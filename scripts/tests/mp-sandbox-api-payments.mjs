// Pruebas de cargos por API para cuentas FICTICIAS exclusivamente.
// No es una compra Checkout Pro: valida por separado el procesador real de pagos.
// Los únicos datos de tarjeta son los públicos de test de Mercado Pago.
import {randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const secret=String(process.env.MP_SANDBOX_ACCESS_TOKEN||'').trim();
if(!secret)throw Error('BLOCKED: no se configuró MP_SANDBOX_ACCESS_TOKEN');
const root='https://api.mercadopago.com';
async function request(path,body,headers={}){
 const r=await fetch(root+path,{method:body===undefined?'GET':'POST',
  headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json',...headers},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 let data;try{data=await r.json();}catch{data={};}
 if(!r.ok){
  const code=String(data?.cause?.[0]?.code||data?.error||data?.status||'unavailable').slice(0,90);
  throw Error('Mercado Pago HTTP '+r.status+' en '+path.split('?')[0]+' ('+code+'). No se imprimen claves ni tarjetas.');
 }
 return data;
}
function report(rows){
 const s=['## MP: pagos de prueba por API (NO Checkout Pro)',
  'Acciones restringidas a seller de prueba MLA. Esta evidencia NO acredita el checkout web.',
  ...rows.map(x=>'- '+x.case+': '+x.status+' · referencia '+x.ref),
  'Ningún dato de tarjeta, clave o token efímero se registra.'].join('\n')+'\n';
 console.log(s);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,s);
}
const seller=await request('/users/me');
if(seller.site_id!=='MLA'||!Array.isArray(seller.tags)||!seller.tags.includes('test_user'))
 throw Error('BLOCKED: la credencial no pertenece a un vendedor ficticio de Argentina');
if(!String(secret).startsWith('APP_USR-'))
 throw Error('BLOCKED: solo cuenta de prueba APP_USR; no ejecutar con token productivo de Sahten');
const rows=[];
for(const scenario of ['APRO','OTHE']){
 const token=await request('/v1/card_tokens',{
  card_number:'4509953566233704',security_code:'123',
  expiration_month:11,expiration_year:2030,
  cardholder:{name:scenario,identification:{type:'DNI',number:'12345678'}}
 });
 if(!token?.id)throw Error('No se pudo tokenizar la tarjeta ficticia '+scenario);
 const reference='sahten-api-test-'+randomUUID();
 const payment=await request('/v1/payments',{
  token:token.id,transaction_amount:1000,installments:1,payment_method_id:'visa',
  description:'Sahten prueba interna API '+scenario,
  external_reference:reference,
  payer:{email:'testuser'+(Number(seller.id)+100)+'@testuser.com',
   identification:{type:'DNI',number:'12345678'}}
 },{'X-Idempotency-Key':randomUUID()});
 if(!payment?.id)throw Error('MP no devolvió identificador de pago de prueba');
 const check=await request('/v1/payments/'+encodeURIComponent(payment.id));
 if(check.external_reference!==reference||
    Number(check.transaction_amount)!==1000||
    check.currency_id!=='ARS'||
    String(check.collector_id)!==String(seller.id))
  throw Error('Integridad de pago API '+scenario+' no coincide');
 const expected=scenario==='APRO'?'approved':'rejected';
 if(check.status!==expected)throw Error('Estado '+scenario+': MP devolvió '+String(check.status||'unknown')+', se esperaba '+expected);
 rows.push({case:scenario,status:check.status,ref:reference});
}
report(rows);
