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
- Put long explanations, caveats, and citations in `speakerNotes`, not on the visible slide.
- Embed Mermaid source directly in `diagram.mermaid`; the renderer turns it into SVG at runtime using the site's shared Mermaid theme.

## Procedure

1. Read the source article from `content/posts/<post-slug>.md`.
2. Build a presentation outline with one idea per slide.
3. Convert large sections into concise layouts:
   - `statement` for the core thesis.
   - `bullets` for short tactical points.
   - `comparison` for provider or architecture tradeoffs.
   - `table` only for small tables, max 5 columns and 6 rows.
   - `diagram` with inline Mermaid source for flowcharts.
   - `takeaways` for closing slides.
4. Do not paste long article paragraphs directly into visible slide fields.
5. Move raw citations, caveats, and presenter explanations into `speakerNotes`.
6. For Mermaid diagrams, copy the source from the article and trim it for slide scale: short node labels, `<br/>` for line breaks, and total source under ~2400 characters.
7. Run `npm run slides:validate` and fix every failure before considering the deck complete.
8. Run `npm run build` to verify the Astro route compiles.

## Slide Budget Rules

- Titles should stay under 92 characters.
- Bullet slides should have at most 5 bullets.
- Each bullet should be under 132 characters.
- Comparison slides should have at most 3 columns.
- Tables should be reduced to highlights; oversized source tables belong in notes or appendix.
- Code slides should show only the critical excerpt.

## Stability Rules

- The renderer should not rescue overstuffed slides with tiny fonts.
- If a slide feels crowded, split it or move material to notes.
- Mermaid runs once per page load through the shared `src/scripts/mermaid.ts`; keep diagrams compact so they fit a 16:9 frame at large type.
- Preserve a link back to the source article through `articleSlug`.
