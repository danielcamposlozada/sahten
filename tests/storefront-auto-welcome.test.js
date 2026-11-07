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
function setup({valid=true,programName='Primera compra',failCouponQuotes=0,failLookup=0,delayCoupon=false,partial=false}={}){
 const catalog=partial?{...menu,products:[...menu.products,{id:'hummus',name:'Hummus',category:'Entradas',price:9500}]}:menu;
 const calls=[];let rejectPending;const rejectQuote=()=>rejectPending(new Error('Falla anterior'));
 const dom=new JSDOM(buildIndexHtml(catalog,{storefront:true}),{
  runScripts:'dangerously',url:'https://sahten.example/pedir/',
  beforeParse(w){w.scrollTo=()=>{};w.fetch=async (url,opts)=>{
    const target=String(url);calls.push({target,opts});
    if(target.includes('/loyalty')){if(failLookup-->0)throw new Error('Sin conexión');return {ok:true,json:async()=>({
      benefit:{code:coupon,name:programName,expiresOn:'2099-12-31',productIds:['fatay'],
        totalPercent:15,extraPercent:5,methods:['efectivo','transferencia'],minEligibleSubtotal:30000}
    })};}
    if(target.includes('/quote')){
      if(JSON.parse(opts.body).couponCode&&delayCoupon)return await new Promise((resolve,reject)=>{rejectPending=reject;});
      if(JSON.parse(opts.body).couponCode&&failCouponQuotes-->0)throw new Error('Sin conexión');
      if(!valid)return {ok:false,json:async()=>({error:'not_eligible',message:'La compra no reúne las condiciones'})};
      return {ok:true,json:async()=>({order:{discount:6000,promotionSnapshot:{
        couponId:'coupon-1',discount:6000,paymentPercent:10,
        appliedPromotionIds:['coupon-1'],lines:[{paymentDiscount:4000,promotionDiscount:2000,net:34000}]
      }}})};
    }
    if(target.includes('menu.json'))return {ok:true,json:async()=>catalog};
    if(target.includes('/get_public_loyalty_programs'))return {ok:true,json:async()=>([])};
    if(target.includes('/menus'))return {ok:true,json:async()=>([])};
    return {ok:false,json:async()=>({})};
  };}
 });
 return {dom,calls,rejectQuote};
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
  await vi.waitFor(()=>expect(d.querySelector('.checkout-totals')?.textContent).toContain('34.000'),{timeout:2500});
  expect(d.querySelector('.checkout-totals')?.textContent).toContain('4.000');
  expect(d.querySelector('.checkout-totals')?.textContent).toContain('2.000');
  expect(d.querySelector('#coupon-code')?.value).toBe(coupon);
  expect(d.querySelector('.checkout-totals')?.textContent).toContain('34.000');
  const card=d.querySelector('.loyalty-benefit');
  expect(card.textContent).toContain('En todo el menú disponible.');
  expect(card.textContent).toContain('Vence 31/12/2099');
  expect(card.querySelector('details')).toBeNull();
 }finally{dom.window.close();}
},12000);
it('conserva la lista para un cupón anterior con cobertura parcial',async()=>{
 const {dom}=setup({partial:true});const d=dom.window.document;
 try{
  await reachPayment(d);
  const phone=d.querySelector('#f-phone');phone.value='11 5555 1234';phone.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(d.querySelector('.loyalty-benefit details')).not.toBeNull(),{timeout:2500});
  const card=d.querySelector('.loyalty-benefit');
  expect(card.querySelector('summary').textContent).toBe('Ver productos participantes');
  expect(card.querySelector('li').textContent).toBe('Fatay');
  expect(card.textContent).not.toContain('todo el menú');
 }finally{dom.window.close();}
},12000);
it('si la oferta no es elegible, no deja el checkout bloqueado por un código automático',async()=>{
 const {dom,calls}=setup({valid:false});const d=dom.window.document;
 try{
  await reachPayment(d);
  const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(calls.some(x=>x.target.includes('/quote'))).toBe(true),{timeout:2500});
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('todavía no aplica'),{timeout:2500});
  expect(d.querySelector('#coupon-code')?.value).toBe('');
  await new Promise(resolve=>setTimeout(resolve,40));
 }finally{dom.window.close();}
},12000);

it('aplica automáticamente el beneficio de segunda compra devuelto por el servidor',async()=>{
 const {dom}=setup({programName:'Segunda compra'});const d=dom.window.document;
 try{
  await reachPayment(d);const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('Beneficio aplicado al pedido'),{timeout:2500});
  expect(d.querySelector('#sheet')?.textContent).toContain('Segunda compra');
  expect(d.querySelector('#sheet')?.textContent).not.toContain('Usar mi beneficio');
 }finally{dom.window.close();}
},12000);
it('permite reintentar explícitamente si falla la aplicación automática sin quedar en un bucle',async()=>{
 const {dom,calls}=setup({failCouponQuotes:1});const d=dom.window.document;
 try{
  await reachPayment(d);const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(d.querySelector('[data-loyalty-retry]')).not.toBeNull(),{timeout:2500});
  const before=calls.filter(x=>x.target.includes('/quote')&&JSON.parse(x.opts.body).couponCode).length;
  await new Promise(resolve=>setTimeout(resolve,80));
  expect(calls.filter(x=>x.target.includes('/quote')&&JSON.parse(x.opts.body).couponCode).length).toBe(before);
  d.querySelector('[data-loyalty-retry]').click();
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('Beneficio aplicado al pedido'),{timeout:2500});
 }finally{dom.window.close();}
},12000);
it('muestra un reintento si falla la consulta del teléfono',async()=>{
 const {dom}=setup({failLookup:1});const d=dom.window.document;
 try{
  await reachPayment(d);const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('No pudimos consultar tu beneficio'),{timeout:2500});
  d.querySelector('[data-loyalty-retry]').click();
  await vi.waitFor(()=>expect(d.querySelector('#sheet')?.textContent).toContain('Beneficio aplicado al pedido'),{timeout:2500});
 }finally{dom.window.close();}
},12000);

it('ignora errores de una cotización anterior si el cliente cambió el cupón',async()=>{
 const {dom,calls,rejectQuote}=setup({delayCoupon:true});const d=dom.window.document;
 try{
  await reachPayment(d);const ph=d.querySelector('#f-phone');ph.value='11 5555 1234';ph.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await vi.waitFor(()=>expect(calls.some(x=>x.target.includes('/quote')&&JSON.parse(x.opts.body).couponCode===coupon)).toBe(true),{timeout:2500});
  const input=d.querySelector('#coupon-code');input.value='SHT-HGFEDCBA';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  rejectQuote();
  await vi.waitFor(()=>expect(d.querySelector('#coupon-code')?.value).toBe('SHT-HGFEDCBA'),{timeout:2500});
  await new Promise(resolve=>setTimeout(resolve,50));
  expect(d.querySelector('#sheet')?.textContent).not.toContain('Falla anterior');
 }finally{dom.window.close();}
},12000);
