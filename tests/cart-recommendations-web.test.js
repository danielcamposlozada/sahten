import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

it('sugiere dos complementos, los suma solo por click y no altera el descuento del pago',async()=>{
 const menu={version:1,
 store:{name:'SAHTEN test',address:'Dirección de prueba',currency:{symbol:'$',locale:'es-AR'}},
 config:{enabled:true,showPrices:true,showImages:false,categories:['Platos','Bebidas','Dulces']},
 products:[
  {id:'shawarma',name:'Shawarma',price:15800,category:'Platos'},
  {id:'coke220',name:'Coca-Cola 220 ml',price:1400,category:'Bebidas'},
  {id:'baklava',name:'Baklava',price:7350,category:'Dulces'}
 ],
 payments:{methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 delivery:{enabled:false},promotions:{enabled:false},
 cartRecommendations:{enabled:true,beverageContexts:[
  {id:'small',name:'Una lata con tu plato',priority:30,triggerProductIds:['shawarma'],options:['coke220']}
 ],complements:[
  {id:'sweet',name:'Algo dulce',priority:20,triggerProductIds:['shawarma'],productId:'baklava'}
 ]},
 site:null
 };
 const dom=new JSDOM(buildIndexHtml(menu),{url:'https://test.shop/',runScripts:'dangerously',
 pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.fetch=async(url)=>String(url)==='menu.json'?Response.json(menu):Response.json([]);}});
 try{
  const w=dom.window,d=w.document;
  await vi.waitFor(()=>expect(d.querySelector('[data-inc="shawarma"]')).toBeTruthy());
  expect(d.querySelector('.cart-addons')).toBeNull();
  d.querySelector('[data-inc="shawarma"]').click();w.openCart();
  expect([...d.querySelectorAll('.cart-addon')]).toHaveLength(2);
  expect(d.querySelector('.cart-addons').textContent).toContain('Coca-Cola 220 ml');
  expect(d.querySelector('.cart-addons').textContent).toContain('Baklava');
  expect(d.querySelector('.cart-addons').textContent).toContain('Porque agregaste Shawarma');
  expect(d.querySelector('.cart-addons').textContent).toContain('precio indicado');
  expect(d.querySelector('.cart-addons').textContent).not.toContain('20%');
  expect(d.querySelector('.cart-addons').textContent).not.toMatch(/% OFF|descuento extra/i);
  const b=d.querySelector('.cart-addon [data-inc="coke220"]');
  expect(b).toBeTruthy();b.click();
  expect([...d.querySelectorAll('.cart-addon')]).toHaveLength(1);
  expect(d.querySelector('.cart-addon').textContent).toContain('Baklava');
  expect(d.querySelector('.cart-items').textContent).toContain('Coca-Cola 220 ml');
  expect(w.__menu().payments.benefit.percent).toBe(10);
  expect(w.__menu().promotions.enabled).toBe(false);
 }finally{dom.window.close();}
});
