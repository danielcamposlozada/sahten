import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

it('la bebida sugerida requiere pedido de comida, es opcional y desaparece al agregarla',async()=>{
 const menu={version:1,store:{name:'SAHTEN test',currency:{symbol:'$',locale:'es-AR'}},
 config:{enabled:true,showPrices:true,showImages:false,categories:['Sandwich','Bebidas']},
 products:[
  {id:'sandwich',name:'Sándwich de prueba',category:'Sandwich',price:15800},
  {id:'lata',name:'Coca-Cola 220 ml',category:'Bebidas',price:1400},
  {id:'agua',name:'Agua sin gas 600 ml',category:'Bebidas',price:2000}],
 delivery:{enabled:false},payments:{methods:{transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true}}},
 promotions:{enabled:false},
 beverageRecommendations:{enabled:true,options:[{id:'lata'},{id:'agua'}],contexts:[
  {id:'pedido_chico',name:'¿Sumás una bebida?',priority:40,triggerProductIds:['sandwich'],maxEligibleSubtotal:19999,options:['lata','agua']}
 ]},site:null};
 const dom=new JSDOM(buildIndexHtml(menu),{url:'https://menu.test/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>Response.json([]);}});
 try{
  const w=dom.window,d=w.document;
  await vi.waitFor(()=>expect(d.querySelector('[data-inc="sandwich"]')).not.toBeNull());
  w.openCart();
  expect(d.querySelector('.checkout-beverage-suggestion')).toBeNull();
  w.closeSheet?.();
  d.querySelector('[data-inc="sandwich"]').click();
  w.openCart();
  const rec=d.querySelector('.checkout-beverage-suggestion');
  expect(rec).not.toBeNull();
  expect(rec.textContent).toContain('Coca-Cola 220 ml');
  expect(rec.textContent).toContain('1.400');
  expect(rec.textContent).not.toMatch(/OFF|descuento/i);
  rec.querySelector('button').click();
  expect(d.querySelector('.checkout-beverage-suggestion')).toBeNull();
  expect(d.querySelector('.cart-items').textContent).toContain('Coca-Cola 220 ml');
 }finally{dom.window.close();}
});
