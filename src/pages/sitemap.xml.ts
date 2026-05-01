import { getAllItems } from '../lib/content';
import { absoluteUrl, escapeXml } from '../lib/site';

export async function GET() {
  const urls = [
    '/',
    ...getAllItems().map((item) => `/${item.slug}/`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(absoluteUrl(url))}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}