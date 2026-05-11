/*
 * Adds a small "Copy" chip to every Shiki code block on hover.
 * Skips mermaid blocks — those are replaced before paint by mermaid.ts.
 */
const blocks = document.querySelectorAll<HTMLPreElement>(
  '.article pre[data-language]:not([data-language="mermaid"])'
);

for (const pre of blocks) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', 'Copy code to clipboard');
  pre.appendChild(btn);

  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code');
    const text = code ? code.innerText : pre.innerText.replace(/Copy$/, '');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
      btn.dataset.copied = 'true';
    } catch {
      btn.textContent = 'Failed';
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
      delete btn.dataset.copied;
    }, 1600);
  });
}
