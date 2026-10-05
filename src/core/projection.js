// ═══════════════════════════════════════════════════════════
// Proyección: UNA sola computeProjection() para pantalla, snapshot, CSV y PDF
// ═══════════════════════════════════════════════════════════
import { costPerUnit } from './costs.js';
import { totalGF, gfAssigned } from './gf.js';
import { channelPrice, channelPriceWithDisc, channelNetReceivedWithDisc, tierProfitPerUnit } from './pricing.js';

// ── Distribución por canal ───────────────────────────────
/** Inicializa / normaliza la distribución para que sume 100 entre los canales activos. */
export function initProjDist(s) {
  const pr = s.projection;
  const active = s.channels.filter(c => c.enabled);
  if (active.length === 0) return;
  const existing = Object.keys(pr.channelDist).filter(id => s.channels.find(c => c.id === id && c.enabled));
  if (existing.length > 0) {
    const sum = existing.reduce((a, id) => a + (pr.channelDist[id] || 0), 0);
    if (sum > 0) {
      existing.forEach(id => pr.channelDist[id] = Math.round(pr.channelDist[id] / sum * 100));
      const s2 = existing.reduce((a, id) => a + pr.channelDist[id], 0);
      if (s2 !== 100) pr.channelDist[existing[0]] += (100 - s2);
    }
    return;
  }
  const pct = Math.floor(100 / active.length);
  const rem = 100 - pct * active.length;
  pr.channelDist = {};
  active.forEach((c, i) => { pr.channelDist[c.id] = pct + (i === 0 ? rem : 0); });
}

/** Cambia el % de un canal y reparte el resto entre los canales libres (no bloqueados). */
export function setProjDist(s, chId, newVal) {
  const pr = s.projection;
  const active = s.channels.filter(c => c.enabled);
  const free = active.filter(c => c.id !== chId && !pr.channelLocked[c.id]);
  newVal = Math.max(0, Math.min(100, Math.round(newVal)));
  const lockedSum = active.filter(c => c.id !== chId && pr.channelLocked[c.id]).reduce((a, c) => a + (pr.channelDist[c.id] || 0), 0);
  const remaining = Math.max(0, 100 - newVal - lockedSum);
  if (free.length === 0) { pr.channelDist[chId] = newVal; return; }
  const freeSum = free.reduce((a, c) => a + (pr.channelDist[c.id] || 0), 0);
  if (freeSum === 0) {
    const share = Math.floor(remaining / free.length);
    const rem2 = remaining - share * free.length;
    free.forEach((c, i) => pr.channelDist[c.id] = share + (i === 0 ? rem2 : 0));
  } else {
    let assigned = 0;
    free.forEach((c, i) => {
      if (i === free.length - 1) { pr.channelDist[c.id] = Math.max(0, remaining - assigned); }
      else {
        const v = Math.round((pr.channelDist[c.id] || 0) / freeSum * remaining);
        pr.channelDist[c.id] = Math.max(0, v); assigned += v;
      }
    });
  }
  pr.channelDist[chId] = newVal;
}

/** Normaliza para que sume 100. Devuelve false si la suma es 0 (hay que reinicializar). */
export function normalizeProjDist(s) {
  const pr = s.projection;
  const active = s.channels.filter(c => c.enabled);
  const sum = active.reduce((a, c) => a + (pr.channelDist[c.id] || 0), 0);
  if (sum === 0) { initProjDist(s); return false; }
  active.forEach(c => pr.channelDist[c.id] = Math.round(pr.channelDist[c.id] / sum * 100));
  const s2 = active.reduce((a, c) => a + pr.channelDist[c.id], 0);
  const first = active.find(c => !pr.channelLocked[c.id]) || active[0];
  if (first) pr.channelDist[first.id] += (100 - s2);
  return true;
}

// ── Unidades ─────────────────────────────────────────────
export function getProjUnits(s, p) {
  const pr = s.projection;
  if (pr.manualMode) return pr.manualUnits[p.id] != null ? pr.manualUnits[p.id] : (p.avgMes || 0);
  return p.avgMes || 0;
}
export const tierProfitTotalProj = s => s.products.reduce((a, p) => a + tierProfitPerUnit(s, p) * getProjUnits(s, p), 0);

// ── Cálculo único ────────────────────────────────────────
/**
 * Proyección mensual completa.
 *  - Ingreso = Σ unidades × %canal × neto recibido (con descuento de canal)
 *  - Costo   = unidades × costo por unidad (el GF se resta una sola vez en el resultado)
 *  - Resultado operativo = margen − GF del mes
 * Antes de calcular normaliza la distribución de canales (initProjDist, idempotente):
 * así el snapshot y el CSV dan lo mismo aunque la pantalla de Proyección no se haya abierto.
 */
export function computeProjection(s) {
  initProjDist(s);
  const pr = s.projection;
  const gf = totalGF(s);
  const channels = s.channels.filter(c => c.enabled);
  let tI = 0, tC = 0, tM = 0, totalUnits = 0, gfContribTotal = 0;
  const chIncome = {}, chUnits = {}, chGross = {};

  const rows = s.products.map(p => {
    const units = getProjUnits(s, p);
    totalUnits += units;
    const unitCost = costPerUnit(s, p);
    const gfContrib = Math.round(units * gfAssigned(s, p));
    gfContribTotal += gfContrib;

    let ingRaw = 0;
    const byChannel = {};
    channels.forEach(c => {
      const net = channelNetReceivedWithDisc(s, p, c.id);
      const gross = channelPriceWithDisc(s, p, c.id) ?? channelPrice(s, p, c.id);
      const pct = pr.channelDist[c.id] || 0;
      if (net == null) { byChannel[c.id] = { pct, units: 0, net: null, gross, income: 0 }; return; }
      const u = units * (pct / 100);
      ingRaw += u * net;
      chIncome[c.id] = (chIncome[c.id] || 0) + u * net;
      chUnits[c.id] = (chUnits[c.id] || 0) + u;
      if (gross != null) chGross[c.id] = (chGross[c.id] || 0) + u * gross;
      byChannel[c.id] = { pct, units: u, net, gross, income: u * net };
    });
    const ing = Math.round(ingRaw);
    const cost = Math.round(units * unitCost);
    const marg = ing - cost;
    tI += ing; tC += cost; tM += marg;
    return { id: p.id, name: p.name, star: !!p.star, units, unitCost, gfContrib, ing, cost, marg, byChannel };
  });

  const resultado = tM - gf;
  const ticketProm = totalUnits > 0 ? tI / totalUnits : 0;
  const channelBreakdown = channels.map(c => ({
    id: c.id, name: c.name, pct: pr.channelDist[c.id] || 0,
    units: Math.round(chUnits[c.id] || 0),
    ticketNeto: (chUnits[c.id] || 0) > 0 ? (chIncome[c.id] || 0) / chUnits[c.id] : 0,
    ticketCliente: (chUnits[c.id] || 0) > 0 ? (chGross[c.id] || 0) / chUnits[c.id] : 0,
  }));

  return {
    gf, channels, rows, tI, tC, tM, resultado, totalUnits, ticketProm, gfContribTotal,
    chIncome, chUnits, chGross, channelBreakdown,
    gananciaDiaria: resultado / 30,
    gananciaWeekly: resultado / 4.33,
    dist: { ...pr.channelDist },
    mode: pr.manualMode ? 'manual' : 'ventas',
  };
}
