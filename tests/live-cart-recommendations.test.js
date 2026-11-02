import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
import {recommendCartAddons} from '../src/core/cart-recommendations.js';
afterEach(()=>kv.clear());
const menuProducts=[
  {id:'shawarma',name:'Shawarma',price:15000,category:'Platos'},
  {id:'baklava',name:'Baklava',price:7000,category:'Dulces'},
  {id:'coke',name:'Coca',price:2500,category:'Bebidas'}
];
function make(readonly=false){
  const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://sahten.local'});
  const state={published:true,revision:null,products:menuProducts,
    rules:{enabled:true,complements:[{id:'baklava-context',enabled:true,name:'Algo dulce',priority:50,
      productId:'baklava',triggerProductIds:['shawarma'],suppressIfPresent:[]}],
      beverageContexts:[{id:'drink-context',enabled:true,name:'Una bebida',priority:80,
        options:['coke'],triggerProductIds:['shawarma'],minEligibleSubtotal:0,maxEligibleSubtotal:null}]}};
  const api={info:()=>({signedIn:true}),
    readCartRecommendations:vi.fn(async()=>JSON.parse(JSON.stringify(state))),
    setCartRecommendations:vi.fn(async(rules,revision)=>{
      expect(revision).toBe(state.revision);
      state.rules={...state.rules,...JSON.parse(JSON.stringify(rules))};
      state.revision='rev'+Date.now();return {revision:state.revision,rules:state.rules,published:true};
    }),
    readPromotionCampaignStates:vi.fn(async()=>({published:true,campaigns:[]}))};
  const w=dom.window;
  w.SAHTEN={project:{session:{readOnly:readonly}},online:{role:()=> 'owner',controller:api}};
  w.PRODUCTS=[{id:'shawarma',name:'Shawarma'}];
  w.sahtenConfirm=vi.fn(async()=>true);
  const editor=installPromotionsEditor(w);editor.render();
  return {dom,w,api,state};
}
async function open(w){
  w.document.querySelector('[data-tab="publishedRecs"]').click();
  await vi.waitFor(()=>expect(w.document.querySelector('[data-rec-rule="baklava-context"]')).not.toBeNull());
}
describe('Recomendaciones en vivo editables',()=>{
  it('distingue reglas publicadas de borradores y permite pausar una sola',async()=>{
    const {w,dom,api,state}=make();
    try{
      await open(w);
      expect(w.document.querySelector('[data-rec-rule="baklava-context"]').textContent).toContain('Habilitada en web');
      w.document.querySelector('[data-rec-toggle="baklava-context"]').click();
      await vi.waitFor(()=>expect(api.setCartRecommendations).toHaveBeenCalledTimes(1));
      await vi.waitFor(()=>expect(w.document.querySelector('[data-rec-rule="baklava-context"]').textContent).toContain('Pausada en web'));
      expect(state.rules.complements[0].enabled).toBe(false);
      expect(state.rules.beverageContexts[0].enabled).toBe(true);
    }finally{dom.window.close();}
  });
  it('permite editar nombre y disparadores y presenta una vista previa contextual',async()=>{
    const {w,dom,api,state}=make();
    try{
      await open(w);
      w.document.querySelector('[data-rec-preview="baklava-context"]').click();
      expect(w.document.querySelector('.rec-preview').textContent).toContain('Baklava');
      w.document.querySelector('[data-rec-edit="baklava-context"]').click();
      expect(w.document.querySelector('.rec-choices').textContent).toContain('Mostrar si el carrito');
      expect(w.document.querySelector('.rec-edit-form').textContent).toContain('Checkout, ficha de producto');
      w.document.getElementById('rec-edit-name').value='Dulce recomendado';
      w.document.querySelector('[data-rec-save]').click();
      await vi.waitFor(()=>expect(api.setCartRecommendations).toHaveBeenCalledTimes(1));
      expect(state.rules.complements[0].name).toBe('Dulce recomendado');
    }finally{dom.window.close();}
  });
  it('no habilita escritura si la sesión es solo lectura',async()=>{
    const {w,dom,api}=make(true);
    try{await open(w);
      expect(w.document.querySelector('[data-rec-toggle]').disabled).toBe(true);
      expect(w.document.querySelector('[data-rec-create]').disabled).toBe(true);
      expect(api.setCartRecommendations).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
  it('el motor del carrito respeta los switches individuales',()=>{
    const food={id:'baklava',name:'Baklava',enabled:false,productId:'baklava',priority:50,triggerProductIds:['shawarma']};
    const beverage={id:'beverage',name:'Coca',enabled:false,priority:50,options:['coke'],triggerProductIds:['shawarma']};
    const policy={enabled:true,complements:[food],beverageContexts:[beverage]};
    expect(recommendCartAddons({products:menuProducts,cart:[{id:'shawarma',qty:1}],policy})).toEqual([]);
    expect(recommendCartAddons({products:menuProducts,cart:[{id:'shawarma',qty:1}],
      policy:{...policy,complements:[{...food,enabled:true}],beverageContexts:[{...beverage,enabled:true}]}}).map(x=>x.id)).toEqual(['coke','baklava']);
  });
});
