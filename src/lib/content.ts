import { buildAssignments, desks, type DeskAssignment, type DeskKey } from './desks';
import { slugify, uniqueSlug } from './slug';

type MarkdownModule = {
  frontmatter: Record<string, any>;
  default: any;
  rawContent?: () => string;
  compiledContent?: () => string;
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
  series?: SeriesInfo;
  headings: Heading[];
  plainText: string;
  searchText: string;
  Content: any;
  readingTime: number;
  desk?: DeskAssignment;
};

export type Heading = {
  depth: 2 | 3;
  text: string;
  slug: string;
};

export type SeriesInfo = {
  name: string;
  slug: string;
  order?: number;
};

export type TagGroup = {
  name: string;
  slug: string;
  posts: BlogItem[];
};

export type SeriesGroup = {
  name: string;
  slug: string;
  posts: BlogItem[];
};

export type PostContext = {
  newer?: BlogItem;
  older?: BlogItem;
  related: BlogItem[];
  seriesPosts: BlogItem[];
};

const postModules = import.meta.glob<MarkdownModule>('../../content/posts/*.md', { eager: true });
const pageModules = import.meta.glob<MarkdownModule>('../../content/pages/*.md', { eager: true });

function fileSlug(file: string) {
  return file.split('/').pop()?.replace(/\.md$/, '') ?? '';
}

function estimateReadingTime(module: MarkdownModule): number {
  const raw = moduleText(module);
  // Word count: split on whitespace for latin words; add CJK char count for
  // east-asian content (each character is roughly one word's reading load).
  const latinWords = (raw.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || []).length;
  const cjkChars = (raw.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const effective = latinWords + cjkChars / 2;
  return Math.max(1, Math.round(effective / 220));
}

function moduleText(module: MarkdownModule) {
  if (typeof module.rawContent === 'function') return module.rawContent();
  if (typeof module.compiledContent === 'function') {
    return module.compiledContent().replace(/<[^>]+>/g, ' ');
  }
  return '';
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainText(module: MarkdownModule) {
  return stripMarkdown(moduleText(module));
}

function extractHeadings(module: MarkdownModule): Heading[] {
  const raw = moduleText(module).replace(/```[\s\S]*?```/g, '');
  const counts = new Map<string, number>();
  return [...raw.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((match) => {
    const text = stripMarkdown(match[2]);
    return {
      depth: match[1].length as 2 | 3,
      text,
      slug: uniqueSlug(text, counts)
    };
  });
}

function inferSeries(slug: string, title: string, data: Record<string, any>): SeriesInfo | undefined {
  const explicit = typeof data.series === 'string' ? data.series.trim() : '';
  const explicitOrder = Number(data.seriesOrder ?? data.series_order);
  if (explicit) {
    return {
      name: explicit,
      slug: slugify(explicit),
      order: Number.isFinite(explicitOrder) ? explicitOrder : undefined
    };
  }

  const kusto = slug.match(/^kusto-detective-agency-case-(\d+)$/);
  if (kusto) {
    return {
      name: 'Kusto Detective Agency',
      slug: 'kusto-detective-agency',
      order: Number(kusto[1])
    };
  }

  if (/openvpn-server-on-azure/.test(slug)) {
    return {
      name: 'OpenVPN on Azure',
      slug: 'openvpn-on-azure',
      order: /updated/.test(slug) ? 2 : 1
    };
  }

  if (/coding-agent|copilot|dspy|react-agents|vibe-coding|english-dictionary/.test(`${slug} ${title}`.toLowerCase())) {
    return {
      name: 'AI Coding Systems',
      slug: 'ai-coding-systems'
    };
  }

  return undefined;
}

function normalize(file: string, module: MarkdownModule, fallbackType: 'post' | 'page'): BlogItem {
  const data = module.frontmatter ?? {};
  const text = plainText(module);
  const title = String(data.title ?? fileSlug(file));
  const slug = String(data.slug ?? fileSlug(file));
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  const excerpt = String(data.excerpt ?? '');
  return {
    title,
    slug,
    date: data.date ? new Date(data.date) : new Date(0),
    type: data.type === 'page' ? 'page' : fallbackType,
    excerpt,
    featureImage: String(data.feature_image ?? ''),
    authors: Array.isArray(data.authors) ? data.authors.map(String) : [],
    tags,
    series: fallbackType === 'post' ? inferSeries(slug, title, data) : undefined,
    headings: extractHeadings(module),
    plainText: text,
    searchText: [title, excerpt, tags.join(' '), text].filter(Boolean).join(' '),
    Content: module.default,
    readingTime: estimateReadingTime(module)
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

export function getDeskGroups() {
  return postsByDesk().map((group) => ({
    ...group,
    slug: group.deskKey
  }));
}

export function getDeskGroup(slug: string) {
  return getDeskGroups().find((group) => group.slug === slug);
}

export function getTagGroups(): TagGroup[] {
  const bySlug = new Map<string, TagGroup>();
  for (const post of getPosts()) {
    for (const tag of post.tags) {
      const slug = slugify(tag);
      const group = bySlug.get(slug) ?? { name: tag, slug, posts: [] };
      group.posts.push(post);
      bySlug.set(slug, group);
    }
  }
  return [...bySlug.values()]
    .map((group) => ({
      ...group,
      posts: group.posts.sort((a, b) => b.date.getTime() - a.date.getTime())
    }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

export function getTagGroup(slug: string) {
  return getTagGroups().find((group) => group.slug === slug);
}

export function getSeriesGroups(): SeriesGroup[] {
  const bySlug = new Map<string, SeriesGroup>();
  for (const post of getPosts()) {
    if (!post.series) continue;
    const group = bySlug.get(post.series.slug) ?? { name: post.series.name, slug: post.series.slug, posts: [] };
    group.posts.push(post);
    bySlug.set(post.series.slug, group);
  }
  return [...bySlug.values()]
    .map((group) => ({
      ...group,
      posts: group.posts.sort((a, b) => {
        const orderA = a.series?.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.series?.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.date.getTime() - b.date.getTime();
      })
    }))
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

export function getSeriesGroup(slug: string) {
  return getSeriesGroups().find((group) => group.slug === slug);
}

function relatedScore(post: BlogItem, candidate: BlogItem) {
  let score = 0;
  if (post.desk?.deskKey && post.desk.deskKey === candidate.desk?.deskKey) score += 5;
  if (post.series?.slug && post.series.slug === candidate.series?.slug) score += 8;
  const postTags = new Set(post.tags.map((tag) => slugify(tag)));
  for (const tag of candidate.tags) {
    if (postTags.has(slugify(tag))) score += 3;
  }
  const postWords = new Set(slugify(post.title).split('-').filter((word) => word.length > 3));
  for (const word of slugify(candidate.title).split('-')) {
    if (postWords.has(word)) score += 1;
  }
  return score;
}

export function getPostContext(slug: string): PostContext {
  const posts = getPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  const post = posts[index];
  if (!post) return { related: [], seriesPosts: [] };

  const related = posts
    .filter((candidate) => candidate.slug !== slug)
    .map((candidate) => ({ candidate, score: relatedScore(post, candidate) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.candidate.date.getTime() - a.candidate.date.getTime())
    .slice(0, 3)
    .map((item) => item.candidate);

  const seriesPosts = post.series
    ? getSeriesGroup(post.series.slug)?.posts.filter((candidate) => candidate.slug !== slug) ?? []
    : [];

  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
    related,
    seriesPosts
  };
}