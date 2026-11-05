import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {createPromotionPolicyEditor} from '../src/ui/promotion-policy-editor.js';
it('shows editable provisional commission and compares real discount headroom by payment method',async()=>{
 const dom=new JSDOM('<main></main>'),w=dom.window,root=w.document.querySelector('main');
 try{
 const api={info:()=>({storeId:'fake'}),readPromotionPolicy:async()=>({policy:{minMarginPct:40,maxTotalPercent:30},products:[{id:'x',name:'Ficticio',price:10000}],costs:{x:4500}}),savePromotionPolicy:vi.fn()};
 w.SAHTEN={project:{session:{id:'fixture'}},online:{role:()=> 'owner',controller:api}};
 w.sahtenConfirm=vi.fn(async()=>false);
 let editor;const redraw=()=>{root.innerHTML=editor.render();editor.bind(root);};
 editor=createPromotionPolicyEditor(w,redraw);await editor.refresh();
 expect(root.querySelector('#policy-mp-fee').value).toBe('10');
 expect(root.querySelector('#policy-mp-provisional').checked).toBe(true);
 expect(root.textContent).toContain('Hasta 25% total estimado');
 expect(root.textContent).toContain('Hasta 16.66% total');
 root.querySelector('#policy-mp-fee').value='12';root.querySelector('[data-policy-save]').click();
 await vi.waitFor(()=>expect(w.sahtenConfirm).toHaveBeenCalledOnce());
 expect(w.sahtenConfirm.mock.calls[0][0]).toContain('12% (estimación provisional)');
 expect(api.savePromotionPolicy).not.toHaveBeenCalled();
 }finally{dom.window.close();}
});
