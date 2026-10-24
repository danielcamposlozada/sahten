// Reglas privadas por producto y canal. Los importes bloqueados son por unidad.
export const policyFor = (p, channel = 'mostrador') => p?.pricingPolicies?.[channel] || {};
export const lockedAmount = (p, channel, key, fallback) => {
  const value = policyFor(p, channel)[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
};
export const isPriceFixed = (p, channel = 'mostrador') => lockedAmount(p, channel, 'price', null) !== null || !!p?.priceFixedChannels?.includes(channel);
const copy = value => JSON.parse(JSON.stringify(value));
const KEYS = ['price', 'variableCost', 'fixedCost', 'commissionRate'];

export function savePricePolicy(p, channel, values, { now = new Date(), actor = 'local', reason = '' } = {}) {
  if (!channel) throw new Error('Elegí un canal.');
  const next = {};
  for (const key of KEYS) {
    const value = values[key];
    if (value == null) next[key] = null;
    else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key === 'commissionRate' && value > 1) || (key === 'price' && value === 0)) throw new Error('Ingresá importes válidos; el precio debe ser mayor que cero.');
    else next[key] = Math.round(value * (key === 'commissionRate' ? 10000 : 100)) / (key === 'commissionRate' ? 10000 : 100);
  }
  const before = copy(policyFor(p, channel));
  if (KEYS.every(key => (before[key] ?? null) === next[key])) return false;
  const effectiveAt = now.toISOString();
  const revision = globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  const after = { ...next, revision, effectiveAt };
  p.pricingPolicies = { ...p.pricingPolicies, [channel]: after };
  p.pricingHistory = [...(p.pricingHistory || []), { revision, channel, effectiveAt, actor, reason: String(reason).trim().slice(0, 300), before, after: copy(after) }];
  return true;
}
