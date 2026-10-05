// Genera tests/fixtures/baseline-v3.json y tests/fixtures/demo-raw-v3.sahten a partir del v3 ORIGINAL (reference/).
// Es la "verdad" contra la que los tests comparan el núcleo refactorizado.
//   npm run baseline
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLegacy } from './legacy-harness.mjs';
import { seedSource } from '../tests/app-harness.js';
import { RAW_V3 } from './pizzeria-data.mjs';
import { SCENARIOS, legacyScenarioSource, dumpNumbers, dumpMenuEngineering } from '../tests/scenarios.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = path.join(root, 'reference');

// Expone los números del v3 original (las funciones son const/let del script: se leen con eval en la ventana)
const API_SRC = `({
  products:()=>PRODUCTS, channels:()=>CHANNELS,
  totalGF,totalGFRaw,gfPerUnit,gfUnitsBase,gfCoverageAmount,gfCoveragePct,tierProfitTotal,tierProfitTotalProj,totalGFPct,globalComm,getUSD,
  channelPrice,channelNetReceived,channelPriceWithDisc,channelNetReceivedWithDisc,effectiveChannelDisc,
  totalCost,getPorc,costPerUnit,gfAssigned,absorbsGF,mostradorPrice,mostradorFinalPrice,getProjUnits,
  projectionData:()=>{ initProjDist(); const d=computeCurrentProjData(); delete d.savedAt; delete d.label; return d; },
  snapshotData:()=>{ const d=_buildSnapData('x'); delete d.savedAt; delete d.label; return d; },
  fmt,RND })`;

const result = { generatedFrom: 'reference/Sahten v3.html', scenarios: {} };
let demo = null;

for (const [name, sc] of Object.entries(SCENARIOS)) {
  const { window: w, logs } = await loadLegacy({ root: ref, file: 'Sahten v3.html' });
  if (logs.length) console.warn(name, 'logs:', logs.slice(0, 3));
  w.eval(seedSource(RAW_V3));   // la app original también arranca vacía: se carga la pizzería ficticia
  if (!demo) demo = JSON.parse(JSON.stringify(w.eval('({PRODUCTS,INGREDIENTES,ENVASES,GASTOS_OP,GASTOS_S,TIERS,CHANNELS})')));
  w.eval(legacyScenarioSource(sc));
  const api = w.eval(API_SRC);
  result.scenarios[name] = dumpNumbers(api);
  w.close();
  console.log('baseline', name, Object.keys(result.scenarios[name].products).length, 'productos');
}

// Asistente de estrategia del v3: sus funciones viven dentro de un IIFE; se re-evalúa una copia que las expone
{
  const { window: w } = await loadLegacy({ root: ref, file: 'Sahten v3.html' });
  w.eval(seedSource(RAW_V3));
  const src = fs.readFileSync(path.join(ref, 'sahten-estrategia.js'), 'utf8');
  const i = src.lastIndexOf('})();');
  const patched = src.slice(0, i) + `window.__es={ initState, diagnose, buildScenarios, get D(){return D;}, get S(){return S;}, set S(v){S=v;} };` + src.slice(i);
  const el = w.document.createElement('script'); el.textContent = patched; w.document.head.appendChild(el);
  const es = w.__es;
  result.menuEngineering = dumpMenuEngineering({
    diagnose: () => { es.initState(); return es.D; },
    defaultAnswers: () => ({ ...es.S }),
    buildScenarios: (S, D) => { es.S = { ...S, acc: {} }; return es.buildScenarios(); },
  });
  console.log('baseline asistente de estrategia: ok');
  w.close();
}

fs.mkdirSync(path.join(root, 'tests/fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests/fixtures/baseline-v3.json'), JSON.stringify(result, null, 1));

// Proyecto de ejemplo (.sahten) a partir de SAHTEN_DEMO_DATA
const sahten = {
  format: 'sahten', schemaVersion: 1, appVersion: '4.0.0-alpha.1',
  project: { name: 'Proyecto de ejemplo', demo: true, setupDone: true },
  catalog: { ingredientes: demo.INGREDIENTES, envases: demo.ENVASES, productos: demo.PRODUCTS, tiers: demo.TIERS },
  costs: { gastosOp: demo.GASTOS_OP, gastosS: demo.GASTOS_S, gfMonths: {}, globalCommission: 0, usdRate: 1200 },
  channels: demo.CHANNELS,
};
fs.mkdirSync(path.join(root, 'samples'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests/fixtures/demo-raw-v3.sahten'), JSON.stringify(sahten, null, 1));
console.log('listo: tests/fixtures/baseline-v3.json + tests/fixtures/demo-raw-v3.sahten');
process.exit(0);
