// ═══════════════════════════════════════════════════════════
// Stock: consumo por orden y descuento / reversión manual
// Cantidades en unidad base: g/ml para ingredientes, u para envases y productos sin receta.
// ═══════════════════════════════════════════════════════════
import { comboResolveProps, getPorc } from './costs.js';
import { t } from '../i18n/index.js';

/** Qué se consume al vender esta orden: { itemId: cantidad en unidad base }. */
export function orderConsumption(s, o) {
  const cons = {};
  const add = (id, q) => { if (!id || !isFinite(q) || q <= 0) return; cons[id] = (cons[id] || 0) + q; };
  const walk = (p, factor, visited, withPack) => {
    if (!p || visited.has(p.id)) return;
    const v = new Set(visited); v.add(p.id);
    (p.ingredients || []).forEach(r => {
      if (!r.ingId) return;
      const ing = s.ingredients.find(x => x.id === r.ingId);
      const q = parseFloat(r.qty) || 0; const u = r.unit || 'g';
      let b = q;
      if (u === 'kg' || u === 'L') b = q * 1000;
      else if (u === 'u' && ing) b = q * ((ing.grPaquete / (ing.cantidad || 1)) || 1);
      add(r.ingId, b * factor);
    });
    if (withPack) (p.packaging || []).forEach(r => { if (r.envId) add(r.envId, (parseFloat(r.qty) || 1) * factor); });
    (p.combos || []).forEach(r => {
      const tg = s.products.find(x => x.id === r.prodId); if (!tg) return;
      const { prop, resolved } = comboResolveProps(r, tg);
      if (resolved && prop > 0) walk(tg, factor * prop, v, withPack && r.addPackaging !== false);
    });
  };
  (o.items || []).forEach(it => {
    const p = s.products.find(x => x.id === it.productId); if (!p) return;
    const hasRecipe = (p.ingredients || []).some(r => r.ingId) || (p.packaging || []).some(r => r.envId) || (p.combos || []).length;
    if (!hasRecipe) { add(p.id, it.qty); return; }
    walk(p, (it.qty || 0) / Math.max(0.01, getPorc(p)), new Set(), true);
  });
  return cons;
}

export function stockItemInfo(s, id) {
  const ing = s.ingredients.find(x => x.id === id); if (ing) return { name: ing.name || ing.n || id, cat: 'ingrediente', unit: 'g' };
  const env = s.packs.find(x => x.id === id); if (env) return { name: env.name || env.n || id, cat: 'envase', unit: 'u' };
  const p = s.products.find(x => x.id === id); return { name: p ? p.name : id, cat: 'producto', unit: 'u' };
}

/** Crea las filas de stock que falten (ingredientes en g, envases y productos en u). */
export function initStock(s) {
  s.ingredients.forEach(ing => { if (!s.stock[ing.id]) s.stock[ing.id] = { actual: 0, minimo: 500, unit: 'g' }; else if (!s.stock[ing.id].unit) s.stock[ing.id].unit = 'g'; });
  s.packs.forEach(env => { if (!s.stock[env.id]) s.stock[env.id] = { actual: 0, minimo: 50, unit: 'u' }; else if (!s.stock[env.id].unit) s.stock[env.id].unit = 'u'; });
  s.products.filter(p => !p.recetaOnly).forEach(p => { if (!s.stock[p.id]) s.stock[p.id] = { actual: 0, minimo: 0, unit: 'u' }; else if (!s.stock[p.id].unit) s.stock[p.id].unit = 'u'; });
}

export function stockNowLabel(now = new Date()) {
  return now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

const orderNum = o => '#' + String(o.num).padStart(4, '0');

/**
 * Descuenta el stock de una orden y deja `o.stockDeducted`. Devuelve:
 *  { ok:false, reason:'ya-descontado' | 'sin-receta' }  ó  { ok:true, applied }
 */
export function deductOrderStock(s, o, now = new Date()) {
  if (!o || o.stockDeducted) return { ok: false, reason: 'ya-descontado' };
  const cons = orderConsumption(s, o);
  const ids = Object.keys(cons);
  if (!ids.length) return { ok: false, reason: 'sin-receta' };
  initStock(s);
  const fecha = stockNowLabel(now), num = orderNum(o), applied = {};
  ids.forEach(id => {
    const info = stockItemInfo(s, id);
    if (!s.stock[id]) s.stock[id] = { actual: 0, minimo: 0, unit: info.unit };
    const cur = s.stock[id].actual || 0;
    const take = Math.min(cur, cons[id]);
    s.stock[id].actual = Math.max(0, cur - cons[id]);
    applied[id] = take;
    s.movements.push({ fecha, ing: info.name, tipo: 'egreso', qty: -Math.round(cons[id] * 100) / 100, nota: t('stock.sale', { num }) + (take < cons[id] ? t('stock.saleShort') : ''), categoria: info.cat, unit: info.unit });
  });
  o.stockDeducted = { at: now.toISOString(), items: applied };
  return { ok: true, applied };
}

/** Devuelve al stock lo que descontó la orden y quita la marca. */
export function restoreOrderStock(s, o, now = new Date()) {
  if (!o || !o.stockDeducted) return { ok: false };
  const fecha = stockNowLabel(now), num = orderNum(o);
  Object.entries(o.stockDeducted.items || {}).forEach(([id, q]) => {
    const info = stockItemInfo(s, id);
    if (!s.stock[id]) s.stock[id] = { actual: 0, minimo: 0, unit: info.unit };
    s.stock[id].actual = (s.stock[id].actual || 0) + q;
    if (q > 0) s.movements.push({ fecha, ing: info.name, tipo: 'ingreso', qty: Math.round(q * 100) / 100, nota: t('stock.reversal', { num }), categoria: info.cat, unit: info.unit });
  });
  delete o.stockDeducted;
  return { ok: true };
}
