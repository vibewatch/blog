import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDirs = ['content/posts', 'content/pages'];
const errors = [];
const warnings = [];
const referencedAssets = new Set();
const routes = new Set(['/', '/archive/', '/search/', '/tags/', '/desk/', '/series/', '/feed.xml', '/sitemap.xml', '/about/']);

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function parseList(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return [trimmed.replace(/^['"]|['"]$/g, '')].filter(Boolean);
}

function classifyDesk(slug, tags, title) {
  const haystack = `${slug} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/kusto-detective|dspy|harness-engineering|react-agents|english-dictionary|copilot-cli/.test(haystack)) return 'casebook';
  if (/articles-i-collected|business-architecture|architectural-characteristics|migration-checklist|advancements-in-ai|vibe.coding|agent-skills.*security|mcp.*security/.test(haystack)) return 'front';
  if (/load.?balancer|snat|\bnsg\b|\bwaf\b|hub-spoke|openvpn|\bvpn\b|tunnel|backbone|iperf|macvlan|flannel-network|accelerated.?network|\bnic\b|active-active|persistent-ssh/.test(haystack)) return 'networks';
  if (/kubernetes|\bk8s\b|wasm|keda|kafka|podsecurity|ingress|nginx|traefik|prometheus|monitoring|kubeadm|calico|ipvs|\baks\b|host this website|host-this-website|verbose-logging|hpa\b|horizontal-pod/.test(haystack)) return 'cloud-native';

  return 'field';
}

function inferSeries(slug, title, data) {
  const explicit = typeof data.series === 'string' ? data.series.trim() : '';
  if (explicit) return slugify(explicit);

  const kusto = slug.match(/^kusto-detective-agency-case-(\d+)$/);
  if (kusto) return 'kusto-detective-agency';
  if (/openvpn-server-on-azure/.test(slug)) return 'openvpn-on-azure';
  if (/coding-agent|copilot|dspy|react-agents|vibe-coding|english-dictionary/.test(`${slug} ${title}`.toLowerCase())) return 'ai-coding-systems';

  return '';
}

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}

function frontmatter(text, file) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    errors.push(`${file}: missing YAML frontmatter`);
    return { data: {}, body: text };
  }
  const raw = match[1];
  const data = {};
  for (const line of raw.split('\n')) {
    const pair = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (pair) data[pair[1]] = pair[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { data, body: text.slice(match[0].length) };
}

function localAssetExists(urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0];
  if (!clean.startsWith('/')) return true;
  const local = path.join(root, 'static', clean.replace(/^\//, ''));
  return fs.existsSync(local);
}

function routeExists(urlPath) {
  const clean = urlPath.split('#')[0].split('?')[0];
  if (!clean || clean.startsWith('http') || clean.startsWith('mailto:') || clean.startsWith('#')) return true;
  if (!clean.startsWith('/')) return true;
  if (clean.startsWith('/assets/')) return localAssetExists(clean);
  const normalized = clean.endsWith('/') || /\.[a-z0-9]+$/i.test(clean) ? clean : `${clean}/`;
  return routes.has(normalized);
}

function collectStaticFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectStaticFiles(full));
    else out.push(full);
  }
  return out;
}

const files = contentDirs.flatMap(readMarkdownFiles);

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const { data } = frontmatter(text, file);
  const slug = data.slug || path.basename(file, '.md');
  const title = data.title || slug;
  routes.add(`/${slug}/`);

  if (file.startsWith(path.join('content', 'posts'))) {
    const tags = parseList(data.tags);
    for (const tag of tags) routes.add(`/tags/${slugify(tag)}/`);
    routes.add(`/desk/${classifyDesk(slug, tags, title)}/`);

    const series = inferSeries(slug, title, data);
    if (series) routes.add(`/series/${series}/`);
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const { data, body } = frontmatter(text, file);

  for (const key of ['title', 'slug', 'date']) {
    if (!data[key]) errors.push(`${file}: missing required frontmatter field '${key}'`);
  }

  const fileSlug = path.basename(file, '.md');
  if (data.slug && data.slug !== fileSlug) warnings.push(`${file}: slug '${data.slug}' differs from filename '${fileSlug}'`);

  if (data.feature_image) {
    referencedAssets.add(data.feature_image.split('#')[0].split('?')[0]);
    if (!localAssetExists(data.feature_image)) errors.push(`${file}: feature_image does not exist: ${data.feature_image}`);
  }

  for (const match of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const alt = match[1].trim();
    const src = match[2];
    if (!alt) warnings.push(`${file}: image is missing alt text: ${src}`);
    if (src.startsWith('/')) referencedAssets.add(src.split('#')[0].split('?')[0]);
    if (src.startsWith('/') && !localAssetExists(src)) errors.push(`${file}: image does not exist: ${src}`);
  }

  for (const match of body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const src = match[1];
    if (src.startsWith('/')) referencedAssets.add(src.split('#')[0].split('?')[0]);
    if (src.startsWith('/') && !localAssetExists(src)) errors.push(`${file}: image does not exist: ${src}`);
    if (!/\balt=["'][^"']*["']/i.test(match[0])) warnings.push(`${file}: HTML image is missing alt text: ${src}`);
  }

  const ids = new Map();
  for (const match of body.matchAll(/\bid=["']([^"']+)["']/gi)) {
    ids.set(match[1], (ids.get(match[1]) ?? 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) warnings.push(`${file}: duplicate HTML id '${id}' appears ${count} times`);
  }

  for (const match of body.matchAll(/(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const label = match[1].trim();
    const href = match[2];
    if (!label) warnings.push(`${file}: link is missing visible text: ${href}`);
    if (!routeExists(href)) warnings.push(`${file}: internal link may not resolve: ${href}`);
  }
}

const assetRoot = path.join(root, 'static/assets/posts');
const allAssets = collectStaticFiles(assetRoot).map((file) => `/${path.relative(path.join(root, 'static'), file).split(path.sep).join('/')}`);
const orphaned = allAssets.filter((asset) => !referencedAssets.has(asset));
if (orphaned.length) warnings.push(`${orphaned.length} static post assets are not directly referenced by Markdown or feature_image`);

for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);

if (errors.length) {
  console.error(`content validation failed with ${errors.length} error(s) and ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`content validation passed: ${files.length} markdown files, ${warnings.length} warning(s)`);
