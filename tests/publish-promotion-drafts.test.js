import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {initialPromotionConfig} from '../src/core/promotions.js';
import {publicationKind,preparePublishedRecommendation} from '../src/core/promotion-publication.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
const products=[{id:'shawarma',name:'Shawarma',price:16000,category:'Platos'},
  {id:'baklava',name:'Baklava',price:7200,category:'Dulces'},
  {id:'coke',name:'Coca',price:2500,category:'Bebidas'}];
const draft={id:'dulce-local',name:'Algo dulce para después',enabled:true,extraPercent:0,priority:50,
  productId:'baklava',triggerProductIds:['shawarma'],suppressIfPresent:[],placement:['cart']};
describe('Publicación de borradores compatibles',()=>{
  it('solo permite sugerencias a precio de lista en el carrito, no descuentos ni cupones',()=>{
    expect(publicationKind('crossSells',draft).ready).toBe(true);
    expect(publicationKind('crossSells',{...draft,extraPercent:10}).ready).toBe(false);
    expect(publicationKind('crossSells',{...draft,placement:['checkout']}).ready).toBe(false);
    expect(publicationKind('crossSells',{...draft,enabled:false}).ready).toBe(false);
    expect(publicationKind('upsells',draft).ready).toBe(false);
    expect(publicationKind('couponPrograms',draft).ready).toBe(false);
    expect(preparePublishedRecommendation(draft,products)).toMatchObject({id:'dulce-local',
      productId:'baklava',enabled:true,placement:['cart']});
    expect(()=>preparePublishedRecommendation({...draft,productId:'retirado'},products)).toThrow();
  });
});
function setup({readOnly=false,confirmation=true}={}){
  kv.set('sahten_promotions',JSON.stringify({...initialPromotionConfig(),crossSells:[{...draft}]}));
  const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://sahten.local'});
  const state={published:true,revision:null,products,rules:{enabled:true,complements:[],beverageContexts:[]}};
  const api={info:()=>({signedIn:true}),readPromotionCampaignStates:vi.fn(async()=>({published:true,campaigns:[]})),
    readCartRecommendations:vi.fn(async()=>JSON.parse(JSON.stringify(state))),
    setCartRecommendations:vi.fn(async(next,revision)=>{
      expect(revision).toBe(state.revision);
      state.rules={...state.rules,...structuredClone(next)};
      state.revision='server-1';
      return {published:true,revision:state.revision,rules:state.rules};
    })};
  const w=dom.window;
  w.SAHTEN={project:{session:{readOnly}},online:{role:()=> 'owner',controller:api,conn:()=>({storeId:'sahten',url:'https://supabase.test'})}};
  w.sahtenConfirm=vi.fn(async()=>confirmation);
  w.PRODUCTS=products.map(x=>({...x,precioMostrador:x.price}));
  const editor=installPromotionsEditor(w);editor.render();
  return {dom,w,api,state,editor};
}
describe('Publicar desde la tarjeta del borrador',()=>{
  it('publica solo al confirmar, relee servidor y muestra el estado real',async()=>{
    const {dom,w,api,state}=setup();
    try{
      await vi.waitFor(()=>expect(w.document.querySelector('[data-publish-draft="dulce-local"]')).not.toBeNull());
      w.document.querySelector('[data-publish-draft="dulce-local"]').click();
      await vi.waitFor(()=>expect(api.setCartRecommendations).toHaveBeenCalledTimes(1));
      expect(state.rules.complements).toHaveLength(1);
      expect(state.rules.complements[0]).toMatchObject({id:'dulce-local',enabled:true,productId:'baklava'});
      await vi.waitFor(()=>expect(w.document.querySelector('.promo-overview-card').textContent).toContain('Publicada'));
      expect(w.document.querySelector('[data-publish-draft="dulce-local"]')).toBeNull();
      expect(w.sahtenConfirm).toHaveBeenCalledTimes(1);
      expect(api.readCartRecommendations.mock.calls.length).toBeGreaterThanOrEqual(2);
    }finally{dom.window.close();}
  });
  it('rechazar confirmación no escribe en web',async()=>{
    const {dom,w,api}=setup({confirmation:false});
    try{
      await vi.waitFor(()=>expect(w.document.querySelector('[data-publish-draft="dulce-local"]')).not.toBeNull());
      w.document.querySelector('[data-publish-draft="dulce-local"]').click();
      await vi.waitFor(()=>expect(w.sahtenConfirm).toHaveBeenCalled());
      expect(api.setCartRecommendations).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
  it('la vista solo lectura no puede publicar',async()=>{
    const {dom,w,api}=setup({readOnly:true});
    try{
      const button=w.document.querySelector('[data-publish-draft="dulce-local"]');
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(true);
      expect(api.setCartRecommendations).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
});
