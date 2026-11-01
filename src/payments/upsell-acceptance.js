import { issueUpsellIntent, verifyAcceptedUpsell, UpsellIntentError } from '../core/upsell-intent.js';
import { quoteOrder, PaymentError } from './core.js';

const unavailable=(reason='upsell_unavailable')=>{
  throw new PaymentError(reason==='intent_expired'?'La oferta venció. Volvé a elegirla.':
    'La oferta ya no está disponible. Actualizá el carrito.',409,reason);
};
function completeContext({menu,order,costs,selection,now,route,authorization}){
  // El cliente NUNCA decide costos o selección verificada. Sólo el servicio Edge
  // aporta estas propiedades, leídas con privilegios de servidor.
  if(!costs||costs.verified!==true || !costs.trustedEconomics ||
     !costs.trustedCosts || !costs.trustedOrderCosts?.verified)
    unavailable('upsell_costs_not_verified');
  if(order.paymentMethod==='mercadopago' &&
    (typeof costs.trustedPaymentFeePercent!=='number' ||
      !Number.isFinite(costs.trustedPaymentFeePercent) || costs.trustedPaymentFeePercent<0))
    unavailable('upsell_payment_fee_not_verified');
  return {
    validateCustomer:false,allowOtherPayments:true,requireCustomer:false,now,
    ...(route?{route}:{}),...(authorization?{authorization}:{}),
    trustedCosts:costs.trustedCosts,
    trustedEconomics:costs.trustedEconomics,
    trustedOrderCosts:costs.trustedOrderCosts,
    trustedPaymentFeePercent:costs.trustedPaymentFeePercent,
    trustedUpsellSelection:selection
  };
}
function assertApplied(quoted,promotionId,productId){
  if(!quoted.promotionSnapshot?.appliedPromotionIds?.includes(promotionId)||
    !quoted.promotionSnapshot.lines.some(l=>l.productId===productId &&
      l.appliedPromotionId===promotionId && l.appliedPromotionType==='upsell' &&
      l.promotionDiscount>0))
    unavailable('upsell_margin_or_context_not_approved');
}
function errorAsUnavailable(e){
  if(e instanceof UpsellIntentError)unavailable(e.message);
  throw e;
}
/** Oferta desde un carrito BASE sin el complemento. No publica descuentos
 * si no existen los costos, comisión y margen verificados por el servidor.
 * La emisión de la intención ocurre DESPUÉS de evaluar el precio real. */
export async function prepareUpsellOffer({
  repo,storeId,menu,order,productId,promotionId,costs,now=Date.now(),
  route=null,authorization=null
}){
  let intent;
  try{intent=await issueUpsellIntent({storeId,menu,order,productId,promotionId});}
  catch(e){errorAsUnavailable(e);}
  const preview={...order,items:intent.after};
  const quoted=quoteOrder(menu,preview,completeContext({
    menu,order:preview,costs,selection:{verified:true,isIncremental:true,eligibleUnits:1,
      productId,promotionId},now,route,authorization
  }));
  assertApplied(quoted,promotionId,productId);
  const issue=await repo.issueUpsellIntent({
    sid:storeId,promotion_id:promotionId,product_id:productId,
    before_hash:intent.beforeHash,after_hash:intent.afterHash
  });
  if(!issue?.id||!issue.expiresAt)unavailable('upsell_issue_failed');
  const line=quoted.promotionSnapshot.lines.find(l=>l.productId===productId);
  return {
    intentId:issue.id,expiresAt:issue.expiresAt,productId,promotionId,
    // Esta es cotización de retiro o entrega verificada; nunca un cálculo
    // construido desde precios aportados por el navegador.
    priceBefore:line.base,priceAfter:line.net,
    promotionDiscount:line.promotionDiscount,
    orderTotal:quoted.total,paymentMethod:quoted.paymentMethod
  };
}
/** Validación del token + recotización del pedido. Primero hacer preview, 
 * luego consumir atómicamente el mismo token SOLO al confirmar el pedido.
 * Entregar al gateway el objeto quoted del servidor, nunca body.order. */
export async function validateAcceptedOffer({
  repo,storeId,menu,order,requestId,costs,now=Date.now(),commit=false,
  route=null,authorization=null
}){
  if(!order?.upsellIntentId)unavailable('upsell_intent_missing');
  let verified;
  try{
    const record=await repo.readUpsellIntent({sid:storeId,intent_id:order.upsellIntentId});
    verified=await verifyAcceptedUpsell({record,storeId,menu,order,requestId,now});
  }catch(e){errorAsUnavailable(e);}
  const quoted=quoteOrder(menu,order,completeContext({
    menu,order,costs,selection:verified.trustedSelection,now,route,authorization
  }));
  assertApplied(quoted,verified.trustedSelection.promotionId,verified.trustedSelection.productId);
  if(commit) {
    const confirmation=await repo.redeemUpsellIntent({
      sid:storeId,intent_id:verified.redemption.id,
      expected_before_hash:verified.redemption.beforeHash,
      expected_after_hash:verified.redemption.afterHash,
      request_id:requestId
    });
    if(!confirmation||confirmation.request_id!==requestId)
      unavailable('upsell_intent_replayed');
  }
  return quoted;
}
