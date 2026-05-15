export type SlideLayout =
  | 'title'
  | 'section'
  | 'statement'
  | 'bullets'
  | 'comparison'
  | 'diagram'
  | 'table'
  | 'code'
  | 'takeaways';

export type SlideSource = {
  article?: string;
  section?: string;
  refs?: string[];
};

export type BaseSlide = {
  id: string;
  layout: SlideLayout;
  title: string;
  kicker?: string;
  speakerNotes?: string;
  appendix?: boolean;
  source?: SlideSource;
};

export type TitleSlide = BaseSlide & {
  layout: 'title';
  subtitle?: string;
  meta?: string;
};

export type SectionSlide = BaseSlide & {
  layout: 'section';
  statement?: string;
};

export type StatementSlide = BaseSlide & {
  layout: 'statement';
  statement: string;
  supports?: string[];
};

export type BulletsSlide = BaseSlide & {
  layout: 'bullets';
  lede?: string;
  bullets: string[];
};

export type ComparisonColumn = {
  heading: string;
  body?: string;
  bullets?: string[];
};

export type ComparisonSlide = BaseSlide & {
  layout: 'comparison';
  columns: ComparisonColumn[];
};

export type DiagramSlide = BaseSlide & {
  layout: 'diagram';
  diagram: {
    mermaid: string;
    alt: string;
    caption?: string;
  };
  bullets?: string[];
};

export type TableSlide = BaseSlide & {
  layout: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
};

export type CodeSlide = BaseSlide & {
  layout: 'code';
  language?: string;
  code: string;
  highlights?: number[];
};

export type TakeawaysSlide = BaseSlide & {
  layout: 'takeaways';
  items: string[];
};

export type Slide =
  | TitleSlide
  | SectionSlide
  | StatementSlide
  | BulletsSlide
  | ComparisonSlide
  | DiagramSlide
  | TableSlide
  | CodeSlide
  | TakeawaysSlide;

export type SlideDeck = {
  schemaVersion: 1;
  slug: string;
  articleSlug: string;
  title: string;
  subtitle?: string;
  date?: string;
  theme?: string;
  slides: Slide[];
};

export const SLIDE_LIMITS = {
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
} as const;

type ValidationContext = {
  label: string;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textLength(value: unknown): number {
  return String(value ?? '').replace(/\s+/g, ' ').trim().length;
}

function fail(ctx: ValidationContext, path: string, message: string) {
  ctx.errors.push(`${ctx.label}:${path}: ${message}`);
}

function expectString(ctx: ValidationContext, value: unknown, path: string, maxChars?: number) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(ctx, path, 'expected a non-empty string');
    return;
  }
  if (maxChars && textLength(value) > maxChars) {
    fail(ctx, path, `too long (${textLength(value)} chars > ${maxChars})`);
  }
}

function expectOptionalString(ctx: ValidationContext, value: unknown, path: string, maxChars?: number) {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    fail(ctx, path, 'expected a string');
    return;
  }
  if (maxChars && textLength(value) > maxChars) {
    fail(ctx, path, `too long (${textLength(value)} chars > ${maxChars})`);
  }
}

function expectStringArray(
  ctx: ValidationContext,
  value: unknown,
  path: string,
  options: { maxItems?: number; maxChars?: number } = {}
) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(ctx, path, 'expected a non-empty string array');
    return;
  }
  if (options.maxItems && value.length > options.maxItems) {
    fail(ctx, path, `too many items (${value.length} > ${options.maxItems})`);
  }
  value.forEach((item, index) => expectString(ctx, item, `${path}[${index}]`, options.maxChars));
}

function validateBaseSlide(ctx: ValidationContext, slide: Record<string, unknown>, path: string) {
  expectString(ctx, slide.id, `${path}.id`, 64);
  expectString(ctx, slide.title, `${path}.title`, SLIDE_LIMITS.titleChars);
  expectOptionalString(ctx, slide.kicker, `${path}.kicker`, 60);
  expectOptionalString(ctx, slide.speakerNotes, `${path}.speakerNotes`, 1400);
  if (slide.appendix !== undefined && typeof slide.appendix !== 'boolean') {
    fail(ctx, `${path}.appendix`, 'expected a boolean');
  }
}

function validateSlide(ctx: ValidationContext, slide: unknown, index: number) {
  const path = `.slides[${index}]`;
  if (!isRecord(slide)) {
    fail(ctx, path, 'expected an object');
    return;
  }
  validateBaseSlide(ctx, slide, path);
  const layout = slide.layout;
  if (typeof layout !== 'string') {
    fail(ctx, `${path}.layout`, 'expected a layout string');
    return;
  }

  switch (layout) {
    case 'title':
      expectOptionalString(ctx, slide.subtitle, `${path}.subtitle`, SLIDE_LIMITS.subtitleChars);
      expectOptionalString(ctx, slide.meta, `${path}.meta`, 120);
      break;
    case 'section':
      expectOptionalString(ctx, slide.statement, `${path}.statement`, SLIDE_LIMITS.statementChars);
      break;
    case 'statement':
      expectString(ctx, slide.statement, `${path}.statement`, SLIDE_LIMITS.statementChars);
      if (slide.supports !== undefined) {
        expectStringArray(ctx, slide.supports, `${path}.supports`, { maxItems: 3, maxChars: 140 });
      }
      break;
    case 'bullets':
      expectOptionalString(ctx, slide.lede, `${path}.lede`, 180);
      expectStringArray(ctx, slide.bullets, `${path}.bullets`, {
        maxItems: SLIDE_LIMITS.bulletsPerSlide,
        maxChars: SLIDE_LIMITS.bulletChars
      });
      break;
    case 'comparison':
      if (!Array.isArray(slide.columns) || slide.columns.length === 0) {
        fail(ctx, `${path}.columns`, 'expected at least one column');
        break;
      }
      if (slide.columns.length > SLIDE_LIMITS.comparisonColumns) {
        fail(ctx, `${path}.columns`, `too many columns (${slide.columns.length} > ${SLIDE_LIMITS.comparisonColumns})`);
      }
      slide.columns.forEach((column, columnIndex) => {
        const columnPath = `${path}.columns[${columnIndex}]`;
        if (!isRecord(column)) {
          fail(ctx, columnPath, 'expected a column object');
          return;
        }
        expectString(ctx, column.heading, `${columnPath}.heading`, 52);
        expectOptionalString(ctx, column.body, `${columnPath}.body`, 160);
        if (column.bullets !== undefined) {
          expectStringArray(ctx, column.bullets, `${columnPath}.bullets`, {
            maxItems: SLIDE_LIMITS.comparisonBullets,
            maxChars: 96
          });
        }
      });
      break;
    case 'diagram':
      if (!isRecord(slide.diagram)) {
        fail(ctx, `${path}.diagram`, 'expected a diagram object');
        break;
      }
      expectString(ctx, slide.diagram.mermaid, `${path}.diagram.mermaid`, 2400);
      expectString(ctx, slide.diagram.alt, `${path}.diagram.alt`, 180);
      expectOptionalString(ctx, slide.diagram.caption, `${path}.diagram.caption`, 160);
      if (slide.bullets !== undefined) {
        expectStringArray(ctx, slide.bullets, `${path}.bullets`, { maxItems: 3, maxChars: 110 });
      }
      break;
    case 'table':
      expectStringArray(ctx, slide.headers, `${path}.headers`, { maxItems: SLIDE_LIMITS.tableColumns, maxChars: 48 });
      if (!Array.isArray(slide.rows) || slide.rows.length === 0) {
        fail(ctx, `${path}.rows`, 'expected at least one row');
        break;
      }
      if (slide.rows.length > SLIDE_LIMITS.tableRows) {
        fail(ctx, `${path}.rows`, `too many rows (${slide.rows.length} > ${SLIDE_LIMITS.tableRows})`);
      }
      slide.rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row)) {
          fail(ctx, `${path}.rows[${rowIndex}]`, 'expected a row array');
          return;
        }
        if (Array.isArray(slide.headers) && row.length !== slide.headers.length) {
          fail(ctx, `${path}.rows[${rowIndex}]`, `expected ${slide.headers.length} cells, got ${row.length}`);
        }
        row.forEach((cell, cellIndex) => expectString(ctx, cell, `${path}.rows[${rowIndex}][${cellIndex}]`, 96));
      });
      expectOptionalString(ctx, slide.caption, `${path}.caption`, 160);
      break;
    case 'code': {
      expectString(ctx, slide.code, `${path}.code`, 1800);
      const lineCount = typeof slide.code === 'string' ? slide.code.split('\n').length : 0;
      if (lineCount > SLIDE_LIMITS.codeLines) {
        fail(ctx, `${path}.code`, `too many lines (${lineCount} > ${SLIDE_LIMITS.codeLines})`);
      }
      expectOptionalString(ctx, slide.language, `${path}.language`, 24);
      break;
    }
    case 'takeaways':
      expectStringArray(ctx, slide.items, `${path}.items`, { maxItems: SLIDE_LIMITS.takeaways, maxChars: 130 });
      break;
    default:
      fail(ctx, `${path}.layout`, `unsupported layout "${layout}"`);
  }
}

export function validateSlideDeck(input: unknown, label = 'deck'): SlideDeck {
  const ctx: ValidationContext = { label, errors: [] };
  if (!isRecord(input)) {
    throw new Error(`${label}: expected a deck object`);
  }

  if (input.schemaVersion !== 1) fail(ctx, '.schemaVersion', 'expected schemaVersion 1');
  expectString(ctx, input.slug, '.slug', 96);
  expectString(ctx, input.articleSlug, '.articleSlug', 96);
  expectString(ctx, input.title, '.title', 140);
  expectOptionalString(ctx, input.subtitle, '.subtitle', 220);
  expectOptionalString(ctx, input.date, '.date', 32);
  expectOptionalString(ctx, input.theme, '.theme', 48);

  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    fail(ctx, '.slides', 'expected at least one slide');
  } else {
    const ids = new Set<string>();
    input.slides.forEach((slide, index) => {
      if (isRecord(slide) && typeof slide.id === 'string') {
        if (ids.has(slide.id)) fail(ctx, `.slides[${index}].id`, `duplicate id "${slide.id}"`);
        ids.add(slide.id);
      }
      validateSlide(ctx, slide, index);
    });
  }

  if (ctx.errors.length > 0) {
    throw new Error(ctx.errors.join('\n'));
  }

  return input as SlideDeck;
}
