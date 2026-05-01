type MarkdownModule = {
  frontmatter: Record<string, any>;
  default: any;
};

export type BlogItem = {
  title: string;
  slug: string;
  date: Date;
  type: 'post' | 'page';
  excerpt: string;
  featureImage: string;
  authors: string[];
  Content: any;
};

const postModules = import.meta.glob<MarkdownModule>('../../content/posts/*.md', { eager: true });
const pageModules = import.meta.glob<MarkdownModule>('../../content/pages/*.md', { eager: true });

function fileSlug(file: string) {
  return file.split('/').pop()?.replace(/\.md$/, '') ?? '';
}

function normalize(file: string, module: MarkdownModule, fallbackType: 'post' | 'page'): BlogItem {
  const data = module.frontmatter ?? {};
  return {
    title: String(data.title ?? fileSlug(file)),
    slug: String(data.slug ?? fileSlug(file)),
    date: data.date ? new Date(data.date) : new Date(0),
    type: data.type === 'page' ? 'page' : fallbackType,
    excerpt: String(data.excerpt ?? ''),
    featureImage: String(data.feature_image ?? ''),
    authors: Array.isArray(data.authors) ? data.authors.map(String) : [],
    Content: module.default
  };
}

export function getPosts() {
  return Object.entries(postModules)
    .map(([file, module]) => normalize(file, module, 'post'))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getPages() {
  return Object.entries(pageModules)
    .map(([file, module]) => normalize(file, module, 'page'))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getAllItems() {
  return [...getPosts(), ...getPages()];
}