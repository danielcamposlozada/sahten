import {it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
it('edita una promoción real sin importar archivos y explica días, descuento, tope y vigencia',async()=>{
 const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://app.sahten.test'});
 const w=dom.window;
 const item={id:'postres-extra-online-nov26',kind:'public',name:'Postres 12%',enabled:true,priority:35,
   extraPercent:2,maxUnits:1,schedule:null,channels:['online'],productIds:['baklava','torta'],
   advertising:{enabled:true,message:'Baklava o torta con 12% total',placement:['ticket','cart','checkout']}};
 const doc={source:'published_management',published:true,campaigns:[item],products:[
   {id:'baklava',name:'Baklava',price:7350},{id:'torta',name:'Torta',price:8200}],
   paymentPercent:10,ticket:{enabled:true,advertise:true}};
 const state={published:true,campaigns:[{id:item.id,enabled:true,revision:null}]};
 const api={
   info:()=>({signedIn:true}),
   readPromotionCampaignStates:vi.fn(async()=>structuredClone(state)),
   readPromotionTicketCampaigns:vi.fn(async()=>({source:'published_server',campaigns:[item],ticket:doc.ticket})),
   readPromotionCampaignDetails:vi.fn(async()=>structuredClone(doc)),
   updatePromotionCampaignDetails:vi.fn(async()=>({saved:true})),
   updatePromotionTicketSettings:vi.fn(async()=>({enabled:true,advertise:false}))
 };
 w.SAHTEN={project:{session:{readOnly:false}},online:{role:()=> 'owner',controller:api}};
 w.sahtenConfirm=vi.fn(async()=>true);
 const editor=installPromotionsEditor(w);editor.render();
 try{
   await vi.waitFor(()=>expect(w.document.querySelector('.promo-overview-card')).not.toBeNull());
   w.document.querySelector('[data-open-promo="'+item.id+'"]').click();
   const root=w.document;
   expect(root.querySelector('.promo-live-editor').textContent).toContain('Todos los días');
   expect(root.querySelector('.promo-live-editor').textContent).toContain('Sin fecha de finalización');
   expect(root.querySelector('.promo-live-editor').textContent).toContain('12% total');
   expect(root.querySelector('.promo-live-editor').textContent).toContain('Máximo 1 unidad');
   root.querySelector('[data-live-field="name"]').value='Postres todos los días 12%';
   root.querySelector('[data-live-field="name"]').dispatchEvent(new w.Event('input',{bubbles:true}));
   root.querySelector('[data-live-save]').click();
   await vi.waitFor(()=>expect(api.updatePromotionCampaignDetails).toHaveBeenCalled());
   const [id,patch,rev]=api.updatePromotionCampaignDetails.mock.calls[0];
   expect(id).toBe(item.id);expect(patch.name).toBe('Postres todos los días 12%');
   expect(rev).toBeNull();
   await vi.waitFor(()=>expect(w.sahtenConfirm).toHaveBeenCalled());
   root.querySelector('[data-tab="tickets"]').click();
   expect(root.body.textContent).toContain('Publicidad');
   expect(root.body.textContent).toContain('Solo cupón C emitido');
   root.querySelector('[data-ticket-live="advertise"]').checked=false;
   root.querySelector('[data-ticket-live-save]').click();
   await vi.waitFor(()=>expect(api.updatePromotionTicketSettings).toHaveBeenCalledWith({
     enabled:true,advertise:false},null));
 }finally{dom.window.close();}
});
