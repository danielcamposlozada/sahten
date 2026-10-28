import {beforeAll,it,expect,vi} from 'vitest';
import {buildTestBundle,openApp,loadRawDemo} from './app-harness.js';
import {sahtenDeliveryPolicy,SAHTEN_CENTER} from '../src/delivery/preset.js';
import {deliveryQuote,deliverySnapshot} from '../src/core/delivery.js';
import places from './fixtures/delivery/routes-verified-2026-10-24.json';
beforeAll(()=>buildTestBundle(),120000);
const wait=async()=>new Promise(r=>setTimeout(r,60));
function configure(w,{active=true}={}){
 const policy={...sahtenDeliveryPolicy(),hours:{...sahtenDeliveryPolicy().hours,enabled:false},active,promotionsEnabled:true};
 w._saveTiendaConfig({...w._getTiendaConfig(),address:SAHTEN_CENTER.address,deliveryV2:policy,paymentBenefit:{enabled:false,percent:10,channels:{online:true,mostrador:true}}});
 w.SAHTEN.delivery.client.provider=async()=>({configured:true});return policy;
}
function leaflet(w){const polygons=[];const layer=()=>({addTo(){return this;},bindPopup(){return this;},bindTooltip(){return this;},on(){return this;}});w.L={map:()=>({setView(){return this;},on(){return this;},remove(){},removeLayer(){}}),tileLayer:layer,marker:layer,polygon:(rings)=>{polygons.push(rings);return layer();},divIcon:()=>({}),DomEvent:{stopPropagation(){}}};w.SAHTEN.libs.leaflet=async()=>{};return polygons;}
it('administración dibuja seis anillos con huecos; convertir, cancelar, guardar y reabrir conserva precios, geometría y horarios',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);configure(w,{active:false});const polygons=leaflet(w);w.eval("_ajNavTab('tienda')");await wait();const d=w.document;
 expect(d.querySelectorAll('[data-zone]')).toHaveLength(6);expect(polygons.slice(0,6).map(r=>r.length)).toEqual([2,2,2,2,2,1]);
 d.querySelector('[data-zone="2"]').click();d.querySelector('[data-action="convert"]').click();expect(d.querySelector('[data-ring]')).not.toBeNull();
 d.querySelector('[data-action="cancel"]').click();expect(d.querySelector('[data-ring]')).toBeNull();
 d.querySelector('[data-zone="2"]').click();d.querySelector('[data-action="convert"]').click();d.querySelector('[data-action="save"]').click();await wait();
 expect(d.querySelector('[data-message]').textContent).toContain('guardada');const cfg=w._getTiendaConfig();expect(cfg.deliveryV2.zones[2].type).toBe('polygon');expect(cfg.deliveryV2.zones[2].baseCost).toBe(3990);expect(cfg.deliveryV2.zones[1].type).toBe('circle');
 const file=w.SAHTEN.project.collect();await w.SAHTEN.project.apply(file);expect(w._getTiendaConfig().deliveryV2.zones[2].points.length).toBe(128);w._renderTiendaOnline();await wait();
 expect(w._getTiendaConfig().deliveryV2.hours.weekly[5][0].end).toBe('23:00');d.querySelector('[data-hours-period="w5:0:end"]').value='22:30';d.querySelector('[data-hours-period="w5:0:end"]').dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('[data-action="save"]').click();await wait();expect(w._getTiendaConfig().deliveryV2.hours.weekly[5][0].end).toBe('22:30');
 d.body.dataset.role='cajero';w._renderTiendaOnline();expect(d.querySelector('[data-action="save"]').disabled).toBe(true);
 }finally{w.close();}
});
it('Mostrador actualiza progreso, descuentos y cambio de dirección; valida antes de guardar y conserva la tarifa histórica',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);const p=configure(w),place=places[2];w.SAHTEN.libs.leaflet=async()=>{};
 const product=w.SAHTEN.state.products[0];product.fixedPrices={mostrador:20000};w.showPanel('mostrador');w.mostradorAddToCart(product.id);w.eval("mostradorSetOrderType('delivery')");
 const dest={...place.destination,address:place.label,route:place.route};w.eval('mostradorDelivery='+JSON.stringify(dest));w._renderCartExtras();w._renderCartTotals();const d=w.document;
 expect(d.querySelector('#most-delivery-incentive [role="progressbar"]').getAttribute('aria-valuenow')).toBe('57');
 w.mostradorAddToCart(product.id);expect(d.querySelector('#most-delivery-incentive [role="progressbar"]').getAttribute('aria-valuenow')).toBe('80');
 const payment=w.eval('_mostPaymentOptions()[0]');w.mostradorSetPayment(payment.id);w._mostAddrInput('Dirección cambiada');expect(d.getElementById('most-delivery-incentive').textContent).not.toContain('desbloqueado');expect(w.mostradorDeliveryValue().route).toBeUndefined();
 w.eval('mostradorDelivery='+JSON.stringify(dest));w._renderCartExtras();w._renderCartTotals();
 w.SAHTEN.delivery.client.validate=vi.fn(async()=>{throw Error('Sin conexión: no se confirmó el delivery');});w.alert=vi.fn();await w.mostradorCheckout();expect(w.sahtenOrders()).toHaveLength(0);expect(w.eval('mostradorCart.length')).toBe(1);
 const q=deliveryQuote(p,place.destination,40000,{route:place.route});const snapshot=deliverySnapshot(q,place.route);
 w.SAHTEN.delivery.client.validate=vi.fn(async req=>({validationId:'validation-test',order:{deliverySnapshot:snapshot,items:[{productId:product.id,name:product.name,qty:2,unitPrice:20000,lineTotal:40000}]}}));
 await w.mostradorCheckout();expect(w.sahtenOrders()).toHaveLength(1);const order=w.sahtenOrders()[0];expect(order).toMatchObject({shipping:1990,total:41990,deliverySnapshot:{baseCost:3990,discount:2000,charged:1990},deliveryValidationId:'validation-test'});
 const changed=w._getTiendaConfig();changed.deliveryV2.zones[2].baseCost=9999;w._saveTiendaConfig(changed);expect(order.deliverySnapshot.baseCost).toBe(3990);w.openOrderDetail(order.id);expect(d.getElementById('order-detail-overlay').textContent).toContain('2.000');
 }finally{w.close();}
});
it('Mostrador muestra cierre de delivery sin dirección; retiro no muestra promociones y no consulta servidor',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);configure(w);const cfg=w._getTiendaConfig();cfg.deliveryV2.hours={...sahtenDeliveryPolicy().hours,weekly:Array.from({length:7},()=>[])};w._saveTiendaConfig(cfg);w.showPanel('mostrador');const product=w.SAHTEN.state.products[0];w.mostradorAddToCart(product.id);w.eval("mostradorSetOrderType('delivery')");
 expect(w.document.getElementById('most-delivery-incentive').textContent).toContain('Delivery fuera de horario');expect(w.document.getElementById('most-delivery-incentive').compareDocumentPosition(w.document.getElementById('most-addr-input')) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();w.eval("mostradorSetOrderType('retiro')");expect(w.document.getElementById('most-delivery-incentive')).toBeNull();w.SAHTEN.delivery.client.validate=vi.fn();await w.mostradorCheckout();expect(w.SAHTEN.delivery.client.validate).not.toHaveBeenCalled();expect(w.sahtenOrders()).toHaveLength(1);
 }finally{w.close();}
});
it('Mostrador busca al escribir calle/altura sin botón y descarta la respuesta anterior',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);configure(w);w.showPanel('mostrador');w.mostradorAddToCart(w.SAHTEN.state.products[0].id);w.eval("mostradorSetOrderType('delivery')");
 const client=w.SAHTEN.delivery.client;let release;client.suggest=vi.fn(async q=>{if(q==='Roca 100')await new Promise(r=>release=r);return [{display_name:q+', Localidad ficticia',lat:'-34.527',lon:'-58.482',provider:'georef'}];});client.geocode=vi.fn();
 const type=v=>{const input=w.document.getElementById('most-addr-input');input.focus();input.value=v;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 expect(w.document.getElementById('most-addr-retry').hidden).toBe(true);type('Roca');await new Promise(r=>setTimeout(r,400));expect(client.suggest).not.toHaveBeenCalled();type('Roca 10');type('Roca 100');await vi.waitFor(()=>expect(client.suggest).toHaveBeenCalledTimes(1));type('Roca 200');await vi.waitFor(()=>expect(w.document.getElementById('most-addr-sugs').textContent).toContain('Roca 200'));
 release();await wait();expect(w.document.getElementById('most-addr-sugs').textContent).not.toContain('Roca 100');expect(w.document.getElementById('most-addr-input').value).toBe('Roca 200');expect(w.document.activeElement.id).toBe('most-addr-input');expect(w.document.getElementById('most-addr-retry').hidden).toBe(true);expect(client.geocode).not.toHaveBeenCalled();expect(w.mostradorDeliveryValue().lat).toBeNull();expect(w.sahtenOrders()).toHaveLength(0);
 client.suggest=vi.fn(async()=>[]);type('Sin resultado 123');await vi.waitFor(()=>expect(w.document.getElementById('most-addr-retry').hidden).toBe(false));type('Otra calle 123');expect(w.document.getElementById('most-addr-retry').hidden).toBe(true);
 }finally{w.close();}
});
it('tarjetas de Pedidos ofrecen mapa, copiar y compartir al aceptar un delivery, sin desplegar detalles ni cambiar su estado',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);const base={source:'delivery',createdAt:new Date().toISOString(),items:[],total:20000,lat:-34.4970518,lng:-58.4899007,address:'Destino ficticio',customerName:'Nombre privado',customerPhone:'1100000000'};
 w.eval('SAHTEN_ORDERS='+JSON.stringify([{...base,id:'pending',num:1,status:'pendiente'},{...base,id:'ready',num:2,status:'listo'},{...base,id:'pickup',num:3,source:'pickup',status:'listo'}]));w.showPanel('mostrador');w.mostSetTab('online');const d=w.document;
 expect(d.querySelector('[data-online-action="route-copy"][data-id="pending"]')).toBeNull();expect(d.querySelector('[data-online-action="route-copy"][data-id="pickup"]')).toBeNull();const copy=d.querySelector('[data-online-action="route-copy"][data-id="ready"]');expect(copy).not.toBeNull();expect(copy.closest('details')).toBeNull();const link=copy.parentElement.querySelector('a');expect(new URL(link.href).searchParams.get('destination')).toBe('-34.4970518,-58.4899007');
 const writeText=vi.fn(async()=>{}),share=vi.fn(async()=>{});Object.defineProperty(w.navigator,'clipboard',{value:{writeText},configurable:true});Object.defineProperty(w.navigator,'share',{value:share,configurable:true});copy.click();await wait();expect(writeText).toHaveBeenCalledWith(link.href);d.querySelector('[data-online-action="route-share"][data-id="ready"]').click();await wait();expect(share).toHaveBeenCalled();expect(JSON.stringify(share.mock.calls)).not.toContain('Nombre privado');expect(w.sahtenOrders().find(o=>o.id==='ready').status).toBe('listo');
 w.orderSetStatus('pending','en_preparacion');expect(d.querySelector('[data-online-action="route-copy"][data-id="pending"]')).not.toBeNull();
 }finally{w.close();}
});

it('controles de zona son inmediatos, no guardan tarifas pendientes y cancelar no los revierte',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);configure(w);leaflet(w);w.eval("_ajNavTab('delivery')");await wait();const d=w.document,initial=w._getTiendaConfig(),events=[];
 w.addEventListener('sahten:delivery-zone-state',e=>events.push(e.detail));
 const cost=d.querySelector('[data-df="baseCost"]');cost.value='99999';cost.dispatchEvent(new w.Event('change',{bubbles:true}));
 const flag=d.querySelector('[data-zoneflag="requiresAuthorization"]');flag.checked=true;flag.dispatchEvent(new w.Event('change',{bubbles:true}));
 let cfg=w._getTiendaConfig();expect(cfg.deliveryV2.zones[0].requiresAuthorization).toBe(true);expect(cfg.deliveryV2.zones[0].baseCost).toBe(initial.deliveryV2.zones[0].baseCost);expect(cfg.deliveryV2.revision).toBe(initial.deliveryV2.revision);expect(events).toEqual([{id:initial.deliveryV2.zones[0].id,flag:'requiresAuthorization',value:true}]);
 expect(d.querySelector('[data-zone-live-status]').textContent).toContain('Solo en este proyecto');d.querySelector('[data-action="cancel"]').click();expect(d.querySelector('[data-zoneflag="requiresAuthorization"]').checked).toBe(true);expect(d.querySelector('[data-df="baseCost"]').value).not.toBe('99999');
 d.body.dataset.role='cajero';expect(w.SAHTEN.delivery.zoneOperation.set(cfg.deliveryV2.zones[0].id,'enabled',false)).toBe(false);expect(w._getTiendaConfig().deliveryV2.zones[0].enabled).toBe(true);
 }finally{w.close();}
});
