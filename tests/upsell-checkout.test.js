import {describe,it,expect,vi} from 'vitest';
import {promotionReport} from '../src/core/promotions-report.js';
import {createDeliveryService} from '../src/delivery/service.js';
import {createUpsellCheckout,upsellDefinitionDigest} from '../src/promotions/upsell-checkout.js';
const sid='11111111-1111-4111-8111-111111111111';
const sessionId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const secret='local-test-only-not-production-'+ 'a'.repeat(40);
function setup(){
 const menu={config:{enabled:true,showPrices:true},store:{currency:{code:'ARS'}},
  products:[{id:'plato',name:'Plato',price:30000},{id:'baklava',name:'Baklava',price:7000}],
  payments:{methods:{efectivo:true,transferencia:true,mercadopago:true},
   benefit:{enabled:true,percent:10,channels:{online:true}}},
  promotions:{enabled:true,paymentPercent:10,upsellGuardRequired:true,requireVerifiedCosts:true,
   minMarginPct:40,campaigns:[],upsells:[{id:'baklava-up',name:'Baklava adicional',kind:'upsell',
    enabled:true,maxUnits:1,productIds:['baklava'],triggerProductIds:['plato'],extraPercent:10}]}};
 const economics={revision:'review-1',products:{
  plato:{verified:true,directCost:5000,fixedCost:3000},
  baklava:{verified:true,incrementalVerified:true,directCost:800,fixedCost:500,additionalIncrementalCost:100}},
  orderCosts:{verified:true,additionalOrderCost:300,shippingSubsidy:0}};
 const used=new Map();
 const consumeNonce=vi.fn(async({nonce,requestId})=>{
  if(used.has(nonce))return used.get(nonce)===requestId;
  used.set(nonce,requestId);return true;
 });
 const readEconomics=vi.fn(async()=>structuredClone(economics));
 let timestamp=Date.parse('2026-11-04T15:00:00Z');
 const checkout=createUpsellCheckout({secret,readEconomics,consumeNonce,now:()=>timestamp});
 const args={storeId:sid,sessionId,offerId:'baklava-up',menu,
  order:{source:'pickup',customerName:'Prueba',customerPhone:'1122334455',paymentMethod:'transferencia',items:[{productId:'plato',qty:1}]}};
 const accept=(offer,extra={})=>checkout.accept({...args,token:offer.token,requestId,
  order:{...args.order,items:[...args.order.items,{productId:'baklava',qty:1}]},...extra});
 return {checkout,args,accept,menu,economics,consumeNonce,readEconomics,setTime:n=>timestamp=n};
}
describe('Recorrido servidor de una oferta incremental',()=>{
 it('cotiza importes reales, firma una oferta y recotiza al aceptarla sin revelar costos',async()=>{
  const x=setup(),offer=await x.checkout.offer(x.args);
  expect(offer).toMatchObject({productId:'baklava',offerId:'baklava-up',total:32600,discount:4400});
  expect(offer.line).toMatchObject({base:7000,net:5600,discount:1400});
  expect(x.consumeNonce).not.toHaveBeenCalled();
  expect(JSON.stringify(offer)).not.toMatch(/directCost|fixedCost|additionalIncrementalCost|review-1/);
  const accepted=await x.accept(offer);
  expect(accepted.order.total).toBe(32600);
  expect(accepted.order.promotionSnapshot.appliedPromotionIds).toEqual(['baklava-up']);
  expect(x.consumeNonce).toHaveBeenCalledOnce();
  expect(accepted.acceptanceDigest).toMatch(/^[a-f0-9]{64}$/);
 });
 it('la misma compra reintenta sin duplicar la aceptación, otra compra no puede consumir el token',async()=>{
  const x=setup(),offer=await x.checkout.offer(x.args);
  expect((await x.accept(offer)).order.total).toBe(32600);
  expect((await x.accept(offer)).order.total).toBe(32600);
  await expect(x.accept(offer,{requestId:'44444444-4444-4444-8444-444444444444'})).rejects.toMatchObject({code:'upsell_acceptance_invalid'});
 });
 it('ignora pruebas y precios inventados dentro de la compra',async()=>{
  const x=setup(),offer=await x.checkout.offer(x.args);
  const accepted=await x.accept(offer,{order:{...x.args.order,total:1,
   trustedEconomics:{},trustedUpsellSelection:{verified:true},
   items:[{productId:'plato',qty:1,unitPrice:1},{productId:'baklava',qty:1,unitPrice:1}]}});
  expect(accepted.order.total).toBe(32600);
 });
 it('sin costo de otro producto o gastos incrementales comprobados no ofrece descuento',async()=>{
  for(const mutate of [e=>delete e.products.plato,e=>delete e.products.baklava.additionalIncrementalCost,
   e=>e.orderCosts.verified=false,e=>e.orderCosts.shippingSubsidy=1]){
   const x=setup();mutate(x.economics);
   await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_costs_unverified'});
   expect(x.consumeNonce).not.toHaveBeenCalled();
  }
 });
 it('margen insuficiente no se transforma en oferta ni consume una aceptación',async()=>{
  const x=setup();x.economics.products.baklava.additionalIncrementalCost=6000;
  await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_ineligible'});
  expect(x.consumeNonce).not.toHaveBeenCalled();
 });
 it('un piso debilitado en el menú no evita el mínimo de margen del servidor',async()=>{
  const x=setup();x.economics.products.baklava.additionalIncrementalCost=3000;
  x.menu.promotions.activationPolicy={basketContributionTargetPct:1,minIncrementalContributionPct:1};
  await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_ineligible'});
  expect(x.consumeNonce).not.toHaveBeenCalled();
 });
 it('permite diferir adicionales sólo con autorización privada y conserva la marca provisional en la venta y reportes',async()=>{
  const x=setup();
  x.economics.products.baklava.incrementalVerified=false;
  x.economics.products.baklava.additionalIncrementalCost=0;
  x.economics.orderCosts.verified=false;x.economics.orderCosts.additionalOrderCost=0;
  await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_costs_unverified'});
  x.economics.costException={approved:true,kind:'deferred_additional_costs',
   auditId:'55555555-5555-4555-8555-555555555555',approvedBy:'66666666-6666-4666-8666-666666666666',
   approvedAt:'2026-11-04T15:00:00Z',note:'Se revisarán los envases y gastos adicionales posteriormente.',
   assumedIncrementalCost:0,assumedOrderCost:0};
  const offer=await x.checkout.offer(x.args),accepted=await x.accept(offer);
  expect(accepted.order.promotionSnapshot.costReview).toMatchObject({status:'provisional',auditId:x.economics.costException.auditId});
  expect(promotionReport([accepted.order]).provisionalOrders).toBe(1);
  delete x.economics.products.plato;
  await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_costs_unverified'});
 });
 it('precio, costo o estado modificados invalidan el reto antes de consumirlo',async()=>{
  for(const change of [x=>x.menu.products[0].price++,x=>x.economics.revision='review-2',
   x=>x.menu.promotions.upsells[0].enabled=false]){
   const x=setup(),offer=await x.checkout.offer(x.args);change(x);
   await expect(x.accept(offer)).rejects.toBeDefined();
   expect(x.consumeNonce).not.toHaveBeenCalled();
  }
 });
 it('rechaza dos unidades, retirar el plato, otra sesión y caducidad',async()=>{
  const x=setup(),offer=await x.checkout.offer(x.args);
  for(const extra of [
   {order:{...x.args.order,items:[{productId:'plato',qty:1},{productId:'baklava',qty:2}]}},
   {order:{...x.args.order,items:[{productId:'baklava',qty:1}]}},
   {sessionId:'44444444-4444-4444-8444-444444444444'},
   {token:offer.token+'bad'}
  ])await expect(x.accept(offer,extra)).rejects.toBeDefined();
  x.setTime(offer.expiresAt+1);
  await expect(x.accept(offer)).rejects.toMatchObject({code:'upsell_acceptance_invalid'});
  expect(x.consumeNonce).not.toHaveBeenCalled();
 });
 it('no incorpora Mercado Pago, delivery ni Mostrador sin su integración específica',async()=>{
  const x=setup();
  await expect(x.checkout.offer({...x.args,order:{...x.args.order,paymentMethod:'mercadopago'}})).rejects.toMatchObject({code:'upsell_payment_ineligible'});
  await expect(x.checkout.offer({...x.args,order:{...x.args.order,source:'delivery'}})).rejects.toMatchObject({code:'upsell_channel_unavailable'});
  await expect(x.checkout.offer({...x.args,channel:'mostrador'})).rejects.toMatchObject({code:'upsell_channel_unavailable'});
 });
 it('Fatay 30% necesita una excepción privada exacta y mantiene el 30% como total',async()=>{
  const x=setup();
  x.menu.products[1]={id:'fatay',name:'Fatay',price:5850};
  x.economics.products.fatay=x.economics.products.baklava;delete x.economics.products.baklava;
  const rule=x.menu.promotions.upsells[0];
  Object.assign(rule,{id:'fatay-individual-up',productIds:['fatay'],
   discountTiers:[{minEligibleNetSubtotal:20000,totalDiscountPercent:20},
    {minEligibleNetSubtotal:50000,totalDiscountPercent:30}]});
  const args={...x.args,offerId:rule.id,order:{...x.args.order,items:[{productId:'plato',qty:2}]}};
  x.economics.exceptionApproval={verified:true,auditId:'55555555-5555-4555-8555-555555555555',
   definitionDigest:await upsellDefinitionDigest(rule)};
  await expect(x.checkout.offer(args)).rejects.toMatchObject({code:'upsell_exception_required'});
  x.economics.exceptionApproval.maxTotalPercent=30;
  const offer=await x.checkout.offer(args);
  expect(offer.line).toMatchObject({base:5850,discount:1755,net:4095});
  rule.extraPercent=9;
  await expect(x.checkout.offer(args)).rejects.toMatchObject({code:'upsell_exception_required'});
  expect(x.consumeNonce).not.toHaveBeenCalled();
 });
 it('no extiende descuentos superiores al 20% a una oferta ordinaria',async()=>{
  const x=setup();x.menu.promotions.upsells[0].extraPercent=20;
  await expect(x.checkout.offer(x.args)).rejects.toMatchObject({code:'upsell_exception_required'});
 });
});


describe('Oferta y confirmación mediante el servicio de pedidos',()=>{
 it('persiste el total recotizado, permite reintento idéntico y rechaza modificar o quitar la aceptación',async()=>{
  const x=setup();x.menu.delivery={deliveryV2:{active:true}};
  const stored=new Map(),orders=[];
  const repo={menu:async()=>x.menu,promotionCosts:async()=>({plato:8000,baklava:1300}),
   run:vi.fn(async(action,args)=>{
    if(action==='limit')return true;
    if(action==='submission')return stored.get(args.request_id)||null;
    if(action==='order'){
     const result={id:'saved-order',order:args.payload};orders.push(args.payload);
     stored.set(args.request_id,result);return result;
    }
   })};
  repo.confirmUpsellOrder=(store_id,request_id,payload)=>repo.run('order',{store_id,request_id,payload});
  const handler=createDeliveryService({repo,upsellCheckout:x.checkout,authenticate:async()=>null});
  const call=async(action,extra={})=>{
   const response=await handler(new Request('https://test.invalid/'+action,{method:'POST',
    body:JSON.stringify({storeId:sid,upsellOfferId:'baklava-up',upsellSessionId:sessionId,order:x.args.order,...extra})}));
   return {status:response.status,data:await response.json()};
  };
  const offer=await call('upsell-offer');expect(offer.status).toBe(200);
  const order={...x.args.order,total:offer.data.total,items:[...x.args.order.items,{productId:'baklava',qty:1}]};
  const args={order,requestId,upsellToken:offer.data.token};
  expect((await call('order',{...args,order:{...order,total:1}})).status).toBe(409);
  expect(orders).toHaveLength(0);
  const confirmed=await call('order',args);
  expect(confirmed.status).toBe(200);
  expect(orders).toHaveLength(1);expect(orders[0].total).toBe(32600);
  expect(orders[0].upsellAcceptanceDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(orders[0])).not.toContain(offer.data.token);
  expect((await call('order',args)).status).toBe(200);expect(orders).toHaveLength(1);
  expect((await call('order',{...args,upsellToken:undefined})).status).toBe(409);
  expect((await call('order',{...args,upsellSessionId:'44444444-4444-4444-8444-444444444444'})).status).toBe(409);
 });
 it('sin configurar el coordinador no habilita ofertas ni cambia el pedido habitual',async()=>{
  const handler=createDeliveryService({repo:{run:async()=>true},authenticate:async()=>null});
  const response=await handler(new Request('https://test.invalid/upsell-offer',{
   method:'POST',body:JSON.stringify({storeId:sid,order:{source:'pickup'}})}));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe('upsell_not_configured');
 });
});
