import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {publicPromotionsPageScript} from '../src/online/public-promotions-page.js';
import {editorialCampaignMarkup,editorialLoyaltyMarkup} from '../src/online/editorial-state.js';
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
  expect(dom.window.document.querySelector('a').getAttribute('href')).toContain('../pedir/?beneficio=first_online#pedido');
  expect(dom.window.document.body.textContent).toContain('30.000');
 }finally{dom.window.close();}
});
it('does not advertise paused products or private drafts and lists all valid published campaigns',()=>{
 const m=structuredClone(menu);m.promotions.campaigns=Array.from({length:4},(_,i)=>({id:'campaign'+i,name:'Campaña '+i,enabled:true,kind:'public',channels:['online'],extraPercent:5,productIds:['dish'],schedule:{type:'always'}}));
 const doc=new JSDOM(editorialCampaignMarkup(m));expect(doc.window.document.querySelectorAll('article')).toHaveLength(4);doc.window.close();
 m.products[0].salesAvailability={paused:true};expect(editorialLoyaltyMarkup(m,programs)).toBe('');
 m.products[0].salesAvailability=null;m.config.showPrices=false;expect(editorialCampaignMarkup(m)).toBe('');
});
