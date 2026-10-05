// Genera los archivos de versiones anteriores (.json de v2/v3 y proyecciones sueltas) que usan los tests, a partir del
// demo ficticio de la pizzería. No contienen datos reales de ningún negocio.   npm run fixtures
import fs from 'node:fs';
import path from 'node:path';
import { buildTestBundle, openApp } from '../tests/app-harness.js';
import { root } from '../tests/helpers.js';
import { fileToLegacy } from '../src/project/schema.js';

await buildTestBundle();
const { window: w } = await openApp();
w.document.getElementById('proj-welcome')?.remove();
await w.SAHTEN.project.openDemo();
w.sahtenTour && w.sahtenTour.close();
const out = path.join(root, 'tests/fixtures/legacy');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const write = (n, o) => fs.writeFileSync(path.join(out, n), JSON.stringify(o, null, 1));

const snap = (id, name, label) => {
  const d = JSON.parse(JSON.stringify(w.eval('(function(){ initProjDist(); const d=_buildSnapData("x"); return d; })()')));
  return { id, name, label, ...d, savedAt: '2026-08-06T12:00:00.000Z', id };
};
const s1 = snap(1001, 'Mostrador 60% — base', 'base');
w.eval('projChannelDist.mostrador=60; projChannelDist.whatsapp=20; projChannelDist.rappi=10; projChannelDist.pedidosya=10;');
const s2 = snap(1002, 'Mostrador 60% — objetivo $5M', 'objetivo');
const L = JSON.parse(JSON.stringify(fileToLegacy(w.SAHTEN.project.collect())));
['gfMonths', 'project', 'images', 'theme', 'customization', 'supabase'].forEach(k => delete L[k]);   // v3 no tenía estos campos
L.projSnapshots = [s1, s2]; L.activeProjSnapshotId = 1001; L.savedAt = '6/8/2026, 12:00:00';
write('v3-pizzeria.json', L);
write('v2-pizzeria.json', { ...L, _version: 2, projSnapshots: [s1] });
write('Proyeccion_Mostrador_60.json', s1);
write('Proyeccion_Objetivo_5M.json', s2);
console.log('listo:', fs.readdirSync(out).join(', '));
process.exit(0);
