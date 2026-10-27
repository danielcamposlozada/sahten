import {beforeAll,it,expect,vi} from 'vitest';
import {buildTestBundle,openApp,loadRawDemo} from './app-harness.js';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';
import {createOnlineUi} from '../src/online/ui.js';
import {PROJECT_ACTION,CATALOG_ACTION} from '../src/online/cloud-help.js';
beforeAll(()=>buildTestBundle(),120000);
const wait=()=>new Promise(r=>setTimeout(r,20));
const action=(w,label)=>{const b=[...w.document.querySelectorAll('.sd-actions button')].find(b=>b.textContent===label);expect(b,label).toBeTruthy();b.click();};
it('una receta interna no se ofrece en Mostrador ni Tienda; habilitarla crea un producto pausado y aún sin publicar',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);const p=w.SAHTEN.state.products[0];p.recetaOnly=true;w.showPanel('mostrador');expect(w.document.querySelector(`[data-id="${p.id}"]`)).toBeNull();w.showPanel('menuonline');expect(w.document.querySelector(`[data-mo-prod="${p.id}"]`)).toBeNull();
 const job=w.SAHTEN.salesAvailability.toggleEligibility(p.id);await wait();action(w,'Habilitar producto');await job;
 expect(p.recetaOnly).toBe(false);expect(p.salesAvailability.paused).toBe(true);expect(w.MENU_CONFIG.hiddenProducts).toContain(p.id);
 w.showPanel('mostrador');const card=w.document.querySelector(`[data-id="${p.id}"]`);expect(card.classList.contains('sales-paused')).toBe(true);expect(card.querySelector('button').disabled).toBe(true);w.mostradorAddToCart(p.id);expect(w.eval('mostradorCart.length')).toBe(0);
 w.showPanel('menuonline');expect(w.document.querySelector(`[data-mo-prod="${p.id}"]`).checked).toBe(false);
 expect(w.SAHTEN.project.collect().catalog.productos.find(x=>x.id===p.id).salesAvailability.paused).toBe(true);
 }finally{w.close();}
});
it('pausar ofrece tres opciones, cancelar no cambia nada y un producto que ya estaba en el carrito no puede confirmarse',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);const p=w.SAHTEN.state.products.find(p=>!p.recetaOnly);w.showPanel('mostrador');w.mostradorAddToCart(p.id);const price=w.mostradorFinalPrice(p);
 let job=w.SAHTEN.salesAvailability.open(p.id);await wait();expect(w.document.querySelectorAll('[name=pause-until]').length).toBe(3);action(w,'Volver');await job;expect(p.salesAvailability).toBeUndefined();
 job=w.SAHTEN.salesAvailability.open(p.id);await wait();action(w,'Pausar ventas');await job;expect(p.salesAvailability).toMatchObject({paused:true,resumeAt:null});expect(w.mostradorFinalPrice(p)).toBe(price);
 await w.mostradorCheckout();await wait();expect(w.sahtenOrders()).toHaveLength(0);expect(w.document.querySelector('.sd-box').textContent).toContain('no disponibles');action(w,'Entendido');
 job=w.SAHTEN.salesAvailability.open(p.id);await wait();action(w,'Reactivar');await job;expect(p.salesAvailability.paused).toBe(false);
 }finally{w.close();}
});
it('fecha inválida no confirma y por hoy muestra la fecha exacta antes de guardar',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);const p=w.SAHTEN.state.products.find(p=>!p.recetaOnly);let job=w.SAHTEN.salesAvailability.open(p.id);await wait();const radio=w.document.querySelector('[value=date]');radio.checked=true;radio.dispatchEvent(new w.Event('change',{bubbles:true}));action(w,'Pausar ventas');await wait();expect(w.document.querySelector('.sd-error').textContent).toContain('futuras');expect(p.salesAvailability).toBeUndefined();const today=w.document.querySelector('[value=today]');today.checked=true;today.dispatchEvent(new w.Event('change',{bubbles:true}));expect(w.document.querySelector('#sales-pause-description').textContent).toContain('comienzo del próximo día');action(w,'Pausar ventas');await job;expect(Date.parse(p.salesAvailability.resumeAt)).toBeGreaterThan(Date.now());
 }finally{w.close();}
});
it('nombres distintos y ayuda accesible explican qué reemplaza cada acción',async()=>{
 const dom=new JSDOM('<div id="panel-nube"></div>');const w=dom.window;
 const online={enabled:true,controller:{info:()=>({configured:true,signedIn:true,mode:'conectado'})},conn:()=>({url:'https://test.invalid',slug:'test'}),syncInfo:()=>({linked:true,state:'al día'}),role:()=> 'cajero',photoPublisher:{info:()=>({state:'sin cambios'})}};
 const ui=createOnlineUi({online,w});await ui.render();expect(w.document.body.textContent).toContain(PROJECT_ACTION);expect(w.document.body.textContent).toContain(CATALOG_ACTION);const details=[...w.document.querySelectorAll('.cloud-action-help')];expect(details).toHaveLength(2);details[0].querySelector('summary').click();expect(details[0].open).toBe(true);expect(details[0].textContent).toContain('Reemplaza el catálogo');expect(details[1].textContent).toContain('No publica el catálogo');w.close();
});
async function web(){
 const m={version:1,config:{enabled:true,showPrices:true,categories:['Platos']},store:{name:'Prueba',currency:{symbol:'$',locale:'es-AR'}},products:[{id:'p',name:'Plato',price:12000,category:'Platos'}],payments:{methods:{efectivo:true}},delivery:{},site:null,supabase:{url:'https://server.test',storeId:'test-store',anonKey:'public-test'}};let live=structuredClone(m);const posts=[];
 const dom=new JSDOM(buildIndexHtml(m),{url:'https://store.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.fetch=async(url,o={})=>{if(o.method==='POST')posts.push(url);if(url==='menu.json')return Response.json(m);if(String(url).includes('/rest/v1/stores'))return Response.json([{id:'test-store',menus:{json:m}}]);if(String(url).includes('/rest/v1/menus'))return Response.json([{json:live}]);if(String(url).includes('/config'))return Response.json({enabled:false});return Response.json({});};}});await vi.waitFor(()=>expect(dom.window.document.querySelector('[data-inc]')).toBeTruthy());return {w:dom.window,d:dom.window.document,posts,live:v=>live=v,m};
}
it('la tienda actualiza la pausa sin recargar; conserva el precio del carrito, permite quitar y bloquea el envío',async()=>{
 const a=await web();try{a.d.querySelector('[data-inc]').click();a.w.openCart();a.d.querySelector('#cart-next').click();a.d.querySelector('[data-type=pickup]').click();a.live({...a.m,products:[{...a.m.products[0],price:99000,salesAvailability:{paused:true,resumeAt:null}}]});a.w.dispatchEvent(new a.w.Event('focus'));await vi.waitFor(()=>expect(a.d.querySelector('.sales-paused')).toBeTruthy());expect(a.w.__menu().products[0].price).toBe(12000);expect(a.d.querySelector('#send').disabled).toBe(true);expect(a.d.querySelector('#send-status').textContent).toContain('no disponibles');a.d.querySelector('[data-checkout-step=cart]').click();expect(a.d.querySelector('#cart-inc-p').disabled).toBe(true);a.d.querySelector('[data-remove=p]').click();expect(a.d.querySelector('#sheet').textContent).toContain('vacío');expect(a.posts).toHaveLength(0);
 }finally{a.w.close();}
});
