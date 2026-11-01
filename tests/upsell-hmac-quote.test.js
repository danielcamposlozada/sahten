import {describe,it,expect,vi} from 'vitest';
import {preflightUpsell,acceptPreflightUpsell} from '../src/payments/upsell-hmac-quote.js';
const secret='sahten-test-secret-for-crypto-'+'x'.repeat(56);
const storeId='b0a7ce44-8833-4a55-bb11-2c774daa3151';
const sessionId='aa111111-1111-4111-8111-111111111111';
const requestId='bb222222-2222-4222-8222-222222222222';
const now=Date.parse('2026-11-06T16:00:00-03:00');
const offerId='fatay-individual-up';
const base={source:'pickup',paymentMethod:'transferencia',customerName:'Cliente',
  customerPhone:'1155551234',items:[{productId:'shawarma_pollo',qty:2}]};
const menu={
 store:{currency:{symbol:'$',locale:'es-AR'}},
 config:{enabled:true,showPrices:true},
 products:[{id:'shawarma_pollo',name:'Shawarma',price:16000},
           {id:'fatay',name:'Fatay',price:5850}],
 payments:{methods:{transferencia:true,efectivo:true},
  benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 delivery:{enabled:true},
 promotions:{enabled:true,upsellGuardRequired:true,
  activationPolicy:{requireIncrementalAndBasketMarginCheck:true,basketContributionTargetPct:40},
  campaigns:[],upsells:[{id:offerId,kind:'upsell',enabled:true,maxUnits:1,
  productIds:['fatay'],triggerProductIds:['shawarma_pollo'],suppressIfPresent:[],
  extraPercent:10,discountTiers:[
   {minEligibleNetSubtotal:20000,totalDiscountPercent:20},
   {minEligibleNetSubtotal:35000,totalDiscountPercent:25},
   {minEligibleNetSubtotal:50000,totalDiscountPercent:30}]}]}
};
const ec={
 shawarma_pollo:{verified:true,incrementalVerified:true,directCost:2677.49,
  fixedCost:5066.31,additionalIncrementalCost:0},
 fatay:{verified:true,incrementalVerified:true,directCost:442.12,
  fixedCost:3138.42,additionalIncrementalCost:0}};
const costs={verified:true,trustedEconomics:ec,
 trustedCosts:{shawarma_pollo:7743.8,fatay:3580.54},
 trustedOrderCosts:{verified:true,additionalOrderCost:0,shippingSubsidy:0}};
const setup=(opts={})=>({storeId,sessionId,menuRevision:'catalog-v304',secret,menu,
 order:base,productId:'fatay',offerId,costs,now,...opts});
const selected=t=>({...base,items:[...base.items,{productId:'fatay',qty:1}]});
describe('Preflight HMAC y canje atómico sin publicar promociones',()=>{
 it('cotiza primero, firma oferta verificada y consume nonce únicamente al aceptar el total',async()=>{
  const p=await preflightUpsell(setup());
  expect(p).toMatchObject({priceBefore:5850,priceAfter:4680,
   promotionDiscount:585,orderTotal:33480,offerId});
  const consumeNonce=vi.fn(async()=>true);
  const q=await acceptPreflightUpsell(setup({order:selected(),
   token:p.token,requestId,expectedTotal:p.orderTotal,consumeNonce}));
  expect(q.total).toBe(33480);
  expect(consumeNonce).toHaveBeenCalledTimes(1);
 });
 it('no emite oferta si el motor está apagado, el costo no verificado o el complemento ya existe',async()=>{
  await expect(preflightUpsell(setup({menu:{...menu,promotions:{...menu.promotions,enabled:false}}}))).rejects.toThrow();
  await expect(preflightUpsell(setup({costs:{...costs,trustedOrderCosts:null}}))).rejects.toThrow();
  await expect(preflightUpsell(setup({order:selected()}))).rejects.toThrow();
 });
 it('bloquea manipulación de precio y método antes de consumir el nonce',async()=>{
  const p=await preflightUpsell(setup()),consumeNonce=vi.fn(async()=>true);
  await expect(acceptPreflightUpsell(setup({order:selected(),token:p.token,
   requestId,expectedTotal:p.orderTotal-100,consumeNonce}))).rejects.toThrow();
  await expect(acceptPreflightUpsell(setup({order:{...selected(),paymentMethod:'efectivo'},
   token:p.token,requestId,expectedTotal:p.orderTotal,consumeNonce}))).rejects.toThrow();
  expect(consumeNonce).not.toHaveBeenCalled();
 });
 it('no admite segundo artículo, sesión diferente, token vencido ni comisión MP desconocida',async()=>{
  const p=await preflightUpsell(setup());
  for(const change of [
   {order:{...selected(),items:[...base.items,{productId:'fatay',qty:2}]}},
   {sessionId:'cc333333-3333-4333-8333-333333333333'},
   {now:now+300001}
  ])await expect(acceptPreflightUpsell(setup({order:selected(),token:p.token,
   requestId,expectedTotal:p.orderTotal,consumeNonce:async()=>true,...change}))).rejects.toThrow();
  await expect(preflightUpsell(setup({order:{...base,paymentMethod:'mercadopago'}}))).rejects.toThrow();
 });
 it('si Supabase no confirma el nonce, no existe oferta canjeada',async()=>{
  const p=await preflightUpsell(setup());
  await expect(acceptPreflightUpsell(setup({order:selected(),token:p.token,
   requestId,expectedTotal:p.orderTotal,consumeNonce:async()=>false}))).rejects.toThrow('upsell_token_already_used');
 });
});
