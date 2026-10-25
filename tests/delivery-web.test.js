import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';
import {createDeliveryService} from '../src/delivery/service.js';
import places from './fixtures/delivery/routes-verified-2026-10-24.json';
const sid='00000000-0000-4000-8000-000000000001',qid='00000000-0000-4000-8000-000000000002';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function web({closed=false,geocodeDelay=0,price=20000,geocodeFallback=false,geocodeQuota=false,automatic=false}={}){
 let serverNow=Date.parse(closed?'2026-10-25T21:00:00Z':'2026-10-23T23:00:00Z');
 const menu={version:1,store:{name:'Local de prueba',address:'Dirección de prueba',currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true,showImages:false,categories:['Platos']},products:[{id:'p',name:'Plato de prueba',price,category:'Platos'}],site:null,delivery:{deliveryV2:{...sahtenDeliveryPolicy(),active:true,promotionsEnabled:true}},payments:{methods:{efectivo:true,transferencia:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},supabase:{url:'https://server.test',storeId:sid,anonKey:'public-test-only-key',slug:'test'}};
 const calls=[],orders=[],quotes=new Map(),place=places[2];
 const service=createDeliveryService({now:()=>serverNow,repo:{menu:async()=>menu,run:async(a,b)=>{if(a==='limit')return true;if(a==='save_quote'){const q={id:qid,...b};quotes.set(qid,q);return q;}if(a==='quote')return quotes.get(b.id);if(a==='order'){orders.push(b.payload);return {id:'order-test',order:b.payload};}return null;}},authenticate:async()=>null,resolveRoute:async(s,o,d)=>({...place.route,origin:o,destination:d}),geocode:async()=>{if(geocodeDelay)await wait(geocodeDelay);return [{display_name:place.label,lat:String(place.destination.lat),lon:String(place.destination.lng)}];}});
 const dom=new JSDOM(buildIndexHtml(menu),{url:'https://store.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.Date=class extends Date{constructor(...a){super(...(a.length?a:[serverNow]));}static now(){return serverNow;}};
  w.scrollTo=()=>{};w.fetch=async(u,opts={})=>{const url=String(u);calls.push({url,...opts});if(url==='menu.json')return Response.json(menu);if(url.includes('/sahten-payments/config'))return Response.json({enabled:true,mode:'test'});if(url.includes('/geocode')&&geocodeQuota)return Response.json({error:'routing_geocoder_rate_limited',message:'Esperá un momento.'},{status:503});if(url.includes('/geocode')&&geocodeFallback)return Response.json([]);if(url.startsWith('https://nominatim.openstreetmap.org/search'))return Response.json([{display_name:place.label,lat:String(place.destination.lat),lon:String(place.destination.lng)}]);if(url.includes('/sahten-delivery/'))return service(new Request(url,opts));if(url.includes('/rest/v1/stores'))return Response.json([]);throw Error('Sin red externa: '+url);};
  if(automatic){const original=w.fetch;w.fetch=async(u,o)=>{const url=String(u);if(!url.includes('apis.datos.gob.ar'))return original(u,o);calls.push({url});if(url.includes('/departamentos'))return Response.json({departamentos:[{id:'home',centroide:{lat:menu.delivery.deliveryV2.center.lat,lon:menu.delivery.deliveryV2.center.lng}}]});if(url.includes('/ubicacion'))return Response.json({ubicacion:{departamento:{id:'home'}}});const q=new URL(url).searchParams.get('direccion');if(q.includes('100'))await wait(400);return Response.json({direcciones:[{altura:{valor:1489},calle:{nombre:'ROCA'},nomenclatura:q+', Localidad ficticia',ubicacion:{lat:place.destination.lat,lon:place.destination.lng}}]});};}
 }});
 await wait(100);const w=dom.window,d=w.document,click=sel=>{const el=d.querySelector(sel);expect(el,sel).not.toBeNull();el.click();},type=(sel,value)=>{const el=d.querySelector(sel);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const search=async()=>{await vi.waitFor(()=>expect(d.querySelector('[data-delivery-search]').hidden).toBe(false));click('[data-delivery-search]');expect(d.querySelector('[data-delivery-search]').hidden).toBe(true);};
 return {w,d,click,type,search,calls,orders,close:()=>w.close(),setTime:t=>serverNow=Date.parse(t)};
}
it('web usa ruta del servidor, progreso neto y pagos; cambiar dirección quita la tarifa anterior sin perder foco',async()=>{
 const a=await web();try{a.click('[data-inc]');a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia 123');await wait(600);
 expect(a.calls.filter(c=>c.url.includes('/geocode'))).toHaveLength(0);await a.search();await wait(650);a.click('[data-sug="0"]');await wait(100);
 expect(a.d.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('72');expect(a.d.querySelector('#delivery-card').textContent).toContain('$1.990');expect(a.d.querySelector('#send').disabled).toBe(false);
 a.click('[data-payment-choice="mercadopago"]');expect(a.d.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('80');
 a.click('[data-payment-choice="efectivo"]');a.d.getElementById('f-addr').focus();a.type('#f-addr','Otra dirección');expect(a.d.activeElement.id).toBe('f-addr');expect(a.d.getElementById('delivery-card').textContent).not.toContain('$1.990');expect(a.d.getElementById('send').disabled).toBe(true);expect(a.d.querySelectorAll('[data-shipping-total]')).toHaveLength(0);expect(a.d.querySelectorAll('[data-order-total]')[0].textContent).toBe('$36.000');
 a.click('[data-type="pickup"]');expect(a.d.querySelector('[role="progressbar"]')).toBeNull();expect(a.d.querySelector('#send').disabled).toBe(false);
 }finally{a.close();}
});

it('sugiere automáticamente con calle y altura, agrupa teclas y conserva la selección explícita',async()=>{
 const a=await web({automatic:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');expect(a.d.querySelector('[data-delivery-search]').hidden).toBe(true);a.type('#f-addr','Roca');await wait(400);expect(a.calls.some(c=>c.url.includes('apis.datos.gob.ar'))).toBe(false);a.type('#f-addr','Roca 148');a.type('#f-addr','Roca 1489');await wait(500);expect(a.calls.filter(c=>c.url.includes('/direcciones?'))).toHaveLength(1);expect(a.d.querySelector('[data-sug]').textContent).toContain('Roca 1489');expect(a.d.querySelector('[data-delivery-search]').hidden).toBe(true);expect(a.calls.some(c=>c.url.includes('nominatim'))).toBe(false);expect(a.calls.some(c=>c.url.includes('/quote'))).toBe(false);a.click('[data-sug="0"]');await wait(100);expect(a.calls.some(c=>c.url.includes('/quote'))).toBe(true);expect(a.orders).toHaveLength(0);}finally{a.close();}
});
it('una sugerencia automática tardía no reemplaza la calle que el cliente terminó de escribir',async()=>{
 const a=await web({automatic:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-addr','Roca 100');await wait(380);a.type('#f-addr','Roca 200');await wait(800);expect(a.d.querySelector('#f-addr').value).toBe('Roca 200');expect(a.d.querySelector('[data-sug]').textContent).toContain('Roca 200');expect(a.d.querySelector('#sugs').textContent).not.toContain('Roca 100');expect(a.orders).toHaveLength(0);}finally{a.close();}
});

it('usa la búsqueda directa si el servidor no encuentra una dirección precisa, manteniendo validación de ruta en servidor',async()=>{
 const a=await web({geocodeFallback:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-addr','Calle ficticia 123');await a.search();await wait(120);expect(a.calls.filter(c=>c.url.includes('nominatim.openstreetmap.org/search'))).toHaveLength(1);a.click('[data-sug="0"]');await wait(100);expect(a.calls.some(c=>c.url.includes('/sahten-delivery/quote'))).toBe(true);expect(a.orders).toHaveLength(0);expect(a.d.querySelector('#err').textContent).not.toContain('sin conexión');}finally{a.close();}
});
it('no usa respaldo para eludir una cuota del proveedor ni lo presenta como falta de internet',async()=>{
 const a=await web({geocodeQuota:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-addr','Calle ficticia 123');await a.search();await wait(120);expect(a.calls.filter(c=>c.url.includes('nominatim.openstreetmap.org/search'))).toHaveLength(0);expect(a.d.querySelector('#err').textContent).toContain('Esperá un momento');expect(a.d.querySelector('#err').textContent).not.toContain('sin conexión');expect(a.orders).toHaveLength(0);}finally{a.close();}
});
it('cierre visible desde el carrito; no confirma delivery fuera de hora y permite retiro',async()=>{
 const a=await web({closed:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');expect(a.d.getElementById('delivery-card').textContent).toContain('Delivery fuera de horario');expect(a.d.getElementById('send').disabled).toBe(true);a.click('[data-type="pickup"]');expect(a.d.getElementById('send').disabled).toBe(false);a.click('#send');await wait(100);expect(a.orders).toHaveLength(1);expect(a.orders[0].shipping).toBe(0);
 }finally{a.close();}
});
it('un carrito abierto antes del cierre es rechazado al confirmar después; la hora enviada no es autoridad',async()=>{
 const a=await web();try{a.click('[data-inc]');a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia 123');await a.search();await wait(650);a.click('[data-sug="0"]');await wait(100);expect(a.d.getElementById('send').disabled).toBe(false);a.setTime('2026-10-24T02:00:00Z');a.click('#send');await wait(80);expect(a.orders).toHaveLength(0);expect(a.d.getElementById('send').disabled).toBe(true);expect(a.d.getElementById('delivery-card').textContent).toContain('Delivery fuera de horario');
 }finally{a.close();}
});

it('una búsqueda anterior no repone una dirección que el cliente ya cambió',async()=>{
 const a=await web({geocodeDelay:200});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-addr','Primera dirección 123');await a.search();await wait(40);a.type('#f-addr','Segunda dirección');await wait(350);expect(a.d.querySelector('[data-sug]')).toBeNull();expect(a.d.getElementById('f-addr').value).toBe('Segunda dirección');expect(a.d.getElementById('send').disabled).toBe(true);
 }finally{a.close();}
});

it('piso/depto/referencia y efectivo llegan al servidor; el vuelto usa descuento y envío sin alterar la venta',async()=>{
 const a=await web();try{
 a.click('[data-inc]');a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia 123');a.type('#f-floor','2');a.type('#f-apartment','B');a.type('#f-reference','Timbre 2B');
 await a.search();await wait(650);a.click('[data-sug="0"]');await wait(150);
 expect(a.d.getElementById('f-floor').value).toBe('2');a.type('#f-cash','10000');expect(a.d.getElementById('send').disabled).toBe(true);a.type('#f-cash','50000');expect(a.d.getElementById('cash-status').textContent).toContain('$12.010');
 a.click('#send');await wait(120);expect(a.orders).toHaveLength(1);expect(a.orders[0]).toMatchObject({addressFloor:'2',addressApartment:'B',deliveryReference:'Timbre 2B',cashTendered:50000,cashChange:12010,total:37990,discountAmount:4000,shipping:1990});
 }finally{a.close();}
});
it('cambiar a transferencia descarta efectivo y retiro no conserva piso ni departamento en la orden',async()=>{
 const a=await web({closed:true});try{a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-floor','8');a.type('#f-apartment','C');a.type('#f-cash','25000');a.click('[data-type="pickup"]');a.click('[data-payment-choice="transferencia"]');expect(a.d.getElementById('f-cash')).toBeNull();a.click('#send');await wait(100);expect(a.orders[0]).not.toHaveProperty('cashTendered');expect(a.orders[0]).not.toHaveProperty('addressFloor');}finally{a.close();}
});

it('editar cantidades recalcula el mínimo y el envío sin perder dirección ni crear órdenes',async()=>{
 const a=await web({price:10000});try{
  for(let i=0;i<4;i++)a.click('#grid [data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia 123');a.type('#f-floor','3');await a.search();await wait(650);a.click('[data-sug="0"]');await wait(100);
  expect(a.d.querySelector('#send').disabled).toBe(false);
  a.click('[data-checkout-step="cart"]');for(let i=0;i<3;i++)a.click('.cart-items [data-dec]');a.click('#cart-next');
  expect(a.d.querySelector('#f-floor').value).toBe('3');expect(a.d.querySelector('#f-addr').value).toContain(places[2].label.split(',')[0]);expect(a.d.querySelector('#send').disabled).toBe(true);expect(a.d.querySelector('[data-shipping-total]')).toBeNull();
  a.click('[data-checkout-step="cart"]');for(let i=0;i<3;i++)a.click('.cart-items [data-inc]');a.click('#cart-next');expect(a.d.querySelector('#send').disabled).toBe(false);expect(a.d.querySelector('[data-shipping-total]').textContent).toContain('$1.990');expect(a.orders).toHaveLength(0);
 }finally{a.close();}
});
