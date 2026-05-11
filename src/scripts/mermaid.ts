/*
 * Loads Mermaid only when the page contains mermaid code blocks.
 * Theme tuned to the Quiet Broadsheet palette: ink on warm cream, single
 * op-ed wine accent for highlighted edges and label backgrounds.
 */
// Shiki tags mermaid blocks as `<pre data-language="mermaid">` and wraps each
// line in <span class="line">. We grab the <pre>, read its textContent (which
// reassembles the source verbatim), then swap it for a .mermaid container.
const mermaidBlocks = document.querySelectorAll('pre[data-language="mermaid"]');
if (mermaidBlocks.length > 0) {
  const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');

  const fontStack = '"Mona Sans Variable", "Mona Sans Fallback", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

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
      fontSize: '14px',
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
        font-size: 11.5px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6f6a5e;
      }
      .edgePath .path { stroke-width: 1.1px; }
      .arrowheadPath, marker path { fill: #4a4137; stroke: none; }
      .edgeLabel {
        padding: 2px 6px;
        font-size: 12.5px;
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
      padding: 22,
      nodeSpacing: 62,
      rankSpacing: 72,
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
}
