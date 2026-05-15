/*
 * Loads Mermaid only when the page contains mermaid code blocks.
 * Theme tuned to the Quiet Broadsheet palette: ink on warm cream, single
 * op-ed wine accent for highlighted edges and label backgrounds.
 */
export {};

// Shiki tags mermaid blocks as `<pre data-language="mermaid">` and wraps each
// line in <span class="line">. We grab the <pre>, read its textContent (which
// reassembles the source verbatim), then swap it for a .mermaid container.
const mermaidBlocks = document.querySelectorAll('pre[data-language="mermaid"]');
if (mermaidBlocks.length > 0) {
  // Loaded from a CDN at runtime; TypeScript can't resolve the URL specifier.
  const mermaidModule = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs' as string
  );
  const mermaid = (mermaidModule as { default: any }).default;

  const fontStack = '"Mona Sans", "Noto Sans SC", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // Slide decks render the same Mermaid source into a 16:9 frame that fills
  // the viewport, so scale text up in SVG user-units (which scale with the
  // SVG itself) — that's the only way to make labels read well on a screen.
  const isSlide = document.body.classList.contains('slide-body');
  const baseFontSize = isSlide ? 20 : 14;
  const edgeLabelSize = isSlide ? 17 : 12.5;
  const clusterLabelSize = isSlide ? 15 : 11.5;
  const flowchartPadding = isSlide ? 14 : 22;
  const nodeSpacing = isSlide ? 48 : 62;
  const rankSpacing = isSlide ? 56 : 72;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: fontStack,
    themeVariables: {
      background: '#f3eee2',
      primaryColor: '#f7f3e9',
      primaryTextColor: '#3a322a',
      primaryBorderColor: '#3a322a',
      secondaryColor: '#ece6d5',
      secondaryTextColor: '#3a322a',
      secondaryBorderColor: '#7a1f1f',
      tertiaryColor: '#f3eee2',
      tertiaryTextColor: '#3a322a',
      tertiaryBorderColor: '#c8c1b1',
      lineColor: '#4a4137',
      edgeLabelBackground: '#f3eee2',
      clusterBkg: '#ece6d5',
      clusterBorder: '#3a322a',
      titleColor: '#3a322a',
      noteBkgColor: '#ece6d5',
      noteBorderColor: '#7a1f1f',
      noteTextColor: '#3a322a',
      actorBkg: '#f7f3e9',
      actorBorder: '#3a322a',
      actorTextColor: '#3a322a',
      actorLineColor: '#4a4137',
      signalColor: '#3a322a',
      signalTextColor: '#3a322a',
      labelBoxBkgColor: '#ece6d5',
      labelBoxBorderColor: '#3a322a',
      labelTextColor: '#3a322a',
      loopTextColor: '#3a322a',
      sectionBkgColor: '#ece6d5',
      altSectionBkgColor: '#f3eee2',
      gridColor: '#c8c1b1',
      git0: '#7a1f1f',
      git1: '#3a322a',
      git2: '#6f6a5e',
      git3: '#8b8678',
      fontSize: `${baseFontSize}px`,
      fontFamily: fontStack
    },
    themeCSS: `
      .node rect, .node circle, .node ellipse, .node polygon, .node path { stroke-width: 1.1px; }
      .cluster rect {
        stroke-dasharray: 4 3;
        stroke-width: 1px;
        rx: 2; ry: 2;
      }
      .cluster .nodeLabel, .cluster .label {
        font-weight: 700;
        font-size: ${clusterLabelSize}px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6f6a5e;
      }
      .edgePath .path { stroke-width: 1.1px; }
      .arrowheadPath, marker path { fill: #4a4137; stroke: none; }
      .edgeLabel {
        padding: 2px 6px;
        font-size: ${edgeLabelSize}px;
        font-weight: 500;
        color: #4a4137;
      }
      .edgeLabel rect {
        fill: #f3eee2 !important;
        stroke: #c8c1b1;
        stroke-width: 1px;
      }
      .label foreignObject { overflow: visible; }
      .nodeLabel, .label { font-weight: 460; }
      .marker.cross { stroke: #4a4137; }
      /* Apply the body sans family to all text in the diagram */
      text, .nodeLabel, .label, .edgeLabel, foreignObject div, foreignObject span {
        font-family: ${fontStack};
      }
    `,
    flowchart: {
      curve: 'monotoneX',
      padding: flowchartPadding,
      nodeSpacing,
      rankSpacing,
      htmlLabels: true,
      useMaxWidth: true,
      diagramPadding: 12
    },
    sequence: {
      useMaxWidth: true,
      actorMargin: 60,
      boxMargin: 12,
      messageMargin: 40,
      mirrorActors: false
    },
    gantt: { useMaxWidth: true },
    journey: { useMaxWidth: true },
    class: { useMaxWidth: true },
    state: { useMaxWidth: true },
    er: { useMaxWidth: true }
  });

  mermaidBlocks.forEach((pre, i) => {
    const container = document.createElement('div');
    container.className = 'mermaid';
    container.id = `mermaid-${i}`;
    container.textContent = pre.textContent;
    pre.replaceWith(container);
  });

  await mermaid.run({ querySelector: '.mermaid' });

  // After Mermaid replaces each container's contents with an SVG, attach a
  // small "expand" affordance that opens the diagram in a viewport-wide
  // dialog with zoom + pan controls.
  document.querySelectorAll<HTMLElement>('.mermaid[data-processed="true"]').forEach((container, idx) => {
    if (container.querySelector('.mermaid-expand')) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mermaid-expand';
    button.setAttribute('aria-label', 'Open diagram in fullscreen viewer');
    button.title = 'Expand diagram';
    button.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 6V2.5H6M14 6V2.5H10.5M2.5 10v3.5H6M14 10v3.5H10.5"
          fill="none" stroke="currentColor" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
    button.addEventListener('click', () => {
      openMermaidDialog(svg as SVGSVGElement, `Fig. ${idx + 1}`);
    });
    container.appendChild(button);
  });
}

/* -------------------------------------------------------------------------- */
/*  Fullscreen dialog with zoom + pan                                         */
/* -------------------------------------------------------------------------- */

type DialogController = {
  show(svg: SVGSVGElement, title: string): void;
};

let dialogController: DialogController | null = null;

function openMermaidDialog(svg: SVGSVGElement, title: string) {
  if (!dialogController) dialogController = createMermaidDialog();
  dialogController.show(svg, title);
}

function createMermaidDialog(): DialogController {
  const dialog = document.createElement('dialog');
  dialog.className = 'mermaid-dialog';
  dialog.innerHTML = `
    <div class="mermaid-dialog__bar">
      <span class="mermaid-dialog__title" data-mermaid-title>Diagram</span>
      <div class="mermaid-dialog__tools">
        <button type="button" class="mermaid-dialog__btn" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">&minus;</button>
        <output class="mermaid-dialog__zoom" data-mermaid-zoom>100%</output>
        <button type="button" class="mermaid-dialog__btn" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" class="mermaid-dialog__btn" data-action="reset" aria-label="Reset zoom" title="Reset">Reset</button>
        <button type="button" class="mermaid-dialog__btn mermaid-dialog__btn--close" data-action="close" aria-label="Close" title="Close">&times;</button>
      </div>
    </div>
    <div class="mermaid-dialog__viewport" data-mermaid-viewport>
      <div class="mermaid-dialog__stage" data-mermaid-stage></div>
    </div>
  `;
  document.body.appendChild(dialog);

  const titleEl = dialog.querySelector<HTMLElement>('[data-mermaid-title]')!;
  const zoomLabel = dialog.querySelector<HTMLElement>('[data-mermaid-zoom]')!;
  const viewport = dialog.querySelector<HTMLElement>('[data-mermaid-viewport]')!;
  const stage = dialog.querySelector<HTMLElement>('[data-mermaid-stage]')!;

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 8;
  const STEP = 1.25;

  let scale = 1;
  let tx = 0;
  let ty = 0;

  const apply = () => {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  };

  const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const reset = () => {
    scale = 1;
    tx = 0;
    ty = 0;
    apply();
  };

  // Zoom around the viewport center so the diagram stays visually anchored.
  const zoomCentered = (factor: number) => {
    const next = clamp(scale * factor);
    if (next === scale) return;
    scale = next;
    apply();
  };

  // Zoom around an arbitrary client point (used by the wheel handler so the
  // point under the cursor stays fixed while scaling).
  const zoomAt = (factor: number, clientX: number, clientY: number) => {
    const next = clamp(scale * factor);
    if (next === scale) return;
    const rect = viewport.getBoundingClientRect();
    // The stage's transform-origin sits at the viewport center, so convert
    // the pointer position into that coordinate space first.
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const pointX = (cx - tx) / scale;
    const pointY = (cy - ty) / scale;
    scale = next;
    tx = cx - pointX * scale;
    ty = cy - pointY * scale;
    apply();
  };

  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;
    switch (actionEl.dataset.action) {
      case 'zoom-in': zoomCentered(STEP); break;
      case 'zoom-out': zoomCentered(1 / STEP); break;
      case 'reset': reset(); break;
      case 'close': dialog.close(); break;
    }
  });

  dialog.addEventListener('close', () => {
    stage.replaceChildren();
    reset();
    document.body.classList.remove('mermaid-dialog-open');
  });

  // Drag-to-pan with pointer events so it works for mouse, touch, and pen.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-grabbing');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    tx += event.clientX - lastX;
    ty += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    apply();
  });

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    viewport.classList.remove('is-grabbing');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  viewport.addEventListener('wheel', (event) => {
    if (!dialog.open) return;
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    zoomAt(factor, event.clientX, event.clientY);
  }, { passive: false });

  return {
    show(svg: SVGSVGElement, title: string) {
      titleEl.textContent = title;
      stage.replaceChildren();
      const clone = svg.cloneNode(true) as SVGSVGElement;
      // Strip Mermaid's intrinsic sizing so the SVG fills the stage and
      // scales freely with the transform.
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      clone.style.width = '100%';
      clone.style.height = '100%';
      clone.style.maxWidth = 'none';
      clone.style.maxHeight = 'none';
      stage.appendChild(clone);
      reset();
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      document.body.classList.add('mermaid-dialog-open');
    }
  };
}
