import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

it.each(['first_online','second_online'])('identifica y quita el filtro de %s sin perder otros parámetros',async id=>{
 const menu={store:{name:'Prueba'},config:{enabled:true,showPrices:true,categories:['Entradas','Bebidas']},
  products:[{id:'a',name:'Plato A',category:'Entradas',price:1000},{id:'b',name:'Plato B',category:'Bebidas',price:2000}],
  site:{enabled:true,orderPage:true,order:['menu']},payments:{methods:{efectivo:true}},delivery:{enabled:false},
  promotions:{enabled:true,campaigns:[]},supabase:{url:'https://backend.invalid',anonKey:'demo',storeId:'11111111-1111-4111-8111-111111111111'}};
 const programs=[{id,name:id==='first_online'?'Bienvenida web':'Segunda compra web',totalPercent:15,paymentPercent:10,validDays:14,productIds:['a']}];
 const html=buildIndexHtml(menu,{storefront:true}).replace('<base href="../">','<base href="https://external.example/">');
 const dom=new JSDOM(html,{url:'https://shop.example/pedir/?canal=prueba&beneficio='+id+'#pedido',runScripts:'dangerously',beforeParse(w){
  w.scrollTo=()=>{};w.fetch=async url=>({ok:true,json:async()=>String(url).includes('get_public_loyalty_programs')?programs:String(url).includes('menu.json')?menu:[]});
 }});
 try{const d=dom.window.document;
  await vi.waitFor(()=>expect(d.querySelector('.catalog-promo-chip')?.textContent).toContain(programs[0].name));
  expect(d.querySelector('.catalog-public-promos').nextElementSibling).toBe(d.querySelector('.catalog-offer-context'));
  expect(d.querySelector('#grid').textContent).toContain('Plato A');expect(d.querySelector('#grid').textContent).not.toContain('Plato B');
  const input=d.querySelector('#catalog-search');input.value='Plato A';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  d.querySelector('[data-clear-promo-filter]').click();
  expect(d.querySelector('.catalog-promo-chip')).toBeNull();expect(input.value).toBe('');expect(d.querySelector('#grid').textContent).toContain('Plato B');
  const url=new URL(dom.window.location.href);expect(url.searchParams.has('beneficio')).toBe(false);expect(url.searchParams.get('canal')).toBe('prueba');
 }finally{dom.window.close();}
});
