// Intenta completar Checkout Pro con Chromium, usando SOLO vendedor y tarjetas ficticios.
// NO usa credenciales reales ni evade login/CAPTCHA. Si el proveedor exige una
// acción humana o cambia el formulario, detiene la prueba sin acusar éxito.
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {quoteOrder,buildPreference,checkoutUrl,cents} from '../../src/payments/core.js';
const access=String(process.env.MP_SANDBOX_ACCESS_TOKEN||'').trim();
if(!access)throw Error('No test token configured');
const root='https://api.mercadopago.com',folder='mp-checkout-e2e-artifacts';
await mkdir(folder,{recursive:true});
async function api(path,body){
 const r=await fetch(root+path,{method:body===undefined?'GET':'POST',
  headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const v=await r.json().catch(()=>({}));
 if(!r.ok)throw Error('MP '+path.split('?')[0]+' HTTP '+r.status+' ('+String(v?.error||'unknown').slice(0,60)+')');
 return v;
}
const seller=await api('/users/me');
if(seller.site_id!=='MLA'||!seller.tags?.includes('test_user')||!access.startsWith('APP_USR-'))
 throw Error('BLOCKED: not an Argentine test seller');
const browser=await chromium.launch({headless:true});
const reports=[];
async function capture(page,name){
 await page.screenshot({path:folder+'/'+name+'.png',fullPage:true,timeout:9000}).catch(()=>{});
}
async function clickOne(page,pattern){
 for(const el of [page.getByRole('button',{name:pattern}).first(),page.getByRole('link',{name:pattern}).first()]){
  try{if(await el.isVisible({timeout:500})&&await el.isEnabled()){await el.click({timeout:4000});return true;}}catch{}
 }
 return false;
}
async function fill(page,selectors,value){
 for(const selector of selectors){
  const el=page.locator(selector).first();
  try{if(await el.isVisible({timeout:400})&&await el.isEnabled()){await el.fill(String(value),{timeout:2500});return true;}}catch{}
 }
 return false;
}
function merchantCheckout(scenario){
 const now=Date.now();
 const menu={config:{enabled:true,showPrices:true},products:[{id:'ficticio',name:'Compra ficticia '+scenario,price:1000}],
  store:{currency:{symbol:'$',locale:'es-AR'}},payments:{methods:{mercadopago:true},
  benefit:{enabled:false}},delivery:{enabled:false},promotions:{enabled:false}};
 const order=quoteOrder(menu,{source:'pickup',paymentMethod:'mercadopago',
  customerName:'Prueba ficticia',customerPhone:'1111111111',items:[{productId:'ficticio',qty:1}]},
 {validateCustomer:false,now});
 const checkout={id:randomUUID(),store_id:randomUUID(),order};
 const account={site_url:'https://example.org',mode:'test',account_id:String(seller.id)};
 return {checkout,pref:buildPreference(checkout,account,'https://example.org/sahten-test',now)};
}
for(const scenario of ['APRO','OTHE']){
 const {checkout,pref}=merchantCheckout(scenario);
 const created=await api('/checkout/preferences',pref);
 const actual=await api('/checkout/preferences/'+encodeURIComponent(created.id));
 if(actual.external_reference!==checkout.id||
  actual.items?.reduce((n,x)=>n+cents(x.unit_price)*Number(x.quantity),0)!==100000)
  throw Error('El importe del Checkout Pro '+scenario+' cambió');
 const url=checkoutUrl(created),context=await browser.newContext({locale:'es-AR'});
 const page=await context.newPage();
 let result='not_completed',reason='form_not_automatable';
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  await capture(page,scenario+'-01-open');
  // Diagnóstico de estructura, JAMÁS leer valores de inputs o tarjetas.
  const controls=await page.locator('input,button,a').evaluateAll(els=>els.slice(0,65).map(e=>({
   tag:e.tagName.toLowerCase(),type:String(e.getAttribute('type')||'').slice(0,30),
   name:String(e.getAttribute('name')||'').slice(0,50),
   placeholder:String(e.getAttribute('placeholder')||'').slice(0,60),
   label:String(e.getAttribute('aria-label')||'').slice(0,60),
   text:e.tagName==='INPUT'?'':String(e.innerText||'').trim().slice(0,60)
  })).filter(x=>x.tag==='input'||x.tag==='button'||x.text)).catch(()=>[]);
  console.log('CHECKOUT_UI_STRUCTURE '+scenario+' '+JSON.stringify(controls));
  console.log('CHECKOUT_UI_TITLE '+scenario+' '+(await page.title()).slice(0,110));
  for(let attempt=0;attempt<9;attempt++){
   if(/captcha|no soy un robot|verific(a|á) tu identidad/i.test(await page.locator('body').innerText().catch(()=>''))){
    reason='interactive_verification_required';break;
   }
   if(/approved|aprobado|rechazado|rejected|denegado/i.test(page.url())){
    reason='checkout_return';break;
   }
   await fill(page,['input[type="email"]','input[name*="email" i]'],'testuser'+(Number(seller.id)+124)+'@testuser.com');
   const card=await fill(page,['input[autocomplete="cc-number"]','input[name*="cardNumber" i]','input[name*="card_number" i]','input[placeholder*="número" i]'],'4509953566233704');
   if(card){
    await fill(page,['input[autocomplete="cc-exp"]','input[name*="expiration" i]','input[name*="expiry" i]'],'11/30');
    await fill(page,['input[autocomplete="cc-csc"]','input[name*="securityCode" i]','input[name*="security_code" i]','input[placeholder*="seguridad" i]'],'123');
    await fill(page,['input[autocomplete="cc-name"]','input[name*="cardholderName" i]','input[name*="holder" i]'],scenario);
    await fill(page,['input[name*="identification" i]','input[name*="document" i]'],'12345678');
   }
   const labels=['Tarjeta de crédito','Tarjetas de crédito y débito','Pagar con tarjeta','Continuar','Siguiente'];
   let clicked=false;
   for(const t of labels){if(await clickOne(page,new RegExp(t,'i'))){clicked=true;break;}}
   if(!clicked&&card)clicked=await clickOne(page,/^(pagar|confirmar pago|finalizar compra)(\b|$)/i);
   if(!clicked){reason='required_checkout_input_or_login';break;}
   await page.waitForLoadState('domcontentloaded',{timeout:7000}).catch(()=>{});
   await page.waitForTimeout(750);
  }
  await capture(page,scenario+'-02-after-attempt');
  // El veredicto no se toma de la pantalla; se consulta en API con la referencia.
  const search=await api('/v1/payments/search?'+new URLSearchParams({external_reference:checkout.id,limit:'10'}));
  const payments=(search.results||[]).filter(p=>p.external_reference===checkout.id);
  for(const p of payments){
   if(String(p.collector_id)!==String(seller.id)||p.currency_id!=='ARS'||cents(p.transaction_amount)!==100000)
    throw Error('Pago incompatible con vendedor de prueba, moneda o importe');
  }
  const expected=scenario==='APRO'?'approved':'rejected';
  if(payments.some(p=>p.status===expected)){result=expected;reason='verified_by_mp_api';}
  else if(payments.length)reason='different_payment_status';
 }catch(e){reason='checkout_automation_blocked_or_provider_error';await capture(page,scenario+'-error');}
 reports.push({scenario,result,reason,reference:checkout.id});
 await context.close();
}
await browser.close();
await writeFile(folder+'/report.json',JSON.stringify(reports,null,2));
for(const r of reports)console.log(r.scenario+': '+r.result+' / '+r.reason+' / '+r.reference);
if(reports.some(r=>r.result==='not_completed'))
 throw Error('Checkout Pro no completado automáticamente. Revisar capturas y continuar en navegador de pruebas, SIN usar credenciales productivas.');
