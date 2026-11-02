import { describe,it,expect,vi,afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { kv } from '../src/project/kv.js';
import { installPromotionsEditor } from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
function make(override={}){
 const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://app.sahten.test/'});
 const state={published:true,campaigns:[{id:'weekly-meals',enabled:true,revision:'aaaa0000-0000-4000-8000-000000000000'}]};
 const api={
  info:()=>({signedIn:true}),
  readPromotionCampaignStates:vi.fn(async()=>JSON.parse(JSON.stringify(state))),
  setPromotionCampaignState:vi.fn(async(id,enabled,revision)=>{if(revision!==state.campaigns[0].revision)throw Error('promotion_state_conflict');state.campaigns[0].enabled=enabled;state.campaigns[0].revision='bbbb0000-0000-4000-8000-000000000000';return state.campaigns[0];}),
 };
 const w=dom.window;
 w.SAHTEN={project:{session:{readOnly:false}},online:{role:()=> 'owner',controller:api}};
 w.sahtenConfirm=vi.fn(async()=>true);
 Object.assign(api,override.api||{});if(override.role)w.SAHTEN.online.role=()=>override.role;
 if(override.readOnly)w.SAHTEN.project.session.readOnly=true;
 const editor=installPromotionsEditor(w);
 editor.render();
 return {dom,w,api,state};
}
async function openLive(w){
 const d=w.document;
 d.querySelector('[data-tab="live"]').click();
 await vi.waitFor(()=>expect(d.querySelector('[data-live-campaign="weekly-meals"]')).not.toBeNull());
}
describe('Controles aislados de campañas publicadas',()=>{
 it('pausa una sola campaña con confirmación, revisión y relectura del servidor',async()=>{
  const {dom,w,api}=make();
  try{
   await openLive(w);
   expect(w.document.querySelector('[data-live-campaign]').textContent).toContain('Activa en web');
   w.document.querySelector('[data-live-toggle="weekly-meals"]').click();
   await vi.waitFor(()=>expect(api.setPromotionCampaignState).toHaveBeenCalledTimes(1));
   expect(api.setPromotionCampaignState).toHaveBeenCalledWith('weekly-meals',false,'aaaa0000-0000-4000-8000-000000000000');
   await vi.waitFor(()=>expect(w.document.querySelector('[data-live-campaign]').textContent).toContain('Pausada en web'));
  }finally{dom.window.close();}
 });
 it('rol cajero y vista de lectura no pueden cambiar el estado',async()=>{
  for(const props of [{role:'cajero'},{readOnly:true}]){
   const {dom,w,api}=make(props);
   try{await openLive(w);
     expect(w.document.querySelector('[data-live-toggle]').disabled).toBe(true);
     expect(api.setPromotionCampaignState).not.toHaveBeenCalled();
   }finally{dom.window.close();}
  }
 });
 it('nunca ofrece Reactivar cuando motor global no está publicado',async()=>{
  const {dom,w,api}=make({api:{readPromotionCampaignStates:vi.fn(async()=>({published:false,campaigns:[{id:'weekly-meals',enabled:false,revision:null}]}))}});
  try{await openLive(w);
   expect(w.document.querySelector('[data-live-toggle]').disabled).toBe(true);
   expect(w.document.querySelector('#promotions-editor').textContent).toContain('no está publicado');
   expect(api.setPromotionCampaignState).not.toHaveBeenCalled();
  }finally{dom.window.close();}
 });
 it('rechazar la confirmación no envía RPC',async()=>{
  const {dom,w,api}=make();
  try{w.sahtenConfirm=vi.fn(async()=>false);await openLive(w);
   w.document.querySelector('[data-live-toggle]').click();
   await vi.waitFor(()=>expect(w.sahtenConfirm).toHaveBeenCalledTimes(1));
   expect(api.setPromotionCampaignState).not.toHaveBeenCalled();
  }finally{dom.window.close();}
 });
});


it('muestra las seis campañas publicadas aunque el archivo local sólo conozca dos; cambia estado en servidor',async()=>{
 const ids=['weekly-meals','central-tables','postres-extra-online-nov26','postres-mamul-extra-nov26','fatay-adicional-moderado-nov26','falafel-mix-moderado-nov26'];
 const state={published:true,campaigns:ids.map(id=>({id,enabled:true,revision:id+'-revision'}))};
 const server={source:'published_server',campaigns:ids.map((id,i)=>({
   id,name:i===2?'Baklava o torta · 12% total':id,enabled:true,kind:'public',
   channels:['online'],schedule:null,
   advertising:{enabled:true,placement:['ticket'],message:'Descuento publicado'}
 }))};
 const {dom,w,api}=make({api:{
   readPromotionCampaignStates:vi.fn(async()=>structuredClone(state)),
   readPromotionTicketCampaigns:vi.fn(async()=>structuredClone(server)),
   setPromotionCampaignState:vi.fn(async(id,enabled,revision)=>{
     const record=state.campaigns.find(r=>r.id===id);
     if(record.revision!==revision)throw Error('promotion_state_conflict');
     record.enabled=enabled;record.revision=id+'-new';
     return {...record};
   })
 }});
 try{
   await vi.waitFor(()=>expect(w.document.querySelector('.promo-overview-grid').querySelectorAll('.promo-overview-card')).toHaveLength(6));
   const root=w.document.getElementById('promotions-editor');
   expect(root.textContent).toContain('Baklava o torta · 12% total');
   expect(root.textContent).not.toContain('Pendiente de validación · no publicada');
   const button=root.querySelector('[data-live-toggle="postres-extra-online-nov26"]');
   expect(button).toBeTruthy();expect(button.getAttribute('aria-checked')).toBe('true');
   button.click();
   await vi.waitFor(()=>expect(api.setPromotionCampaignState).toHaveBeenCalledWith('postres-extra-online-nov26',false,'postres-extra-online-nov26-revision'));
   await vi.waitFor(()=>expect(root.querySelector('[data-live-toggle="postres-extra-online-nov26"]').getAttribute('aria-checked')).toBe('false'));
 }finally{dom.window.close();}
});
