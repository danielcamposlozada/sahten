import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

it('permite reintentar una consulta de beneficio que no responde',async()=>{
 const menu={store:{name:'Prueba'},config:{enabled:true,showPrices:true,categories:[]},products:[],site:{enabled:true,orderPage:true,order:['menu']},payments:{methods:{efectivo:true}},delivery:{enabled:false},supabase:{url:'https://backend.invalid',anonKey:'demo',storeId:'11111111-1111-4111-8111-111111111111'}};
 let attempts=0;
 const html=buildIndexHtml(menu,{storefront:true}).replace(/(function deliveryApi\(action,body\)\{[^\n]+\})/, '$1\nwindow.__testDeliveryApi=deliveryApi;');
 const dom=new JSDOM(html,{url:'https://shop.example/pedir/',runScripts:'dangerously',beforeParse(w){
  w.scrollTo=()=>{};const original=w.setTimeout.bind(w);w.setTimeout=(fn,delay,...args)=>original(fn,delay===15000?10:delay,...args);
  w.fetch=(url,options={})=>{
   if(String(url).endsWith('/loyalty')){attempts++;if(attempts===1)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new w.DOMException('Timeout','AbortError'))));return Promise.resolve({ok:true,json:async()=>({eligible:false})});}
   return Promise.resolve({ok:true,json:async()=>String(url).includes('menu.json')?menu:[]});
  };
 }});
 try{
  await vi.waitFor(()=>expect(dom.window.__menu()?.supabase?.url).toBe('https://backend.invalid'));
  await expect(dom.window.__testDeliveryApi('loyalty',{})).rejects.toThrow('La consulta demoró demasiado. Volvé a intentarlo.');
  await expect(dom.window.__testDeliveryApi('loyalty',{})).resolves.toEqual({eligible:false});
 }finally{dom.window.close();}
});
