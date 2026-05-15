/*
 * Adds a small "Copy" chip to every Shiki code block on hover.
 * Skips mermaid blocks — those are replaced before paint by mermaid.ts.
 */
const blocks = document.querySelectorAll<HTMLPreElement>(
  '.article pre[data-language]:not([data-language="mermaid"])'
);

for (const pre of blocks) {
  const language = pre.dataset.language || 'text';
  const label = document.createElement('span');
  label.className = 'code-label';
  label.textContent = language;
  pre.appendChild(label);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', 'Copy code to clipboard');
  pre.appendChild(btn);

  const codeText = pre.querySelector('code')?.innerText ?? '';
  if (codeText.length > 2200 || codeText.split('\n').length > 42) {
    pre.classList.add('is-collapsed');
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'code-expand';
    expand.textContent = 'Show full block';
    expand.setAttribute('aria-expanded', 'false');
    pre.appendChild(expand);
    expand.addEventListener('click', () => {
      const collapsed = pre.classList.toggle('is-collapsed');
      expand.textContent = collapsed ? 'Show full block' : 'Collapse block';
      expand.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code');
    const text = code ? code.innerText : pre.innerText.replace(/Copy$/, '').replace(/Show full block$/, '');
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
