import {hasDeferredCostApproval} from '../core/promotion-cost-review.js';
// Coordinador exclusivo del backend. Las dependencias económicas y de consumo
// provienen del repositorio privado, nunca del JSON de la compra.
import { issueUpsellChallenge, verifyAcceptedUpsell } from '../core/upsell-intent.js';
import { quoteOrder, fail, sha256, validUuid } from '../payments/core.js';
import { scheduleMatches } from '../core/promotions.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const canonical=value=>Array.isArray(value)?value.map(canonical)
 :value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=value=>sha256(JSON.stringify(canonical(value)));
const cart=order=>{
  if(!Array.isArray(order?.items)||!order.items.length||order.items.length>50)
    fail('Revisá los productos del pedido.',400,'upsell_cart_invalid');
  const rows=order.items.map(i=>({productId:String(i?.productId||i?.id||''),qty:Number(i?.qty)}));
  if(new Set(rows.map(l=>l.productId)).size!==rows.length||rows.some(l=>
    !/^[a-z0-9_-]{1,100}$/i.test(l.productId)||!Number.isInteger(l.qty)||l.qty<1||l.qty>99))
    fail('Revisá las cantidades del pedido.',400,'upsell_cart_invalid');
  return rows;
};
const validMoney=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;

export const upsellDefinitionDigest=offer=>{const definition=clone(offer);delete definition.enabled;return digest(definition);};

export const upsellMenuDigest=menu=>digest({products:menu.products,payments:menu.payments,config:menu.config});

export const upsellAcceptanceDigest=({token,sessionId,offerId})=>digest({token,sessionId,offerId});

export function createUpsellCheckout({secret,readEconomics,consumeNonce,now=()=>Date.now()}) {
  async function context({storeId,sessionId,menu,order,offerId,channel='online'}) {
    if(!validUuid(storeId)||!validUuid(sessionId))fail('La sesión de la oferta no es válida.',400,'upsell_session_invalid');
    // Primera integración: retiro online. Delivery necesita el costo de reparto
    // y su subsidio verificados; caja necesita su propio contexto autenticado.
    if(channel!=='online'||order?.source!=='pickup')fail('Esta oferta todavía no está habilitada para este canal.',409,'upsell_channel_unavailable');
    if(!['efectivo','transferencia'].includes(order.paymentMethod))fail('Esta oferta es para efectivo o transferencia.',409,'upsell_payment_ineligible');
    const at=now(),offer=menu?.promotions?.upsells?.find(x=>x.id===offerId);
    if(menu?.promotions?.enabled!==true||!offer?.enabled||offer.kind!=='upsell'||offer.maxUnits!==1
      ||offer.productIds?.length!==1||!offer.triggerProductIds?.length
      ||offer.channels&&!offer.channels.includes(channel)
      ||offer.schedule&&!scheduleMatches(offer.schedule,new Date(at)))
      fail('La oferta no está disponible. Actualizá el pedido.',409,'upsell_unavailable');
    if(typeof readEconomics!=='function'||typeof consumeNonce!=='function')
      fail('Falta completar la validación económica del servidor.',409,'upsell_not_configured');
    const productId=offer.productIds[0];
    const ids=[...new Set([...cart(order).map(l=>l.productId),productId])].sort();
    const economics=await readEconomics({storeId,offerId,channel,productIds:ids,source:'pickup',menu});
    const deferred=hasDeferredCostApproval(economics?.costException);
    if(!economics?.revision||!economics.products||economics.orderCosts?.verified!==true&&!deferred
      ||!validMoney(economics.orderCosts.additionalOrderCost)
      ||economics.orderCosts.shippingSubsidy!==0)
      fail('Faltan gastos del pedido revisados para esta oferta.',409,'upsell_costs_unverified');
    for(const id of ids){
      const c=economics.products[id];
      if(c?.verified!==true||!validMoney(c.directCost)||!validMoney(c.fixedCost)
        ||id===productId&&(c.incrementalVerified!==true&&!deferred||!validMoney(c.additionalIncrementalCost)))
        fail('Faltan costos revisados de un producto del pedido.',409,'upsell_costs_unverified');
    }
    const tiers=Array.isArray(offer.discountTiers)?offer.discountTiers:[];
    if(tiers.some(t=>!validMoney(t.minEligibleNetSubtotal))
      ||new Set(tiers.map(t=>t.minEligibleNetSubtotal)).size!==tiers.length)
      fail('Revisá los mínimos de la oferta.',409,'upsell_discount_limit');
    const totals=tiers.length?tiers.map(t=>Number(t.totalDiscountPercent))
      :[Number(menu.payments?.benefit?.percent??0)+Number(offer.extraPercent)];
    if(totals.some(n=>!Number.isFinite(n)||n<=0||n>30))
      fail('La oferta excede los límites técnicos.',409,'upsell_discount_limit');
    if(totals.some(n=>n>20)){
      const approval=economics.exceptionApproval;
      if(offer.id!=='fatay-individual-up'||productId!=='fatay'||!tiers.length
        ||approval?.verified!==true||!validUuid(approval.auditId)
        ||approval.definitionDigest!==await upsellDefinitionDigest(offer)
        ||!Number.isFinite(Number(approval.maxTotalPercent))
        ||Number(approval.maxTotalPercent)>30||Number(approval.maxTotalPercent)<Math.max(...totals))
        fail('La escala especial requiere autorización comercial registrada.',409,'upsell_exception_required');
    }
    // Un cambio de precios, reglas o costos invalida la oferta de cinco minutos.
    const menuRevision=await digest({products:menu.products,promotions:menu.promotions,
      payments:menu.payments,config:menu.config,economics});
    return {at,offer,productId,menuRevision,economics};
  }
  function quote(menu,order,ctx,selection,requireCustomer=false){
    const trustedCosts=Object.fromEntries(Object.entries(ctx.economics.products)
      .map(([id,c])=>[id,c.directCost+c.fixedCost]));
    // Este primer flujo no admite excepciones de margen. Un flag de menú
    // jamás puede rebajar el piso del servidor sin un contrato auditado propio.
    const policy=menu.promotions.activationPolicy||{};
    const quoteMenu={...menu,promotions:{...menu.promotions,activationPolicy:{...policy,
      basketContributionTargetPct:Math.max(40,Number(policy.basketContributionTargetPct||40)),
      minIncrementalContributionPct:Math.max(40,Number(policy.minIncrementalContributionPct||40))}}};
    const result=quoteOrder(quoteMenu,order,{allowOtherPayments:true,validateCustomer:true,
      requireCustomer,now:ctx.at,trustedCosts,
      trustedEconomics:ctx.economics.products,trustedOrderCosts:ctx.economics.orderCosts,trustedCostException:ctx.economics.costException,
      trustedUpsellSelection:selection});
    const line=result.promotionSnapshot?.lines?.find(l=>l.productId===ctx.productId);
    if(line?.appliedPromotionType!=='upsell'||line.appliedPromotionId!==ctx.offer.id
      ||!(line.promotionDiscount>0))
      fail('La oferta ya no cumple el mínimo, el margen o las condiciones del pedido.',409,'upsell_ineligible');
    return result;
  }
  return {
    async offer(args){
      const ctx=await context(args),baseCart=cart(args.order);
      if(baseCart.length>=50)fail('El pedido alcanzó el límite de productos para esta oferta.',400,'upsell_cart_invalid');
      if(baseCart.some(l=>l.productId===ctx.productId))fail('El producto ya está en el pedido.',409,'upsell_already_in_cart');
      // Probar la cesta completa con una única unidad adicional, sin consumir
      // un nonce ni aceptar marcas de verificación aportadas por el navegador.
      const order=clone(args.order);delete order.cashTendered;
      order.items=[...baseCart,{productId:ctx.productId,qty:1}];
      const preview=quote(args.menu,order,ctx,{verified:true,productId:ctx.productId,
        promotionId:ctx.offer.id,isIncremental:true,eligibleUnits:1});
      const challenge=await issueUpsellChallenge({secret,storeId:args.storeId,
        sessionId:args.sessionId,productId:ctx.productId,offerId:ctx.offer.id,
        method:args.order.paymentMethod,channel:'online',menuRevision:ctx.menuRevision,
        baseCart,now:ctx.at});
      // No exponer costos ni la evidencia privada. Son importes calculados,
      // sujetos a nueva validación al aceptar y al guardar la orden.
      return {...challenge,total:preview.total,discount:preview.discount,
        line:preview.promotionSnapshot.lines.find(l=>l.productId===ctx.productId)};
    },
    async accept(args){
      if(!validUuid(args.requestId))fail('El intento de compra no es válido.',400,'upsell_request_invalid');
      const ctx=await context(args);
      let selection,transaction;
      try{
        selection=await verifyAcceptedUpsell({secret,token:args.token,
          storeId:args.storeId,sessionId:args.sessionId,channel:'online',
          method:args.order.paymentMethod,menuRevision:ctx.menuRevision,
          acceptedCart:cart(args.order),requestId:args.requestId,now:ctx.at,
          consumeNonce:async claims=>{
            if(claims.offerId!==ctx.offer.id)fail('La oferta no coincide con la selección.',409,'upsell_acceptance_invalid');
            // Verificar también margen/condiciones antes del consumo atómico.
            // La prueba de intención aún está siendo validada por la librería.
            quote(args.menu,args.order,ctx,{verified:true,productId:ctx.productId,
              promotionId:ctx.offer.id,isIncremental:true,eligibleUnits:1},true);
            const consumed=await consumeNonce(claims);
            if(consumed===true)transaction={...claims,offerId:ctx.offer.id,reviewId:ctx.economics.revision};
            return consumed;
          }});
      }catch(error){
        if(error.status)throw error;
        fail('La oferta venció, cambió o pertenece a otro intento. Volvé a seleccionarla.',409,'upsell_acceptance_invalid');
      }
      if(selection.promotionId!==ctx.offer.id)fail('La oferta no coincide con la selección.',409,'upsell_acceptance_invalid');
      const result=quote(args.menu,args.order,ctx,selection,true);
      result.promotionSnapshot.upsellReview={reviewId:ctx.economics.revision,offerId:ctx.offer.id};
      return {order:{...result,upsellReviewId:ctx.economics.revision},transaction,
        acceptanceDigest:await upsellAcceptanceDigest(args),
        selection};
    }
  };
}
