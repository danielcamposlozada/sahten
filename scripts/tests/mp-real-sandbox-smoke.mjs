// Prueba de integración real y sin cobros de Checkout Pro con vendedor ficticio.
// REQUIERE MP_SANDBOX_ACCESS_TOKEN. No lee secretos de Supabase ni activa la tienda.
// 1) /users/me verifica test_user + MLA ANTES de escribir una preferencia.
// 2) Crea una preferencia sintética y la relee. NO inicia ni acredita pagos.
import { randomUUID } from 'node:crypto';
import { quoteOrder, buildPreference, checkoutUrl, cents } from '../../src/payments/core.js';

const token=String(process.env.MP_SANDBOX_ACCESS_TOKEN||'').trim();
if(!token){
 console.error('BLOCKED: falta MP_SANDBOX_ACCESS_TOKEN. NO se ejecutó ningún test contra Mercado Pago.');
 process.exit(2);
}
const endpoint='https://api.mercadopago.com';
async function mp(path,options={}){
 const response=await fetch(endpoint+path,{
  method:options.method||'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:options.body===undefined?undefined:JSON.stringify(options.body),
  signal:AbortSignal.timeout(12000)
 });
 let value;try{value=await response.json();}catch{value={};}
 if(!response.ok){
  // No mostrar cuerpo del proveedor: puede contener identificadores o referencias.
  throw Error('Mercado Pago '+path.split('?')[0]+' respondió HTTP '+response.status);
 }
 return value;
}
const seller=await mp('/users/me');
if(seller.site_id!=='MLA'||!Array.isArray(seller.tags)||!seller.tags.includes('test_user')){
 console.error('BLOCKED: las credenciales NO pertenecen a un vendedor de prueba argentino; no se crea preferencia.');
 process.exit(3);
}
const now=Date.now();
const menu={
 config:{enabled:true,showPrices:true},
 products:[{id:'mp_sandbox_smoke',name:'SAHTEN — ensayo sin cobro',price:1000}],
 store:{currency:{symbol:'$',locale:'es-AR'}},
 payments:{methods:{mercadopago:true},benefit:{enabled:false}},
 delivery:{enabled:false},promotions:{enabled:false}
};
const order=quoteOrder(menu,{
 source:'pickup',paymentMethod:'mercadopago',customerName:'Comprador de prueba',
 customerPhone:'1111111111',items:[{productId:'mp_sandbox_smoke',qty:1}]
},{validateCustomer:false,now});
const checkout={id:randomUUID(),store_id:randomUUID(),order};
const account={site_url:'https://sahten.online',mode:'test',account_id:String(seller.id)};
const preference=buildPreference(checkout,account,'https://sahten.online/functions/v1/sahten-payments',now);
const created=await mp('/checkout/preferences',{method:'POST',body:preference});
if(!created?.id)throw Error('Mercado Pago no devolvió ID de preferencia.');
const inspected=await mp('/checkout/preferences/'+encodeURIComponent(created.id));
if(inspected.external_reference!==checkout.id)throw Error('Referencia externa inconsistente.');
if(!Array.isArray(inspected.items))throw Error('No hubo líneas registradas en MP.');
const recorded=inspected.items.reduce((sum,item)=>sum+cents(item.unit_price)*Number(item.quantity||0),0);
if(recorded!==cents(order.total))throw Error('El importe guardado por Mercado Pago no coincide con la cotización de Sahten.');
const acceptedUrl=checkoutUrl(created);
console.log(JSON.stringify({
 verified:true,sellerIsTestUser:true,country:'AR',quotedTotalARS:order.total,
 amountMatched:true,referenceMatched:true,checkoutHost:new URL(acceptedUrl).hostname,
 paymentCreated:false,paymentApproved:false,productionUnchanged:true
},null,2));
