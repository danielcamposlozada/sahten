import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {initialPromotionConfig} from '../src/core/promotions.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
const copy=v=>JSON.parse(JSON.stringify(v));
function setup({role='owner',readOnly=false}={}){
 const config={...initialPromotionConfig(),
  upsells:[{id:'baklava-up',name:'Baklava · Complemento dulce',kind:'upsell',
    enabled:true,extraPercent:5,productIds:['baklava'],triggerProductIds:['fatay']}],
  productUpgrades:[{id:'fatay-four',name:'Cuarta Fatay',kind:'replace_product',enabled:true,
    extraPercent:5,triggerProductId:'fatay',replacementProductId:'fatay4'}],
  couponPrograms:{first_online:{name:'Cupón primera compra',enabled:true,extraPercent:5,
    minEligibleSubtotal:10000,validDays:14,channel:'online',eligibleProductIds:['baklava']}}};
 kv.set('sahten_promotions',JSON.stringify(config));
 const dom=new JSDOM('<!doctype html><html><body><div id="promotions-editor"></div></body></html>',{url:'https://sahten.local'});
 const w=dom.window;const controller={
  info:()=>({signedIn:true}),
  readPromotionCampaignStates:vi.fn(async()=>({published:true,campaigns:[]})),
  readCartRecommendations:vi.fn(async()=>null),
  verifyPromotionDraft:vi.fn(async (type,draft)=>({
   type,id:draft.id,source:'server',checkedAt:'2026-11-02T15:00:00Z',
   canPublish:false,canActivate:false,totalPercent:15,minMarginPercent:40,
   products:[{id:'baklava',name:'Baklava',published:true,price:7350,
    baseCost:3536.19,estimatedMarginPct:43.4,headroomAt40Pct:212.31}],
   checks:[{id:'products',label:'Producto confirmado',ok:true},
     {id:'additional',label:'Gastos adicionales pendientes',ok:false},
     {id:'checkout',label:'Checkout sin aprobar',ok:false}]
  })),
  publishPromotionCampaignDraft:vi.fn(),setPromotionCampaignState:vi.fn()
 };
 w.SAHTEN={project:{session:{readOnly,id:'local'}},online:{
  role:()=>role,conn:()=>({storeId:'store-1',url:'https://supabase.test'}),controller}};
 w.PRODUCTS=[{id:'baklava',name:'Baklava',precioMostrador:7350},
  {id:'fatay',name:'Fatay',precioMostrador:5850},
  {id:'fatay4',name:'Cuatro Fatay',precioMostrador:18500}];
 w.sahtenConfirm=vi.fn(async()=>true);w.sahtenAlert=vi.fn();
 const editor=installPromotionsEditor(w);editor.render();
 return {w,dom,editor,controller};
}
describe('Verificación de complementos, mejoras y cupones dentro de la app',()=>{
 it('verifica una propuesta desde la vista general y muestra evidencia del servidor sin publicar',async()=>{
  const {w,dom,controller}=setup();
  try{
   const selector='[data-verify-type="upsells"][data-verify-draft="baklava-up"]';
   expect(w.document.querySelector(selector)).not.toBeNull();
   w.document.querySelector(selector).click();
   await vi.waitFor(()=>expect(controller.verifyPromotionDraft).toHaveBeenCalledWith('upsells',expect.objectContaining({id:'baklava-up'})));
   await vi.waitFor(()=>expect(w.document.querySelector('#promotions-editor').textContent).toContain('43.4%'));
   expect(w.document.querySelector('#promotions-editor').textContent).toContain('Gastos adicionales pendientes');
   expect(controller.publishPromotionCampaignDraft).not.toHaveBeenCalled();
   expect(w.document.querySelector('[title*="checkout"]')?.disabled).toBe(true);
  }finally{dom.window.close();}
 });
 it('Verificar todos revisa las tres categorías con RPC owner/admin y no toca pedidos',async()=>{
  const {w,dom,controller}=setup();
  try{
   w.document.querySelector('[data-verify-all]').click();
   await vi.waitFor(()=>expect(controller.verifyPromotionDraft).toHaveBeenCalledTimes(3));
   await vi.waitFor(()=>expect(w.document.querySelector('#promotions-editor').textContent).toContain('3 de 3 propuestas'));
   expect(controller.verifyPromotionDraft.mock.calls.map(x=>x[0]).sort()).toEqual(['couponPrograms','productUpgrades','upsells']);
   expect(controller.publishPromotionCampaignDraft).not.toHaveBeenCalled();
  }finally{dom.window.close();}
 });
 it('verifica más de 40 propuestas sin omisiones ni más de cuatro consultas simultáneas',async()=>{
  const {w,dom,editor,controller}=setup();
  try{
   const state=editor.get();
   state.upsells=Array.from({length:45},(_,i)=>({...state.upsells[0],id:'test-up-'+i}));
   state.productUpgrades=[];state.couponPrograms={};
   editor.save(state);editor.render();
   const original=controller.verifyPromotionDraft.getMockImplementation();
   let active=0,maxActive=0;
   controller.verifyPromotionDraft.mockImplementation(async(...args)=>{
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,0));
    active--;return original(...args);
   });
   w.document.querySelector('[data-verify-all]').click();
   await vi.waitFor(()=>expect(w.document.body.textContent).toContain('45 de 45 propuestas'),{timeout:3000});
   expect(controller.verifyPromotionDraft).toHaveBeenCalledTimes(45);
   expect(maxActive).toBeLessThanOrEqual(4);
  }finally{dom.window.close();}
 });
 it('una respuesta antigua no reemplaza la verificación iniciada después',async()=>{
  const {w,dom,controller}=setup();
  try{
   const original=controller.verifyPromotionDraft.getMockImplementation();
   let resolveOld;
   controller.verifyPromotionDraft.mockImplementationOnce((...args)=>new Promise(resolve=>{
    resolveOld=async()=>resolve({...await original(...args),products:[{name:'Evidencia obsoleta'}]});
   }));
   w.document.querySelector('[data-verify-draft="baklava-up"]').click();
   await vi.waitFor(()=>expect(resolveOld).toBeTypeOf('function'));
   w.document.querySelector('[data-verify-all]').click();
   await vi.waitFor(()=>expect(w.document.body.textContent).toContain('3 de 3 propuestas'));
   await resolveOld();
   await new Promise(resolve=>setTimeout(resolve,0));
   expect(w.document.body.textContent).not.toContain('Evidencia obsoleta');
   expect(w.document.body.textContent).toContain('43.4%');
  }finally{dom.window.close();}
 });
 it('un borrador editado pierde su verificación anterior, para evitar datos obsoletos',async()=>{
  const {w,dom,editor}=setup();
  try{
   w.document.querySelector('[data-verify-draft="baklava-up"]').click();
   await vi.waitFor(()=>expect(w.document.querySelector('#promotions-editor').textContent).toContain('43.4%'));
   const row=w.document.querySelector('[data-draft-toggle="upsells"][data-draft-id="baklava-up"]');
   row.click();
   expect(editor.get().upsells[0].enabled).toBe(false);
   expect(w.document.querySelector('#promotions-editor').textContent).not.toContain('43.4%');
  }finally{dom.window.close();}
 });
 it('no permite consultar costos privados al rol no autorizado o en solo lectura',async()=>{
  const {w,dom,controller}=setup({role:'viewer',readOnly:true});
  try{
   expect(w.document.querySelector('[data-verify-all]').disabled).toBe(true);
   expect(w.document.querySelector('[data-verify-draft="baklava-up"]').disabled).toBe(true);
   expect(controller.verifyPromotionDraft).not.toHaveBeenCalled();
  }finally{dom.window.close();}
 });
 it('no sobrescribe un borrador al volver a la ventana ni renueva su base remota mientras se escribe',async()=>{
  const {w,dom,controller}=setup();
  try{
   await vi.waitFor(()=>expect(controller.readPromotionCampaignStates).toHaveBeenCalledOnce());
   await new Promise(resolve=>setTimeout(resolve,0));
   w.document.querySelector('[data-open-promo="baklava-up"]').click();
   const input=w.document.querySelector('#draft-name');
   input.value='Nombre todavía sin guardar';
   input.dispatchEvent(new w.Event('input',{bubbles:true}));
   w.currentPanel='promociones';
   w.dispatchEvent(new w.Event('focus'));
   await new Promise(resolve=>setTimeout(resolve,0));
   expect(controller.readPromotionCampaignStates).toHaveBeenCalledOnce();
   expect(w.document.querySelector('#draft-name')).toBe(input);
   expect(input.value).toBe('Nombre todavía sin guardar');
  }finally{dom.window.close();}
 });
 it('editor de cupón permite elegir SKU de costo verificable',()=>{
  const {w,dom,editor}=setup();
  try{
   w.document.querySelector('[data-tab="coupons"]').click();
   w.document.querySelector('[data-coupon-edit="first_online"]').click();
   expect(w.document.querySelector('[data-coupon-product="baklava"]').checked).toBe(true);
   w.document.querySelector('[data-coupon-product="fatay"]').click();
   w.document.querySelector('[data-coupon-save]').click();
   expect(editor.get().couponPrograms.first_online.eligibleProductIds).toEqual(['baklava','fatay']);
   expect(editor.get().couponPrograms.first_online.enabled).toBe(false);
  }finally{dom.window.close();}
 });
});
