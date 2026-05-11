import { buildAssignments, desks, type DeskAssignment, type DeskKey } from './desks';

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
  tags: string[];
  Content: any;
  desk?: DeskAssignment;
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
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    Content: module.default
  };
}

function rawPosts() {
  return Object.entries(postModules)
    .map(([file, module]) => normalize(file, module, 'post'))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

const assignments = buildAssignments(rawPosts());

function withDesk(item: BlogItem): BlogItem {
  return { ...item, desk: assignments.get(item.slug) };
}

export function getPosts() {
  return rawPosts().map(withDesk);
}

export function getPages() {
  return Object.entries(pageModules)
    .map(([file, module]) => normalize(file, module, 'page'))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getAllItems() {
  return [...getPosts(), ...getPages()];
}

export function postsByDesk(): Array<{ deskKey: DeskKey; desk: typeof desks[DeskKey]; posts: BlogItem[] }> {
  const all = getPosts();
  return (Object.keys(desks) as DeskKey[])
    .map((key) => ({
      deskKey: key,
      desk: desks[key],
      posts: all
        .filter((p) => p.desk?.deskKey === key)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    }))
    .filter((g) => g.posts.length > 0);
}