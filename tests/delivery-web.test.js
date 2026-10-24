import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';
import {createDeliveryService} from '../src/delivery/service.js';
import places from './fixtures/delivery/routes-verified-2026-10-24.json';
const sid='00000000-0000-4000-8000-000000000001',qid='00000000-0000-4000-8000-000000000002';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function web({closed=false,geocodeDelay=0}={}){
 let serverNow=Date.parse(closed?'2026-10-25T21:00:00Z':'2026-10-23T23:00:00Z');
 const menu={version:1,store:{name:'Local de prueba',address:'Dirección de prueba',currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true,showImages:false,categories:['Platos']},products:[{id:'p',name:'Plato de prueba',price:20000,category:'Platos'}],site:null,delivery:{deliveryV2:{...sahtenDeliveryPolicy(),active:true,promotionsEnabled:true}},payments:{methods:{efectivo:true,transferencia:true,mercadopago:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},supabase:{url:'https://server.test',storeId:sid,anonKey:'public-test-only-key',slug:'test'}};
 const calls=[],orders=[],quotes=new Map(),place=places[2];
 const service=createDeliveryService({now:()=>serverNow,repo:{menu:async()=>menu,run:async(a,b)=>{if(a==='limit')return true;if(a==='save_quote'){const q={id:qid,...b};quotes.set(qid,q);return q;}if(a==='quote')return quotes.get(b.id);if(a==='order'){orders.push(b.payload);return {id:'order-test',order:b.payload};}return null;}},authenticate:async()=>null,resolveRoute:async(s,o,d)=>({...place.route,origin:o,destination:d}),geocode:async()=>{if(geocodeDelay)await wait(geocodeDelay);return [{display_name:place.label,lat:String(place.destination.lat),lon:String(place.destination.lng)}];}});
 const dom=new JSDOM(buildIndexHtml(menu),{url:'https://store.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.Date=class extends Date{constructor(...a){super(...(a.length?a:[serverNow]));}static now(){return serverNow;}};
  w.scrollTo=()=>{};w.fetch=async(u,opts={})=>{const url=String(u);calls.push({url,...opts});if(url==='menu.json')return Response.json(menu);if(url.includes('/sahten-payments/config'))return Response.json({enabled:true,mode:'test'});if(url.includes('/sahten-delivery/'))return service(new Request(url,opts));if(url.includes('/rest/v1/stores'))return Response.json([]);throw Error('Sin red externa: '+url);};
 }});
 await wait(100);const w=dom.window,d=w.document,click=sel=>{const el=d.querySelector(sel);expect(el,sel).not.toBeNull();el.click();},type=(sel,value)=>{const el=d.querySelector(sel);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,d,click,type,calls,orders,close:()=>w.close(),setTime:t=>serverNow=Date.parse(t)};
}
it('web usa ruta del servidor, progreso neto y pagos; cambiar dirección quita la tarifa anterior sin perder foco',async()=>{
 const a=await web();try{a.click('[data-inc]');a.click('[data-inc]');a.click('#bar button');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia');await wait(600);
 expect(a.calls.filter(c=>c.url.includes('/geocode'))).toHaveLength(0);a.click('[data-delivery-search]');await wait(650);a.click('[data-sug="0"]');await wait(100);
 expect(a.d.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('72');expect(a.d.querySelector('#delivery-card').textContent).toContain('$1.990');expect(a.d.querySelector('#send').disabled).toBe(false);
 a.click('[data-payment-choice="mercadopago"]');expect(a.d.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('80');
 a.click('[data-payment-choice="efectivo"]');a.d.getElementById('f-addr').focus();a.type('#f-addr','Otra dirección');expect(a.d.activeElement.id).toBe('f-addr');expect(a.d.getElementById('delivery-card').textContent).not.toContain('$1.990');expect(a.d.getElementById('send').disabled).toBe(true);expect(a.d.querySelectorAll('[data-shipping-total]')).toHaveLength(0);expect(a.d.querySelectorAll('[data-order-total]')[0].textContent).toBe('$36.000');
 a.click('[data-type="pickup"]');expect(a.d.querySelector('[role="progressbar"]')).toBeNull();expect(a.d.querySelector('#send').disabled).toBe(false);
 }finally{a.close();}
});
it('cierre visible desde el carrito; no confirma delivery fuera de hora y permite retiro',async()=>{
 const a=await web({closed:true});try{a.click('[data-inc]');a.click('#bar button');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');expect(a.d.getElementById('delivery-card').textContent).toContain('Delivery fuera de horario');expect(a.d.getElementById('send').disabled).toBe(true);a.click('[data-type="pickup"]');expect(a.d.getElementById('send').disabled).toBe(false);a.click('#send');await wait(100);expect(a.orders).toHaveLength(1);expect(a.orders[0].shipping).toBe(0);
 }finally{a.close();}
});
it('un carrito abierto antes del cierre es rechazado al confirmar después; la hora enviada no es autoridad',async()=>{
 const a=await web();try{a.click('[data-inc]');a.click('[data-inc]');a.click('#bar button');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-addr','Dirección ficticia');a.click('[data-delivery-search]');await wait(650);a.click('[data-sug="0"]');await wait(100);expect(a.d.getElementById('send').disabled).toBe(false);a.setTime('2026-10-24T02:00:00Z');a.click('#send');await wait(80);expect(a.orders).toHaveLength(0);expect(a.d.getElementById('send').disabled).toBe(true);expect(a.d.getElementById('delivery-card').textContent).toContain('Delivery fuera de horario');
 }finally{a.close();}
});

it('una búsqueda anterior no repone una dirección que el cliente ya cambió',async()=>{
 const a=await web({geocodeDelay:200});try{a.click('[data-inc]');a.click('#bar button');a.type('#f-addr','Primera dirección');a.click('[data-delivery-search]');await wait(40);a.type('#f-addr','Segunda dirección');await wait(350);expect(a.d.querySelector('[data-sug]')).toBeNull();expect(a.d.getElementById('f-addr').value).toBe('Segunda dirección');expect(a.d.getElementById('send').disabled).toBe(true);
 }finally{a.close();}
});
