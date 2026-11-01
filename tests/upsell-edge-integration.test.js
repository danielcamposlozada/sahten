import {describe,it,expect,vi} from 'vitest';
import {createPaymentService} from '../src/payments/service.js';
import {createDeliveryService} from '../src/delivery/service.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';
import {circlePoints} from '../src/delivery/geometry.js';
const sid='00000000-0000-4000-8000-000000000001';
const rid='00000000-0000-4000-8000-000000000004';
const proof='a'.repeat(64),secret='sahten-edge-secret-test-only-'+'x'.repeat(48);
const at=Date.parse('2026-11-06T15:00:00-03:00');
const menu=()=>{
 const p=sahtenDeliveryPolicy();p.active=true;p.hours.enabled=false;
 return {store:{currency:{symbol:'$',locale:'es-AR'}},
  config:{enabled:true,showPrices:true},
  products:[{id:'shawarma_pollo',name:'Shawarma',price:16000,priceRevision:'r1'},
   {id:'fatay',name:'Fatay',price:5850,priceRevision:'r1'}],
  payments:{methods:{mercadopago:true,transferencia:true,efectivo:true},
   benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
  delivery:{enabled:true,deliveryV2:p},
  promotions:{enabled:true,upsellGuardRequired:true,activationPolicy:{
   requireIncrementalAndBasketMarginCheck:true,basketContributionTargetPct:40
  },campaigns:[],upsells:[{id:'fatay-individual-up',kind:'upsell',enabled:true,
   maxUnits:1,productIds:['fatay'],triggerProductIds:['shawarma_pollo'],
   suppressIfPresent:[],extraPercent:10,discountTiers:[
    {minEligibleNetSubtotal:20000,totalDiscountPercent:20},
    {minEligibleNetSubtotal:35000,totalDiscountPercent:25},
    {minEligibleNetSubtotal:50000,totalDiscountPercent:30}]}]}};
};
const costs={verified:true,
 trustedCosts:{shawarma_pollo:7743.8,fatay:3580.54},
 trustedEconomics:{
  shawarma_pollo:{verified:true,incrementalVerified:true,directCost:2677.49,fixedCost:5066.31,additionalIncrementalCost:0},
  fatay:{verified:true,incrementalVerified:true,directCost:442.12,fixedCost:3138.42,additionalIncrementalCost:0}},
 trustedOrderCosts:{verified:true,additionalOrderCost:0,shippingSubsidy:0},
 trustedPaymentFeePercent:7.4
};
const base=method=>({source:'pickup',paymentMethod:method,customerName:'Persona',
 customerPhone:'1111222233',items:[{productId:'shawarma_pollo',qty:2}]});
const selected=(o,p)=>({...o,items:[...o.items,{productId:'fatay',qty:1}],upsellToken:p.token,total:p.orderTotal});
const req=(route,body,origin)=>new Request('https://edge.test/'+route,{method:'POST',
 headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const offerBody=order=>({storeId:sid,proof,order,productId:'fatay',offerId:'fatay-individual-up'});
function paymentSetup(){
 const m=menu(),calls=[],nonces=new Map();
 const account={id:'00000000-0000-4000-8000-000000000005',site_url:'https://sahten.online',mode:'test',
  credentials:{accessToken:'TEST-fake-token-only',webhookSecret:'fake-test-secret'}};
 const repo={
  menu:vi.fn(async()=>m),upsellEconomics:vi.fn(async()=>costs),
  promotionCosts:vi.fn(async()=>costs.trustedCosts),
  consumeUpsellNonce:vi.fn(async x=>{
   const old=nonces.get(x.nonce);if(old)return old===x.requestId;
   nonces.set(x.nonce,x.requestId);return true;
  }),
  run:vi.fn(async(action,args)=>{
   calls.push([action,args]);if(action==='limit')return true;
   if(action==='account')return account;
   if(action==='reserve')return {id:'00000000-0000-4000-8000-000000000006',
    store_id:sid,account_id:account.id,payment_status:'pending',mode:'test',
    order:args.order,attempts:1};
   if(action==='secrets')return account;return {};
  })
 };
 const fetchImpl=vi.fn(async url=>Response.json({id:'preference-1',
  init_point:'https://www.mercadopago.com.ar/checkout/test'}));
 const service=createPaymentService({repo,upsellSecret:secret,fetchImpl,
  authenticate:async()=>null,endpoint:'https://edge.test',originKey:async()=> 'buyer-hash',now:()=>at});
 const call=async(route,body)=>{const r=await service(req(route,body,account.site_url));return {status:r.status,data:await r.json()};};
 return {repo,m,calls,call,fetchImpl};
}
describe('Integración Edge de Mercado Pago (proveedor simulado; SIN cobro real)',()=>{
 it('cotiza, comprueba importe, consume un nonce y crea preferencia desde precio del servidor',async()=>{
  const x=paymentSetup(),original=base('mercadopago');
  const offer=await x.call('offer',offerBody(original));
  expect(offer.status).toBe(200);
  expect(offer.data).toMatchObject({priceBefore:5850,priceAfter:4680,
   paymentMethod:'mercadopago'});
  const checkout=await x.call('checkout',{storeId:sid,requestId:rid,proof,order:selected(original,offer.data)});
  expect(checkout.status).toBe(200);
  expect(checkout.data.total).toBe(offer.data.orderTotal);
  expect(x.repo.consumeUpsellNonce).toHaveBeenCalledTimes(1);
  expect(x.calls.some(([name])=>name==='reserve')).toBe(true);
  expect(x.fetchImpl).toHaveBeenCalledTimes(1);
 });
 it('impide reservar o llamar a Mercado Pago con total alterado, sin consumir nonce',async()=>{
  const x=paymentSetup(),original=base('mercadopago');
  const offer=await x.call('offer',offerBody(original));
  const wrong=await x.call('checkout',{storeId:sid,requestId:rid,proof,
   order:{...selected(original,offer.data),total:offer.data.orderTotal-50}});
  expect(wrong.status).toBe(409);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
  expect(x.calls.some(([name])=>name==='reserve')).toBe(false);
  expect(x.fetchImpl).not.toHaveBeenCalled();
 });
 it('sin costos verificados o con promociones apagadas no hay tokens ni cobro',async()=>{
  const x=paymentSetup();x.m.promotions.enabled=false;
  expect((await x.call('offer',offerBody(base('mercadopago')))).status).toBe(409);
  expect(x.repo.upsellEconomics).not.toHaveBeenCalled();
  x.m.promotions.enabled=true;x.repo.upsellEconomics.mockResolvedValue({...costs,trustedOrderCosts:null});
  expect((await x.call('offer',offerBody(base('mercadopago')))).status).toBe(409);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
 });
});
function deliverySetup(){
 const m=menu(),route=(()=>{
  const point=circlePoints(m.delivery.deliveryV2.center,4)[0];
  return {origin:m.delivery.deliveryV2.center,
   destination:{lat:point[0],lng:point[1]},provider:'verified-test-route',
   distanceMeters:4000,validatedAt:'2026-11-06T17:00:00Z'};
 })();
 const orders=[],used=new Map();
 const repo={menu:vi.fn(async()=>m),promotionCosts:vi.fn(async()=>costs.trustedCosts),
  upsellEconomics:vi.fn(async()=>costs),
  consumeUpsellNonce:vi.fn(async x=>{
   if(used.has(x.nonce))return used.get(x.nonce)===x.requestId;
   used.set(x.nonce,x.requestId);return true;
  }),
  run:vi.fn(async(action,args)=>{
   if(action==='limit')return true;
   if(action==='submission')return null;
   if(action==='order'){orders.push(args.payload);return {id:'order-id',order:args.payload};}
   return null;
  })
 };
 const service=createDeliveryService({repo,authenticate:async()=>null,geocode:async()=>[],
  resolveRoute:async()=>route,upsellSecret:secret,now:()=>at});
 const order={...base('transferencia'),source:'delivery',items:[{productId:'shawarma_pollo',qty:4}],
  address:'Calle de prueba 125, Vicente López',lat:route.destination.lat,lng:route.destination.lng};
 const call=async(action,body)=>{const r=await service(req(action,{storeId:sid,...body}));return {status:r.status,data:await r.json()};};
 return {m,repo,orders,call,order};
}
describe('Integración Edge de delivery y retiro (rutas simuladas)',()=>{
 it('cotiza con ruta verificada y confirma el pedido una sola vez tras validar token',async()=>{
  const x=deliverySetup(),offer=await x.call('offer',{order:x.order,upsellProof:proof,
   productId:'fatay',offerId:'fatay-individual-up'});
  expect(offer.status).toBe(200);
  expect(offer.data.orderTotal).toBeGreaterThan(0);
  const input=selected(x.order,offer.data);
  const quote=await x.call('quote',{order:input,upsellProof:proof});
  expect(quote.status).toBe(200);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
  const done=await x.call('order',{order:input,upsellProof:proof,requestId:rid});
  expect(done.status).toBe(200);
  expect(x.orders).toHaveLength(1);
  expect(x.orders[0].total).toBe(offer.data.orderTotal);
  expect(x.repo.consumeUpsellNonce).toHaveBeenCalledTimes(1);
 });
 it('cambiar la dirección tras emitir la oferta la invalida antes de generar el pedido',async()=>{
  const x=deliverySetup(),offer=await x.call('offer',{order:x.order,upsellProof:proof,
   productId:'fatay',offerId:'fatay-individual-up'});
  expect(offer.status).toBe(200);
  const input={...selected(x.order,offer.data),address:'Otra dirección 456'};
  const done=await x.call('order',{order:input,upsellProof:proof,requestId:rid});
  expect(done.status).toBe(409);expect(x.orders).toHaveLength(0);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
 });
});
