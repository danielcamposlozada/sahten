import {describe,it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {kv} from '../src/project/kv.js';
import {initialPromotionConfig} from '../src/core/promotions.js';
import {promotionDraftReview} from '../src/core/promotion-draft-review.js';
import {installPromotionsEditor} from '../src/ui/promotions-editor.js';
afterEach(()=>kv.clear());
const products=[{id:'baklava',name:'Baklava',precioMostrador:7350},
  {id:'fatay',name:'Fatay',precioMostrador:5850}];
function setup({readOnly=false,confirmation=true}={}){
  const state={...initialPromotionConfig(),upsells:[{id:'baklava-up',name:'Baklava · Complemento dulce',
    enabled:true,kind:'upsell',productIds:['baklava'],triggerProductIds:['fatay'],extraPercent:10,
    maxUnits:1,activationBlockers:['cost_and_checkout_verification_required']}],
    productUpgrades:[{id:'fatay-fourth',name:'Cuarta Fatay',enabled:true,extraPercent:10,
      triggerProductId:'fatay',replacementProductId:'fatay'}],
    couponPrograms:{first_online:{name:'Cupón primera compra',enabled:true,extraPercent:5,
      minEligibleSubtotal:30000,validDays:14,channel:'online'}}};
  kv.set('sahten_promotions',JSON.stringify(state));
  const dom=new JSDOM('<!doctype html><body><div id="promotions-editor"></div></body>',{url:'https://sahten.local'});
  const w=dom.window;
  const controller={info:()=>({signedIn:true}),readPromotionCampaignStates:vi.fn(async()=>({published:false,campaigns:[]})),
    setPromotionCampaignState:vi.fn(),publishPromotionCampaignDraft:vi.fn(),readCartRecommendations:vi.fn(async()=>null)};
  w.SAHTEN={project:{session:{readOnly}},online:{role:()=> 'owner',controller,
    conn:()=>({storeId:'sahten',url:'https://supabase.test'})}};
  w.PRODUCTS=products;
  w.sahtenConfirm=vi.fn(async()=>confirmation);
  w.sahtenAlert=vi.fn();
  const editor=installPromotionsEditor(w);editor.render();
  return {w,dom,editor,controller};
}
describe('Checks de publicación de descuentos y cupones',()=>{
  it('no confunde datos locales con autorización económica o de canje',()=>{
    const r=promotionDraftReview('upsells',{id:'baklava-up',name:'Baklava dulce',
      productIds:['baklava'],triggerProductIds:['fatay'],extraPercent:10},products);
    expect(r.checks.find(c=>c.id==='products').ok).toBe(true);
    expect(r.checks.find(c=>c.id==='triggers').ok).toBe(true);
    expect(r.checks.find(c=>c.id==='limits').ok).toBe(true);
    expect(r.checks.find(c=>c.id==='economics').ok).toBe(false);
    expect(r.checks.find(c=>c.id==='checkout').ok).toBe(false);
    expect(r.readyForDiscount).toBe(false);
  });
  it('no autoriza cupones por un switch local ni beneficios superiores a 20% total',()=>{
    const p={id:'cupon-test',name:'Cupón local',extraPercent:5,minEligibleSubtotal:20000,
      validDays:14,channel:'online'};
    expect(promotionDraftReview('couponPrograms',p).checks.find(c=>c.id==='terms').ok).toBe(true);
    expect(promotionDraftReview('couponPrograms',{...p,extraPercent:12}).checks.find(c=>c.id==='terms').ok).toBe(false);
    expect(promotionDraftReview('couponPrograms',p).checks.find(c=>c.id==='redeem').ok).toBe(false);
    const u={id:'fatay-up',name:'Fatay adicional',productIds:['fatay'],triggerProductIds:['baklava'],
      discountTiers:[{totalDiscountPercent:30,minEligibleNetSubtotal:20000}]};
    expect(promotionDraftReview('upsells',u,products).checks.find(c=>c.id==='limits').ok).toBe(false);
  });
});
describe('Administración segura de todos los borradores',()=>{
  it('vista general identifica Baklava pendiente de validación y enlaza directamente al editor',()=>{
    const {w,dom,editor}=setup();
    try{
      const card=w.document.querySelector('[data-open-promo="baklava-up"]').closest('article');
      expect(card.textContent).toContain('Pendiente de validación');
      expect(card.textContent).toContain('Revisar publicación');
      card.querySelector('[data-open-promo]').click();
      expect(w.document.querySelector('#draft-name')?.value).toContain('Baklava');
      expect(editor.get().upsells[0].enabled).toBe(true);
    }finally{dom.window.close();}
  });
  it('permite editar, duplicar y eliminar cupones locales sin emitir ni canjear códigos',async()=>{
    const {w,dom,editor,controller}=setup();
    try{
      w.document.querySelector('[data-tab="coupons"]').click();
      w.document.querySelector('[data-coupon-edit="first_online"]').click();
      const title=w.document.querySelector('#coupon-name');title.value='Cupón especial para clientes';
      w.document.querySelector('#coupon-percent').value='6';
      w.document.querySelector('#coupon-minimum').value='25000';
      w.document.querySelector('[data-coupon-save]').click();
      expect(editor.get().couponPrograms.first_online).toMatchObject({name:'Cupón especial para clientes',extraPercent:6,
        minEligibleSubtotal:25000,enabled:false});
      w.document.querySelector('[data-coupon-duplicate="first_online"]').click();
      const entries=Object.keys(editor.get().couponPrograms);
      expect(entries).toHaveLength(2);
      const copy=entries.find(x=>x!=='first_online');
      expect(editor.get().couponPrograms[copy].enabled).toBe(false);
      expect(w.document.querySelector('[data-coupon-save]')).not.toBeNull();
      w.document.querySelector('[data-coupon-delete="'+copy+'"]').click();
      await vi.waitFor(()=>expect(Object.keys(editor.get().couponPrograms)).toHaveLength(1));
      w.document.querySelector('[data-coupon-create]').click();
      expect(Object.keys(editor.get().couponPrograms)).toHaveLength(2);
      expect(controller.setPromotionCampaignState).not.toHaveBeenCalled();
      expect(controller.publishPromotionCampaignDraft).not.toHaveBeenCalled();
    }finally{dom.window.close();}
  });
  it('no modifica ni crea cupones desde una sesión solo lectura',()=>{
    const {w,dom,editor}=setup({readOnly:true});
    try{
      w.document.querySelector('[data-tab="coupons"]').click();
      expect(w.document.querySelector('[data-coupon-create]').disabled).toBe(true);
      expect(w.document.querySelector('[data-coupon-edit="first_online"]').disabled).toBe(true);
      expect(Object.keys(editor.get().couponPrograms)).toHaveLength(1);
    }finally{dom.window.close();}
  });
});
