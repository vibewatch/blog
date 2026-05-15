export function slugify(value: string) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export function uniqueSlug(base: string, counts: Map<string, number>) {
  const normalized = slugify(base);
  const seen = counts.get(normalized) ?? 0;
  counts.set(normalized, seen + 1);
  return seen === 0 ? normalized : `${normalized}-${seen + 1}`;
}
