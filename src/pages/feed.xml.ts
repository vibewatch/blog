import { getPosts } from '../lib/content';
import { absoluteUrl, config, escapeXml } from '../lib/site';

function cdata(value: string) {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export async function GET() {
  const items = getPosts().slice(0, 30).map((post) => {
    const body = post.excerpt || `${post.plainText.slice(0, 800)}${post.plainText.length > 800 ? '...' : ''}`;
    const categories = post.tags.map((tag) => `    <category>${escapeXml(tag)}</category>`).join('\n');
    return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(absoluteUrl(`/${post.slug}/`))}</link>
    <guid>${escapeXml(absoluteUrl(`/${post.slug}/`))}</guid>
    <pubDate>${post.date.toUTCString()}</pubDate>
    <dc:creator>${escapeXml(post.authors[0] ?? config.author)}</dc:creator>
${categories}
    <description>${escapeXml(post.excerpt)}</description>
    <content:encoded>${cdata(`<p>${escapeXml(body)}</p><p><a href="${escapeXml(absoluteUrl(`/${post.slug}/`))}">Read the full dispatch</a></p>`)}</content:encoded>
  </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
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