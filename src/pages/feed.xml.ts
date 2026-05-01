import { getPosts } from '../lib/content';
import { absoluteUrl, config, escapeXml } from '../lib/site';

export async function GET() {
  const items = getPosts().slice(0, 30).map((post) => `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(absoluteUrl(`/${post.slug}/`))}</link>
    <guid>${escapeXml(absoluteUrl(`/${post.slug}/`))}</guid>
    <pubDate>${post.date.toUTCString()}</pubDate>
    <description>${escapeXml(post.excerpt)}</description>
  </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${escapeXml(config.title)}</title>
  <link>${escapeXml(config.baseUrl)}</link>
  <description>${escapeXml(config.description)}</description>
${items}
</channel></rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8'
    }
  });
}