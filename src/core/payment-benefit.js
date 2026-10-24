// Regla compartida por caja y tienda. Se publica sin imports ni datos privados.
const benefitRound = n => Math.round((Number(n) || 0) * 100) / 100;
export function paymentBenefitPolicy(value = {}) {
  const percent = Number(value.percent);
  return { enabled: value.enabled === true, percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
    channels: { online: value.channels?.online !== false, mostrador: value.channels?.mostrador !== false },
    revision: String(value.revision || '').slice(0, 100), effectiveFrom: String(value.effectiveFrom || '').slice(0, 40) };
}
export function paymentDiscountQuote(subtotal, method, policy, channel = 'online', manual = null) {
  const baseCents = Number.isFinite(Number(subtotal)) ? Math.max(0, Math.round(Number(subtotal) * 100)) : 0;
  const p = paymentBenefitPolicy(policy);
  const proposed = manual ? manual.type === 'pct' ? baseCents * Math.max(0, Math.min(100, Number(manual.value) || 0)) / 100 : (Number(manual.value) || 0) * 100 : 0;
  const manualCents = Math.max(0, Math.min(baseCents, Math.round(proposed)));
  const eligible = p.enabled && p.channels[channel] && ['efectivo', 'transferencia'].includes(method);
  const benefitCents = eligible ? Math.round(baseCents * p.percent / 100) : 0;
  const benefitWins = benefitCents > 0 && benefitCents >= manualCents;
  const amount = (benefitWins ? benefitCents : manualCents) / 100;
  const label = benefitWins ? p.percent + ' % por efectivo o transferencia' : manualCents ? String(manual?.name || 'Descuento') : '';
  return { amount, label, manualAmount: benefitWins ? 0 : manualCents / 100,
    paymentDiscount: benefitWins ? { kind: 'payment_method', policyId: 'cash-transfer', revision: p.revision,
      effectiveFrom: p.effectiveFrom, percent: p.percent, baseAmount: baseCents / 100, amount, method, label } : null };
}
export function paymentBenefitReport(orders = []) {
  const rows = orders.filter(o => o.status !== 'cancelado').map(o=>({...o,paymentDiscount:savedPaymentDiscount(o)})).filter(o=>o.paymentDiscount);
  const sum = key => benefitRound(rows.reduce((n, o) => n + (Number(o.paymentDiscount[key]) || 0), 0));
  return { count: rows.length, discount: sum('amount'), gross: sum('baseAmount'), netProducts: benefitRound(sum('baseAmount') - sum('amount')), orders: rows };
}
export function savedPaymentDiscount(order) {
  const d = order?.paymentDiscount;
  if (!d || d.kind !== 'payment_method' || !['efectivo', 'transferencia'].includes(order.paymentMethod) || d.method !== order.paymentMethod) return null;
  const base = Number(d.baseAmount), amount = Number(d.amount), percent = Number(d.percent);
  const totalDiscount = Number(order.discountAmount ?? order.discount ?? 0);
  if (![base, amount, percent, totalDiscount].every(Number.isFinite) || base <= 0 || amount <= 0 || percent <= 0 || percent > 100 || benefitRound(amount) !== benefitRound(totalDiscount) || totalDiscount > base) return null;
  if (benefitRound(base * percent / 100) !== benefitRound(amount) || benefitRound(base) !== benefitRound(order.subtotal)) return null;
  if (benefitRound(base - totalDiscount + (Number(order.shipping) || 0)) !== benefitRound(order.total)) return null;
  return { kind: 'payment_method', policyId: 'cash-transfer', revision: String(d.revision || '').slice(0,100), effectiveFrom: String(d.effectiveFrom || '').slice(0,40), percent, baseAmount: base, amount, method: d.method, label: percent + ' % por efectivo o transferencia' };
}
