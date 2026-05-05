# Blog

Static rebuild of my old [Ghost](https://ghost.org/) blog as an
[Astro](https://astro.build/) site, hosted on GitHub Pages at
[blog.genisisiq.com](https://blog.genisisiq.com).

The original site ran on Ghost for years. This repo holds the migrated content
(54 posts plus a couple of standalone pages), the Astro source that renders
it, and the GitHub Actions workflow that publishes the build.

## Why this exists

- **Get off Ghost.** Stop paying for / maintaining a hosted CMS for a blog
  that is essentially append-only.
- **Own the content.** Posts live as plain Markdown in [content/posts/](content/posts/)
  with front matter preserved (title, slug, date, tags, hero image, etc.).
- **Keep URLs stable.** Slugs and `/assets/posts/{slug}/...` image paths match
  the old Ghost site so existing links keep working.
- **Free hosting.** Built artifacts go to GitHub Pages via Actions; the only
  recurring cost is the domain.

## How the migration was done

1. Exported the Ghost site (JSON + image folders).
2. Converted each post to a Markdown file under `content/posts/{slug}.md`
   with YAML front matter.
3. Moved images into per-post folders under `static/assets/posts/{slug}/`
   and rewrote in-content image URLs to root-relative paths
   (`/assets/posts/{slug}/...`).
4. Removed unreferenced legacy Ghost assets.
5. Wrote a small Astro site under [src/](src/) to render posts, the index,
   tags, the RSS feed, and the sitemap.

## Project layout

```
content/
  posts/      Markdown posts (one file per post, slug = filename)
  pages/      Standalone pages (e.g. about.md)
src/
  pages/      Astro routes: index, [slug], tags/, feed.xml, sitemap.xml
  layouts/    Page/post layouts
  components/ Shared UI
  styles/     CSS
  lib/        Helpers (front matter, post loading, etc.)
static/
  assets/     Images and other static files served at /assets/...
public/       Build output (served by GitHub Pages)
site.config.json             Site title, description, baseUrl, author
astro.config.mjs             Astro config (reads site.config.json)
.github/workflows/pages.yml  Build + deploy workflow
DESIGN.md                    Design tokens / style notes
```

## Development

```bash
npm install
npm run dev       # astro dev on 0.0.0.0
```

## Build

```bash
npm run build     # writes the static site into public/
npm run serve     # serves public/ locally on :8080 via python3 -m http.server
```

Astro is configured with `outDir: ./public` and `publicDir: ./static`, so
`static/assets/...` is published as `/assets/...`.

## Adding a post

Create `content/posts/{slug}.md` with front matter:

```markdown
---
title: "My new post"
slug: "my-new-post"
date: "2026-01-15 10:00:00"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "/assets/posts/my-new-post/hero.jpg"
authors: ["Yingting Huang"]
tags: ["Azure", "Kubernetes"]
---

Body in Markdown.
```

Put images in `static/assets/posts/my-new-post/` and reference them with
root-relative paths:

```markdown
![Topology](/assets/posts/my-new-post/topology.svg)
```

Conventions:
- Use `hero.jpg` or `hero.png` for the post's main image.
- Body images use lowercase, hyphen-separated names
  (e.g. `portal-nsg-rule.png`, `tcp-reset-capture-01.png`).

## Deployment

[.github/workflows/pages.yml](.github/workflows/pages.yml) runs on every push
to `main`:

1. `npm ci`
2. `npm run build`
3. Upload `public/` as the Pages artifact and deploy.

In repository settings, **Pages → Source** must be set to **GitHub Actions**.
The site is served from `https://blog.genisisiq.com/` (custom domain via
[public/CNAME](public/CNAME)) with no `/blog` base path.

## License

Code: MIT (see [package.json](package.json)). Post content: © Yingting Huang.
