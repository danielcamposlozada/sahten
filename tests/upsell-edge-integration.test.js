import {describe,it,expect,vi} from 'vitest';
import {createPaymentService} from '../src/payments/service.js';
import {quoteOrder} from '../src/payments/core.js';
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
 const account={id:'00000000-0000-4000-8000-000000000005',store_id:sid,account_id:'123',site_url:'https://sahten.online',mode:'test',
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
 return {repo,m,calls,call,fetchImpl,service,account};
}
describe('Rentabilidad: comisión MP nunca presumida al activar promociones',()=>{
 it('sin comisión aprobada no cotiza promociones MP, aunque el checkout no lleve upsell',()=>{
  const m=menu();
  expect(()=>quoteOrder(m,base('mercadopago'),{now:at}))
   .toThrow(/comisión aprobada/);
  m.promotions.checkoutProFeePercent=7.4;
  const quoted=quoteOrder(m,base('mercadopago'),{now:at});
  expect(quoted.total).toBe(32000);
  expect(quoted.promotionSnapshot.method).toBe('mercadopago');
  // Cero explícito significa 0 %, no la comisión ficticia del 10 %.
  m.promotions.checkoutProFeePercent=0;
  const noFee=quoteOrder(m,base('mercadopago'),{now:at});
  expect(noFee.promotionSnapshot.estimatedPaymentFee).toBe(0);
 });
});
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
 it('oferta firmada + compra MP ficticia + webhook aprobado y rechazado: no confundir retorno con pago',async()=>{
  for(const status of ['approved','rejected']){
   const x=paymentSetup(),original=base('mercadopago');
   const offer=await x.call('offer',offerBody(original));
   expect(offer.status).toBe(200);
   const paidOrder=await x.call('checkout',{storeId:sid,requestId:rid,proof,
    order:selected(original,offer.data)});
   expect(paidOrder.status).toBe(200);
   // La preferencia por sí sola NO genera un pedido ni prueba acreditación.
   expect(x.calls.filter(([kind])=>kind==='payment')).toHaveLength(0);
   const id='999',checkoutId='00000000-0000-4000-8000-000000000006';
   x.fetchImpl.mockImplementation(async url=>{
    if(String(url).includes('/v1/payments/'))return Response.json({
     id:999,external_reference:checkoutId,collector_id:123,currency_id:'ARS',
     live_mode:false,status,transaction_amount:offer.data.orderTotal,
     date_last_updated:new Date(at).toISOString()
    });
    return Response.json({id:'preference-1',init_point:'https://www.mercadopago.com.ar/checkout/test'});
   });
   const oldRun=x.repo.run;
   x.repo.run=vi.fn(async(action,args)=>{
    if(action==='webhook_accounts')return [x.account];
    if(action==='checkout')return {id:checkoutId,store_id:sid,account_id:x.account.id,
     order:{total:offer.data.orderTotal},payment_status:'pending'};
    return oldRun(action,args);
   });
   const ts=String(Math.floor(at/1000)),reqId='test-event-signed-001';
   const payload='id:'+id+';request-id:'+reqId+';ts:'+ts+';';
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(x.account.credentials.webhookSecret),
     {name:'HMAC',hash:'SHA-256'},false,['sign']);
   const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
   const hash=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
   const webhook=()=>new Request('https://edge.test/webhook?store_id='+sid+'&data.id='+id,{
    method:'POST',headers:{'Content-Type':'application/json','x-request-id':reqId,
     'x-signature':'ts='+ts+',v1='+hash},
    body:JSON.stringify({type:'payment',data:{id}})
   });
   const signed=await x.service(webhook());
   expect(signed.status).toBe(200);
   const events=x.calls.filter(([action])=>action==='payment');
   expect(events).toHaveLength(1);
   expect(events[0][1]).toMatchObject({checkout_id:checkoutId,status});
   const withoutSignature=new Request('https://edge.test/webhook?store_id='+sid+'&data.id='+id,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'payment',data:{id}})});
   expect((await x.service(withoutSignature)).status).toBe(401);
   expect(x.calls.filter(([action])=>action==='payment')).toHaveLength(1);
  }
 });
 it('Mercado Pago no cobra como transferencia aunque el browser fuerce el método',async()=>{
  const x=paymentSetup(),original=base('mercadopago');
  const offer=await x.call('offer',offerBody(original));expect(offer.status).toBe(200);
  const wrong={...selected(original,offer.data),paymentMethod:'transferencia'};
  const result=await x.call('checkout',{storeId:sid,requestId:rid,proof,order:wrong});
  expect(result.status).toBe(409);
  expect(result.data.code).toBe('invalid_payment_method');
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
  expect(x.calls.some(([action])=>action==='reserve')).toBe(false);
  expect(x.fetchImpl).not.toHaveBeenCalled();
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
 it('reintentar el mismo requestId reutiliza preferencia y nonce; no duplica cobro',async()=>{
  const x=paymentSetup(),original=base('mercadopago'),saved={url:null};
  const old=x.repo.run;
  x.repo.run=vi.fn(async(action,args)=>{
   const record=await old(action,args);
   if(action==='reserve'&&saved.url)return {...record,checkout_url:saved.url};
   if(action==='preference')saved.url=args.checkout_url;
   return record;
  });
  const offer=await x.call('offer',offerBody(original));
  const payload={storeId:sid,requestId:rid,proof,order:selected(original,offer.data)};
  const first=await x.call('checkout',payload),again=await x.call('checkout',payload);
  expect(first.status).toBe(200);expect(again.status).toBe(200);
  expect(first.data.checkoutUrl).toBe(again.data.checkoutUrl);
  expect(x.fetchImpl).toHaveBeenCalledTimes(1);
  // Una preferencia existente no necesita consumir el nonce otra vez.
  expect(x.repo.consumeUpsellNonce).toHaveBeenCalledTimes(1);
 });
 it('si falla la reserva, no consume el nonce ni solicita pago a Mercado Pago',async()=>{
  const x=paymentSetup(),original=base('mercadopago'),old=x.repo.run;
  x.repo.run=vi.fn(async(action,args)=>{
   if(action==='reserve')throw Error('db unavailable');
   return old(action,args);
  });
  const offer=await x.call('offer',offerBody(original));
  expect(offer.status).toBe(200);
  const result=await x.call('checkout',{storeId:sid,requestId:rid,proof,
   order:selected(original,offer.data)});
  expect(result.status).toBe(500);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
  expect(x.fetchImpl).not.toHaveBeenCalled();
 });
 it('nonce rechazado libera la reserva y nunca crea preferencia',async()=>{
  const x=paymentSetup(),original=base('mercadopago');
  x.repo.consumeUpsellNonce.mockResolvedValue(false);
  const offer=await x.call('offer',offerBody(original));
  expect(offer.status).toBe(200);
  const result=await x.call('checkout',{storeId:sid,requestId:rid,proof,
   order:selected(original,offer.data)});
  expect(result.status).toBe(409);
  expect(x.calls.map(([name])=>name)).toContain('reserve');
  expect(x.calls.map(([name])=>name)).toContain('release');
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
  atomicUpsellOrder:vi.fn(async x=>{
   // Simulador: la transacción SQL real se prueba con PGlite por separado.
   const confirmed=await repo.consumeUpsellNonce(x);
   if(!confirmed)throw Error('upsell_nonce_reused');
   return repo.run('order',{store_id:x.storeId,request_id:x.requestId,payload:x.payload});
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
describe('Delivery: bebidas de precio completo independientes de promociones',()=>{
 it('acepta una bebida sin token promocional y conserva el beneficio por transferencia',async()=>{
  const x=deliverySetup();x.m.promotions.enabled=false;
  x.m.products.push({id:'bebida_agua_con_gas_600ml',name:'Agua con gas 600 ml',category:'Bebidas',
   price:2000,priceRevision:'r1'});
  const baseQuote=await x.call('quote',{order:x.order});
  const withDrink={...x.order,items:[...x.order.items,
   {productId:'bebida_agua_con_gas_600ml',qty:1}]};
  const drinkQuote=await x.call('quote',{order:withDrink});
  expect(baseQuote.status).toBe(200);expect(drinkQuote.status).toBe(200);
  expect(drinkQuote.data.order.total-baseQuote.data.order.total).toBe(1800);
  const done=await x.call('order',{order:{...withDrink,total:drinkQuote.data.order.total},requestId:rid});
  expect(done.status).toBe(200);
  expect(done.data.order.items.some(x=>x.productId==='bebida_agua_con_gas_600ml')).toBe(true);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
 });
});
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
 it('repetir la misma orden entrega el registro previo sin volver a consumir el token',async()=>{
  const x=deliverySetup(),old=x.repo.run;
  let last=null;
  x.repo.run=vi.fn(async(action,args)=>{
   if(action==='submission')return last;
   const value=await old(action,args);
   if(action==='order')last=value;
   return value;
  });
  const offer=await x.call('offer',{order:x.order,upsellProof:proof,
   productId:'fatay',offerId:'fatay-individual-up'});
  expect(offer.status).toBe(200);
  const request={order:selected(x.order,offer.data),upsellProof:proof,requestId:rid};
  const a=await x.call('order',request),b=await x.call('order',request);
  expect(a.status).toBe(200);expect(b.status).toBe(200);
  expect(x.orders).toHaveLength(1);
  expect(x.repo.consumeUpsellNonce).toHaveBeenCalledTimes(1);
 });
 it('si la transacción atómica falla, el servicio NO crea pedido ni hace un canje alternativo',async()=>{
  const x=deliverySetup();
  const offer=await x.call('offer',{order:x.order,upsellProof:proof,
   productId:'fatay',offerId:'fatay-individual-up'});
  expect(offer.status).toBe(200);
  x.repo.atomicUpsellOrder.mockRejectedValueOnce(Error('db timeout'));
  const done=await x.call('order',{order:selected(x.order,offer.data),
   upsellProof:proof,requestId:rid});
  expect(done.status).toBeGreaterThanOrEqual(400);
  expect(x.orders).toHaveLength(0);
  expect(x.repo.atomicUpsellOrder).toHaveBeenCalledTimes(1);
  expect(x.repo.consumeUpsellNonce).not.toHaveBeenCalled();
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
