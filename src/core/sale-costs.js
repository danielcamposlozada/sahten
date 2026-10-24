// Registro privado: nunca viaja en el catálogo público ni en los pedidos operativos.
import { costPerUnit, actualCostPerUnit } from './costs.js';
import { gfAssigned, actualGfAssigned } from './gf.js';
import { channelCommission, channelPriceWithDisc } from './pricing.js';
import { policyFor } from './price-policy.js';
const cents = n => Math.round((Number(n) || 0) * 100) / 100;
const indexes = new WeakMap();
function quoteIndex(book) {
  if (!indexes.has(book)) indexes.set(book, new Map(Object.entries(book).map(([id, q]) => [q.fingerprint, id])));
  return indexes.get(book);
}

const quotation = (s, p, channel) => ({ productId: p.id, channel, price: channelPriceWithDisc(s, p, channel), unitVariable: costPerUnit(s, p, channel), unitFixed: gfAssigned(s, p, channel), commissionRate: channelCommission(s, p, channel), actualVariableAtCapture: actualCostPerUnit(s, p), actualFixedAtCapture: actualGfAssigned(s, p), revision: policyFor(p, channel).revision || null, policy: JSON.parse(JSON.stringify(policyFor(p, channel))) });
export function preparePricingQuotes(s, now = new Date()) {
  s.pricingQuotes ||= {};
  const index = quoteIndex(s.pricingQuotes);
  let changed = false;
  for (const p of s.products.filter(p => !p.recetaOnly && !p.fixedPrices)) for (const c of s.channels.filter(c => c.enabled)) {
    const value = quotation(s, p, c.id), fingerprint = JSON.stringify(value);
    if (index.has(fingerprint)) continue;
    const id = globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
    s.pricingQuotes[id] = { ...value, fingerprint, createdAt: now.toISOString() }; index.set(fingerprint, id); changed = true;
  }
  return changed;
}
export function pricingQuoteIds(s, p) {
  if (p.quoteIds) return p.quoteIds;
  return Object.fromEntries(s.channels.filter(c => c.enabled).map(c => {
    const fingerprint = JSON.stringify(quotation(s, p, c.id));
    return [c.id, s.pricingQuotes ? quoteIndex(s.pricingQuotes).get(fingerprint) : undefined];
  }).filter(([, id]) => id));
}

export function captureSaleCosts(s, order, { now = new Date(), basis = 'at-sale' } = {}) {
  if (!order?.id || s.saleCosts?.[order.id]) return false;
  const channel = order.pricingChannelId || 'mostrador';
  const lines = order.items || [];
  if (!lines.length) return false;
  if (lines.some(it => !Number.isFinite(Number(it.qty)) || Number(it.qty) <= 0 || !Number.isFinite(Number(it.unitPrice)) || Number(it.unitPrice) < 0 || !Number.isFinite(Number(it.lineTotal ?? it.unitPrice * it.qty)) || Number(it.lineTotal ?? it.unitPrice * it.qty) < 0)) return false;
  const amounts = lines.map(it => Math.round(Number(it.lineTotal ?? it.unitPrice * it.qty) * 100));
  const gross = amounts.reduce((a, n) => a + n, 0);
  const discount = Math.max(0, Math.min(gross, Math.round((Number(order.discountAmount ?? order.discount) || 0) * 100)));
  const shares = amounts.map(n => gross ? discount * n / gross : 0), allocations = shares.map(Math.floor);
  const rest = discount - allocations.reduce((a, n) => a + n, 0);
  [...shares.keys()].sort((a, b) => (shares[b] - allocations[b]) - (shares[a] - allocations[a])).slice(0, rest).forEach(i => allocations[i]++);
  const items = lines.map((it, i) => {
    const p = s.products.find(p => p.id === it.productId);
    const quote = it.priceRevision ? s.pricingQuotes?.[it.priceRevision] : null;
    const known = quote && quote.productId === it.productId && quote.channel === channel && cents(quote.price) === cents(it.unitPrice) && Date.parse(quote.createdAt) <= Date.parse(order.createdAt);
    if ((!p || p.fixedPrices || basis !== 'at-sale') && !known) return { productId: it.productId, name: it.name, missing: true };
    const revenue = (amounts[i] - allocations[i]) / 100, qty = Number(it.qty);
    const unitVariable = known ? quote.unitVariable : costPerUnit(s, p, channel), unitFixed = known ? quote.unitFixed : gfAssigned(s, p, channel);
    const rate = known ? quote.commissionRate : channelCommission(s, p, channel), commission = cents(revenue * rate);
    return { productId: it.productId, name: it.name, qty, unitPrice: it.unitPrice, revenue,
      unitVariable, unitFixed, variable: cents(unitVariable * qty), fixed: cents(unitFixed * qty), commissionRate: rate, commission,
      actualVariableAtCapture: known ? quote.actualVariableAtCapture : actualCostPerUnit(s, p), actualFixedAtCapture: known ? quote.actualFixedAtCapture : actualGfAssigned(s, p),
      revision: known ? quote.revision : policyFor(p, channel).revision || null, policy: JSON.parse(JSON.stringify(known ? quote.policy : policyFor(p, channel))) };
  });
  s.saleCosts ||= {};
  if (items.some(i => i.missing)) return false;
  s.saleCosts[order.id] = { version: 1, orderCreatedAt: order.createdAt, capturedAt: now.toISOString(), basis: basis === 'at-sale' ? basis : 'published-quote', channel, currency: { currencySymbol: s.project.currencySymbol || '$', locale: s.project.locale || 'es-AR', roundTo: s.project.roundTo || 50 }, items };
  return true;
}

export function summarizeSaleCosts(orders, ledger = {}) {
  let revenue = 0, variable = 0, fixed = 0, commission = 0, covered = 0, missing = 0, imported = 0;
  for (const order of orders) {
    if (order.status === 'cancelado') continue;
    const entry = ledger[order.id];
    if (!entry || entry.items.some(i => i.missing)) { missing++; continue; }
    if (!['at-sale', 'published-quote'].includes(entry.basis)) { imported++; continue; }
    covered++;
    for (const it of entry.items) { revenue += it.revenue; variable += it.variable; fixed += it.fixed; commission += it.commission; }
  }
  return { covered, missing, imported, revenue: cents(revenue), variable: cents(variable), fixed: cents(fixed), commission: cents(commission), contribution: cents(revenue - variable - commission), afterAssigned: cents(revenue - variable - commission - fixed) };
}
