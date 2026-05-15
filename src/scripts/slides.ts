export {};

const slides = Array.from(document.querySelectorAll<HTMLElement>('[data-slide]'));
const currentLabel = document.querySelector<HTMLElement>('[data-slide-current]');
const progress = document.querySelector<HTMLElement>('[data-slide-progress]');
const notesPanel = document.querySelector<HTMLElement>('[data-slide-notes]');
const notesText = document.querySelector<HTMLElement>('[data-slide-note-text]');
const notesPayload = document.getElementById('slide-notes-data')?.textContent ?? '[]';
const notes = parseNotes(notesPayload);

let current = Math.max(0, Math.min(slides.length - 1, initialIndex()));

function parseNotes(payload: string): string[] {
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    console.warn('Unable to parse slide notes payload.', error);
    return [];
  }
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, summary, [contenteditable="true"]'));
}

function initialIndex() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return 0;
  const numeric = Number(hash);
  if (Number.isInteger(numeric) && numeric > 0) return numeric - 1;
  const byId = slides.findIndex((slide) => slide.id === hash);
  return byId >= 0 ? byId : 0;
}

function setNotes(index: number) {
  if (!notesText) return;
  notesText.textContent = notes[index] || 'No notes for this slide.';
}

function show(index: number, updateHash = true) {
  if (slides.length === 0) return;
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === current;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
  if (currentLabel) currentLabel.textContent = String(current + 1);
  if (progress) progress.style.inlineSize = `${((current + 1) / slides.length) * 100}%`;
  setNotes(current);
  if (updateHash) {
    history.replaceState(null, '', `#${current + 1}`);
  }
}

function next() {
  show(current + 1);
}

function previous() {
  show(current - 1);
}

function toggleOverview() {
  document.body.classList.toggle('slides-overview');
}

function toggleNotes() {
  if (!notesPanel) return;
  const shouldShow = notesPanel.hasAttribute('hidden');
  notesPanel.toggleAttribute('hidden', !shouldShow);
  document.body.classList.toggle('slides-notes-open', shouldShow);
  if (shouldShow) setNotes(current);
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await document.documentElement.requestFullscreen();
}

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'Escape' && isInteractiveTarget(event.target)) return;
  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      event.preventDefault();
      next();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault();
      previous();
      break;
    case 'Home':
      event.preventDefault();
      show(0);
      break;
    case 'End':
      event.preventDefault();
      show(slides.length - 1);
      break;
    case 'n':
    case 'N':
      toggleNotes();
      break;
    case 'o':
    case 'O':
      toggleOverview();
      break;
    case 'f':
    case 'F':
      event.preventDefault();
      void toggleFullscreen();
      break;
    case 'Escape':
      document.body.classList.remove('slides-overview');
      break;
  }
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target;
  const action = target.closest<HTMLElement>('[data-slide-action]')?.dataset.slideAction;
  if (action === 'next') next();
  if (action === 'prev') previous();
  if (action === 'overview') toggleOverview();
  if (action === 'notes') toggleNotes();
  if (action === 'fullscreen') void toggleFullscreen();

  const clickedSlide = target.closest<HTMLElement>('[data-slide]');
  if (clickedSlide && document.body.classList.contains('slides-overview')) {
    document.body.classList.remove('slides-overview');
    show(Number(clickedSlide.dataset.slideIndex || 0));
  }
});

window.addEventListener('hashchange', () => show(initialIndex(), false));

show(current, false);

/* -------------------------------------------------------------------------- */
/*  Auto-hiding chrome (topbar)                                               */
/*  Only reveal when the cursor is near the top edge so the slide owns the    */
/*  full viewport height the rest of the time.                                */
/* -------------------------------------------------------------------------- */

const TOP_EDGE_PX = 80;
const CHROME_LINGER_MS = 600;
let chromeTimer: number | undefined;

function setChromeVisible(visible: boolean) {
  document.body.classList.toggle('slides-chrome-visible', visible);
}

function scheduleHide() {
  if (chromeTimer !== undefined) window.clearTimeout(chromeTimer);
  chromeTimer = window.setTimeout(() => setChromeVisible(false), CHROME_LINGER_MS);
}

document.addEventListener(
  'mousemove',
  (event) => {
    if (event.clientY <= TOP_EDGE_PX) {
      if (chromeTimer !== undefined) {
        window.clearTimeout(chromeTimer);
        chromeTimer = undefined;
      }
      setChromeVisible(true);
    } else if (document.body.classList.contains('slides-chrome-visible')) {
      scheduleHide();
    }
  },
  { passive: true }
);

document.addEventListener('mouseleave', () => {
  scheduleHide();
});
