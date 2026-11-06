import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

const sid='11111111-1111-4111-8111-111111111111';
const auto='SHT-ABCDEFGH', manual='SHT-JKLMNPQR';
const menu={store:{name:'Tienda QA',address:'Local'},config:{enabled:true,showPrices:true,categories:['Entradas']},
 products:[{id:'fatay',name:'Fatay',category:'Entradas',price:40000}],
 site:{enabled:true,orderPage:true,order:['hero','menu'],hero:{title:'Tienda QA',cta:'Pedir',highlights:[]}},
 payments:{methods:{efectivo:true},benefit:{enabled:true,percent:10,channels:{online:true}}},
 promotions:{enabled:true,version:1,paymentPercent:10,campaigns:[]},
 delivery:{enabled:false},supabase:{url:'https://backend.invalid',anonKey:'example-anon',storeId:sid}};
function setup({autoTotal=34000,manualTotal=35000,failComparison=false}={}){
 const calls=[];let autoCalls=0;const dom=new JSDOM(buildIndexHtml(menu,{storefront:true}),{
  runScripts:'dangerously',url:'https://tienda.example/pedir/',
  beforeParse(w){w.scrollTo=()=>{};w.fetch=async(url,opts)=>{
   const target=String(url),body=opts?.body?JSON.parse(opts.body):{};calls.push({target,body});
   if(target.includes('/loyalty'))return {ok:true,json:async()=>({benefit:{code:auto,name:'Primera compra',
     expiresOn:'2099-12-31',productIds:['fatay'],totalPercent:15,extraPercent:5,methods:['efectivo']}})};
   if(target.includes('/quote')){
    if(body.couponCode===auto&&++autoCalls>1&&failComparison)return {ok:false,json:async()=>({message:'Error de red'})};
    const total=body.couponCode===auto?autoTotal:manualTotal;
    return {ok:true,json:async()=>({order:{total,discount:40000-total,promotionSnapshot:{
      couponId:body.couponCode===auto?'auto':'manual',discount:40000-total,paymentPercent:10,
      appliedPromotionIds:[body.couponCode===auto?'auto':'manual'],
      lines:[{paymentDiscount:4000,promotionDiscount:36000-total,net:total}]
    }}})};
   }
   if(target.includes('menu.json'))return {ok:true,json:async()=>menu};
   if(target.includes('/get_public_loyalty_programs')||target.includes('/menus'))return {ok:true,json:async()=>([])};
   return {ok:false,json:async()=>({})};
  };}
 });return {dom,calls};
}
async function open(d){
 await vi.waitFor(()=>expect(d.querySelector('#grid [data-inc]')).not.toBeNull());
 d.querySelector('#grid [data-inc]').click();d.querySelector('#bar button').click();
 d.querySelector('[data-checkout-step="details"]').click();
 await vi.waitFor(()=>expect(d.querySelector('#f-phone')).not.toBeNull());
 const phone=d.querySelector('#f-phone');phone.value='11 5555 1234';phone.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));
}
async function manualCoupon(d){
 await vi.waitFor(()=>expect(d.querySelector('#coupon-code')?.value).toBe(auto),{timeout:3000});
 const input=d.querySelector('#coupon-code');input.value=manual;input.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));
 d.querySelector('[data-coupon-apply]').click();
}
it('compara ambos cupones y aplica el automático cuando deja menor total',async()=>{
 const {dom,calls}=setup();try{const d=dom.window.document;await open(d);await manualCoupon(d);
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('menor total'),{timeout:4000});
  expect(d.querySelector('#coupon-code').value).toBe(auto);
  expect(calls.filter(c=>c.target.includes('/quote')&&c.body.couponCode===manual)).toHaveLength(1);
 }finally{dom.window.close();}
},12000);
it('conserva el cupón manual cuando es más conveniente',async()=>{
 const {dom}=setup({manualTotal:32000});try{const d=dom.window.document;await open(d);await manualCoupon(d);
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('mejor total'),{timeout:4000});
  expect(d.querySelector('#coupon-code').value).toBe(manual);
 }finally{dom.window.close();}
},12000);
it('no reemplaza el cupón manual si falla la comparación y ofrece reintento',async()=>{
 const {dom}=setup({failComparison:true});try{const d=dom.window.document;await open(d);await manualCoupon(d);
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('No pudimos comparar'),{timeout:4000});
  expect(d.querySelector('#coupon-code').value).toBe(manual);
  expect(d.querySelector('[data-comparison-retry]')).not.toBeNull();
 }finally{dom.window.close();}
},12000);
