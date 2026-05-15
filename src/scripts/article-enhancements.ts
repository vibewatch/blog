const article = document.querySelector<HTMLElement>('.article');
const progress = document.querySelector<HTMLElement>('[data-reading-progress]');

if (article && progress) {
  const updateProgress = () => {
    const rect = article.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    const read = Math.min(1, Math.max(0, -rect.top / scrollable));
    progress.style.transform = `scaleX(${read})`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
}

const toc = document.querySelector<HTMLElement>('[data-toc]');
if (article && toc) {
  const links = new Map<string, HTMLAnchorElement>();
  toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    const id = decodeURIComponent(link.hash.slice(1));
    if (id) links.set(id, link);
  });

  const activate = (id: string) => {
    links.forEach((link) => link.removeAttribute('aria-current'));
    links.get(id)?.setAttribute('aria-current', 'true');
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) activate(visible.target.id);
    },
    { rootMargin: '-20% 0px -65% 0px', threshold: 0.01 }
  );

  article.querySelectorAll<HTMLElement>('h2[id], h3[id]').forEach((heading) => observer.observe(heading));
}

const figures = Array.from(document.querySelectorAll<HTMLImageElement>('.article figure img, .article > img, .feature-image'))
  .filter((img) => img.currentSrc || img.src);

if (figures.length > 0) {
  const dialog = document.createElement('dialog');
  dialog.className = 'image-lightbox';
  dialog.innerHTML = `
    <div class="image-lightbox__bar">
      <span data-lightbox-counter></span>
      <div class="image-lightbox__actions">
        <button type="button" data-action="copy">Copy link</button>
        <button type="button" data-action="prev">Prev</button>
        <button type="button" data-action="next">Next</button>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
    <figure>
      <img alt="" data-lightbox-image />
      <figcaption data-lightbox-caption></figcaption>
    </figure>`;
  document.body.appendChild(dialog);

  const image = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]')!;
  let index = 0;

  const show = (nextIndex: number) => {
    index = (nextIndex + figures.length) % figures.length;
    const source = figures[index];
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || '';
    const figureCaption = source.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
    caption.textContent = figureCaption || source.alt || source.closest('article')?.querySelector('h1')?.textContent?.trim() || '';
    counter.textContent = `Figure ${index + 1} of ${figures.length}`;
    if (!dialog.open) dialog.showModal();
  };

  figures.forEach((img, i) => {
    img.classList.add('is-lightboxable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Open image viewer');
    img.addEventListener('click', () => show(i));
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        show(i);
      }
    });
  });

  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') dialog.close();
    if (action === 'prev') show(index - 1);
    if (action === 'next') show(index + 1);
    if (action === 'copy') navigator.clipboard?.writeText(image.src);
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });
}
