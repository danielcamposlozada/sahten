// Notas de una versión para la Release de GitHub: toma la sección de CHANGELOG.md de esa versión.
//   node scripts/release-notes.mjs v0.4.5        → texto en Markdown (stdout)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FOOTER = 'Instaladores de Sahten. Si macOS o Windows muestran un aviso al abrirla, seguí docs/INSTALACION.md.';

const LINK = '[Detalle completo en CHANGELOG.md](https://github.com/danielcamposlozada/sahten/blob/main/CHANGELOG.md)';

/** Un renglón por cambio: el título en negrita y la primera frase (máx. `maxItem` caracteres); como mucho `maxTotal` en total. */
export function condense(body, { maxItem = 150, maxTotal = 1500 } = {}) {
  const items = String(body).split('\n').map(l => l.trim()).filter(l => /^[-*]\s+/.test(l)).map(l => l.replace(/^[-*]\s+/, ''));
  const short = t => {
    const m = /^(\*\*[^*]+\*\*:?)\s*(.*)$/.exec(t); const head = m ? m[1] : '', rest = m ? m[2] : t;
    const sentence = (rest.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ«¿¡])/)[0] || '').trim();
    let txt = sentence; const room = Math.max(40, maxItem - head.length);
    if (txt.length > room) txt = txt.slice(0, room).replace(/\s+\S*$/, '') + '…';
    return '- ' + (head ? head + ' ' : '') + txt;
  };
  const out = []; let len = 0;
  for (const it of items) { const line = short(it); if (len + line.length > maxTotal && out.length) break; out.push(line); len += line.length + 1; }
  const extra = items.length - out.length;
  if (extra > 0) out.push(`- …y ${extra} cambio${extra > 1 ? 's' : ''} más.`);
  return out.join('\n');
}

/** Sección «## <versión>» del changelog (sin el título). Si no existe, usa la primera. */
export function notesFor(changelog, tag) {
  const ver = String(tag || '').replace(/^v/, '');
  const parts = String(changelog).split(/^## /m).slice(1);
  const pick = parts.find(p => p.split('\n')[0].trim().split(/[\s—-]/)[0] === ver) || (ver ? null : parts[0]);
  const body = pick ? pick.split('\n').slice(1).join('\n').trim() : '';
  return (body ? `## Novedades de ${ver}\n\n${condense(body)}\n\n${LINK}\n\n---\n` : '') + FOOTER;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tag = process.argv[2] || '';
  let text = ''; try { text = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'); } catch (e) { /* sin changelog */ }
  process.stdout.write(notesFor(text, tag) + '\n');
}
