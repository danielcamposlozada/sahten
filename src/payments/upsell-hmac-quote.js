// Cotización de upselling en servidor, separada del endpoint y de producción.
// Reutiliza el reto HMAC y el nonce atómico existentes: NO crea un segundo ledger.
// El caller obtiene secret, sessionId, menuRevision y costos del backend autorizado.
import { issueUpsellChallenge,verifyAcceptedUpsell } from '../core/upsell-intent.js';
import { quoteOrder,PaymentError,cents } from './core.js';

const fail=(reason)=>{throw new PaymentError(
  'Esta oferta no está disponible. Actualizá el pedido.',409,reason);};
const safeCart=items=>{
  if(!Array.isArray(items)||items.length<1||items.length>50)fail('invalid_upsell_cart');
  const seen=new Set();
  return items.map(x=>{
    const productId=String(x?.productId||x?.id||''),qty=Number(x?.qty);
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(productId)||
       !Number.isSafeInteger(qty)||qty<1||qty>99||seen.has(productId))
       fail('invalid_upsell_cart');
    seen.add(productId);return {productId,qty};
  });
};
function policy(menu,productId,offerId,method){
  if(menu?.promotions?.enabled!==true||menu.promotions.upsellGuardRequired===false)
    fail('promotions_off');
  if(!['transferencia','efectivo','mercadopago'].includes(method))fail('invalid_payment_method');
  const found=menu.promotions.upsells?.find(x=>x.id===offerId && x.enabled===true &&
    x.kind==='upsell' && x.maxUnits===1 && x.productIds?.includes(productId));
  if(!found)fail('offer_not_published');
  return found;
}
function trustedCosts(costs){
  if(costs?.verified!==true || !costs.trustedOrderCosts?.verified ||
    !costs.trustedCosts || !costs.trustedEconomics)
    fail('upsell_costs_not_verified');
  return costs;
}
function paymentFee(costs,method){
 if(method!=='mercadopago')return null;
 const fee=costs?.trustedPaymentFeePercent;
 if(typeof fee!=='number'||!Number.isFinite(fee)||fee<0||fee>100)
   fail('upsell_payment_fee_not_verified');
 return fee;
}
function validateOffer(quote,offerId,productId) {
  const line=quote.promotionSnapshot?.lines?.find(l=>l.productId===productId);
  if(!quote.promotionSnapshot?.appliedPromotionIds?.includes(offerId) ||
     !line || line.appliedPromotionId!==offerId ||
     line.appliedPromotionType!=='upsell' ||
     !(line.promotionDiscount>0))fail('offer_margin_rejected');
  return line;
}
function quote(menu,order,costs,selection,now,extras={},requireCustomer=false){
  const validated=trustedCosts(costs);
  const trustedPaymentFeePercent=paymentFee(validated,order?.paymentMethod);
  return quoteOrder(menu,order,{
    allowOtherPayments:true,salesChannel:'online',validateCustomer:true,requireCustomer,now,
    trustedCosts:validated.trustedCosts,
    trustedEconomics:validated.trustedEconomics,
    trustedOrderCosts:validated.trustedOrderCosts,
    trustedUpsellSelection:selection,trustedPaymentFeePercent,
    ...extras
  });
}
function context({storeId,sessionId,menuRevision,secret,order,now}){
  return {storeId,sessionId,menuRevision,secret,channel:'online',
    method:order?.paymentMethod,now};
}
/** Cotiza antes de publicar una oferta. No emite token si no hay beneficio confirmado. */
export async function preflightUpsell({
  storeId,sessionId,menuRevision,secret,menu,order,productId,offerId,
  costs,now=Date.now(),quoteContext={}
}={}){
  const base=safeCart(order?.items),promotion=policy(menu,productId,offerId,order?.paymentMethod);
  if(base.some(x=>x.productId===productId) ||
    !base.some(x=>promotion.triggerProductIds?.includes(x.productId)) ||
    base.some(x=>promotion.suppressIfPresent?.includes(x.productId)))
    fail('offer_not_eligible');
  const after=[...base,{productId,qty:1}];
  // La selección temporal existe sólo en esta rutina backend, nunca en el navegador.
  const selection={verified:true,isIncremental:true,eligibleUnits:1,productId,
    promotionId:offerId};
  const priced=quote(menu,{...order,items:after},costs,selection,now,quoteContext,false);
  const line=validateOffer(priced,offerId,productId);
  const challenge=await issueUpsellChallenge({
    ...context({storeId,sessionId,menuRevision,secret,order,now}),
    productId,offerId,baseCart:base
  });
  return {token:challenge.token,expiresAt:challenge.expiresAt,productId,offerId,
    priceBefore:line.base,priceAfter:line.net,promotionDiscount:line.promotionDiscount,
    orderTotal:priced.total,paymentMethod:priced.paymentMethod};
}
/** Revalida token, menú, economía y total del checkout. Consume nonce REAL
 * únicamente después de que todas esas verificaciones pasan. La reserva del
 * pedido debe usar exactamente el mismo requestId para reintentos idempotentes. */
export async function acceptPreflightUpsell({
  storeId,sessionId,menuRevision,secret,menu,order,token,requestId,
  consumeNonce,expectedTotal,costs,now=Date.now(),quoteContext={},commit=true
}={}){
  trustedCosts(costs);
  const items=safeCart(order?.items);
  if(commit && typeof consumeNonce!=='function')fail('upsell_nonce_missing');
  // Sólo valida firma/contexto sin consumir; todavía NO es prueba canjeada.
  const params={...context({storeId,sessionId,menuRevision,secret,order,now}),
    token,acceptedCart:items,requestId};
  let dry;
  try{dry=await verifyAcceptedUpsell({...params,consumeNonce:async()=>true});}
  catch(e){fail(e?.code||'upsell_challenge_invalid');}
  policy(menu,dry.productId,dry.offerId,order.paymentMethod);
  const priced=quote(menu,{...order,items},costs,
    {...dry,promotionId:dry.offerId},now,quoteContext,true);
  validateOffer(priced,dry.offerId,dry.productId);
  if(typeof expectedTotal!=='number'||!Number.isFinite(expectedTotal)||
     cents(expectedTotal)!==cents(priced.total))fail('quote_total_changed');
  if(!commit)return priced;
  // El mismo requestId de pago/orden permite reintentar un nonce ya canjeado.
  let verified;
  try{verified=await verifyAcceptedUpsell({...params,consumeNonce});}
  catch(e){fail(e?.code||'upsell_challenge_invalid');}
  if(verified.promotionId!==dry.promotionId)fail('offer_mismatch');
  return priced;
}
