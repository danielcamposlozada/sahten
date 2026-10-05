// ═══════════════════════════════════════════════════════════
// Precios: tier, ajuste, descuento, redondeo, canales y neto recibido
// ═══════════════════════════════════════════════════════════
import { RND } from './format.js';
import { costPerUnit } from './costs.js';
import { gfAssigned } from './gf.js';

export const getTier = (s, id) => s.tiers.find(t => t.id === id) || s.tiers[2] || s.tiers[0] || { id: '', name: '—', factor: 1, color: '#8e8e93' };
export const getChannel = (s, id) => s.channels.find(c => c.id === id) || s.channels[0] || { id: 'mostrador', name: 'Mostrador', surcharge: 0, commission: 0, enabled: true };

/** Comisión global (fracción). Antes se leía del input del DOM; ahora vive en el estado. */
export const globalComm = s => (parseFloat(s.globalCommission) || 0) / 100;
/** Cotización del dólar. Antes se leía del input del DOM; ahora vive en el estado. */
export const getUSD = s => parseFloat(s.usdRate) || 1200;

/** Precio de mostrador antes de recargo del canal y comisión: (costo + GF) × tier × ajuste − descuento, redondeado. */
// Roles sin acceso a costos (encargado, cajero) reciben los productos con `fixedPrices` ya calculados por el dueño:
// { mostrador: precio final, rappi: precio, … }. Sin esa propiedad (el caso normal) todo se calcula como siempre.
const fixed = (p, chId) => (p.fixedPrices && p.fixedPrices[chId] != null ? p.fixedPrices[chId] : null);

export function mostradorPrice(s, p) {
  if (fixed(p, 'mostrador') != null) return fixed(p, 'mostrador');
  const tier = getTier(s, p.tier);
  const base = costPerUnit(s, p) + gfAssigned(s, p);
  let price = base * tier.factor * (p.priceAdj || 1);
  const disc = p.discount || 0;
  const dtype = p.discountType || 'pct';
  if (disc > 0) {
    if (dtype === 'pct') price = price * (1 - disc);
    else price = price - disc;
  }
  return Math.max(0, RND(s, price));
}

export function mostradorFinalPrice(s, p) {
  if (fixed(p, 'mostrador') != null) return fixed(p, 'mostrador');
  const mostradorCh = s.channels.find(c => c.id === 'mostrador');
  if (!mostradorCh) return mostradorPrice(s, p);
  const afterSurcharge = mostradorPrice(s, p) * (1 + mostradorCh.surcharge);
  return RND(s, afterSurcharge * (1 + globalComm(s)));
}

/** Precio que se COBRA al cliente en el canal. La comisión global se aplica una sola vez. */
export function channelPrice(s, p, chId) {
  const ch = getChannel(s, chId);
  if (!ch.enabled) return null;
  if (fixed(p, chId) != null) return fixed(p, chId);
  if (chId === 'mostrador') {
    const afterSurcharge = mostradorPrice(s, p) * (1 + ch.surcharge);
    return RND(s, afterSurcharge * (1 + globalComm(s)));
  }
  const mostCh = s.channels.find(c => c.id === 'mostrador');
  const base = mostradorPrice(s, p) * (1 + (mostCh ? mostCh.surcharge : 0));
  return RND(s, base * (1 + ch.surcharge) * (1 + globalComm(s)));
}

/** Lo que RECIBÍS = precio cobrado × (1 − comisión de la plataforma). */
export function channelNetReceived(s, p, chId) {
  const ch = getChannel(s, chId);
  if (!ch.enabled) return null;
  const gross = channelPrice(s, p, chId);
  if (gross == null) return null;
  return Math.round(gross * (1 - (ch.commission || 0)));
}

/** Descuento efectivo de canal para un producto (no acumulable): producto › canal. */
export function effectiveChannelDisc(s, p, chId) {
  const prodDisc = ((p.channelDiscounts || {})[chId]) || 0;
  if (prodDisc > 0) return prodDisc / 100;
  const ch = getChannel(s, chId);
  return (ch.channelDisc || 0) / 100;
}

// NOTA (v3, sin cambios en la Fase A): el descuento de canal redondea siempre a $50,
// no al `roundTo` de la moneda. Pendiente de decisión (ver resumen de la Fase A).
export function channelPriceWithDisc(s, p, chId) {
  const base = channelPrice(s, p, chId);
  if (base == null) return null;
  const disc = effectiveChannelDisc(s, p, chId);
  if (disc <= 0) return base;
  return Math.round(base * (1 - disc) / 50) * 50;
}

export function channelNetReceivedWithDisc(s, p, chId) {
  const gross = channelPriceWithDisc(s, p, chId);
  if (gross == null) return null;
  const ch = getChannel(s, chId);
  return Math.round(gross * (1 - (ch.commission || 0)));
}

export function marginPct(price, cost) { return price > 0 ? (price - cost) / price : 0; }

/** Ganancia extra generada por el factor de tier, por encima de costo + GF. */
export const tierProfitPerUnit = (s, p) => (getTier(s, p.tier).factor - 1) * (costPerUnit(s, p) + gfAssigned(s, p));
export const tierProfitTotal = s => s.products.reduce((a, p) => a + tierProfitPerUnit(s, p) * (p.avgMes || 0), 0);
