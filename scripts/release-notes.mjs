// Notas de una versión para la Release de GitHub: toma la sección de CHANGELOG.md de esa versión.
//   node scripts/release-notes.mjs v0.4.5        → texto en Markdown (stdout)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FOOTER = 'Instaladores de Sahten. Si macOS o Windows muestran un aviso al abrirla, seguí docs/INSTALACION.md.';

/** Sección «## <versión>» del changelog (sin el título). Si no existe, usa la primera. */
export function notesFor(changelog, tag) {
  const ver = String(tag || '').replace(/^v/, '');
  const parts = String(changelog).split(/^## /m).slice(1);
  const pick = parts.find(p => p.split('\n')[0].trim().split(/[\s—-]/)[0] === ver) || (ver ? null : parts[0]);
  const body = pick ? pick.split('\n').slice(1).join('\n').trim() : '';
  return (body ? `## Novedades de ${ver}\n\n${body}\n\n---\n` : '') + FOOTER;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tag = process.argv[2] || '';
  let text = ''; try { text = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'); } catch (e) { /* sin changelog */ }
  process.stdout.write(notesFor(text, tag) + '\n');
}
