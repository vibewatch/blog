---
name: blog-to-slides
description: "Convert Astro blog posts into stable HTML presentation slides. Use when: blog to slides, article to deck, presentation renderer, inline Mermaid, deck JSON, slide overflow, speaker notes."
argument-hint: "<post-slug>"
---

# Blog to Slides

Use this skill to convert a long-form blog article in `content/posts/` into a stable Astro slide deck in `content/slides/`.

## Output Contract

- Write one deck file at `content/slides/<post-slug>.deck.json`.
- Follow the schema implemented in `src/lib/slides/schema.ts`.
- Reuse the Astro renderer at `/slides/<post-slug>/`.
- Treat `<post-slug>` as the public article slug: use frontmatter `slug` when it exists, not necessarily the markdown filename.
- Keep the deck filename slug and top-level `slug` identical; set `articleSlug` to the public source article slug.
- Preserve important article figures and screenshots with `layout: "image"`; use the original public image path in `image.src`.
- Put long explanations, caveats, and citations in `speakerNotes`, not on the visible slide.
- Embed Mermaid source directly in `diagram.mermaid`; the renderer turns it into SVG at runtime using the site's shared Mermaid theme.

## Procedure

1. Resolve the source article:
   - First try `content/posts/<post-slug>.md`.
   - If it does not exist, search `content/posts/*.md` for frontmatter `slug: "<post-slug>"`.
   - Use the resolved public slug for the deck filename, `slug`, `articleSlug`, route, and links.
2. Read at least one existing deck in `content/slides/` as a style and density reference.
3. Read the source article and list its tables, Mermaid diagrams, and images before building the outline.
4. Convert large sections into concise layouts:
   - `statement` for the core thesis.
   - `bullets` for short tactical points.
   - `comparison` for provider or architecture tradeoffs.
   - `table` only for small tables, max 5 columns and 6 rows.
   - `diagram` with inline Mermaid source for flowcharts.
   - `image` for charts, screenshots, architecture exports, or other important article figures.
   - `takeaways` for closing slides.
5. Do not paste long article paragraphs directly into visible slide fields.
6. Move raw citations, caveats, and presenter explanations into `speakerNotes`.
7. For image slides, copy the article image path, write descriptive alt text, and keep visible bullets to at most three short observations. Local image paths must be root-relative (for example `/assets/posts/.../chart.png`) and resolve under `static/`.
8. For Mermaid diagrams, copy the source from the article and trim it for slide scale: short node labels, `<br/>` for line breaks, and total source under ~2400 characters.
9. Run `npm run slides:validate` and fix every failure before considering the deck complete.
10. Run `npm run build` to verify the Astro route compiles.

## Slide Budget Rules

- Titles should stay under 92 characters.
- Slide IDs must be unique within the deck, kebab-case, and under 64 characters.
- Bullet slides should have at most 5 bullets.
- Each bullet should be under 132 characters.
- Comparison slides should have at most 3 columns.
- Tables should be reduced to highlights; oversized source tables belong in notes or appendix.
- Image slides should show one image, one concise caption, and at most 3 bullets.
- Code slides should show only the critical excerpt.
- Speaker notes should be concise presenter prompts: aim for 600–900 characters, never above the validator's 1400-character limit.

## Stability Rules

- The renderer should not rescue overstuffed slides with tiny fonts.
- If a slide feels crowded, split it or move material to notes.
- Mermaid runs once per page load through the shared `src/scripts/mermaid.ts`; keep diagrams compact so they fit a 16:9 frame at large type.
- Do not ignore article images that carry evidence; include them as `image` slides or explicitly explain in notes why they are omitted.
- Preserve a link back to the source article through `articleSlug`.
