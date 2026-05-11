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

  const fontStack = '"Martian Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: fontStack,
    themeVariables: {
      background: '#f7f3e9',
      primaryColor: '#f7f3e9',
      primaryTextColor: '#1a1714',
      primaryBorderColor: '#1a1714',
      secondaryColor: '#ece6d5',
      secondaryTextColor: '#1a1714',
      secondaryBorderColor: '#7a1f1f',
      tertiaryColor: '#f3eee2',
      tertiaryTextColor: '#1a1714',
      tertiaryBorderColor: '#c8c1b1',
      lineColor: '#2c2822',
      edgeLabelBackground: '#f7f3e9',
      clusterBkg: '#ece6d5',
      clusterBorder: '#1a1714',
      titleColor: '#1a1714',
      noteBkgColor: '#f3eee2',
      noteBorderColor: '#7a1f1f',
      noteTextColor: '#1a1714',
      actorBkg: '#f7f3e9',
      actorBorder: '#1a1714',
      actorTextColor: '#1a1714',
      actorLineColor: '#2c2822',
      signalColor: '#1a1714',
      signalTextColor: '#1a1714',
      labelBoxBkgColor: '#ece6d5',
      labelBoxBorderColor: '#1a1714',
      labelTextColor: '#1a1714',
      loopTextColor: '#1a1714',
      sectionBkgColor: '#ece6d5',
      altSectionBkgColor: '#f7f3e9',
      gridColor: '#c8c1b1',
      git0: '#7a1f1f',
      git1: '#1a1714',
      git2: '#6f6a5e',
      git3: '#8b8678',
      fontSize: '15px',
      fontFamily: fontStack
    },
    themeCSS: `
      .node rect, .node circle, .node ellipse, .node polygon, .node path { stroke-width: 1.25px; }
      .cluster rect { stroke-dasharray: 0; rx: 2; ry: 2; }
      .cluster .nodeLabel, .cluster .label { font-weight: 500; letter-spacing: 0.01em; }
      .edgePath .path { stroke-width: 1.25px; }
      .arrowheadPath, marker path { fill: #2c2822; stroke: none; }
      .edgeLabel { padding: 2px 6px; font-size: 13px; color: #2c2822; }
      .edgeLabel rect { fill: #f7f3e9 !important; }
      .label foreignObject { overflow: visible; }
      .nodeLabel, .label { font-weight: 500; }
      .marker.cross { stroke: #2c2822; }
      /* Apply Martian Mono condensed width to all text in the diagram */
      text, .nodeLabel, .label, .edgeLabel, foreignObject div, foreignObject span {
        font-stretch: 80%;
        font-family: ${fontStack};
      }
    `,
    flowchart: {
      curve: 'basis',
      padding: 18,
      nodeSpacing: 50,
      rankSpacing: 60,
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
