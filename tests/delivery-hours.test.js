import {it,expect,vi} from 'vitest';
import {deliveryHours,validDeliveryHours,deliveryQuote,deliverySnapshot,deliveryHoursText} from '../src/core/delivery.js';
import {sahtenDeliveryPolicy,sahtenDeliveryHours,SAHTEN_CENTER} from '../src/delivery/preset.js';
import {createDeliveryService} from '../src/delivery/service.js';
import {createPaymentService} from '../src/payments/service.js';
import {quoteOrder} from '../src/payments/core.js';
import {deliveryIncentiveHtml} from '../src/delivery/incentive.js';
import routes from './fixtures/delivery/routes-verified-2026-10-24.json';
const open=Date.parse('2026-10-23T23:00:00Z'),closed=Date.parse('2026-10-25T00:00:00Z')+2*3600000; // sábado 23:00 ART
const p=()=>({...sahtenDeliveryPolicy(),active:true,promotionsEnabled:true});
const place=routes.find(r=>r.query==='Hospital Bernardo Houssay');
const menu=()=>({products:[{id:'p',name:'Plato de prueba',price:20000}],config:{},store:{currency:{symbol:'$',locale:'es-AR'}},delivery:{deliveryV2:p()},payments:{methods:{efectivo:true,mercadopago:true}}});
const order={source:'delivery',lat:place.destination.lat,lng:place.destination.lng,address:place.label,customerName:'Prueba',customerPhone:'1112345678',items:[{id:'p',qty:1}],paymentMethod:'efectivo',total:22190};
const sid='00000000-0000-4000-8000-000000000001',qid='00000000-0000-4000-8000-000000000002';
it.each([
 ['2026-10-19T20:59:59Z',false],['2026-10-19T21:00:00Z',true],['2026-10-20T00:59:59Z',true],['2026-10-20T01:00:00Z',false],
 ['2026-10-23T21:00:00Z',true],['2026-10-24T01:59:59Z',true],['2026-10-24T02:00:00Z',false],
 ['2026-10-24T21:00:00Z',true],['2026-10-25T02:00:00Z',false],['2026-10-25T21:00:00Z',false],
])('horario Argentina, instante %s, abierto %s',(stamp,expected)=>expect(deliveryHours(sahtenDeliveryHours(),Date.parse(stamp)).open).toBe(expected));
it('muestra próxima apertura y no inventa pedidos programados ni atención los domingos',()=>{
 const h=deliveryHours(sahtenDeliveryHours(),Date.parse('2026-10-25T21:00:00Z'));
 expect(h).toMatchObject({open:false,nextOpening:'2026-10-26T21:00:00.000Z'});expect(h.nextLabel).toContain('18:00');expect(deliveryIncentiveHtml({status:'closed',hours:h})).toContain('Delivery fuera de horario');expect(deliveryHoursText(sahtenDeliveryHours())).toContain('Dom: cerrado');
});
it('fechas especiales, turnos partidos y pasada medianoche son explícitos y editables',()=>{
 const h=sahtenDeliveryHours();h.exceptions=[{date:'2026-10-23',periods:[]}];expect(deliveryHours(h,open).open).toBe(false);
 h.exceptions=[{date:'2026-10-23',periods:[{start:'12:00',end:'14:00'},{start:'22:00',end:'02:00'}]}];expect(deliveryHours(h,Date.parse('2026-10-23T16:00:00Z')).open).toBe(true);expect(deliveryHours(h,open).open).toBe(false);expect(deliveryHours(h,Date.parse('2026-10-24T04:00:00Z')).open).toBe(true);
 h.exceptions.push({date:'2026-10-24',periods:[]});expect(deliveryHours(h,Date.parse('2026-10-24T04:00:00Z')).open).toBe(false);
});
it('rechaza zona horaria, fecha y rango inválidos; un horario corrupto cierra el delivery',()=>{
 for(const mutate of [h=>h.timeZone='inexistente',h=>h.weekly[1]=[{start:'25:00',end:'26:00'}],h=>h.exceptions=[{date:'2026-02-30',periods:[]}],h=>h.weekly[1]=[{start:'18:00',end:'18:00'}]]){const h=sahtenDeliveryHours();mutate(h);expect(validDeliveryHours(h)).toBe(false);expect(deliveryHours(h,open).open).toBe(false);}
 expect(deliveryHours(null,open).open).toBe(true);expect(deliveryHours({...sahtenDeliveryHours(),enabled:false},closed).open).toBe(true);
});
it('web/POS usan la misma regla: cierra aun con ruta y autorización; retiro sigue disponible y el histórico se conserva',()=>{
 const policy=p(),route=place.route,authorization={approved:true,revision:policy.revision,destination:place.destination};
 const q=deliveryQuote(policy,place.destination,20000,{route,now:open,authorization});expect(q.ok).toBe(true);const historical=deliverySnapshot(q,route);
 expect(deliveryQuote(policy,place.destination,20000,{route,now:closed,authorization})).toMatchObject({ok:false,status:'closed'});
 expect(()=>quoteOrder(menu(),order,{route,now:closed,allowOtherPayments:true})).toThrow(/fuera de horario/);
 expect(quoteOrder(menu(),{...order,source:'pickup'},{now:closed,allowOtherPayments:true}).shipping).toBe(0);
 expect(historical.hours).toMatchObject({checkedAt:new Date(open).toISOString(),closesAt:'2026-10-24T02:00:00.000Z'});
});
it('el servidor rechaza nuevos pedidos fuera de horario sin consultar rutas, aunque el comprador envíe una hora falsa',async()=>{
 const run=vi.fn(async a=>a==='limit'?true:null),resolveRoute=vi.fn(async()=>place.route);
 const handler=createDeliveryService({repo:{run,menu:async()=>menu(),canOperate:async()=>true,posRules:async()=>({})},resolveRoute,authenticate:async()=>({id:'cashier'}),geocode:async()=>[],now:()=>closed});
 const call=async action=>handler(new Request('https://test.invalid/'+action,{method:'POST',body:JSON.stringify({storeId:sid,requestId:qid,order:{...order,localOrderId:'ord_prueba12',now:open}})}));
 expect((await (await call('quote')).json()).quote.status).toBe('closed');
 for(const action of ['order','validate-pos']){const r=await call(action);expect(r.status).toBe(409);expect((await r.json()).error).toBe('closed');}
 expect(resolveRoute).not.toHaveBeenCalled();expect(run.mock.calls.some(([a])=>a==='order')).toBe(false);
});
it('Checkout Pro verifica hora del servidor antes de reservar una compra o contactar Mercado Pago',async()=>{
 const run=vi.fn(async action=>action==='account'?{site_url:'https://store.test',mode:'test'}:true),provider=vi.fn(),resolve=vi.fn();
 const handler=createPaymentService({repo:{run,menu:async()=>menu()},authenticate:async()=>null,fetchImpl:provider,endpoint:'https://server.test',resolveDelivery:resolve,now:()=>closed});
 const r=await handler(new Request('https://server.test/checkout',{method:'POST',headers:{origin:'https://store.test'},body:JSON.stringify({storeId:sid,requestId:qid,proof:'a'.repeat(64),order:{...order,paymentMethod:'mercadopago',now:open}})}));
 expect(r.status).toBe(409);expect((await r.json()).code).toBe('closed');expect(provider).not.toHaveBeenCalled();expect(resolve).not.toHaveBeenCalled();expect(run.mock.calls.some(([a])=>a==='reserve')).toBe(false);
});
it('rutas reales registradas: zonas efectivas 1–5, excepción y rechazo; nunca confunde radio con calle',()=>{
 const expected=[['delivery-2',true],['delivery-2',true],['delivery-3',true],['delivery-6',false],['delivery-5',true],['delivery-4',true],['delivery-4',true],['delivery-1',true],[null,false]];
 routes.forEach((r,i)=>{const q=deliveryQuote(p(),r.destination,90000,{route:r.route,now:open});expect(q.effectiveZone?.id||null,r.label).toBe(expected[i][0]);expect(q.ok,r.label).toBe(expected[i][1]);});
 const q=deliveryQuote(p(),routes[0].destination,20000,{route:routes[0].route,now:open});expect(q.geographicZone.id).toBe('delivery-1');expect(q.effectiveZone.id).toBe('delivery-2');expect(q.baseCost).toBe(2990);expect(q.routeKm).toBeGreaterThan(q.distKm);
});

it('tabla comercial completa usando destinos y recorridos reales de cada zona efectiva',()=>{
 for(const [index,subtotal,cost] of [[7,15000,2190],[7,25000,0],[0,20000,2990],[0,35000,0],[2,20000,3990],[2,35000,1990],[2,50000,0],[5,55000,2750],[5,80000,0],[4,40000,6990],[4,80000,3500]]){const r=routes[index];expect(deliveryQuote(p(),r.destination,subtotal,{route:r.route,now:open}),r.label).toMatchObject({ok:true,cost});}
});
