import { getPosts } from '../lib/content';
import { sitePath } from '../lib/site';

export async function GET() {
  const items = getPosts().map((post) => ({
    title: post.title,
    slug: post.slug,
    url: sitePath(`/${post.slug}/`),
    excerpt: post.excerpt,
    date: post.date.toISOString(),
    year: post.date.getFullYear(),
    readingTime: post.readingTime,
    desk: post.desk?.desk.name ?? 'Dispatch',
    deskKey: post.desk?.deskKey ?? '',
    sectionId: post.desk?.sectionId ?? '',
    tags: post.tags,
    series: post.series?.name ?? '',
    headings: post.headings.map((heading) => heading.text),
    text: post.searchText
  }));

  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), items }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
