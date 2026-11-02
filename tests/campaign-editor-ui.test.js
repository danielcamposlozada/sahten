import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
function make(){
 const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://sahten.local/'});
 const w=dom.window;w.SAHTEN={project:{session:{readOnly:false,info:()=>({hasFile:true}),id:'local'}},online:{role:()=> 'owner',
   conn:()=>({projectId:'cloud',storeId:'sahten',url:'https://supabase.test'}),
   controller:{info:()=>({signedIn:true}),readPromotionCampaignStates:vi.fn(async()=>({published:false,campaigns:[]})),
     setPromotionCampaignState:vi.fn()}}};
 w.sahtenConfirm=vi.fn(async()=>true);
 w.PRODUCTS=[{id:'p1',name:'Hummus',precioMostrador:10000},{id:'p2',name:'Fatay',precioMostrador:6000}];
 const editor=installPromotionsEditor(w);editor.render();
 return {w,dom,editor};
}
describe('UX creación y activación de campañas',()=>{
 it('crea lunes y miércoles con un click, en borrador y con días seleccionables',()=>{
  const {w,dom,editor}=make();try{
   w.document.querySelector('[data-tab="campaigns"]').click();
   const preset=w.document.querySelector('[data-promo-preset]');
   preset.value='mon-wed';w.document.querySelector('[data-promo-new]').click();
   const campaign=editor.get().campaigns.at(-1);
   expect(campaign.schedule).toMatchObject({type:'weekly',weekdays:[1,3]});
   expect(campaign.enabled).toBe(false);
   expect(w.document.querySelector('[data-promo-weekday="1"]').checked).toBe(true);
   expect(w.document.querySelector('[data-promo-weekday="3"]').checked).toBe(true);
   expect(w.document.querySelector('[data-promo-weekday="2"]').checked).toBe(false);
   w.document.querySelector('[data-promo-weekday="2"]').click();
   expect(editor.get().campaigns.at(-1).schedule.weekdays).toEqual([1,2,3]);
  }finally{dom.window.close();}
 });
 it('muestra switch visible pero inhabilitado si todavía no se publicó el motor',async()=>{
  const {w,dom}=make();try{
   await vi.waitFor(()=>expect(w.document.querySelector('[data-live-refresh]')).not.toBeNull());
   w.document.querySelector('[data-tab="campaigns"]').click();
   await vi.waitFor(()=>expect(w.document.querySelector('#promotions-editor').textContent).toContain('No publicada en el servidor'));
   expect(w.document.querySelector('[data-live-toggle]')).toBeNull();
  }finally{dom.window.close();}
 });
 it('la preparación local no ejecuta el RPC de publicación en vivo',()=>{
  const {w,dom}=make();try{
   w.document.querySelector('[data-tab="campaigns"]').click();
   w.document.querySelector('[data-promo-new]').click();
   w.document.querySelector('[data-field="enabled"]').click();
   expect(w.SAHTEN.online.controller.setPromotionCampaignState).not.toHaveBeenCalled();
  }finally{dom.window.close();}
 });
});
