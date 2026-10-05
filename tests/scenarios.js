// Escenarios compartidos: se aplican igual al v3 original (para generar el baseline)
// y al estado refactorizado (para compararlo). Cubren las ramas de precio y de proyección.
export const SCENARIOS = {
  base: {},
  comision5: { globalCommission: 5, usd: 1400 },
  mixto: {
    products: {
      0: { priceAdj: 1.1 },
      1: { discount: 0.1, discountType: 'pct' },
      2: { discount: 200, discountType: 'fixed' },
      3: { absorbeGF: false },
      4: { channelDiscounts: { rappi: 10 } },
      5: { gfPctOverride: 150, porcionesOverride: 2.5, merma: 10 },
      6: { recetaOnly: true },
    },
    channels: { rappi: { channelDisc: 5 }, mostrador: { surcharge: 0.1 } },
    globalCommission: 3,
  },
  sinVentas: { zeroUnits: true, project: { estUnitsMonth: 900 } },
  monedaChica: { project: { roundTo: 0.5, currencySymbol: 'US$', locale: 'en-US' } },
  proyeccionManual: {
    projection: {
      manualMode: true,
      manualUnits: { pizza_muzza: 900, pizza_fuga: 50, empanada_jyq: 7 },
      channelDist: { mostrador: 40, fudo: 20, rappi: 15, pedidosya: 15, mercadopago: 10 },
    },
  },
};

/** Aplica un escenario a un estado de core (src/core/state.js). */
export function applyScenarioCore(s, sc) {
  Object.entries(sc.products || {}).forEach(([i, f]) => Object.assign(s.products[i], JSON.parse(JSON.stringify(f))));
  Object.entries(sc.channels || {}).forEach(([id, f]) => Object.assign(s.channels.find(c => c.id === id), f));
  if (sc.globalCommission != null) s.globalCommission = sc.globalCommission;
  if (sc.usd != null) s.usdRate = sc.usd;
  if (sc.project) Object.assign(s.project, sc.project);
  if (sc.zeroUnits) s.products.forEach(p => { p.avgMes = 0; });
  if (sc.projection) {
    const pr = sc.projection;
    if (pr.manualMode != null) s.projection.manualMode = pr.manualMode;
    if (pr.manualUnits) s.projection.manualUnits = { ...pr.manualUnits };
    if (pr.channelDist) s.projection.channelDist = { ...pr.channelDist };
  }
}

/** Código que aplica el mismo escenario dentro de la página v3 original (se evalúa en la ventana). */
export function legacyScenarioSource(sc) {
  return `(function(sc){
    Object.entries(sc.products||{}).forEach(([i,f])=>Object.assign(PRODUCTS[i],f));
    Object.entries(sc.channels||{}).forEach(([id,f])=>Object.assign(CHANNELS.find(c=>c.id===id),f));
    if(sc.globalCommission!=null) document.getElementById('global-commission').value=sc.globalCommission;
    if(sc.usd!=null) document.getElementById('usd-rate').value=sc.usd;
    if(sc.project) Object.assign(SAHTEN_PROJECT,sc.project);
    if(sc.zeroUnits) PRODUCTS.forEach(p=>{p.avgMes=0;});
    if(sc.projection){ const pr=sc.projection;
      if(pr.manualMode!=null) projManualMode=pr.manualMode;
      if(pr.manualUnits) projManualUnits=Object.assign({},pr.manualUnits);
      if(pr.channelDist) projChannelDist=Object.assign({},pr.channelDist); }
  })(${JSON.stringify(sc)})`;
}

/** Foto de todos los números que importan, a partir de un "api" con las mismas funciones del v3. */
export function dumpNumbers(api) {
  const prods = api.products();
  const chs = api.channels().filter(c => c.enabled);
  const out = { global: {}, products: {}, projection: null, snapshot: null, fmt: null };
  out.global = {
    totalGF: api.totalGF(), totalGFRaw: api.totalGFRaw(), gfPerUnit: api.gfPerUnit(), gfUnitsBase: api.gfUnitsBase(),
    gfCoverageAmount: api.gfCoverageAmount(), gfCoveragePct: api.gfCoveragePct(),
    tierProfitTotal: api.tierProfitTotal(), tierProfitTotalProj: api.tierProfitTotalProj(), totalGFPct: api.totalGFPct(),
    globalComm: api.globalComm(), usd: api.getUSD(),
  };
  prods.forEach(p => {
    const ch = {};
    chs.forEach(c => {
      ch[c.id] = { price: api.channelPrice(p, c.id), net: api.channelNetReceived(p, c.id), priceDisc: api.channelPriceWithDisc(p, c.id), netDisc: api.channelNetReceivedWithDisc(p, c.id), disc: api.effectiveChannelDisc(p, c.id) };
    });
    out.products[p.id] = {
      totalCost: api.totalCost(p), porc: api.getPorc(p), costPerUnit: api.costPerUnit(p), gfAssigned: api.gfAssigned(p), absorbs: api.absorbsGF(p),
      mostradorPrice: api.mostradorPrice(p), mostradorFinalPrice: api.mostradorFinalPrice(p), projUnits: api.getProjUnits(p), ch,
    };
  });
  out.projection = api.projectionData();
  out.snapshot = api.snapshotData();
  out.fmt = [api.fmt(12345.678), api.fmt(0.5), api.fmt(-1234.5), api.RND(1234.4), api.RND(1275.1)];
  return JSON.parse(JSON.stringify(out)); // normaliza NaN/undefined como en el archivo de baseline
}

/** Metas del asistente de estrategia que se comparan contra el v3. */
export const GOALS = {
  plato: {},
  mensual: { goal: 'mensual', monthly: 30000000 },
  equilibrio: { goal: 'equilibrio' },
  foodcost: { goal: 'foodcost', fcTarget: 28 },
};

/** Foto del asistente de estrategia: diagnóstico + escenarios por meta. `api` = { diagnose(), defaultAnswers(D), buildScenarios(S, D) } */
export function dumpMenuEngineering(api) {
  const D = api.diagnose();
  const diag = {
    q: D.q,
    sim: { gf: D.sim.gf, resultado: D.sim.resultado, cmTot: D.sim.cmTot, units: D.sim.units, rev: D.sim.rev, fc: D.sim.fc, beUnits: D.sim.beUnits, coverage: D.sim.coverage },
    rows: D.rows.map(r => ({ id: r.id, units: r.units, net: r.net, cost: r.cost, price: r.price, cat: r.cat })),
    ings: D.ings.slice(0, 8).map(i => ({ id: i.id, month: i.month, share: i.share, uses: i.uses })),
    chans: D.chans.map(c => ({ id: c.c.id, ratio: c.ratio, dist: c.dist })),
    missing: D.missing,
  };
  const goals = {};
  Object.entries(GOALS).forEach(([g, over]) => {
    const S = { ...api.defaultAnswers(D), ...over };
    goals[g] = api.buildScenarios(S, D).map(sc => ({
      key: sc.key, ok: sc.ok, ch: sc.ch, resultado: sc.sim.resultado, fc: sc.sim.fc, cmTot: sc.sim.cmTot, units: sc.sim.units, met: sc.met.txt,
    }));
  });
  return JSON.parse(JSON.stringify({ diag, goals }));
}
