import { t } from '../i18n/index.js';

// ═══════════════════════════════════════════════════════════
// Gastos fijos (GF): total, quién los absorbe, GF por unidad
// y control mensual (presupuesto vs real, cierre, registro de cambios)
// ═══════════════════════════════════════════════════════════

// ── Total y reparto ──────────────────────────────────────
export const totalGFRaw = s => s.gastosOp.reduce((a, g) => a + g.amount, 0) + s.gastosS.reduce((a, g) => a + g.amount, 0);
/** Los descuentos sobre el GF se eliminaron en v3 (se reemplazaron por el control mensual). */
export const totalGFDiscount = () => 0;
export const totalGF = s => totalGFRaw(s);
export const totalGFPct = s => s.products.reduce((a, p) => a + (p.gfPct || 0), 0);

/** ¿Este producto absorbe GF? Por defecto sí, salvo los que son solo receta. */
export const absorbsGF = p => p.absorbeGF != null ? !!p.absorbeGF : !p.recetaOnly;

export const gfUnitsBase = s => s.products.reduce((a, p) => a + (absorbsGF(p) ? (p.avgMes || 0) : 0), 0);

/** GF por unidad. Sin ventas por producto, usa las ventas estimadas del setup inicial. */
export function gfPerUnit(s) {
  const u = gfUnitsBase(s);
  if (u > 0) return totalGF(s) / u;
  const est = +s.project.estUnitsMonth || 0;
  return est > 0 ? totalGF(s) / est : 0;
}

/** GF asignado a un producto (gfPctOverride: 100 = promedio, 150 = 50% más, 70 = 30% menos). */
export function gfAssigned(s, p) {
  if (!absorbsGF(p)) return 0;
  const base = gfPerUnit(s);
  if (p.gfPctOverride != null) return base * (p.gfPctOverride / 100);
  return base;
}

/** Cuánto GF se recupera al mes (ponderado por volumen). */
export const gfCoverageAmount = s => s.products.reduce((a, p) => a + gfAssigned(s, p) * (p.avgMes || 0), 0);
export function gfCoveragePct(s) {
  const tot = totalGF(s);
  return tot > 0 ? (gfCoverageAmount(s) / tot) * 100 : 0;
}

// ── Ids estables de los gastos ───────────────────────────
export function gfNewId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function gfEnsureIds(s) { [s.gastosOp, s.gastosS].forEach(a => a.forEach(g => { if (!g.id) g.id = gfNewId(); })); }
export const gfArr = (s, type) => type === 'op' ? s.gastosOp : s.gastosS;

// ── Control mensual (GF_MONTHS) ──────────────────────────
export const GFM_MONTHS_ES = t('gf.months').split(',');

export const gfmNowKey = (now = new Date()) => now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
export function gfmLabel(k) { const [y, m] = k.split('-'); return GFM_MONTHS_ES[+m - 1] + ' ' + y; }
export function gfmShift(k, d) {
  let [y, m] = k.split('-').map(Number);
  m += d;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return y + '-' + String(m).padStart(2, '0');
}
export const gfmPrevWithData = (s, k) => Object.keys(s.gfMonths).filter(x => x < k).sort().pop() || null;
export const gfmHas = i => i.real != null && i.real !== '';

/** Nuevo mes: presupuesto = gastos fijos actuales; real precargado con el real del mes anterior (o el presupuesto). */
export function gfmBudgetItems(s, k) {
  const prev = k ? gfmPrevWithData(s, k) : null;
  const pm = prev ? s.gfMonths[prev] : null;
  const mk = (g, type) => {
    const pi = pm ? pm.items.find(i => (i.gid && i.gid === g.id) || (!i.gid && i.name === g.name && i.type === type)) : null;
    const real = pi && gfmHas(pi) ? +pi.real : (g.amount || 0);
    return { gid: g.id, name: g.name, type, budget: g.amount || 0, real };
  };
  return [...s.gastosOp.map(g => mk(g, 'op')), ...s.gastosS.map(g => mk(g, 's'))];
}

export function gfmGet(s, k, create, now = new Date()) {
  if (!s.gfMonths[k] && create) {
    gfEnsureIds(s);
    s.gfMonths[k] = { items: gfmBudgetItems(s, k), note: '', closed: k < gfmNowKey(now), reviewed: false, createdAt: now.toISOString(), log: [] };
  }
  return s.gfMonths[k] || null;
}

/** Mantiene sincronizados los meses abiertos (en curso y preparados) con la lista de gastos fijos. */
export function gfmSyncOpen(s, now = new Date()) {
  gfEnsureIds(s);
  const cur = gfmNowKey(now);
  Object.keys(s.gfMonths).filter(k => k >= cur && !s.gfMonths[k].closed).forEach(k => {
    const mm = s.gfMonths[k];
    mm.items.forEach(i => { if (!i.gid && !i.extra) { const g = gfArr(s, i.type).find(x => x.name === i.name); if (g) i.gid = g.id; } });
    const items = [];
    [['op', s.gastosOp], ['s', s.gastosS]].forEach(([type, arr]) => arr.forEach(g => {
      const ex = mm.items.find(i => i.gid === g.id);
      items.push(ex ? { ...ex, name: g.name, type, budget: g.amount || 0 } : { gid: g.id, name: g.name, type, budget: g.amount || 0, real: g.amount || 0 });
    }));
    mm.items = [...items, ...mm.items.filter(i => i.extra)];
  });
}

/** Toda edición de gastos fijos (alta, renombre, monto, baja) queda registrada en el mes en curso. */
export function gfmLog(s, action, name, d, now = new Date()) {
  const m = gfmGet(s, gfmNowKey(now), true, now);
  if (!m.log) m.log = [];
  m.log.push({ at: now.toISOString(), action, name, ...(d || {}) });
}

export function gfmTotals(m) {
  const b = m.items.reduce((a, i) => a + (i.budget || 0), 0);
  const wr = m.items.filter(gfmHas);
  const r = wr.reduce((a, i) => a + (+i.real || 0), 0);
  return { budget: b, real: r, hasReal: wr.length > 0, complete: wr.length === m.items.length };
}

/** Variación (%) real vs presupuesto del último mes con real cargado. */
export function gfmLastVar(s) {
  const keys = Object.keys(s.gfMonths).sort().reverse();
  for (const k of keys) {
    const tot = gfmTotals(s.gfMonths[k]);
    if (tot.hasReal && tot.budget > 0) return (tot.real - tot.budget) / tot.budget * 100;
  }
  return null;
}

/** Cierra automáticamente los meses pasados y crea el mes en curso precargado. Devuelve true si cambió algo. */
export function gfmEnsureMonths(s, now = new Date()) {
  gfEnsureIds(s);
  gfmSyncOpen(s, now);
  const cur = gfmNowKey(now);
  let changed = false;
  Object.keys(s.gfMonths).forEach(k => {
    const mm = s.gfMonths[k];
    if (k < cur && !mm.closed && !mm.reopened) { mm.closed = true; mm.autoClosed = true; mm.closedAt = now.toISOString(); changed = true; }
  });
  if (!s.gfMonths[cur] && (s.gastosOp.length || s.gastosS.length)) { gfmGet(s, cur, true, now); changed = true; }
  // Migración: meses abiertos sin ningún real cargado → precargar
  Object.keys(s.gfMonths).forEach(k => {
    const mm = s.gfMonths[k];
    if (mm.reviewed == null) { mm.reviewed = false; changed = true; }
    if (!mm.closed && mm.items.length && !mm.items.some(gfmHas)) {
      const pre = gfmBudgetItems(s, k);
      mm.items.forEach(i => { const p = pre.find(x => x.name === i.name && x.type === i.type); i.real = p ? p.real : (i.budget || 0); });
      changed = true;
    }
  });
  return changed;
}

/** Recordatorio: últimos 3 días del mes (revisar el próximo) o mes en curso sin revisar. */
export function gfmReminder(s, now = new Date()) {
  const cur = gfmNowKey(now), next = gfmShift(cur, 1);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() >= dim - 2 && !(s.gfMonths[next] && s.gfMonths[next].reviewed)) {
    return { key: next, text: t('gf.remind.next', { month: gfmLabel(next) }) };
  }
  if (s.gfMonths[cur] && !s.gfMonths[cur].reviewed) {
    return { key: cur, text: t('gf.remind.current', { month: gfmLabel(cur) }) };
  }
  return null;
}

// ── Operaciones sobre el mes (sin UI) ────────────────────
export function gfmAddExtra(s, k, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed) return null;
  m.items.push({ gid: null, extra: true, name: t('gf.extra'), type: 'op', budget: 0, real: 0 });
  if (!m.log) m.log = [];
  m.log.push({ at: now.toISOString(), action: 'extra', name: t('gf.extra') });
  return m;
}
export function gfmRenameItem(s, k, i, v, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed || !m.items[i]) return null;
  m.items[i].name = (v || '').trim() || m.items[i].name;
  return m;
}
export function gfmDelExtra(s, k, i, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed || !m.items[i] || !m.items[i].extra) return null;
  if (!m.log) m.log = [];
  m.log.push({ at: now.toISOString(), action: 'extra-del', name: m.items[i].name, from: m.items[i].real });
  m.items.splice(i, 1);
  return m;
}
export function gfmSetReal(s, k, i, v, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed) return null;
  m.items[i].real = v === '' ? null : (parseFloat(v) || 0);
  return m;
}
export function gfmSyncBudget(s, k, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed) return null;
  const old = m.items;
  m.items = gfmBudgetItems(s, k).map(n => { const o = old.find(x => x.name === n.name && x.type === n.type); return o ? { ...n, real: o.real } : n; });
  return m;
}
export function gfmCopyBudgetToReal(s, k, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed) return null;
  m.items.forEach(i => { i.real = i.budget; });
  return m;
}
export function gfmToggleClose(s, k, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  if (m.closed) { m.closed = false; m.reopened = true; }
  else { m.closed = true; m.reopened = false; m.closedAt = now.toISOString(); }
  return m;
}
export function gfmMarkReviewed(s, k, now = new Date()) {
  const m = gfmGet(s, k, true, now);
  m.reviewed = true; m.reviewedAt = now.toISOString();
  return m;
}

/** Meses cerrados y completos (hasta 3) con los que se calcula el promedio real. */
export function gfmAverageKeys(s) {
  return Object.keys(s.gfMonths).filter(k => s.gfMonths[k].closed && gfmTotals(s.gfMonths[k]).complete).sort().slice(-3);
}
/** Reemplaza los montos de GF por el promedio real de `keys`. Cambia todos los precios. */
export function gfmApplyAverage(s, keys) {
  const avg = (name, type) => {
    const v = keys.map(k => s.gfMonths[k].items.find(i => i.name === name && i.type === type)).filter(Boolean).map(i => +i.real || 0);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  s.gastosOp.forEach(g => { const a = avg(g.name, 'op'); if (a != null) g.amount = a; });
  s.gastosS.forEach(g => { const a = avg(g.name, 's'); if (a != null) g.amount = a; });
}

// ── Alta / baja / edición de un gasto fijo (con registro) ─
export function gfAddRow(s, type, now = new Date()) {
  const g = { id: gfNewId(), name: type === 'op' ? t('gf.newExpense') : t('gf.newEmployee'), amount: 0 };
  gfArr(s, type).push(g);
  gfmLog(s, 'add', g.name, { type }, now);
  gfmSyncOpen(s, now);
  return g;
}
export function gfEditName(s, type, i, v, now = new Date()) {
  const g = gfArr(s, type)[i]; if (!g) return false;
  v = (v || '').trim() || g.name;
  if (v === g.name) return false;
  gfmLog(s, 'rename', v, { from: g.name, to: v, type }, now);
  g.name = v; gfmSyncOpen(s, now);
  return true;
}
export function gfEditAmount(s, type, i, v, now = new Date()) {
  const g = gfArr(s, type)[i]; if (!g) return false;
  const n = parseFloat(v) || 0;
  if (n === g.amount) return false;
  gfmLog(s, 'amount', g.name, { from: g.amount, to: n, type }, now);
  g.amount = n; gfmSyncOpen(s, now);
  return true;
}
export function gfDeleteRow(s, type, i, now = new Date()) {
  const arr = gfArr(s, type); const g = arr[i]; if (!g) return false;
  gfmLog(s, 'delete', g.name, { from: g.amount, type }, now);
  arr.splice(i, 1); gfmSyncOpen(s, now);
  return true;
}
