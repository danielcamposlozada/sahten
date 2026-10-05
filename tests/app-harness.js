// Arranca la app REAL (index.html + src/main.js compilado a IIFE) dentro de jsdom, sin red.
import { RAW_V3 } from '../scripts/pizzeria-data.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { loadLegacy } from '../scripts/legacy-harness.mjs';
import { root } from './helpers.js';

const outDirs = { online: path.join(root, '.tmp/test-bundle'), offline: path.join(root, '.tmp/test-bundle-offline') };
const out = outDirs.online;

/** Compila src/main.js como IIFE (una sola vez) y arma un index.html clásico para jsdom. */
export async function buildTestBundle({ online = true } = {}) {
  const out = online ? outDirs.online : outDirs.offline;
  fs.rmSync(out, { recursive: true, force: true });
  await build({
    root, configFile: false, logLevel: 'silent', define: { __SAHTEN_ONLINE__: JSON.stringify(online) },
    build: { outDir: out, emptyOutDir: true, minify: false, lib: { entry: path.join(root, 'src/main.js'), formats: ['iife'], name: 'SahtenApp', fileName: () => 'sahten.iife.js' } },
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('<script type="module" src="/src/main.js"></script>', '<script defer src="sahten.iife.js"></script>');
  fs.writeFileSync(path.join(out, 'index.html'), html);
  return out;
}

/** Abre la app (arranca en blanco, con la bienvenida). */
export async function openApp({ storage = {}, online = true } = {}) {
  return loadLegacy({ root: online ? outDirs.online : outDirs.offline, file: 'index.html', storage });
}

/** Carga el negocio ficticio en formato crudo de v3 (sin pasar por applyData), para comparar contra el baseline. */
export function seedSource(raw) {
  return `(function(){ const D=${JSON.stringify(raw)}, set=(a,b)=>{ a.length=0; b.forEach(x=>a.push(x)); };
    set(PRODUCTS,D.PRODUCTS); set(INGREDIENTES,D.INGREDIENTES); set(ENVASES,D.ENVASES); set(GASTOS_OP,D.GASTOS_OP); set(GASTOS_S,D.GASTOS_S); initStock(); })()`;
}
export function loadRawDemo(w) {
  w.document.getElementById('proj-welcome')?.remove();
  w.eval(seedSource(RAW_V3));
}
