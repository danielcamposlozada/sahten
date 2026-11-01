// Checkout Pro E2E real en vendedor ficticio argentino. NO opera la tienda Sahten.
// MODE=create genera enlaces de prueba APRO/OTHE; MODE=verify lee estados por referencia.
// Las tarjetas se completan en Mercado Pago por un comprador ficticio separado.
import {randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {quoteOrder,buildPreference,checkoutUrl,cents} from '../../src/payments/core.js';

const token=String(process.env.MP_SANDBOX_ACCESS_TOKEN||'').trim();
if(!token)throw Error('BLOCKED: MP_SANDBOX_ACCESS_TOKEN ausente, ninguna operación enviada');
const root='https://api.mercadopago.com';
async function mp(path,{method='GET',body}={}){
 const response=await fetch(root+path,{method,
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('Mercado Pago API HTTP '+response.status+' para '+path.split('?')[0]);
 return response.json();
}
function write(lines){
 const summary=lines.join('\n')+'\n';
 console.log(summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
}
const seller=await mp('/users/me');
if(seller.site_id!=='MLA'||!Array.isArray(seller.tags)||!seller.tags.includes('test_user'))
 throw Error('BLOCKED: no es un vendedor de prueba argentino; operación cancelada');
const mode=String(process.env.MODE||'create');
if(mode==='verify'){
 const reference=String(process.env.REFERENCE||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))
  throw Error('Falta una referencia UUID de prueba válida');
 const query=new URLSearchParams({external_reference:reference,sort:'date_created',criteria:'desc',limit:'15'});
 const found=await mp('/v1/payments/search?'+query.toString());
 const payments=(found.results||[]).filter(p=>p.external_reference===reference);
 for(const p of payments){
  if(String(p.collector_id)!==String(seller.id)||p.currency_id!=='ARS'||cents(p.transaction_amount)!==100000)
   throw Error('La referencia de prueba incluye un pago con vendedor, moneda o importe inconsistente');
 }
 const statuses=payments.map(p=>String(p.status||'unknown'));
 write(['## Mercado Pago sandbox — conciliación real (SOLO pruebas)',
  '- Referencia: `'+reference+'`',
  '- Pagos encontrados: **'+payments.length+'**',
  '- Estados: **'+(statuses.join(', ')||'sin pagos')+'**',
  '- Cuenta: vendedor ficticio de Argentina; no se leyó ni modificó la caja productiva',
  '- El webhook no se prueba aquí: debe ensayarse con notificación simulada y firma válida']);
} else if(mode==='create'){
 const now=Date.now();
 const cases=[['APRO','Pago aprobado'],['OTHE','Pago rechazado']];
 const rows=[];
 for(const [key,label] of cases){
  const menu={
   config:{enabled:true,showPrices:true},
   products:[{id:'sahten_e2e_sandbox',name:'Pedido ficticio - '+key,price:1000}],
   store:{currency:{symbol:'$',locale:'es-AR'}},
   payments:{methods:{mercadopago:true},benefit:{enabled:false}},
   delivery:{enabled:false},promotions:{enabled:false}
  };
  const order=quoteOrder(menu,{
   source:'pickup',paymentMethod:'mercadopago',customerName:'Comprador ficticio',
   customerPhone:'1111111111',items:[{productId:'sahten_e2e_sandbox',qty:1}]
  },{validateCustomer:false,now});
  const checkout={id:randomUUID(),store_id:randomUUID(),order};
  const account={site_url:'https://example.org',mode:'test',account_id:String(seller.id)};
  const preference=buildPreference(checkout,account,'https://example.org/sahten-test',now);
  const created=await mp('/checkout/preferences',{method:'POST',body:preference});
  const actual=await mp('/checkout/preferences/'+encodeURIComponent(created.id));
  if(actual.external_reference!==checkout.id||
   actual.metadata?.sahten_checkout_id!==checkout.id||
   actual.metadata?.sahten_store_id!==checkout.store_id||
   !Array.isArray(actual.items)||actual.items.reduce((n,i)=>n+cents(i.unit_price)*Number(i.quantity||0),0)!==100000)
    throw Error('La preferencia '+key+' no conserva los importes y referencias');
  rows.push({key,label,url:checkoutUrl(created),reference:checkout.id});
 }
 write(['## Mercado Pago — Checkout Pro con comprador de prueba',
  'Solo vendedor **test_user MLA** y productos ficticios. **No hay venta real**. Links válidos 30 minutos.',
  ...rows.flatMap(r=>['### '+r.key+' — '+r.label,
   '- [Abrir Checkout de prueba]('+r.url+')',
   '- Referencia para consultar posteriormente: `'+r.reference+'`',
   '- Usar tarjeta ficticia de Mercado Pago, titular `'+r.key+'`, DNI de prueba `12345678`']),
  'Las URLs de retorno/notificación apuntan a example.org; jamás a la producción de Sahten.',
  'Estos pagos no envían webhooks reales de Checkout Pro test. Simular webhook separadamente.']);
} else throw Error('MODE debe ser create o verify');
