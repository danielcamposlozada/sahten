import {it,expect,vi} from 'vitest';
import {quoteOrder} from '../src/payments/core.js';
import {createPaymentService} from '../src/payments/service.js';
import {shippingFor,deliveryPolicyWithHours,validDeliveryHours} from '../src/core/delivery.js';
import {serviceHoursStatus} from '../src/core/service-hours.js';
import {sahtenOpeningHours,sahtenDeliveryHours,sahtenDeliveryPolicy} from '../src/delivery/preset.js';
const lunch=Date.parse('2026-10-30T16:00:00Z'),afterLunch=Date.parse('2026-10-30T18:30:00Z');
const menu=()=>({products:[{id:'p',name:'Plato',price:20000}],store:{currency:{symbol:'$',locale:'es-AR'},openingHours:sahtenOpeningHours()},delivery:{hours:sahtenDeliveryHours(),deliveryV2:{...sahtenDeliveryPolicy(),active:true}},payments:{methods:{efectivo:true,mercadopago:true}}});
const order={source:'pickup',customerName:'Prueba',customerPhone:'1112345678',items:[{id:'p',qty:1}],paymentMethod:'efectivo',total:20000};
it('el retiro abre a las 12 aunque delivery esté cerrado; a las 15:30 solo Mostrador puede cobrar',()=>{
 const m=menu();expect(serviceHoursStatus(m,'pickup',lunch)).toMatchObject({open:true,kind:'opening'});expect(serviceHoursStatus(m,'delivery',lunch)).toMatchObject({open:false,kind:'delivery'});
 expect(quoteOrder(m,order,{now:lunch,allowOtherPayments:true})).toMatchObject({source:'pickup',total:20000,shipping:0});
 expect(()=>quoteOrder(m,order,{now:afterLunch,allowOtherPayments:true})).toThrow(/retiro en local.*fuera de horario/);
 expect(quoteOrder(m,order,{now:afterLunch,allowOtherPayments:true,salesChannel:'mostrador'})).toMatchObject({source:'pickup',total:20000});
 expect(serviceHoursStatus(m,'pickup',Date.parse('2026-10-30T14:59:59Z')).open).toBe(false);
});
it('un horario de apertura no se convierte en una restricción adicional para delivery',()=>{
 const m=menu();m.store.openingHours.weekly=Array.from({length:7},()=>[]);
 expect(serviceHoursStatus(m,'pickup',Date.parse('2026-10-30T22:00:00Z')).open).toBe(false);
 expect(serviceHoursStatus(m,'delivery',Date.parse('2026-10-30T22:00:00Z')).open).toBe(true);
});
it('el horario operativo raíz domina la copia antigua en v2 tanto en web como en config de Mostrador',()=>{
 const closed={...sahtenDeliveryHours(),weekly:Array.from({length:7},()=>[])},v2={...sahtenDeliveryPolicy(),active:true,hours:{...sahtenDeliveryHours(),enabled:false}};
 expect(deliveryPolicyWithHours({hours:closed,deliveryV2:v2}).hours).toEqual(closed);
 expect(deliveryPolicyWithHours({deliveryHours:closed,deliveryV2:v2}).hours).toEqual(closed);
 expect(shippingFor({deliveryHours:closed,deliveryV2:v2},-34.526,-58.482,20000,{now:lunch})).toMatchObject({ok:false,status:'closed',version:2});
 expect(shippingFor({deliveryHours:closed,zones:[]},-34.526,-58.482,20000,{now:lunch})).toMatchObject({ok:false,status:'closed'});
 for(const timeZone of [undefined,null,'', 'Not/AZone'])expect(validDeliveryHours({...sahtenOpeningHours(),timeZone})).toBe(false);
});
it('Checkout Pro rechaza retiro cerrado usando el reloj del servidor, sin rutas, reservas ni contacto al proveedor',async()=>{
 const run=vi.fn(async action=>action==='account'?{site_url:'https://store.test',mode:'test'}:true),provider=vi.fn(),resolve=vi.fn();
 const handler=createPaymentService({repo:{run,menu:async()=>menu()},authenticate:async()=>null,fetchImpl:provider,endpoint:'https://server.test',resolveDelivery:resolve,now:()=>afterLunch});
 const response=await handler(new Request('https://server.test/checkout',{method:'POST',headers:{origin:'https://store.test'},body:JSON.stringify({storeId:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',proof:'a'.repeat(64),order:{...order,paymentMethod:'mercadopago',now:lunch}})}));
 expect(response.status).toBe(409);expect((await response.json()).code).toBe('pickup_closed');expect(provider).not.toHaveBeenCalled();expect(resolve).not.toHaveBeenCalled();expect(run.mock.calls.some(([action])=>action==='reserve')).toBe(false);
});
