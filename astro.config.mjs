import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

const siteConfig = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

const configuredUrl = new URL(siteConfig.baseUrl);
const base = configuredUrl.pathname.replace(/\/$/, '');

function prefixRootLinks() {
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      const properties = node.properties;
      if (properties) {
        for (const name of ['href', 'src']) {
          const value = properties[name];
          if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
            properties[name] = `${base}${value}`.replace(/\/+/g, '/');
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

export default defineConfig({
  site: siteConfig.baseUrl,
  base,
  outDir: './public',
  publicDir: './static',
  build: {
    format: 'directory'
  },
  markdown: {
    syntaxHighlight: false,
    rehypePlugins: [prefixRootLinks]
  }
});