import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

const siteConfig = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

const configuredUrl = new URL(siteConfig.baseUrl);
const basePath = configuredUrl.pathname.replace(/\/$/, '');

function prefixRootLinks() {
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      const properties = node.properties;
      if (properties) {
        for (const name of ['href', 'src']) {
          const value = properties[name];
          if (basePath && typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
            properties[name] = `${basePath}${value}`.replace(/\/+/g, '/');
          }
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    visit(tree);
  };
}

function nodeText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.value ?? '';
  if (!Array.isArray(node.children)) return '';
  return node.children.map(nodeText).join('');
}

function normalizeHeadingText(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function frontmatterTitle(file) {
  const dataTitle = file?.data?.astro?.frontmatter?.title ?? file?.data?.frontmatter?.title;
  if (dataTitle) return String(dataTitle);

  const raw = typeof file?.value === 'string' ? file.value : '';
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const title = frontmatter.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))\s*$/m);
  return title ? String(title[1] ?? title[2] ?? title[3]).trim() : '';
}

function removeLeadingTitleHeading() {
  return (tree, file) => {
    const children = Array.isArray(tree.children) ? tree.children : [];
    const firstContentIndex = children.findIndex(
      (child) => !(child.type === 'text' && /^\s*$/.test(child.value ?? ''))
    );
    const firstContent = children[firstContentIndex];
    if (!firstContent || firstContent.type !== 'element' || firstContent.tagName !== 'h1') return;

    const title = normalizeHeadingText(frontmatterTitle(file));
    if (!title || normalizeHeadingText(nodeText(firstContent)) !== title) return;

    children.splice(firstContentIndex, 1);
  };
}

// Wrap solo `<p><img></p>` patterns in `<figure><img><figcaption>{alt}</figcaption></figure>`
// so prose images participate in the FIG. counter and get a real caption.
function wrapImagesInFigure() {
  const isWhitespace = (n) => n.type === 'text' && /^\s*$/.test(n.value);
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (
          child.type === 'element' &&
          child.tagName === 'p' &&
          Array.isArray(child.children)
        ) {
          const meaningful = child.children.filter((c) => !isWhitespace(c));
          if (
            meaningful.length === 1 &&
            meaningful[0].type === 'element' &&
            meaningful[0].tagName === 'img'
          ) {
            const img = meaningful[0];
            const alt = img.properties && img.properties.alt;
            const figureChildren = [img];
            if (alt) {
              figureChildren.push({
                type: 'element',
                tagName: 'figcaption',
                properties: {},
                children: [{ type: 'text', value: String(alt) }]
              });
            }
            node.children[i] = {
              type: 'element',
              tagName: 'figure',
              properties: {},
              children: figureChildren
            };
            continue;
          }
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

export default defineConfig({
  site: siteConfig.baseUrl,
  base: basePath || '/',
  outDir: './public',
  publicDir: './static',
  build: {
    format: 'directory'
  },
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'min-light',
      wrap: true
    },
    rehypePlugins: [removeLeadingTitleHeading, wrapImagesInFigure, prefixRootLinks]
  }
});