import {describe,it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {createReviewedUpsellEditor} from '../src/ui/reviewed-upsells.js';
function setup(role='owner'){
 const dom=new JSDOM('<div id="root"></div>'),w=dom.window;
 const definition={id:'baklava-up',name:'Baklava adicional',kind:'upsell',maxUnits:1,extraPercent:10,productIds:['baklava'],triggerProductIds:['plato']};
 let rows=[];
 const api={info:()=>({signedIn:true}),readUpsellManagement:vi.fn(async()=>({source:'reviewed_upsells',offers:structuredClone(rows)})),
  readUpsellReviewContext:vi.fn(async()=>({definition,sourceFingerprint:'source-1',products:[{id:'baklava',name:'Baklava',price:7000},{id:'plato',name:'Plato',price:30000}],costs:{baklava:{directCost:800,fixedCost:500},plato:{directCost:5000,fixedCost:3000}},paymentPercent:10})),
  publishReviewedUpsell:vi.fn(async()=>{rows=[{id:'baklava-up',definition,enabled:false,revision:'rev-1',requiresReview:false}];return {id:'baklava-up',published:true,enabled:false,revision:'rev-1'};}),
  setUpsellState:vi.fn(async(id,enabled)=>{rows[0]={...rows[0],enabled,revision:'rev-2'};return{id,enabled,revision:'rev-2'};})};
 w.SAHTEN={project:{session:{}},online:{role:()=>role,controller:api}};w.sahtenConfirm=vi.fn(async()=>true);
 const root=w.document.querySelector('#root');let editor;
 const draw=()=>{root.innerHTML=editor.render();editor.bind(root);};
 editor=createReviewedUpsellEditor(w,()=>[definition],draw);draw();
 return{w,root,dom,editor,api};
}
describe('Alta guiada de complementos desde la app',()=>{
 it('exige costos explícitos, muestra los valores antes de publicar y activa por revisión',async()=>{
  const x=setup();try{
   x.root.querySelector('[data-upsell-review]').click();
   await vi.waitFor(()=>expect(x.root.querySelector('[data-upsell-publish]')).not.toBeNull());
   expect(x.root.querySelector('[data-upsell-field="incrementalCost"]').value).toBe('');
   x.root.querySelector('[data-upsell-publish]').click();
   expect(x.api.publishReviewedUpsell).not.toHaveBeenCalled();
   for(const [key,value] of Object.entries({incrementalCost:'100',orderCost:'300',note:'Revisé el envase, la mano de obra y los gastos del pedido.'})){
    const input=x.root.querySelector('[data-upsell-field="'+key+'"]');input.value=value;input.dispatchEvent(new x.w.Event('input'));
   }
   x.root.querySelector('[data-upsell-publish]').click();
   await vi.waitFor(()=>expect(x.api.publishReviewedUpsell).toHaveBeenCalled());
   expect(x.w.sahtenConfirm.mock.calls[0][0]).toContain('EN PAUSA');
   expect(x.api.publishReviewedUpsell.mock.calls[0][1]).toMatchObject({incrementalCost:100,orderCost:300,sourceFingerprint:'source-1',expectedRevision:null});
   await vi.waitFor(()=>expect(x.root.textContent).toContain('Publicada en pausa'));
   x.root.querySelector('[data-upsell-state]').click();
   await vi.waitFor(()=>expect(x.api.setUpsellState).toHaveBeenCalledWith('baklava-up',true,'rev-1'));
   await vi.waitFor(()=>expect(x.root.textContent).toContain('Habilitada'));
  }finally{x.dom.window.close();}
 });
 it('permite dejar adicionales pendientes con aviso explícito y sin enviar ceros como costos comprobados',async()=>{
  const x=setup();try{
   x.root.querySelector('[data-upsell-review]').click();
   await vi.waitFor(()=>expect(x.root.querySelector('[data-upsell-publish]')).not.toBeNull());
   const toggle=x.root.querySelector('[data-upsell-field="deferAdditional"]');toggle.checked=true;toggle.dispatchEvent(new x.w.Event('input'));
   const note=x.root.querySelector('[data-upsell-field="note"]');note.value='Autorizo revisar los envases y trabajo adicional posteriormente.';note.dispatchEvent(new x.w.Event('input'));
   x.root.querySelector('[data-upsell-publish]').click();
   await vi.waitFor(()=>expect(x.api.publishReviewedUpsell).toHaveBeenCalled());
   expect(x.api.publishReviewedUpsell.mock.calls[0][1]).toMatchObject({deferAdditional:true,incrementalCost:null,orderCost:null});
   expect(x.w.sahtenConfirm.mock.calls[0][0]).toContain('COSTOS ADICIONALES PENDIENTES');
  }finally{x.dom.window.close();}
 });
 it('no permite publicar a un vendedor ni inventa estado al fallar el servidor',async()=>{
  const x=setup('cashier');try{
   expect(x.root.querySelector('[data-upsell-review]').disabled).toBe(true);
   await x.editor.review('baklava-up');expect(x.api.readUpsellReviewContext).not.toHaveBeenCalled();
  }finally{x.dom.window.close();}
 });
});
