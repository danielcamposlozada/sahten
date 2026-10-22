import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { quoteOrder, buildPreference, checkoutUrl, verifyWebhook, verifiedPayment, sha256 } from '../src/payments/core.js';
import { createPaymentService } from '../src/payments/service.js';

const SID='00000000-0000-4000-8000-000000000001', AID='00000000-0000-4000-8000-000000000002', CID='00000000-0000-4000-8000-000000000003', RID='00000000-0000-4000-8000-000000000004';
const NOW=Date.parse('2026-10-21T12:00:00Z');
const menu={store:{currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true},products:[{id:'p',name:'Plato',price:1000}],delivery:{lat:-34.6,lng:-58.4,zones:[{name:'Local',radiusKm:3,baseCost:200}],deliveryMinOrder:1000}};
const order={items:[{id:'p',qty:2,unitPrice:1}],source:'pickup',customerName:'Ana de prueba',customerPhone:'1112345678',total:2000};
const account={id:AID,store_id:SID,mode:'test',account_id:'123',site_url:'https://mi-negocio.test',credentials:{accessToken:'TEST-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',webhookSecret:'secret-for-tests-only'}};
const checkout={id:CID,store_id:SID,account_id:AID,payment_status:'pending',mode:'test',order:quoteOrder(menu,order),attempts:1};
const payment={id:999,external_reference:CID,collector_id:123,currency_id:'ARS',live_mode:false,status:'approved',transaction_amount:2000,date_last_updated:new Date(NOW).toISOString()};
const sign=async (data, secret=account.credentials.webhookSecret)=>{
  const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))).toString('hex');
};
async function notification({timestamp=NOW,id='999',signedId=id,secret,query=true}={}) {
  const ts=String(timestamp), hash=await sign(`id:${signedId};request-id:req1;ts:${ts};`,secret);
  return new Request('https://backend.test/webhook?store_id='+SID+(query?'&data.id='+id:''),{method:'POST',headers:{'x-signature':`ts=${ts},v1=${hash}`,'x-request-id':'req1'},body:JSON.stringify({type:'payment',data:{id}})});
}

describe('importes y preferencias de cada negocio',()=>{
  it('usa el catálogo del servidor y calcula envío, aunque el navegador altere precios',()=>{
    const q=quoteOrder(menu,{...order,source:'delivery',address:'Calle de prueba 123',lat:-34.6,lng:-58.4,shipping:0,total:1});
    expect(q).toMatchObject({subtotal:2000,shipping:200,total:2200});
    expect(()=>quoteOrder(menu,{...order,items:[{id:'no-existe',qty:1}]})).toThrow(/no está disponible/);
    for(const qty of [0,-1,1.5,100,NaN])expect(()=>quoteOrder(menu,{...order,items:[{id:'p',qty}]})).toThrow();
    expect(()=>quoteOrder(menu,{...order,source:'delivery',address:'Lejos 123',lat:0,lng:0})).toThrow(/fuera/);
    expect(()=>quoteOrder({...menu,store:{currency:{symbol:'$',locale:'es-MX'}}},order)).toThrow(/pesos argentinos/);
  });
  it('fija cuenta, referencia y retornos del comercio sin incluir secretos ni confiar en return_url del cliente',()=>{
    const pref=buildPreference(checkout,account,'https://backend.test',NOW);
    expect(pref.external_reference).toBe(CID);expect(pref.items[0]).toMatchObject({unit_price:1000,quantity:2,currency_id:'ARS'});
    expect(pref.back_urls.success).toContain('https://mi-negocio.test/');expect(pref.notification_url).toContain(SID);
    expect(JSON.stringify(pref)).not.toContain('secret-for-tests');expect(JSON.stringify(pref)).not.toContain(account.credentials.accessToken);
    expect(()=>checkoutUrl({init_point:'https://evil.test'},'production')).toThrow();
    expect(checkoutUrl({init_point:'https://www.mercadopago.com.ar/checkout/test'},'test')).toContain('www.mercadopago');
  });
});
describe('notificaciones y verificación del pago',()=>{
  it('acepta HMAC válido y rechaza firma de otro comercio, id cambiado, ausencia de query y timestamps vencidos',async()=>{
    expect(await verifyWebhook(await notification(),account.credentials.webhookSecret,NOW)).toBe(true);
    expect(await verifyWebhook(await notification({secret:'other-store-secret'}),account.credentials.webhookSecret,NOW)).toBe(false);
    expect(await verifyWebhook(await notification({signedId:'998'}),account.credentials.webhookSecret,NOW)).toBe(false);
    expect(await verifyWebhook(await notification({query:false}),account.credentials.webhookSecret,NOW)).toBe(false);
    expect(await verifyWebhook(await notification({timestamp:NOW-3600000}),account.credentials.webhookSecret,NOW)).toBe(false);
  });
  it('rechaza cuentas, ambiente, moneda y referencias ajenas; procesa pagos parciales sin marcarlos completos',()=>{
    expect(verifiedPayment(payment,checkout,account)).toMatchObject({id:'999',status:'approved',amount_cents:200000});
    for(const override of [{collector_id:321},{currency_id:'USD'},{live_mode:true},{external_reference:RID},{transaction_amount:3000},{transaction_amount_refunded:3000}])expect(()=>verifiedPayment({...payment,...override},checkout,account)).toThrow();
    expect(verifiedPayment({...payment,transaction_amount:1000},checkout,account).amount_cents).toBe(100000);
    expect(verifiedPayment({...payment,status:'refunded'},checkout,account).refunded_cents).toBe(200000);
  });
  it('reconoce pagos de una cuenta ficticia validada que usa APP_USR sin admitir pagos sandbox en producción',()=>{
    const testAccount={...account,credentials:{...account.credentials,accessToken:'APP_USR-fake-test-seller'}};
    expect(verifiedPayment({...payment,live_mode:true},checkout,testAccount)).toMatchObject({status:'approved'});
    expect(()=>verifiedPayment(payment,checkout,{...testAccount,mode:'production'})).toThrow(/ambientes distintos/);
    expect(()=>verifiedPayment({...payment,live_mode:null},checkout,testAccount)).toThrow(/ambientes distintos/);
    expect(()=>verifiedPayment({...payment,live_mode:true,collector_id:321},checkout,testAccount)).toThrow(/no corresponde/);
  });
});

describe('API de integración sin cobros reales',()=>{
  function setup({manage=true,preferenceFails=false,testSeller=true,paymentOverride={}}={}) {
    const calls=[], provider=[];
    const repo={menu:async()=>menu,canManage:async()=>manage,run:async(action,args)=>{
      calls.push([action,args]);if(action==='limit')return true;if(action==='account')return account;if(action==='secrets')return account;
      if(action==='reserve')return checkout;if(action==='checkout')return {...checkout,proof_hash:await sha256('a'.repeat(64))};if(action==='webhook_accounts')return [account];
      if(action==='save_account')return {...account,account_label:'Test seller'};return {};
    }};
    const handler=createPaymentService({repo,authenticate:async req=>req.headers.has('authorization')?{id:'user'}:null,endpoint:'https://backend.test',now:()=>NOW,
      fetchImpl:async(url,opts)=>{provider.push([url,opts]);if(url.endsWith('/users/me'))return Response.json({id:123,nickname:'Test seller',site_id:'MLA',tags:testSeller?['test_user']:[]});
      if(url.includes('/v1/payments/'))return Response.json({...payment,...paymentOverride});
      if(preferenceFails)throw new Error('network');
      return Response.json({id:'pref1',init_point:'https://www.mercadopago.com.ar/checkout/test'});}});
    const req=(route,body,method='POST',auth=false)=>handler(new Request('https://backend.test/'+route,{method,headers:{origin:account.site_url,...(auth?{authorization:'Bearer user-token'}:{})},body:body?JSON.stringify(body):undefined}));
    return {req,calls,provider,handler};
  }
  it('solo el dueño o administrador puede guardar; nunca devuelve las claves',async()=>{
    const body={storeId:SID,accessToken:account.credentials.accessToken,webhookSecret:account.credentials.webhookSecret,mode:'test',siteUrl:account.site_url};
    const a=setup();expect((await a.req('account',body,'PUT')).status).toBe(401);
    expect((await setup({manage:false}).req('account',body,'PUT',true)).status).toBe(403);
    const r=await a.req('account',body,'PUT',true);expect(r.status).toBe(200);const out=await r.text();expect(out).not.toContain(account.credentials.accessToken);expect(out).not.toContain('credentials');
  });
  it('un importe manipulado o desactualizado no llega al proveedor y no crea un pedido',async()=>{
    const a=setup();const r=await a.req('checkout',{storeId:SID,requestId:RID,proof:'a'.repeat(64),order:{...order,total:1}});
    expect(r.status).toBe(409);expect(a.provider).toHaveLength(0);expect(a.calls.some(([a])=>a==='reserve')).toBe(false);
  });
  it('no permite disfrazar una cuenta real como pruebas ni una de prueba como producción',async()=>{
    const body={storeId:SID,accessToken:'APP_USR-fake-only-aaaaaaaaaaaa',webhookSecret:account.credentials.webhookSecret,mode:'test',siteUrl:account.site_url};
    const a=setup({testSeller:false});expect((await a.req('account',body,'PUT',true)).status).toBe(400);expect(a.calls.some(([x])=>x==='save_account')).toBe(false);
    expect((await setup().req('account',{...body,mode:'production'},'PUT',true)).status).toBe(400);
  });
  it('crea checkout de prueba sin marcarlo pagado y libera reserva al fallar el proveedor',async()=>{
    const a=setup();const body={storeId:SID,requestId:RID,proof:'a'.repeat(64),order};
    const r=await a.req('checkout',body);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({paymentStatus:'pending',checkoutUrl:expect.stringContaining('www.mercadopago')});
    expect(a.calls.some(([a])=>a==='payment')).toBe(false);
    const b=setup({preferenceFails:true});expect((await b.req('checkout',body)).status).toBe(502);expect(b.calls.at(-1)[0]).toBe('release');
  });
  it('el webhook firmado consulta al proveedor antes de registrar el pago',async()=>{
    const a=setup();const r=await a.handler(await notification());expect(r.status).toBe(200);expect(a.provider[0][0]).toContain('/v1/payments/999');expect(a.calls.at(-1)).toMatchObject(['payment',{checkout_id:CID,status:'approved'}]);
    const b=setup();expect((await b.handler(await notification({secret:'bad'}))).status).toBe(401);expect(b.provider).toHaveLength(0);
  });
  it('no presenta como pendiente un pago que no pudo verificarse ni registra una acreditación inválida',async()=>{
    const a=setup({paymentOverride:{live_mode:true}});
    const r=await a.req('status',{id:CID,proof:'a'.repeat(64),paymentId:'999'});
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({code:'payment_environment_mismatch'});
    expect(a.calls.some(([action])=>action==='payment')).toBe(false);
  });
  it('una credencial antigua vencida no impide procesar el webhook de la conexión original',async()=>{
    const calls=[];
    const repo={run:async(action,args)=>{calls.push([action,args]);if(action==='webhook_accounts')return [{...account,id:RID,credentials:{...account.credentials,accessToken:'expired'}},account];if(action==='checkout')return checkout;return {};}};
    const handler=createPaymentService({repo,authenticate:async()=>null,endpoint:'https://backend.test',now:()=>NOW,fetchImpl:async(url,opts)=>opts.headers.Authorization.endsWith('expired')?Response.json({}, {status:401}):Response.json(payment)});
    expect((await handler(await notification())).status).toBe(200);expect(calls.at(-1)[0]).toBe('payment');
  });
});
