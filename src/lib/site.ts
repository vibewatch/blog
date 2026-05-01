import siteConfig from '../../site.config.json';

const configuredUrl = new URL(siteConfig.baseUrl);
export const siteOrigin = configuredUrl.origin;
export const basePath = configuredUrl.pathname.replace(/\/$/, '');

export const config = siteConfig;

export function sitePath(urlPath: string) {
  if (/^https?:\/\//.test(urlPath)) return urlPath;
  const normalized = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return `${basePath}${normalized}`.replace(/\/+/g, '/');
}

export function absoluteUrl(urlPath: string) {
  return `${siteOrigin}${sitePath(urlPath)}`;
}

export function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}