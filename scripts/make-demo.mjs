// Genera el proyecto de ejemplo consistente: src/project/demo.sahten.json (lo que abre «Explorar con datos de ejemplo»: una pizzería ficticia)
// y samples/sahten-demo.sahten (copia para usar a mano).
//
// Los datos de ejemplo de v3 NO sobreviven a guardar/cargar tal cual: sus recetas dependen de applyRecetasExcel() (porciones
// por receta) y de la migración de filas {n, v}. Acá se parte del demo de v3, se aplican las recetas del Excel y se repite
// guardar → cargar hasta llegar a un punto fijo: lo que queda es estable (abrirlo y guardarlo no cambia ningún precio).
//   npm run demo
import fs from 'node:fs';
import path from 'node:path';
import { buildTestBundle, openApp, loadRawDemo } from '../tests/app-harness.js';
import { root } from '../tests/helpers.js';
import { migrate, serialize, contentHash, emptyFile } from '../src/project/schema.js';

import * as D from './pizzeria-data.mjs';

await buildTestBundle();
const { window: w } = await openApp();
w.document.getElementById('proj-welcome')?.remove();
const p = w.SAHTEN.project;
// Se parte de un proyecto vacío y se cargan los datos ficticios de la pizzería (scripts/pizzeria-data.mjs)
await p.apply(migrate(serialize(emptyFile())).file, { fresh: true });
w.__D = JSON.parse(JSON.stringify(D));
w.eval(`(function(){ const X=window.__D, set=(a,b)=>{ a.length=0; b.forEach(x=>a.push(x)); };
  set(PRODUCTS,X.PRODUCTS); set(INGREDIENTES,X.INGREDIENTES); set(ENVASES,X.ENVASES); set(GASTOS_OP,X.GASTOS_OP); set(GASTOS_S,X.GASTOS_S); set(MOVIMIENTOS,X.MOVIMIENTOS);
  CHANNELS.forEach(c => Object.assign(c, X.CHANNELS_PATCH[c.id] || {}));
  Object.keys(projChannelDist).forEach(k => delete projChannelDist[k]); Object.assign(projChannelDist, X.DIST);
  Object.keys(projManualUnits).forEach(k => delete projManualUnits[k]); PRODUCTS.forEach(p => projManualUnits[p.id] = p.avgMes); projManualMode = true;
  Object.assign(SAHTEN_PROJECT, X.PROJECT); Object.assign(MENU_CONFIG, X.MENU_CONFIG); _saveMenuConfig();
  PRODUCTS.forEach(p => { p.receta_cost = p.ingredients.reduce((s, r) => s + calcIngCost(r), 0); });
  initStock();
  Object.entries(X.STOCK_LEVELS).forEach(([id, [actual, minimo]]) => { STOCK[id] = Object.assign(STOCK[id] || {}, { actual, minimo, unit: STOCK[id] && STOCK[id].unit || 'g' }); });
})()`);
w.SAHTEN.setSetting('usdRate', 1400, ['usd-rate']); w.SAHTEN.setSetting('globalCommission', 0, ['global-commission']);
const prices = () => Array.from(w.eval('PRODUCTS.map(mostradorFinalPrice)'));

let file = p.collect(); let hash = contentHash(file); let pr = prices();
for (let i = 1; i <= 5; i++) {
  await p.apply(migrate(JSON.parse(serialize(file))).file);
  const next = p.collect(); const h = contentHash(next); const pn = prices();
  console.log(`vuelta ${i}: ${pn.filter((v, j) => v !== pr[j]).length} precios cambian`);
  const stable = h === hash;
  file = next; hash = h; pr = pn;
  if (stable) break;
  if (i === 5) throw new Error('El demo no llega a un punto fijo');
}
file.project = { ...D.PROJECT };
file.modifiedAt = null; file.ui = {}; file.project.id = 'demo-sahten';
const text = serialize(file);
fs.writeFileSync(path.join(root, 'src/project/demo.sahten.json'), text);
fs.mkdirSync(path.join(root, 'samples'), { recursive: true });
fs.writeFileSync(path.join(root, 'samples/sahten-demo.sahten'), text);
console.log('demo listo:', file.catalog.productos.length, 'productos');
process.exit(0);
