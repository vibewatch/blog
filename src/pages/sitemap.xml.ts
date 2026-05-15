import { getAllItems, getDeskGroups, getSeriesGroups, getTagGroups } from '../lib/content';
import { absoluteUrl, escapeXml } from '../lib/site';

export async function GET() {
  const staticUrls = ['/', '/archive/', '/search/', '/tags/', '/desk/', '/series/'];
  const urls = [
    ...staticUrls.map((url) => ({ url })),
    ...getAllItems().map((item) => ({ url: `/${item.slug}/`, lastmod: item.date.toISOString() })),
    ...getTagGroups().map((tag) => ({ url: `/tags/${tag.slug}/`, lastmod: tag.posts[0]?.date.toISOString() })),
    ...getDeskGroups().map((desk) => ({ url: `/desk/${desk.slug}/`, lastmod: desk.posts[0]?.date.toISOString() })),
    ...getSeriesGroups().map((series) => ({ url: `/series/${series.slug}/`, lastmod: series.posts.at(-1)?.date.toISOString() }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url><loc>${escapeXml(absoluteUrl(entry.url))}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}