import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../src/core/index.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJSON = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

/** Estado nuevo a partir del proyecto de ejemplo (tests/fixtures/demo-raw-v3.sahten). */
export const demoState = () => C.stateFromSahten(readJSON('tests/fixtures/demo-raw-v3.sahten'));

/** "api" con los mismos nombres que el v3, ligada a un estado (para dumpNumbers). */
export function coreApi(s) {
  return {
    products: () => s.products, channels: () => s.channels,
    totalGF: () => C.totalGF(s), totalGFRaw: () => C.totalGFRaw(s), gfPerUnit: () => C.gfPerUnit(s), gfUnitsBase: () => C.gfUnitsBase(s),
    gfCoverageAmount: () => C.gfCoverageAmount(s), gfCoveragePct: () => C.gfCoveragePct(s), tierProfitTotal: () => C.tierProfitTotal(s),
    tierProfitTotalProj: () => C.tierProfitTotalProj(s), totalGFPct: () => C.totalGFPct(s), globalComm: () => C.globalComm(s), getUSD: () => C.getUSD(s),
    channelPrice: (p, c) => C.channelPrice(s, p, c), channelNetReceived: (p, c) => C.channelNetReceived(s, p, c),
    channelPriceWithDisc: (p, c) => C.channelPriceWithDisc(s, p, c), channelNetReceivedWithDisc: (p, c) => C.channelNetReceivedWithDisc(s, p, c),
    effectiveChannelDisc: (p, c) => C.effectiveChannelDisc(s, p, c),
    totalCost: p => C.totalCost(s, p), getPorc: p => C.getPorc(p), costPerUnit: p => C.costPerUnit(s, p), gfAssigned: p => C.gfAssigned(s, p),
    absorbsGF: p => C.absorbsGF(p), mostradorPrice: p => C.mostradorPrice(s, p), mostradorFinalPrice: p => C.mostradorFinalPrice(s, p),
    getProjUnits: p => C.getProjUnits(s, p),
    projectionData: () => { const d = C.computeProjection(s); return { name: 'Proyección actual', gf: d.gf, tI: d.tI, tC: d.tC, tM: d.tM, resultado: d.resultado, totalUnits: d.totalUnits, ticketProm: d.ticketProm, channelBreakdown: d.channelBreakdown, gananciaDiaria: d.gananciaDiaria, gananciaWeekly: d.gananciaWeekly, dist: d.dist, mode: d.mode, rows: d.rows.map(r => ({ name: r.name, units: r.units, ing: r.ing, cost: r.cost, marg: r.marg })), live: true }; },
    snapshotData: () => { const d = C.computeProjection(s); return { gf: d.gf, tI: d.tI, tC: d.tC, tM: d.tM, resultado: d.resultado, dist: d.dist, mode: d.mode, manualUnits: { ...s.projection.manualUnits }, rows: d.rows.map(r => ({ name: r.name, units: r.units, ing: r.ing, cost: r.cost, marg: r.marg })), name: 'x', gananciaDiaria: d.gananciaDiaria, gananciaWeekly: d.gananciaWeekly }; },
    fmt: n => C.fmt(s, n), RND: v => C.RND(s, v),
  };
}

/** Compara dos valores JSON: igual estructura, números con tolerancia relativa 1e-9. Devuelve la lista de diferencias. */
export function diffNumbers(actual, expected, pathStr = '', out = []) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Math.abs(actual - expected) > 1e-9 * Math.max(1, Math.abs(expected))) out.push(`${pathStr}: ${actual} ≠ ${expected}`);
  } else if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') { out.push(`${pathStr}: falta`); return out; }
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    keys.forEach(k => diffNumbers(actual[k], expected[k], pathStr + '/' + k, out));
  } else if (actual !== expected) out.push(`${pathStr}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
  return out;
}
