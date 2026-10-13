// Notas de versión (Markdown corto) → HTML seguro para el diálogo de actualización.
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

function inline(s) {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

/** Markdown muy simple (títulos, listas, negritas, `código`, enlaces y «---») a HTML. Todo lo demás se escapa. */
export function notesToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = []; let list = false, foot = false;
  const close = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { close(); continue; }
    if (/^---+$/.test(l)) { close(); foot = true; continue; }
    const h = /^#{1,4}\s+(.*)$/.exec(l);
    if (h) { close(); out.push(`<h4 class="un-h">${inline(h[1])}</h4>`); continue; }
    const b = /^[-*]\s+(.*)$/.exec(l);
    if (b) { if (!list) { out.push('<ul class="un-list">'); list = true; } out.push(`<li>${inline(b[1])}</li>`); continue; }
    close(); out.push(`<p class="${foot ? 'un-foot' : 'un-p'}">${inline(l)}</p>`);
  }
  close();
  return out.join('');
}
