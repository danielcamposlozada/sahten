// La app real (con el puente a src/core) debe dar los mismos números que el v3 original,
// y los paneles / eventos deben funcionar sin los wrappers en cadena.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestBundle, openApp as open0, loadRawDemo } from './app-harness.js';
const openApp = async () => { const a = await open0(); loadRawDemo(a.window); return a; };
import { readJSON, diffNumbers } from './helpers.js';
import { SCENARIOS, legacyScenarioSource, dumpNumbers } from './scenarios.js';

const baseline = readJSON('tests/fixtures/baseline-v3.json');
const API_SRC = `({
  products:()=>PRODUCTS, channels:()=>CHANNELS,
  totalGF,totalGFRaw,gfPerUnit,gfUnitsBase,gfCoverageAmount,gfCoveragePct,tierProfitTotal,tierProfitTotalProj,totalGFPct,globalComm,getUSD,
  channelPrice,channelNetReceived,channelPriceWithDisc,channelNetReceivedWithDisc,effectiveChannelDisc,
  totalCost,getPorc,costPerUnit,gfAssigned,absorbsGF,mostradorPrice,mostradorFinalPrice,getProjUnits,
  projectionData:()=>{ initProjDist(); const d=computeCurrentProjData(); delete d.savedAt; delete d.label; return d; },
  snapshotData:()=>{ const d=_buildSnapData('x'); delete d.savedAt; delete d.label; return d; },
  fmt,RND })`;

beforeAll(async () => { await buildTestBundle(); }, 120000);

describe('app real con el puente a src/core', () => {
  Object.entries(SCENARIOS).forEach(([name, sc]) => {
    it(`escenario «${name}»: mismos números que el v3 original`, async () => {
      const { window: w, logs } = await openApp();
      expect(logs.filter(l => /jsdomError/.test(l))).toEqual([]);
      expect(w.SAHTEN_READY).toBe(true);
      // misma lectura del demo que hace el v3: SAHTEN_DEMO_DATA se captura al final del script principal
      expect(w.eval('PRODUCTS.length')).toBe(7);
      w.eval(legacyScenarioSource(sc));
      // en la app nueva la comisión y el dólar viven en el estado (el input solo los refleja)
      if (sc.globalCommission != null) w.SAHTEN.setSetting('globalCommission', sc.globalCommission);
      if (sc.usd != null) w.SAHTEN.setSetting('usdRate', sc.usd);
      const actual = dumpNumbers(w.eval(API_SRC));
      expect(diffNumbers(actual, baseline.scenarios[name]).slice(0, 15)).toEqual([]);
      w.close();
    }, 60000);
  });

  it('los paneles se dibujan sin errores y los módulos reciben el evento de panel', async () => {
    const { window: w } = await openApp();
    const errors = [];
    w.addEventListener('error', e => errors.push(e.message));
    const panels = w.eval('PANELS');
    for (const p of panels) { w.eval(`showPanel('${p}')`); await new Promise(r => setTimeout(r, 40)); }
    expect(errors).toEqual([]);
    expect(w.document.querySelectorAll('#proj-tbody tr').length).toBe(7);
    w.close();
  }, 60000);

  it('showPanel / renderX se envuelven una sola vez (sin cadena de wrappers)', async () => {
    const { window: w } = await openApp();
    let calls = 0;
    w.SAHTEN.events.afterRender('renderDashboard', () => { calls++; });
    w.eval('renderDashboard()');
    expect(calls).toBe(1);
    w.close();
  }, 60000);

  it('la comisión global vive en el estado y se refleja desde el input', async () => {
    const { window: w } = await openApp();
    const el = w.document.getElementById('global-commission');
    const before = w.eval('mostradorFinalPrice(PRODUCTS[0])');
    el.value = '5'; el.dispatchEvent(new w.Event('input', { bubbles: true }));
    expect(w.SAHTEN.state.globalCommission).toBe(5);
    expect(w.eval('mostradorFinalPrice(PRODUCTS[0])')).toBeGreaterThan(before);
    w.close();
  }, 60000);

  it('collectState() → applyData() es estable y conserva comisión y USD', async () => {
    const { window: w } = await openApp();
    // v3 (y v4, sin cambios): la 1ª recalcAll() aplica las recetas del Excel y mueve ~18 precios del demo, y el
    // primer guardar/cargar cambia 1 más (torta_chocolate). Se normaliza una vez y se mide la estabilidad.
    // Ver «Hallazgos» en el resumen de la Fase A.
    const roundtrip = () => { const d = JSON.parse(JSON.stringify(w.eval('collectState()'))); w.eval(`applyData(${JSON.stringify(d)})`); };
    w.eval('recalcAll()');
    w.SAHTEN.setSetting('globalCommission', 4);
    w.SAHTEN.setSetting('usdRate', 1350);
    roundtrip();
    const price = Array.from(w.eval('PRODUCTS.map(mostradorFinalPrice)'));
    w.SAHTEN.state.globalCommission = 0; w.SAHTEN.state.usdRate = 1200;
    const d = JSON.parse(JSON.stringify(w.eval('collectState()')));
    expect(d.globalCommission).toBe('0');
    w.SAHTEN.setSetting('globalCommission', 4); w.SAHTEN.setSetting('usdRate', 1350);
    roundtrip();
    expect(w.SAHTEN.state.globalCommission).toBe(4);
    expect(w.SAHTEN.state.usdRate).toBe(1350);
    expect(w.document.getElementById('global-commission').value).toBe('4');
    expect(Array.from(w.eval('PRODUCTS.map(mostradorFinalPrice)'))).toEqual(price);
    w.close();
  }, 60000);
});
