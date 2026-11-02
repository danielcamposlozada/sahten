import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {initialPromotionConfig} from '../src/core/promotions.js';
import {publicationKind} from '../src/core/promotion-publication.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
const campaign={id:'custom-postre',name:'Promoción postre semanal',kind:'public',
  enabled:true,priority:30,extraPercent:5,channels:['online'],productIds:['hummus'],
  schedule:{type:'weekly',weekdays:[1,2,3]},advertising:{enabled:false,placement:[]}};
const clone=x=>JSON.parse(JSON.stringify(x));
describe('Campañas en borrador — barreras de publicación',()=>{
  it('limita a canal online, plan válido y 20% acumulado (10+10)',()=>{
    expect(publicationKind('campaigns',campaign).ready).toBe(true);
    for(const change of [{enabled:false},{channels:['mostrador']},{channels:['online','mostrador']},
      {extraPercent:11},{extraPercent:0},{productIds:[]},{schedule:{type:'weekly',weekdays:[]}},
      {id:'no spaces'}]){
      expect(publicationKind('campaigns',{...campaign,...change}).ready).toBe(false);
    }
    expect(publicationKind('couponPrograms',campaign).ready).toBe(false);
    expect(publicationKind('upsells',campaign).ready).toBe(false);
  });
});
function setup({canConfirm=true,readOnly=false}={}){
  kv.set('sahten_promotions',JSON.stringify({...initialPromotionConfig(),campaigns:[clone(campaign)]}));
  const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://sahten.local'});
  const state={published:true,campaigns:[]};
  const api={info:()=>({signedIn:true}),readPromotionCampaignStates:vi.fn(async()=>clone(state)),
    publishPromotionCampaignDraft:vi.fn(async c=>{state.campaigns.push({id:c.id,enabled:false,revision:null});return {published:true,id:c.id,enabled:false};}),
    readCartRecommendations:vi.fn(async()=>({published:true,revision:null,products:[{id:'hummus',price:12000,name:'Hummus'}],rules:{enabled:true,complements:[],beverageContexts:[]}})),
    setPromotionCampaignState:vi.fn(async(id,enabled)=>{state.campaigns.find(c=>c.id===id).enabled=enabled;return {id,enabled};})};
  const w=dom.window;
  w.SAHTEN={project:{session:{readOnly}},online:{role:()=> 'owner',controller:api,
    conn:()=>({storeId:'sahten',url:'https://supabase.test'})}};
  w.sahtenConfirm=vi.fn(async()=>canConfirm);
  w.PRODUCTS=[{id:'hummus',name:'Hummus',precioMostrador:12000}];
  installPromotionsEditor(w).render();
  return {dom,w,api,state};
}
describe('Publicar campaña online pausada',()=>{
  it('requiere confirmación, verifica servidor y no activa el descuento',async()=>{
    const {dom,w,api,state}=setup();
    try{
      await vi.waitFor(()=>expect(w.document.querySelector('[data-publish-campaign="custom-postre"]')).not.toBeNull());
      w.document.querySelector('[data-publish-campaign="custom-postre"]').click();
      await vi.waitFor(()=>expect(api.publishPromotionCampaignDraft).toHaveBeenCalledTimes(1));
      await vi.waitFor(()=>expect(w.document.querySelector('[data-open-promo="custom-postre"]').closest('article').textContent).toContain('Campaña publicada'));
      expect(state.campaigns[0].enabled).toBe(false);
      expect(api.setPromotionCampaignState).not.toHaveBeenCalled();
      expect(w.sahtenConfirm).toHaveBeenCalledTimes(1);
    }finally{dom.window.close();}
  });
  it('cancelar no publica',async()=>{
    const {dom,w,api}=setup({canConfirm:false});
    try{
      await vi.waitFor(()=>expect(w.document.querySelector('[data-publish-campaign="custom-postre"]')).not.toBeNull());
      w.document.querySelector('[data-publish-campaign="custom-postre"]').click();
      await vi.waitFor(()=>expect(w.sahtenConfirm).toHaveBeenCalledTimes(1));
      expect(api.publishPromotionCampaignDraft).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
  it('no ofrece publicar desde sesión de solo lectura',async()=>{
    const {dom,w,api}=setup({readOnly:true});
    try{
      await vi.waitFor(()=>expect(w.document.querySelector('[data-publish-campaign="custom-postre"]')).not.toBeNull());
      expect(w.document.querySelector('[data-publish-campaign="custom-postre"]').disabled).toBe(true);
      expect(api.publishPromotionCampaignDraft).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
});