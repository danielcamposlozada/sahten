import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';

const sid='11111111-1111-4111-8111-111111111111';
const menu={
 store:{name:'Sahten QA',address:'Local de prueba'},
 config:{enabled:true,showPrices:true,categories:['Entradas']},
 products:[{id:'fatay',name:'Fatay',category:'Entradas',price:40000,description:'Fatay de prueba',image:null}],
 site:{enabled:true,orderPage:true,order:['hero','menu'],hero:{title:'Sahten QA',cta:'Pedir',highlights:[]}},
 payments:{methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 promotions:{enabled:true,version:1,paymentPercent:10,campaigns:[]},
 delivery:{enabled:false},supabase:{url:'https://backend.invalid',anonKey:'example-anon',storeId:sid,slug:'sahten'}
};
const coupon='SHT-ABCDEFGH';
function setup({valid=true}={}){
 const calls=[];
 const dom=new JSDOM(buildIndexHtml(menu,{storefront:true}),{
  runScripts:'dangerously',url:'https://sahten.example/pedir/',
  beforeParse(w){w.scrollTo=()=>{};w.fetch=async (url,opts)=>{
    const target=String(url);calls.push({target,opts});
    if(target.includes('/loyalty'))return {ok:true,json:async()=>({
      benefit:{code:coupon,name:'Primera compra',expiresOn:'2099-12-31',productIds:['fatay'],
        totalPercent:15,extraPercent:5,methods:['efectivo','transferencia'],minEligibleSubtotal:30000}
    })};
    if(target.includes('/quote')){
      if(!valid)return {ok:false,json:async()=>({error:'not_eligible',message:'La compra no reúne las condiciones'})};
      return {ok:true,json:async()=>({order:{discount:6000,promotionSnapshot:{
        couponId:'coupon-1',discount:6000,paymentPercent:10,
        appliedPromotionIds:['coupon-1'],lines:[{paymentDiscount:4000,promotionDiscount:2000,net:34000}]
      }}})};
    }
    if(target.includes('menu.json'))return {ok:true,json:async()=>menu};
    if(target.includes('/get_public_loyalty_programs'))return {ok:true,json:async()=>([])};
    if(target.includes('/menus'))return {ok:true,json:async()=>([])};
    return {ok:false,json:async()=>({})};
  };}
 });
 return {dom,calls};
}
async function reachPayment(doc){
 await vi.waitFor(()=>expect(doc.querySelector('#grid [data-inc]')).not.toBeNull());
 doc.querySelector('#grid [data-inc]').click();
 doc.querySelector('#bar button').click();
 doc.querySelector('[data-checkout-step="details"]').click();
 await vi.waitFor(()=>expect(doc.querySelector('#f-phone')).not.toBeNull());
 doc.querySelector('#f-name').value='Cliente de prueba';
 doc.querySelector('#f-name').dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
}
it('detecta teléfono argentino y aplica automáticamente el descuento validado en el servidor',async()=>{
 const {dom,calls}=setup();const d=dom.window.document;
 try{
  await reachPayment(d);
  const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(calls.some(x=>x.target.includes('/loyalty'))).toBe(true),{timeout:2500});
  await vi.waitFor(()=>expect(calls.some(x=>x.target.includes('/quote'))).toBe(true),{timeout:2500});
  await vi.waitFor(()=>expect(d.querySelector('.checkout-totals')?.textContent).toContain('6.000'),{timeout:2500});
  expect(d.querySelector('#coupon-code')?.value).toBe(coupon);
  expect(d.querySelector('.checkout-totals')?.textContent).toContain('34.000');
 }finally{dom.window.close();}
},12000);
it('si la oferta no es elegible, no deja el checkout bloqueado por un código automático',async()=>{
 const {dom,calls}=setup({valid:false});const d=dom.window.document;
 try{
  await reachPayment(d);
  const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(calls.some(x=>x.target.includes('/quote'))).toBe(true),{timeout:2500});
  await vi.waitFor(()=>expect(d.querySelector('#coupon-code')?.value).toBe(''),{timeout:2500});
  expect(d.querySelector('#sheet')?.textContent).toContain('todavía no aplica');
 }finally{dom.window.close();}
},12000);
