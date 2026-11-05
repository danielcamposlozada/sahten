import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {createLoyaltyProgramEditor} from '../src/ui/loyalty-program-editor.js';
function fixture(){
 const dom=new JSDOM('<div id="root"></div>'),w=dom.window,root=w.document.getElementById('root');
 const config={paymentPercent:10,couponPrograms:{first_online:{name:'Bienvenida ficticia',extraPercent:10,minEligibleSubtotal:1000,validDays:14,eligibleProductIds:['a']}}};
 const api={readLoyaltyPrograms:vi.fn(async()=>[]),readPromotionPolicy:vi.fn(async()=>({paymentPercent:10,policy:{minMarginPct:40,maxTotalPercent:25},products:[{id:'a',name:'Producto A',price:10000},{id:'b',name:'Producto B',price:5000}],costs:{a:4000}})),saveLoyaltyProgram:vi.fn(async()=>{throw Error('campaign_margin_below_minimum:a');}),info:()=>({storeId:'store'})};
 w.PRODUCTS=[{id:'a',name:'Producto A'},{id:'b',name:'Producto B'}];w.SAHTEN={project:{session:{id:'one',readOnly:false}},online:{role:()=> 'owner',controller:api}};w.sahtenConfirm=vi.fn(async()=>true);
 let editor;const render=()=>{root.innerHTML=editor.render();editor.bind(root);};editor=createLoyaltyProgramEditor(w,()=>config,render);render();return {w,dom,root,editor,api};
}
it('suggests only products with known economics and preserves entered terms after a server rejection',async()=>{
 const {w,dom,root,editor,api}=fixture();try{
  await editor.refresh();const form=root.querySelector('[data-loyalty-program="first_online"]');
  form.querySelector('[data-loyalty-field="totalPercent"]').value='25';form.querySelector('[data-loyalty-safe]').click();
  await vi.waitFor(()=>expect(root.querySelector('[data-loyalty-status]').textContent).toContain('1 productos seleccionados'));
  expect(form.querySelector('[data-loyalty-product="a"]').checked).toBe(true);expect(form.querySelector('[data-loyalty-product="b"]').checked).toBe(false);
  form.querySelector('button[type="submit"]:not([data-loyalty-draft])').click();await vi.waitFor(()=>expect(api.saveLoyaltyProgram).toHaveBeenCalledOnce());
  await vi.waitFor(()=>expect(root.querySelector('[data-loyalty-status]').textContent).toContain('Producto A'));
  expect(root.querySelector('[data-loyalty-field="totalPercent"]').value).toBe('25');
 }finally{dom.window.close();}
});
it('never writes the previous store terms after switching project during confirmation',async()=>{
 const {w,dom,root,editor,api}=fixture();try{await editor.refresh();w.sahtenConfirm=async()=>{w.SAHTEN.project.session.id='two';return true;};
  root.querySelector('[data-loyalty-program="first_online"] button[type="submit"]:not([data-loyalty-draft])').click();
  await vi.waitFor(()=>expect(root.querySelector('[data-loyalty-status]').textContent).toContain('Cambió el proyecto'));
  expect(api.saveLoyaltyProgram).not.toHaveBeenCalled();
 }finally{dom.window.close();}
});
