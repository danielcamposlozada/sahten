import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {publicPromotionsPageScript} from '../src/online/public-promotions-page.js';
import {editorialCampaignMarkup,editorialLoyaltyMarkup} from '../src/online/editorial-state.js';
import {readFileSync} from 'node:fs';
import {salesPaused} from '../src/core/sales-availability.js';
const product={id:'dish',name:'Plato de prueba',price:10000};
const menu={config:{enabled:true,showPrices:true},products:[product],payments:{bank:{cbu:'private-bank-value'},methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10}},promotions:{enabled:true,version:1,campaigns:[]},supabase:{url:'https://test.invalid',anonKey:'public-demo',storeId:'00000000-0000-4000-8000-000000000001'}};
const programs=[{id:'first_online',name:'Bienvenida de prueba',totalPercent:20,minEligibleSubtotal:30000,maxExtraAmount:4000,validDays:14,productIds:['dish']}];
it('indexable menu script executes independently, loads only public terms and escapes hostile names',async()=>{
 const hostile=structuredClone(menu);hostile.products[0].name='</script><img src=x onerror="window.hacked=1">';
 const html='<section id="page-promotions"></section>'+publicPromotionsPageScript(hostile);
 expect(html).not.toContain('private-bank-value');
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://test.shop/menu/',beforeParse(w){w.fetch=async url=>Response.json(String(url).includes('/rpc/')?programs:[{json:hostile}]);}});
 try{await vi.waitFor(()=>expect(dom.window.document.querySelector('#page-promotions').textContent).toContain('Bienvenida de prueba'));
  expect(dom.window.hacked).toBeUndefined();expect(dom.window.document.querySelector('img')).toBeNull();
  expect(dom.window.document.querySelector('a').getAttribute('href')).toBe('../pedir/#pedido');
  expect(dom.window.document.body.textContent).toContain('30.000');
 }finally{dom.window.close();}
});
it('does not advertise paused products or private drafts and lists all valid published campaigns',()=>{
 const m=structuredClone(menu);m.promotions.campaigns=Array.from({length:4},(_,i)=>({id:'campaign'+i,name:'Campaña '+i,enabled:true,kind:'public',channels:['online'],extraPercent:5,productIds:['dish'],schedule:{type:'always'}}));
 const doc=new JSDOM(editorialCampaignMarkup(m));expect(doc.window.document.querySelectorAll('article')).toHaveLength(4);doc.window.close();
 m.products[0].salesAvailability={paused:true};expect(editorialLoyaltyMarkup(m,programs)).toBe('');
 m.products[0].salesAvailability=null;m.config.showPrices=false;expect(editorialCampaignMarkup(m)).toBe('');
});
it('presenta el beneficio con cupón decorativo y conserva condiciones y productos',()=>{
 const partial={...menu,products:[product,{id:'other',name:'Otro plato',price:15000}]};
 const doc=new JSDOM(editorialLoyaltyMarkup(partial,programs));
 try{const d=doc.window.document;
  expect(d.querySelector('.promo-icon[aria-hidden="true"] svg')).not.toBeNull();
  expect(d.querySelector('.offer-amounts').textContent).toContain('20%');
  expect(d.querySelector('details').textContent).toContain('30.000');
  expect(d.querySelector('details').textContent).toContain('14 días');
  expect(d.querySelector('details').textContent).toContain('Plato de prueba');
 }finally{doc.window.close();}
});
it('dice todo el menú disponible solo cuando todos los productos disponibles participan',()=>{
 const all=new JSDOM(editorialLoyaltyMarkup(menu,programs)),partial=new JSDOM(editorialLoyaltyMarkup({...menu,products:[product,{id:'other',name:'Otro plato'}]},programs));
 try{expect(all.window.document.body.textContent).toContain('todo el menú disponible');expect(all.window.document.querySelector('details summary').textContent).toBe('Condiciones del beneficio');expect(all.window.document.querySelector('details ul')).toBeNull();
  expect(partial.window.document.body.textContent).not.toContain('todo el menú disponible');expect(partial.window.document.querySelector('details ul').textContent).toContain('Plato de prueba');
  expect(partial.window.document.querySelector('.combo-cta').getAttribute('href')).toBe('pedir/?beneficio=first_online#pedido');
 }finally{all.window.close();partial.window.close();}
});
it('conserva abiertas las condiciones al actualizar los beneficios de la home',async()=>{
 const runtime=readFileSync('media/sahten-editorial/home-runtime.js','utf8');let calls=0,items=structuredClone(programs);
 const dom=new JSDOM('<section id="live-public-promos"></section><script id="editorial-menu" type="application/json">'+JSON.stringify(menu)+'</script>',{url:'https://test.shop/',runScripts:'outside-only',pretendToBeVisual:true});
 try{const w=dom.window;w.matchMedia=()=>({matches:true});w.setInterval=()=>0;w.salesPaused=salesPaused;w.editorialBenefitEnabled=()=>false;w.editorialCampaignMarkup=editorialCampaignMarkup;w.editorialLoyaltyMarkup=editorialLoyaltyMarkup;
  w.fetch=async url=>{calls++;return {ok:true,json:async()=>String(url).includes('/rpc/')?items:[{json:menu}]}};
  w.eval(runtime);
  await vi.waitFor(()=>expect(w.document.querySelector('[data-public-promotion] details')).not.toBeNull());
  w.document.querySelector('details').open=true;const before=calls;
  w.dispatchEvent(new w.Event('focus'));await vi.waitFor(()=>expect(calls).toBeGreaterThan(before));
  await vi.waitFor(()=>expect(w.document.querySelector('details').open).toBe(true));
  items=[{...items[0],name:'Bienvenida actualizada'}];w.dispatchEvent(new w.Event('focus'));
  await vi.waitFor(()=>expect(w.document.querySelector('#live-public-promos').textContent).toContain('Bienvenida actualizada'));
  expect(w.document.querySelector('details').open).toBe(true);
 }finally{dom.window.close();}
});
