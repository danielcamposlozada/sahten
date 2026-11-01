import {describe,it,expect,vi} from 'vitest';
import {prepareUpsellOffer,validateAcceptedOffer} from '../src/payments/upsell-acceptance.js';
import {PaymentError} from '../src/payments/core.js';
const sid='b0a7ce44-8833-4a55-bb11-2c774daa3151',now=Date.parse('2026-11-01T17:00:00Z');
const requestId='397e3c7f-d0a3-4b6a-b89a-a384d920d771';
const id='4d125b6a-fb84-4cd9-ae72-4efa1dab7e04',promoId='fatay-individual-up';
const base={source:'pickup',paymentMethod:'transferencia',customerName:'Cliente de prueba',customerPhone:'1155551234',items:[{productId:'shawarma_pollo',qty:2}]};
const menu={
 config:{enabled:true,showPrices:true},
 store:{name:'SAHTEN',currency:{symbol:'$',locale:'es-AR'}},
 products:[{id:'shawarma_pollo',name:'Shawarma pollo',price:16000,priceRevision:'v1'},
           {id:'fatay',name:'Fatay',price:5850,priceRevision:'v1'}],
 payments:{methods:{transferencia:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 delivery:{enabled:false},
 promotions:{version:1,enabled:true,upsellGuardRequired:true,activationPolicy:{
  basketContributionTargetPct:40,requireIncrementalAndBasketMarginCheck:true
 },campaigns:[],upsells:[{id:promoId,kind:'upsell',enabled:true,maxUnits:1,
   productIds:['fatay'],triggerProductIds:['shawarma_pollo'],suppressIfPresent:[],
   extraPercent:10,discountTiers:[{minEligibleNetSubtotal:20000,totalDiscountPercent:20},
     {minEligibleNetSubtotal:35000,totalDiscountPercent:25},
     {minEligibleNetSubtotal:50000,totalDiscountPercent:30}]}]}
};
const ec={
 shawarma_pollo:{verified:true,incrementalVerified:true,directCost:2677.49,
   fixedCost:5066.31,additionalIncrementalCost:0},
 fatay:{verified:true,incrementalVerified:true,directCost:442.12,
   fixedCost:3138.42,additionalIncrementalCost:0}
};
const costs={verified:true,trustedEconomics:ec,
 trustedCosts:{shawarma_pollo:7743.8,fatay:3580.54},
 trustedOrderCosts:{verified:true,additionalOrderCost:0,shippingSubsidy:0},
 trustedPaymentFeePercent:10};
function setup(){
 const state={value:null,redeemed:0};
 const repo={
 issueUpsellIntent:vi.fn(async args=>{
   state.value={id,store_id:sid,product_id:args.product_id,
     promotion_id:args.promotion_id,before_hash:args.before_hash,after_hash:args.after_hash,
     expires_at:new Date(now+5*60000).toISOString(),redeemed_at:null,request_id:null};
   return {id,expiresAt:state.value.expires_at};
 }),
 readUpsellIntent:vi.fn(async()=>state.value),
 redeemUpsellIntent:vi.fn(async args=>{
   if(!state.value||state.value.before_hash!==args.expected_before_hash||
     state.value.after_hash!==args.expected_after_hash||
     (state.value.redeemed_at&&state.value.request_id!==args.request_id))return null;
   state.redeemed++;state.value={...state.value,redeemed_at:new Date(now).toISOString(),request_id:args.request_id};
   return state.value;
 })
 };
 return {repo,state};
}
const prepared=({repo,...params})=>prepareUpsellOffer({repo,storeId:sid,menu,order:base,
 productId:'fatay',promotionId:promoId,costs,now,...params});
const accepted=(repo,intentId,extra={})=>validateAcceptedOffer({repo,storeId:sid,menu,
 order:{...base,items:[...base.items,{productId:'fatay',qty:1}],upsellIntentId:intentId},
 requestId,costs,now,...extra});
describe('cotización servidor + aceptación de un upsell',()=>{
 it('cotiza Fatay 20% total y vincula comprobante solo DESPUÉS de verificar rentabilidad',async()=>{
  const {repo}=setup(),offer=await prepared({repo});
  expect(offer).toMatchObject({intentId:id,productId:'fatay',
    priceBefore:5850,priceAfter:4680,promotionDiscount:585,orderTotal:33480});
  expect(repo.issueUpsellIntent).toHaveBeenCalledTimes(1);
  const quote=await accepted(repo,id,{commit:false});
  expect(quote.total).toBe(33480);
  expect(repo.redeemUpsellIntent).not.toHaveBeenCalled();
  const confirmed=await accepted(repo,id,{commit:true});
  expect(confirmed.total).toBe(33480);
  expect(repo.redeemUpsellIntent).toHaveBeenCalledTimes(1);
 });
 it('no crea comprobante de descuento sin costos verificados',async()=>{
  const {repo}=setup();
  await expect(prepared({repo,costs:{...costs,trustedOrderCosts:null}})).rejects.toThrow(PaymentError);
  expect(repo.issueUpsellIntent).not.toHaveBeenCalled();
 });
 it('sin rentabilidad de cesta no firma token para el usuario',async()=>{
  const {repo}=setup();
  await expect(prepared({repo,costs:{...costs,trustedEconomics:{
    ...ec,shawarma_pollo:{...ec.shawarma_pollo,fixedCost:12000}
  }}})).rejects.toThrow(PaymentError);
  expect(repo.issueUpsellIntent).not.toHaveBeenCalled();
 });
 it('no acepta contenido modificado tras mostrar la oferta',async()=>{
  const {repo}=setup();await prepared({repo});
  await expect(accepted(repo,id,{order:{...base,items:[...base.items,{productId:'fatay',qty:1}],
    paymentMethod:'mercadopago',upsellIntentId:id}})).rejects.toThrow(PaymentError);
  expect(repo.redeemUpsellIntent).not.toHaveBeenCalled();
 });
 it('no acepta ofertas apagadas ni intenta consumir el token',async()=>{
  const {repo}=setup();await prepared({repo});
  await expect(accepted(repo,id,{menu:{...menu,promotions:{...menu.promotions,enabled:false}},
    commit:true})).rejects.toThrow(PaymentError);
  expect(repo.redeemUpsellIntent).not.toHaveBeenCalled();
 });
 it('rechaza comisión desconocida de Mercado Pago, nunca asume 10% nominal',async()=>{
  const {repo}=setup();
  await expect(prepared({repo,order:{...base,paymentMethod:'mercadopago'},
    costs:{...costs,trustedPaymentFeePercent:undefined}})).rejects.toThrow(PaymentError);
  expect(repo.issueUpsellIntent).not.toHaveBeenCalled();
 });
});
