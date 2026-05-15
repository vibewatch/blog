import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const deckDir = join(root, 'content/slides');
const limits = {
  titleChars: 92,
  subtitleChars: 180,
  statementChars: 260,
  bulletsPerSlide: 5,
  bulletChars: 132,
  comparisonColumns: 3,
  comparisonBullets: 4,
  tableColumns: 5,
  tableRows: 6,
  codeLines: 16,
  takeaways: 5
};

const errors = [];
let slideCount = 0;

function textLength(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().length;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function add(file, path, message) {
  errors.push(`${file}:${path}: ${message}`);
}

function expectString(file, value, path, maxChars) {
  if (typeof value !== 'string' || value.trim() === '') {
    add(file, path, 'expected a non-empty string');
    return;
  }
  if (maxChars && textLength(value) > maxChars) {
    add(file, path, `too long (${textLength(value)} chars > ${maxChars})`);
  }
}

function expectOptionalString(file, value, path, maxChars) {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    add(file, path, 'expected a string');
    return;
  }
  if (maxChars && textLength(value) > maxChars) {
    add(file, path, `too long (${textLength(value)} chars > ${maxChars})`);
  }
}

function expectStringArray(file, value, path, { maxItems, maxChars } = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    add(file, path, 'expected a non-empty string array');
    return;
  }
  if (maxItems && value.length > maxItems) {
    add(file, path, `too many items (${value.length} > ${maxItems})`);
  }
  value.forEach((item, index) => expectString(file, item, `${path}[${index}]`, maxChars));
}

function validateSlide(file, slide, index, ids) {
  const path = `.slides[${index}]`;
  if (!isRecord(slide)) {
    add(file, path, 'expected an object');
    return;
  }
  expectString(file, slide.id, `${path}.id`, 64);
  if (typeof slide.id === 'string') {
    if (ids.has(slide.id)) add(file, `${path}.id`, `duplicate id "${slide.id}"`);
    ids.add(slide.id);
  }
  expectString(file, slide.title, `${path}.title`, limits.titleChars);
  expectOptionalString(file, slide.kicker, `${path}.kicker`, 60);
  expectOptionalString(file, slide.speakerNotes, `${path}.speakerNotes`, 1400);

  switch (slide.layout) {
    case 'title':
      expectOptionalString(file, slide.subtitle, `${path}.subtitle`, limits.subtitleChars);
      expectOptionalString(file, slide.meta, `${path}.meta`, 120);
      break;
    case 'section':
      expectOptionalString(file, slide.statement, `${path}.statement`, limits.statementChars);
      break;
    case 'statement':
      expectString(file, slide.statement, `${path}.statement`, limits.statementChars);
      if (slide.supports !== undefined) expectStringArray(file, slide.supports, `${path}.supports`, { maxItems: 3, maxChars: 140 });
      break;
    case 'bullets':
      expectOptionalString(file, slide.lede, `${path}.lede`, 180);
      expectStringArray(file, slide.bullets, `${path}.bullets`, { maxItems: limits.bulletsPerSlide, maxChars: limits.bulletChars });
      break;
    case 'comparison':
      if (!Array.isArray(slide.columns) || slide.columns.length === 0) {
        add(file, `${path}.columns`, 'expected at least one column');
        break;
      }
      if (slide.columns.length > limits.comparisonColumns) add(file, `${path}.columns`, `too many columns (${slide.columns.length} > ${limits.comparisonColumns})`);
      slide.columns.forEach((column, columnIndex) => {
        const columnPath = `${path}.columns[${columnIndex}]`;
        if (!isRecord(column)) {
          add(file, columnPath, 'expected an object');
          return;
        }
        expectString(file, column.heading, `${columnPath}.heading`, 52);
        expectOptionalString(file, column.body, `${columnPath}.body`, 160);
        if (column.bullets !== undefined) expectStringArray(file, column.bullets, `${columnPath}.bullets`, { maxItems: limits.comparisonBullets, maxChars: 96 });
      });
      break;
    case 'diagram':
      if (!isRecord(slide.diagram)) {
        add(file, `${path}.diagram`, 'expected a diagram object');
        break;
      }
      expectString(file, slide.diagram.mermaid, `${path}.diagram.mermaid`, 2400);
      expectString(file, slide.diagram.alt, `${path}.diagram.alt`, 180);
      expectOptionalString(file, slide.diagram.caption, `${path}.diagram.caption`, 160);
      if (slide.bullets !== undefined) expectStringArray(file, slide.bullets, `${path}.bullets`, { maxItems: 3, maxChars: 110 });
      break;
    case 'table':
      expectStringArray(file, slide.headers, `${path}.headers`, { maxItems: limits.tableColumns, maxChars: 48 });
      if (!Array.isArray(slide.rows) || slide.rows.length === 0) {
        add(file, `${path}.rows`, 'expected at least one row');
        break;
      }
      if (slide.rows.length > limits.tableRows) add(file, `${path}.rows`, `too many rows (${slide.rows.length} > ${limits.tableRows})`);
      slide.rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row)) {
          add(file, `${path}.rows[${rowIndex}]`, 'expected an array');
          return;
        }
        if (Array.isArray(slide.headers) && row.length !== slide.headers.length) {
          add(file, `${path}.rows[${rowIndex}]`, `expected ${slide.headers.length} cells, got ${row.length}`);
        }
        row.forEach((cell, cellIndex) => expectString(file, cell, `${path}.rows[${rowIndex}][${cellIndex}]`, 96));
      });
      expectOptionalString(file, slide.caption, `${path}.caption`, 160);
      break;
    case 'code':
      expectString(file, slide.code, `${path}.code`, 1800);
      if (typeof slide.code === 'string' && slide.code.split('\n').length > limits.codeLines) {
        add(file, `${path}.code`, `too many lines (${slide.code.split('\n').length} > ${limits.codeLines})`);
      }
      break;
    case 'takeaways':
      expectStringArray(file, slide.items, `${path}.items`, { maxItems: limits.takeaways, maxChars: 130 });
      break;
    default:
      add(file, `${path}.layout`, `unsupported layout "${slide.layout}"`);
  }
}

function validateDeck(file, deck) {
  if (!isRecord(deck)) {
    add(file, '', 'expected a deck object');
    return;
  }
  if (deck.schemaVersion !== 1) add(file, '.schemaVersion', 'expected schemaVersion 1');
  expectString(file, deck.slug, '.slug', 96);
  expectString(file, deck.articleSlug, '.articleSlug', 96);
  expectString(file, deck.title, '.title', 140);
  expectOptionalString(file, deck.subtitle, '.subtitle', 220);

  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    add(file, '.slides', 'expected at least one slide');
    return;
  }
  slideCount += deck.slides.length;
  const ids = new Set();
  deck.slides.forEach((slide, index) => validateSlide(file, slide, index, ids));
}

if (!existsSync(deckDir)) {
  console.log('No slide decks found.');
  process.exit(0);
}

const files = readdirSync(deckDir).filter((file) => file.endsWith('.deck.json')).sort();

for (const file of files) {
  const fullPath = join(deckDir, file);
  try {
    validateDeck(file, JSON.parse(readFileSync(fullPath, 'utf8')));
  } catch (error) {
    add(file, '', error instanceof Error ? error.message : String(error));
  }
}

if (errors.length > 0) {
  console.error(`Slide validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${files.length} slide deck(s), ${slideCount} slide(s).`);
