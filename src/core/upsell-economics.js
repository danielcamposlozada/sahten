// Revisión server-only: un upsell NO es una campaña pública.
// El precio por producto debe provenir del menú oficial. La proveniencia de la
// adición, costos y gastos incrementales deben ser VALIDADOS POR EL SERVIDOR.
// Los valores de un carrito o request del cliente nunca constituyen esta prueba.
const cents = value => Math.round(Number(value) * 100);
const money = value => Math.round(value) / 100;
const roundedPercent = value => Math.round(value * 100) / 100;
const validMoney = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const marginPct = (revenue, totalCost) => revenue > 0 ? (revenue - totalCost) / revenue * 100 : -Infinity;
export function assessIncrementalUpsell({
  lines = [], currentLines = [], upsell = {}, productId,
  proposedExtra = 0, methodCommissionPercent = 0,
  trustedEconomics = {}, trustedUpsellSelection = null,
  trustedOrderCosts = null,
  minBasketMarginPct = 40, minIncrementalMarginPct = 40
} = {}) {
  const deny = reason => ({ approved:false, reason });
  const proof = trustedUpsellSelection;
  if (!proof || proof.verified !== true || proof.productId !== productId ||
      proof.promotionId !== upsell.id || proof.isIncremental !== true ||
      proof.eligibleUnits !== 1)
    return deny('incremental_upsell_not_verified');
  if (upsell.maxUnits !== 1 || !upsell.triggerProductIds?.length)
    return deny('invalid_upsell_policy');
  if (!lines.some(l => l.productId !== productId && upsell.triggerProductIds.includes(l.productId)))
    return deny('no_trigger');
  if (lines.some(l => upsell.suppressIfPresent?.includes(l.productId)))
    return deny('excluded_combo');
  const line = lines.find(l => l.productId === productId);
  const current = currentLines.find(l => l.productId === productId);
  if (!line || !current || line.qty !== 1 || current.appliedPromotionId)
    return deny('not_single_eligible_upsell');
  if (!validMoney(proposedExtra) || proposedExtra <= 0)
    return deny('not_a_discount');
  const c = trustedEconomics[productId];
  if (!c || c.verified !== true || c.incrementalVerified !== true ||
      !validMoney(c.directCost) || !validMoney(c.fixedCost) ||
      !validMoney(c.additionalIncrementalCost))
    return deny('incremental_costs_unverified');
  if (!trustedOrderCosts || trustedOrderCosts.verified !== true ||
      !validMoney(trustedOrderCosts.additionalOrderCost) ||
      !validMoney(trustedOrderCosts.shippingSubsidy))
    return deny('order_costs_unverified');
  // Un pedido con costos desconocidos en OTROS productos no puede subsidiar
  // una oferta utilizando un margen inventado o incompleto.
  let fullCost = 0, beforeNet = 0;
  for (const l of lines) {
    const econ = trustedEconomics[l.productId];
    if (!econ || econ.verified !== true || !validMoney(econ.directCost) ||
        !validMoney(econ.fixedCost)) return deny('basket_costs_unverified');
    const quoted = currentLines.find(x => x.productId === l.productId);
    if (!quoted) return deny('incomplete_basket');
    fullCost += cents(econ.directCost + econ.fixedCost) * l.qty;
    beforeNet += cents(quoted.net);
  }
  const extra = cents(proposedExtra);
  const afterNet = beforeNet - extra;
  const commission = Number(methodCommissionPercent);
  if (!Number.isFinite(commission) || commission < 0 || commission > 100)
    return deny('invalid_fee');
  const fee = Math.round(afterNet * commission / 100);
  const orderCosts = cents(trustedOrderCosts.additionalOrderCost + trustedOrderCosts.shippingSubsidy);
  const realizedBasket = afterNet - fee;
  const basketMargin = marginPct(realizedBasket,fullCost + orderCosts);
  // No volver a cargar alquiler y sueldos fijos en una unidad que realmente
  // se agrega a un pedido existente. Sí valorar trabajo/materiales marginales.
  const upsellAfter = cents(current.net) - extra;
  const upsellFee = Math.round(upsellAfter * commission / 100);
  const incrementalRevenue = upsellAfter - upsellFee;
  const incrementalCost = cents(c.directCost + c.additionalIncrementalCost);
  const incrementalMargin = marginPct(incrementalRevenue,incrementalCost);
  const targetBasket = Number(minBasketMarginPct);
  const targetIncremental = Number(minIncrementalMarginPct);
  if (![targetBasket,targetIncremental].every(n=>Number.isFinite(n) && n>0 && n<=100))
    return deny('invalid_margin_target');
  if (basketMargin + 0.00001 < targetBasket)
    return { ...deny('basket_margin_below_target'), basketMarginPct:roundedPercent(basketMargin), incrementalMarginPct:roundedPercent(incrementalMargin) };
  if (incrementalMargin + 0.00001 < targetIncremental)
    return { ...deny('incremental_margin_below_target'), basketMarginPct:roundedPercent(basketMargin), incrementalMarginPct:roundedPercent(incrementalMargin) };
  return { approved:true, reason:null, basketMarginPct:roundedPercent(basketMargin),
    incrementalMarginPct:roundedPercent(incrementalMargin),
    incrementalContribution:money(incrementalRevenue-incrementalCost),
    fullBasketContribution:money(realizedBasket-fullCost-orderCosts) };
}
