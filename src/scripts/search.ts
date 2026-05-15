import { slugify } from '../lib/slug';

type SearchItem = {
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  date: string;
  year: number;
  readingTime: number;
  desk: string;
  deskKey: string;
  sectionId: string;
  tags: string[];
  series: string;
  headings: string[];
  text: string;
};

const form = document.querySelector<HTMLFormElement>('[data-search-form]');
const queryInput = document.querySelector<HTMLInputElement>('[data-search-query]');
const deskInput = document.querySelector<HTMLSelectElement>('[data-search-desk]');
const tagInput = document.querySelector<HTMLSelectElement>('[data-search-tag]');
const status = document.querySelector<HTMLElement>('[data-search-status]');
const results = document.querySelector<HTMLOListElement>('[data-search-results]');

if (form && queryInput && deskInput && tagInput && status && results) {
  const formatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
  let index: SearchItem[] = [];

  const params = new URLSearchParams(window.location.search);
  queryInput.value = params.get('q') ?? '';
  deskInput.value = params.get('desk') ?? '';
  tagInput.value = params.get('tag') ?? '';

  fetch(form.dataset.searchIndex || '/search-index.json')
    .then((response) => response.json())
    .then((payload: { items: SearchItem[] }) => {
      index = payload.items;
      render();
    })
    .catch(() => {
      status.textContent = 'The search index could not be loaded.';
    });

  form.addEventListener('input', () => render());
  form.addEventListener('submit', (event) => event.preventDefault());

  function score(item: SearchItem, terms: string[]) {
    if (terms.length === 0) return 1;
    const title = item.title.toLowerCase();
    const haystack = item.text.toLowerCase();
    let value = 0;
    for (const term of terms) {
      if (title.includes(term)) value += 8;
      if (item.excerpt.toLowerCase().includes(term)) value += 4;
      if (item.tags.some((tag) => tag.toLowerCase().includes(term))) value += 4;
      if (item.headings.some((heading) => heading.toLowerCase().includes(term))) value += 3;
      if (haystack.includes(term)) value += 1;
    }
    return value;
  }

  function render() {
    const query = queryInput.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const desk = deskInput.value;
    const tag = tagInput.value;

    const nextUrl = new URL(window.location.href);
    nextUrl.search = '';
    if (query) nextUrl.searchParams.set('q', query);
    if (desk) nextUrl.searchParams.set('desk', desk);
    if (tag) nextUrl.searchParams.set('tag', tag);
    window.history.replaceState({}, '', nextUrl);

    const matches = index
      .map((item) => ({ item, score: score(item, terms) }))
      .filter(({ item, score }) => score > 0 && (!desk || item.deskKey === desk) && (!tag || item.tags.some((itemTag) => slugify(itemTag) === tag)))
      .sort((a, b) => b.score - a.score || Date.parse(b.item.date) - Date.parse(a.item.date))
      .slice(0, 40);

    status.textContent = matches.length === 1 ? '1 dispatch found' : `${matches.length} dispatches found`;
    results.replaceChildren(
      ...matches.map(({ item }) => {
        const row = document.createElement('li');
        row.className = 'search-result';
        row.innerHTML = `
          <a href="${item.url}">
            <span class="search-result__id">${escapeHtml(item.sectionId || item.desk)}</span>
            <span class="search-result__body">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.excerpt || item.headings.slice(0, 2).join(' / '))}</span>
              <em>${escapeHtml([item.desk, item.series, item.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</em>
            </span>
            <time datetime="${item.date}">${formatter.format(new Date(item.date))}</time>
          </a>`;
        return row;
      })
    );
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char] ?? char);
}
