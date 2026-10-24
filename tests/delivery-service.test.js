import {it,expect,vi} from 'vitest';
import {createDeliveryService} from '../src/delivery/service.js';
import {roadRoute} from '../src/delivery/routing.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';
import {circlePoints} from '../src/delivery/geometry.js';
const sid='00000000-0000-4000-8000-000000000001',qid='00000000-0000-4000-8000-000000000002';
function setup(km=4.5){
 const p={...sahtenDeliveryPolicy(),hours:{...sahtenDeliveryPolicy().hours,enabled:false},active:true,promotionsEnabled:true},point=circlePoints(p.center,Math.min(km-.1,7.5))[0],destination={lat:point[0],lng:point[1]},route={origin:p.center,destination,provider:'verified-test-provider',distanceMeters:km*1000,validatedAt:'2026-10-24T12:00:00Z'};
 const menu={config:{},store:{currency:{symbol:'$',locale:'es-AR'}},products:[{id:'p',name:'Producto',price:40000}],delivery:{deliveryV2:p},payments:{methods:{efectivo:true,transferencia:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}}};
 const quotes=new Map(),orders=[],run=vi.fn(async(action,a)=>{if(action==='limit')return true;if(action==='save_quote'){const q={id:qid,store_id:sid,revision:a.revision,payload:a.payload,route:a.route,result:a.result};quotes.set(qid,q);return q;}if(action==='quote')return quotes.get(a.id)||null;if(action==='authorize'){Object.assign(quotes.get(a.id),{authorized_at:'2026-10-24T13:00:00Z',authorized_by:a.actor,authorization_reason:a.reason,tariff_exception:a.tariff_exception});return quotes.get(a.id);}if(action==='order'){orders.push(a.payload);return{id:'order-id'};}if(action==='request')return quotes.get(a.id);return{};});
 const repo={run,menu:async()=>menu,canManage:async(s,u)=>u.id==='owner',canOperate:async()=>true,posRules:async()=>({payments:[{method:'qr'}],discounts:[{id:'d',name:'Beneficio',type:'pct',value:15}]}),savePos:vi.fn(async()=>qid)};
 const resolveRoute=vi.fn(async()=>route),authenticate=async req=>req.headers.get('authorization')==='Bearer owner'?{id:'owner'}:req.headers.get('authorization')==='Bearer cashier'?{id:'cashier'}:null;
 const handler=createDeliveryService({repo,resolveRoute,authenticate,geocode:async()=>[],originKey:async()=> 'ip-hash'});
 const input={source:'delivery',lat:destination.lat,lng:destination.lng,address:'Dirección ficticia',customerName:'Prueba',customerPhone:'12345678',items:[{productId:'p',qty:1}],paymentMethod:'efectivo',total:37990};
 const call=async(action,body={},token='')=>{const response=await handler(new Request('https://test.invalid/'+action,{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({storeId:sid,...body})}));return {status:response.status,data:await response.json()};};
 return {call,menu,route,input,repo,resolveRoute,quotes,orders,p};
}
it('calcula en servidor, rechaza importes falsos y no acepta Mercado Pago sin Checkout Pro',async()=>{
 const a=setup();let r=await a.call('quote',{order:{...a.input,shipping:1,total:1}});expect(r.data.order).toMatchObject({discount:4000,shipping:1990,total:37990});
 r=await a.call('order',{order:{...a.input,total:1},requestId:qid});expect(r.status).toBe(409);expect(a.orders).toHaveLength(0);
 expect((await a.call('order',{order:{...a.input,paymentMethod:'mercadopago'},requestId:qid})).status).toBe(400);
 r=await a.call('order',{order:a.input,requestId:qid});expect(r.status).toBe(200);expect(a.orders[0].deliverySnapshot).toMatchObject({charged:1990,discount:2000,revision:a.p.revision});
});
it('el fallo del proveedor no se sustituye por un radio ni crea un pedido',async()=>{
 const a=setup();a.resolveRoute.mockRejectedValue(new Error('routing_unavailable'));
 const r=await a.call('order',{order:a.input,requestId:qid});expect(r.status).toBe(503);expect(r.data.message).toContain('calles');expect(a.orders).toHaveLength(0);
 const pickup=await a.call('order',{order:{...a.input,source:'pickup',total:36000},requestId:qid});expect(pickup.status).toBe(200);
});
it('solo administración autoriza y una aprobación no sobrevive a cambiar dirección, revisión o máximo',async()=>{
 const a=setup(8.2);a.input.items[0].qty=2;a.input.total=81000;
 const q=await a.call('request',{order:a.input});expect(q.data.quote.status).toBe('authorization_required');
 expect((await a.call('authorize',{quoteId:qid,reason:'Reparto autorizado'},'cashier')).status).toBe(403);
 expect((await a.call('authorize',{quoteId:qid,reason:'Reparto autorizado'},'owner')).status).toBe(200);
 expect((await a.call('order',{order:{...a.input,total:81000,deliveryQuoteId:qid},requestId:qid})).status).toBe(200);
 a.menu.delivery.deliveryV2.revision='otra';expect((await a.call('order',{order:{...a.input,total:81000,deliveryQuoteId:qid},requestId:qid})).status).toBe(409);
 a.route.distanceMeters=8600;expect((await a.call('order',{order:{...a.input,deliveryQuoteId:qid},requestId:qid})).status).toBe(409);
});
it('POS permite medios propios y descuentos del proyecto, pero conserva la validación de catálogo y rol',async()=>{
 const a=setup();const input={...a.input,paymentMethod:'qr',total:41990,localOrderId:'ord_prueba123'};
 const r=await a.call('validate-pos',{order:input},'cashier');expect(r.status).toBe(200);expect(r.data.validationId).toBe(qid);expect(a.repo.savePos).toHaveBeenCalled();
 expect((await a.call('validate-pos',{order:input})).status).toBe(403);
 expect((await a.call('validate-pos',{order:{...input,manualDiscountId:'inventado'}},'cashier')).status).toBe(409);
 expect((await a.call('quote',{order:{...a.input,items:[{id:'p',qty:1.5}]}})).status).toBe(400);
});
it('consulta ORS en servidor, valida endpoints y no filtra la clave ni inventa un respaldo',async()=>{
 const a=setup(),key='fake-test-only-key-no-real';
 const f=vi.fn(async()=>new Response(JSON.stringify({features:[{properties:{summary:{distance:4500,duration:600}},geometry:{coordinates:[[a.p.center.lng,a.p.center.lat],[a.input.lng,a.input.lat]]}}]}),{status:200}));
 const r=await roadRoute(a.p.center,{lat:a.input.lat,lng:a.input.lng},{key,fetchImpl:f});expect(r.distanceMeters).toBe(4500);expect(JSON.stringify(r)).not.toContain(key);expect(JSON.parse(f.mock.calls[0][1].body).coordinates[0]).toEqual([a.p.center.lng,a.p.center.lat]);
 await expect(roadRoute(a.p.center,r.destination,{key,fetchImpl:async()=>new Response('',{status:429})})).rejects.toThrow('routing_rate_limited');
 await expect(roadRoute(a.p.center,r.destination,{fetchImpl:f})).rejects.toThrow('routing_not_configured');
});

it('POS valida todo el catálogo interno, aunque un producto no se publique en la web',async()=>{
 const a=setup();a.repo.posRules=async()=>({catalog:[{id:'interno',name:'Producto solo Mostrador',fixedPrices:{mostrador:40000},quoteIds:{mostrador:'precio-servidor'}}],payments:[{method:'qr'}],tienda:{deliveryV2:a.p}});a.menu.config.enabled=false;
 const input={...a.input,items:[{id:'interno',qty:1}],paymentMethod:'qr',total:41990,localOrderId:'ord_interno12'};
 const r=await a.call('validate-pos',{order:input},'cashier');expect(r.status).toBe(200);expect(r.data.order.items[0]).toMatchObject({productId:'interno',unitPrice:40000,priceRevision:'precio-servidor'});
 expect((await a.call('order',{order:input,requestId:qid})).status).toBe(409);
});
