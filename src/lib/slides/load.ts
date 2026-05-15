import { validateSlideDeck, type SlideDeck } from './schema';

const deckModules = import.meta.glob('../../../content/slides/*.deck.json', {
  eager: true,
  import: 'default'
});

let cachedDecks: SlideDeck[] | undefined;

function fileLabel(file: string) {
  return file.split('/').pop() ?? file;
}

export function getSlideDecks(): SlideDeck[] {
  if (!cachedDecks) {
    cachedDecks = Object.entries(deckModules)
      .map(([file, module]) => validateSlideDeck(module, fileLabel(file)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  return cachedDecks;
}

export function getSlideDeck(slug: string): SlideDeck | undefined {
  return getSlideDecks().find((deck) => deck.slug === slug);
}

export function getSlideDeckByArticle(articleSlug: string): SlideDeck | undefined {
  return getSlideDecks().find((deck) => deck.articleSlug === articleSlug);
}
