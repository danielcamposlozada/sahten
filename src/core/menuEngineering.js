// ═══════════════════════════════════════════════════════════
// Ingeniería de menú (Kasavana & Smith) y escenarios de estrategia
// Modelo puro: lo que antes vivía dentro de sahten-estrategia.js, sin DOM.
//   respuestas (S) = { goal, platoPct, monthly, fcTarget, maxInc, elast, locked, reneg, renegPct, horseMode, chFix, promoteEnigma }
//   diagnóstico (D) = resultado de diagnose()
// ═══════════════════════════════════════════════════════════
import { calcIngCost, costPerUnit, getPorc } from './costs.js';
import { totalGF } from './gf.js';
import { channelNetReceivedWithDisc, mostradorFinalPrice } from './pricing.js';
import { getProjUnits, initProjDist } from './projection.js';
import { fmt } from './format.js';
import { t } from '../i18n/index.js';

const QUADRANTS = ['star', 'horse', 'puzzle', 'dog'];
export const QN = Object.fromEntries(QUADRANTS.map(q => [q, t('menu.q.' + q)]));
export const QD = Object.fromEntries(QUADRANTS.map(q => [q, t('menu.qd.' + q)]));
export const ELAST = { baja: 0.3, media: 0.8, alta: 1.3 };

const pct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) : '—') + '%';
const sgn = v => v > 0 ? '+' : '';

// ── Modelo ───────────────────────────────────────────────
export function activeChannels(s) {
  initProjDist(s);
  const chs = s.channels.filter(c => c.enabled);
  const tot = chs.reduce((a, c) => a + (s.projection.channelDist[c.id] || 0), 0);
  return { chs, tot };
}

export function baseRows(s) {
  const { chs, tot } = activeChannels(s);
  const dist = s.projection.channelDist;
  return s.products.filter(p => !p.recetaOnly).map(p => {
    const units = getProjUnits(s, p) || 0;
    const nets = {}; chs.forEach(c => { const n = channelNetReceivedWithDisc(s, p, c.id); nets[c.id] = n == null ? 0 : n; });
    const w = c => tot > 0 ? (dist[c.id] || 0) / tot : (c.id === 'mostrador' ? 1 : 0);
    let net = chs.reduce((a, c) => a + w(c) * nets[c.id], 0); if (!net) net = mostradorFinalPrice(s, p);
    const cost = costPerUnit(s, p); const price = mostradorFinalPrice(s, p);
    const ingByIng = {};
    (p.ingredients || []).forEach(r => { if (r.ingId) { const v = calcIngCost(s, r) / Math.max(0.01, getPorc(p)); ingByIng[r.ingId] = (ingByIng[r.ingId] || 0) + v; } });
    return { p, id: p.id, name: p.name, cat: p.category || t('menu.uncategorized'), star: !!p.star, units, nets, w: Object.fromEntries(chs.map(c => [c.id, w(c)])), net, cost, price, ingByIng, hasRecipe: (p.ingredients || []).some(r => r.ingId) || (p.receta_cost || 0) > 0 };
  });
}

/** Simula un conjunto de cambios { priceAdj, ingCut, chSurcharge, unitAdj } con elasticidad E. */
export function simulate(s, rows, ch, E) {
  ch = ch || {}; const pa = ch.priceAdj || {}, ic = ch.ingCut || {}, cs = ch.chSurcharge || {}, ua = ch.unitAdj || {};
  const out = rows.map(r => {
    const f = pa[r.id] || 1;
    let net = 0;
    Object.keys(r.w).forEach(cid => {
      const c = s.channels.find(x => x.id === cid); let n = r.nets[cid];
      if (cs[cid] != null && c) n = n * (1 + cs[cid]) / (1 + (c.surcharge || 0));
      net += r.w[cid] * n;
    });
    if (!net) net = r.net; net *= f;
    let cost = r.cost; Object.keys(ic).forEach(iid => { if (r.ingByIng[iid]) cost -= r.ingByIng[iid] * ic[iid]; });
    const units = Math.max(0, r.units * (ua[r.id] || 1) * Math.max(0, 1 - (E || 0) * (f - 1)));
    return { ...r, f, net, cost, price: r.price * f, units, cm: net - cost, fc: r.price * f > 0 ? cost / (r.price * f) : 0 };
  });
  const gf = totalGF(s); const cmTot = out.reduce((a, r) => a + r.units * r.cm, 0); const units = out.reduce((a, r) => a + r.units, 0);
  const rev = out.reduce((a, r) => a + r.units * r.net, 0); const costT = out.reduce((a, r) => a + r.units * r.cost, 0);
  const avgCm = units > 0 ? cmTot / units : 0;
  return { rows: out, gf, cmTot, units, rev, resultado: cmTot - gf, fc: rev > 0 ? costT / out.reduce((a, r) => a + r.units * r.price, 0) : 0, beUnits: avgCm > 0 ? Math.ceil(gf / avgCm) : null, coverage: gf > 0 ? cmTot / gf : 0 };
}

/** Cuadrante por producto: popular = vende ≥ 70% de lo esperado en su categoría; rentable = margen unitario ≥ promedio ponderado. */
export function classify(sim) {
  const by = {}; sim.rows.forEach(r => { (by[r.cat] = by[r.cat] || []).push(r); });
  const q = {};
  Object.values(by).forEach(list => {
    const U = list.reduce((a, r) => a + r.units, 0); const n = list.length;
    const thrPop = n > 0 ? 0.7 / n : 0;
    const avgCm = U > 0 ? list.reduce((a, r) => a + r.units * r.cm, 0) / U : list.reduce((a, r) => a + r.cm, 0) / Math.max(1, n);
    list.forEach(r => { const share = U > 0 ? r.units / U : 0; const pop = share >= thrPop, prof = r.cm >= avgCm; q[r.id] = pop && prof ? 'star' : pop ? 'horse' : prof ? 'puzzle' : 'dog'; });
  });
  return q;
}

/** Diagnóstico: filas base, simulación sin cambios, cuadrantes, faltantes, Pareto de ingredientes y canales. */
export function diagnose(s) {
  const rows = baseRows(s); const sim = simulate(s, rows, {}, 0); const q = classify(sim);
  const missing = { noUnits: rows.filter(r => !r.units).map(r => r.name), noRecipe: rows.filter(r => !r.hasRecipe).map(r => r.name) };
  const ingW = {}, ingUse = {};
  sim.rows.forEach(r => Object.entries(r.ingByIng).forEach(([iid, v]) => { ingW[iid] = (ingW[iid] || 0) + v * r.units; (ingUse[iid] = ingUse[iid] || new Set()).add(r.id); }));
  const costMonth = sim.rows.reduce((a, r) => a + r.units * r.cost, 0) || 1;
  const ings = Object.entries(ingW).map(([iid, v]) => { const ing = s.ingredients.find(x => x.id === iid); return { id: iid, name: ing ? (ing.name || ing.n || iid) : iid, month: v, share: v / costMonth, uses: ingUse[iid].size }; }).sort((a, b) => b.month - a.month);
  const { chs, tot } = activeChannels(s);
  const dist = s.projection.channelDist;
  const chans = chs.map(c => { let num = 0, den = 0; sim.rows.forEach(r => { const pr = r.price || 1; num += r.nets[c.id] / pr * (r.units || 1); den += (r.units || 1); }); return { c, ratio: den ? num / den : 1, dist: tot > 0 ? (dist[c.id] || 0) / tot : 0 }; }).sort((a, b) => a.ratio - b.ratio);
  return { rows, sim, q, missing, ings, chans };
}

/** Respuestas por defecto del asistente a partir del diagnóstico. */
export function defaultAnswers(D) {
  const target = D.sim.resultado > 0 ? Math.round(D.sim.resultado * 1.3) : Math.round(D.sim.gf * 0.2);
  return { goal: 'plato', platoPct: 30, monthly: target, fcTarget: 30, maxInc: 15, elast: 'media', locked: D.rows.filter(r => r.star && D.q[r.id] === 'star').map(r => r.id), reneg: null, renegPct: 8, horseMode: 'precio', chFix: null, promoteEnigma: true, scenario: null, acc: {} };
}

// ── Escenarios ───────────────────────────────────────────
export function goalGap(S, sim) {
  if (S.goal === 'mensual') return S.monthly - sim.resultado;
  if (S.goal === 'equilibrio') return -sim.resultado;
  return null;
}
export function goalMet(s, S, base, sim) {
  if (S.goal === 'plato') {
    const b = base.rows.filter(r => !S.locked.includes(r.id)), a = sim.rows.filter(r => !S.locked.includes(r.id));
    const bc = b.reduce((x, r) => x + r.cm, 0), ac = a.reduce((x, r) => x + r.cm, 0); const got = bc > 0 ? ac / bc - 1 : 0;
    return { ok: got >= S.platoPct / 100 - 0.005, txt: t('menu.goal.plato', { delta: sgn(got) + pct(got, 0), target: S.platoPct }), missing: Math.max(0, S.platoPct / 100 - got) };
  }
  if (S.goal === 'foodcost') { const ok = sim.fc <= S.fcTarget / 100 + 0.002; return { ok, txt: t('menu.goal.foodcost', { value: pct(sim.fc), target: S.fcTarget }) }; }
  const gap = goalGap(S, sim);
  return { ok: gap <= 0, txt: gap <= 0 ? t('menu.goal.met', { result: fmt(s, sim.resultado) }) : t('menu.goal.missing', { gap: fmt(s, gap) }) };
}
const eligible = (S, r) => !S.locked.includes(r.id) && r.units >= 0 && r.net > 0;

export function priceScenario(s, S, D, base, q, E, extra) {
  extra = extra || {}; const max = S.maxInc / 100; const pa = {}; const why = {};
  const capFor = id => q[id] === 'star' ? Math.min(max, 0.05) : max;
  if (S.goal === 'plato') {
    base.rows.forEach(r => { if (!eligible(S, r) || r.cm <= 0 && r.cost <= 0) return; const need = (Math.max(r.cm, 0) * S.platoPct / 100 + Math.max(0, -r.cm)) / r.net; const inc = Math.min(capFor(r.id), Math.max(0, need)); if (inc > 0.001) { pa[r.id] = 1 + inc; why[r.id] = QN[q[r.id]] + (inc < need - 0.001 ? t('menu.why.cap') : ''); } });
  } else if (S.goal === 'foodcost') {
    const tgt = S.fcTarget / 100; base.rows.forEach(r => { if (!eligible(S, r) || r.price <= 0) return; const fc = r.cost / r.price; if (fc > tgt) { const inc = Math.min(capFor(r.id), r.cost / tgt / r.price - 1); if (inc > 0.001) { pa[r.id] = 1 + inc; why[r.id] = QN[q[r.id]] + t('menu.why.cost', { pct: pct(fc, 0) }); } } });
  } else {
    const wq = { horse: 1, dog: 0.7, star: 0.35, puzzle: 0.25 }; if (S.horseMode === 'porcion') wq.horse = 0.5;
    const trial = k => { const adj = {}; base.rows.forEach(r => { if (!eligible(S, r)) return; const inc = Math.min(capFor(r.id), k * wq[q[r.id]]); if (inc > 0.0005) adj[r.id] = 1 + inc; }); return adj; };
    const target = S.goal === 'mensual' ? S.monthly : 0; const ch = extra;
    let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; const sm = simulate(s, D.rows, { ...ch, priceAdj: mid ? trial(mid) : {} }, E); if (sm.resultado >= target) hi = mid; else lo = mid; }
    Object.assign(pa, trial(hi)); Object.keys(pa).forEach(id => why[id] = QN[q[id]]);
  }
  return { pa, why };
}

export function costScenario(S, D) {
  const cut = {}, why = {}; const r = (S.reneg === false ? 0 : S.renegPct / 100);
  if (r > 0) D.ings.filter(i => i.share >= 0.08 || i.uses >= 3).slice(0, 3).forEach(i => { cut[i.id] = r; why[i.id] = t('menu.why.ingShare', { pct: pct(i.share, 0), n: i.uses, s: i.uses !== 1 ? 's' : '' }); });
  return { cut, why };
}

export function mixScenario(S, D) {
  const cs = {}, ua = {}, whyC = {}, whyU = {};
  const low = D.chans.find(x => x.c.id !== 'mostrador' && x.ratio < 0.9 && x.dist > 0);
  if (low && S.chFix !== false) { const c = low.c; const sc = c.commission > 0 ? Math.round(c.commission / (1 - c.commission) * 100) / 100 : c.surcharge; if (sc > (c.surcharge || 0)) { cs[c.id] = sc; whyC[c.id] = t('menu.why.channel', { pct: pct(low.ratio, 0) }); } }
  if (S.promoteEnigma) D.rows.forEach(r => { if (D.q[r.id] === 'puzzle' && r.units > 0) { ua[r.id] = 1.15; whyU[r.id] = t('menu.why.enigma'); } });
  return { cs, ua, whyC, whyU };
}

/** Los 4 escenarios: A Precio, B Costo, C Mix y canales, Combinado. */
export function buildScenarios(s, S, D) {
  const E = ELAST[S.elast]; const base = simulate(s, D.rows, {}, 0); const q = D.q;
  const A = priceScenario(s, S, D, base, q, E); const B = costScenario(S, D); const C = mixScenario(S, D);
  const mk = (key, title, desc, ch, why) => { const sim = simulate(s, D.rows, ch, E); const m = goalMet(s, S, base, sim); return { key, title, desc, ch, why, sim, ok: m.ok, met: m }; };
  const list = [
    mk('precio', t('menu.sc.precio'), t('menu.sc.precio.desc'), { priceAdj: A.pa }, { price: A.why }),
    mk('costo', t('menu.sc.costo'), t('menu.sc.costo.desc'), { ingCut: B.cut }, { ing: B.why }),
    mk('mix', t('menu.sc.mix'), t('menu.sc.mix.desc'), { chSurcharge: C.cs, unitAdj: C.ua }, { ch: C.whyC, units: C.whyU }),
  ];
  const bc = { ingCut: B.cut, chSurcharge: C.cs, unitAdj: C.ua }; const A2 = priceScenario(s, S, D, base, q, E, bc);
  list.push(mk('combo', t('menu.sc.combo'), t('menu.sc.combo.desc'), { ...bc, priceAdj: A2.pa }, { price: A2.why, ing: B.why, ch: C.whyC, units: C.whyU }));
  return list;
}

/** Cambios aceptados del escenario elegido (S.acc[k] === false = rechazado). */
export function acceptedChanges(S, sc) {
  const acc = k => S.acc[k] !== false; const ch = { priceAdj: {}, ingCut: {}, chSurcharge: {}, unitAdj: {} };
  Object.entries(sc.ch.priceAdj || {}).forEach(([id, f]) => { if (acc('p:' + id)) ch.priceAdj[id] = f; });
  Object.entries(sc.ch.ingCut || {}).forEach(([id, v]) => { if (acc('i:' + id)) ch.ingCut[id] = v; });
  Object.entries(sc.ch.chSurcharge || {}).forEach(([id, v]) => { if (acc('c:' + id)) ch.chSurcharge[id] = v; });
  Object.entries(sc.ch.unitAdj || {}).forEach(([id, v]) => { if (acc('u:' + id)) ch.unitAdj[id] = v; });
  return ch;
}

/** Aplica los cambios al estado: ajuste de precio por producto, costo de ingredientes, recargo de canal y unidades manuales. */
export function applyStrategyChanges(s, ch) {
  Object.entries(ch.priceAdj).forEach(([id, f]) => { const p = s.products.find(x => x.id === id); if (p) p.priceAdj = Math.round((p.priceAdj || 1) * f * 1000) / 1000; });
  Object.entries(ch.ingCut).forEach(([id, r]) => { const i = s.ingredients.find(x => x.id === id); if (i) i.precioPkg = Math.round(i.precioPkg * (1 - r) * 100) / 100; });
  Object.entries(ch.chSurcharge).forEach(([id, v]) => { const c = s.channels.find(x => x.id === id); if (c) c.surcharge = v; });
  if (Object.keys(ch.unitAdj).length) {
    const mu = s.projection.manualUnits;
    s.products.forEach(p => { if (mu[p.id] == null) mu[p.id] = getProjUnits(s, p); });
    Object.entries(ch.unitAdj).forEach(([id, m]) => { mu[id] = Math.round((mu[id] || 0) * m); });
    s.projection.manualMode = true;
  }
}
