// ═══════════════════════════════════════════════════════════
// Puente con el código legado (src/legacy/*.js, scripts clásicos con onclick="…" en el HTML)
//
// - Las variables globales de v3 (PRODUCTS, TIERS, GASTOS_OP, projManualMode…) ahora son
//   accesores sobre el estado único: el código viejo las sigue leyendo y asignando igual,
//   pero el dato vive en `state`.
// - Las funciones de cálculo (costPerUnit, mostradorPrice, channelPrice…) son envoltorios
//   finos sobre src/core/ con el estado ya aplicado.
//
// A medida que cada panel se migre a src/modules/, estos globales se pueden ir retirando.
// ═══════════════════════════════════════════════════════════
import { state } from '../core/state.js';
import * as C from '../core/index.js';
import { events } from '../events.js';

const w = window;
const accessor = (name, get, set) => Object.defineProperty(w, name, { get, set, configurable: true, enumerable: false });
const fn = (name, f) => Object.defineProperty(w, name, { value: f, writable: true, configurable: true, enumerable: false });

// ── Estado → globales ────────────────────────────────────
const map = {
  TIERS: 'tiers', CHANNELS: 'channels', INGREDIENTES: 'ingredients', ENVASES: 'packs', PRODUCTS: 'products',
  GASTOS_OP: 'gastosOp', GASTOS_S: 'gastosS', GF_DISC_HISTORY: 'gfDiscHistory', GF_MONTHS: 'gfMonths',
  SAHTEN_PROJECT: 'project', STOCK: 'stock', MOVIMIENTOS: 'movements', customTC: 'customTC',
};
Object.entries(map).forEach(([g, k]) => accessor(g, () => state[k], v => { state[k] = v; }));
const proj = { projChannelDist: 'channelDist', projChannelLocked: 'channelLocked', projManualMode: 'manualMode', projManualUnits: 'manualUnits' };
Object.entries(proj).forEach(([g, k]) => accessor(g, () => state.projection[k], v => { state.projection[k] = v; }));

// ── Funciones del núcleo con el estado aplicado ──────────
const S = state;
const bind = {
  fmt: n => C.fmt(S, n),
  RND: v => C.RND(S, v),
  getUSD: () => C.getUSD(S),
  globalComm: () => C.globalComm(S),
  getTier: id => C.getTier(S, id),
  getChannel: id => C.getChannel(S, id),
  // costos
  toBase: (v, u) => C.toBase(v, u),
  ingNormalize: ing => C.ingNormalize(ing),
  ingPxBase: ing => C.ingPxBase(ing),
  calcIngCost: row => C.calcIngCost(S, row),
  calcEnvCost: row => C.calcEnvCost(S, row),
  calcPackCost: row => C.calcPackCost(S, row),
  calcComboCost: (row, visited) => C.calcComboCost(S, row, visited),
  _comboResolveProps: (row, target) => C.comboResolveProps(row, target),
  comboFracVal: f => C.comboFracVal(f),
  ingRowWeightG: row => C.ingRowWeightG(S, row),
  comboRowWeightG: row => C.comboRowWeightG(S, row),
  calcAutoWeight: p => C.calcAutoWeight(S, p),
  calcAutoPorc: p => C.calcAutoPorc(p),
  getPorc: p => C.getPorc(p),
  packCost: p => C.packCost(S, p),
  comboCost: p => C.comboCost(S, p),
  totalCost: p => C.totalCost(S, p),
  costPerUnit: p => C.costPerUnit(S, p),
  recalcRecetaCost: p => C.recalcRecetaCost(S, p),
  // gastos fijos
  totalGFRaw: () => C.totalGFRaw(S),
  totalGFDiscount: () => C.totalGFDiscount(S),
  totalGF: () => C.totalGF(S),
  totalGFPct: () => C.totalGFPct(S),
  absorbsGF: p => C.absorbsGF(p),
  gfUnitsBase: () => C.gfUnitsBase(S),
  gfPerUnit: () => C.gfPerUnit(S),
  gfPerProduct: () => C.gfPerUnit(S),
  gfAssigned: p => C.gfAssigned(S, p),
  gfCoverageAmount: () => C.gfCoverageAmount(S),
  gfCoveragePct: () => C.gfCoveragePct(S),
  gfNewId: () => C.gfNewId(),
  gfEnsureIds: () => C.gfEnsureIds(S),
  gfArr: type => C.gfArr(S, type),
  gfmNowKey: () => C.gfmNowKey(),
  gfmLabel: k => C.gfmLabel(k),
  gfmShift: (k, d) => C.gfmShift(k, d),
  gfmPrevWithData: k => C.gfmPrevWithData(S, k),
  gfmBudgetItems: k => C.gfmBudgetItems(S, k),
  gfmGet: (k, create) => C.gfmGet(S, k, create),
  gfmSyncOpen: () => C.gfmSyncOpen(S),
  gfmLog: (action, name, d) => C.gfmLog(S, action, name, d),
  gfmHas: i => C.gfmHas(i),
  gfmTotals: m => C.gfmTotals(m),
  gfmLastVar: () => C.gfmLastVar(S),
  gfmEnsureMonths: () => { const changed = C.gfmEnsureMonths(S); if (changed && typeof w.scheduleSave === 'function') w.scheduleSave(); return changed; },
  gfmReminder: () => C.gfmReminder(S),
  // precios
  mostradorPrice: p => C.mostradorPrice(S, p),
  mostradorFinalPrice: p => C.mostradorFinalPrice(S, p),
  channelPrice: (p, ch) => C.channelPrice(S, p, ch),
  channelNetReceived: (p, ch) => C.channelNetReceived(S, p, ch),
  effectiveChannelDisc: (p, ch) => C.effectiveChannelDisc(S, p, ch),
  channelPriceWithDisc: (p, ch) => C.channelPriceWithDisc(S, p, ch),
  channelNetReceivedWithDisc: (p, ch) => C.channelNetReceivedWithDisc(S, p, ch),
  marginPct: (price, cost) => C.marginPct(price, cost),
  tierProfitPerUnit: p => C.tierProfitPerUnit(S, p),
  tierProfitTotal: () => C.tierProfitTotal(S),
  tierProfitTotalProj: () => C.tierProfitTotalProj(S),
  // proyección
  getProjUnits: p => C.getProjUnits(S, p),
  initProjDist: () => C.initProjDist(S),
  computeProjection: () => C.computeProjection(S),
  // stock
  initStock: () => C.initStock(S),
  _orderConsumption: o => C.orderConsumption(S, o),
  _stockItemInfo: id => C.stockItemInfo(S, id),
};
Object.entries(bind).forEach(([name, f]) => fn(name, f));
fn('COMBO_FRACS', C.COMBO_FRACS);

// ── Comisión global y dólar: el estado manda, los inputs lo reflejan ──
function bindInput(id, key, parse) {
  const el = document.getElementById(id);
  if (!el) return;
  const sync = () => { state[key] = parse(el.value); };
  el.addEventListener('input', sync);
  el.addEventListener('change', sync);
  sync();
}
/** Escribe en el estado y refleja el valor en los inputs (los que existan). */
export function setSetting(key, value, inputIds) {
  state[key] = key === 'usdRate' ? (parseFloat(value) || 1200) : (parseFloat(value) || 0);
  (inputIds || []).forEach(id => { const el = document.getElementById(id); if (el && value != null) el.value = value; });
}
export function bindSettingInputs() {
  bindInput('global-commission', 'globalCommission', v => parseFloat(v) || 0);
  bindInput('usd-rate', 'usdRate', v => parseFloat(v) || 1200);
  const drawer = document.getElementById('usd-rate-drawer');
  const mobile = document.getElementById('usd-rate-mobile');
  [drawer, mobile].forEach(el => el && el.addEventListener('input', () => { state.usdRate = parseFloat(el.value) || 1200; }));
}

// ── Para código nuevo ────────────────────────────────────
w.SAHTEN = { state, core: C, events, setSetting };
