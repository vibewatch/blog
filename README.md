# Blog

Minimal Astro blog generated from the old Ghost backup. The site renders
Markdown from `content/posts/` and `content/pages/`, uses a small editorial
style inspired by `bizidea.genisisiq.com`, and writes the final build to
`public/` for GitHub Pages.

## Development

```bash
npm install
npm run dev
```

## Build static site

```bash
npm run build
npm run serve
```

Astro generates the site into `public/`. Static images live under
`static/assets/` and are published as `/assets/...`.

## Images

Store new article images under `static/assets/posts/{post-slug}/` and reference
them from Markdown with root-relative paths:

```markdown
![Azure topology](/assets/posts/azure-load-balancer-snat-behavior-explained/topology.svg)
```

Use `hero.jpg` or `hero.png` for a post's main image. Use lowercase,
hyphen-separated names for body images, for example `portal-nsg-rule.png` or
`tcp-reset-capture-01.png`.

Images imported from the old Ghost site were migrated into per-post folders
under `static/assets/posts/`. Unreferenced legacy Ghost files were removed.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds the Astro site and deploys `public/` to GitHub Pages.

Set Pages source to **GitHub Actions** in the repository settings.
