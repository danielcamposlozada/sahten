import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createPaymentUi } from '../src/payments/ui.js';
import { paymentFields } from '../src/online/orders.js';

it('permite cargar claves en la app, las borra al enviar y nunca las persiste localmente ni las muestra de vuelta',async()=>{
  const dom=new JSDOM('<div id="mp-account-slot"></div>',{url:'https://app.test'}),w=dom.window,d=w.document;
  const calls=[],cfg={paymentMethods:{efectivo:true}},conn={storeId:'store1',projectId:'project1'};
  let saved=false;
  const online={enabled:true,conn:()=>conn,controller:{info:()=>({signedIn:true}),client:{auth:{token:async()=> 'USER'},raw:async(path,opts)=>{calls.push([path,opts]);if(opts.method==='PUT'){saved=true;return {connected:true};}return {connected:saved,accountLabel:'Cuenta del negocio',mode:'test',siteUrl:'https://negocio.test',webhookUrl:'https://backend.test/webhook?store_id=store1'};}}}};
  w._getTiendaConfig=()=>cfg;w._saveTiendaConfig=()=>{};const ui=createPaymentUi({online,w});await ui.render();
  d.getElementById('mp-access-token').value='TEST-only-secret-aaaaaaaaa';d.getElementById('mp-webhook-secret').value='another-secret-bbbbbbbbb';
  d.getElementById('mp-account-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  expect(d.getElementById('mp-access-token').value).toBe('');expect(d.getElementById('mp-webhook-secret').value).toBe('');
  await new Promise(r=>setTimeout(r,5));
  expect(calls.find(([,o])=>o.method==='PUT')[1].body).toMatchObject({storeId:'store1',mode:'test',accessToken:'TEST-only-secret-aaaaaaaaa'});
  expect(d.body.innerHTML).not.toContain('TEST-only-secret');expect(w.localStorage.length).toBe(0);expect(cfg.paymentMethods.mercadopago).toBe(true);w.close();
});
it('ignora una respuesta anterior si se cambia de negocio y no mezcla cuentas en pantalla',async()=>{
  const dom=new JSDOM('<div id="mp-account-slot"></div>'),w=dom.window;let resolve;
  const conn={storeId:'one',projectId:'p1'};const online={enabled:true,conn:()=>conn,controller:{info:()=>({signedIn:true}),client:{auth:{token:async()=> 'USER'},raw:()=>new Promise(r=>resolve=r)}}};
  const ui=createPaymentUi({online,w});const pending=ui.render();await new Promise(r=>setTimeout(r,0));conn.storeId='two';ui.clear();resolve({connected:true,accountLabel:'No mostrar',webhookUrl:'https://server.test/one'});await pending;
  expect(w.document.body.textContent).not.toContain('No mostrar');w.close();
});
it('un payload del navegador no puede presentarse como pago aprobado',()=>{
  expect(paymentFields({payload:{paymentMethod:'mercadopago',paymentStatus:'paid',paymentProvider:'mercadopago'}})).toMatchObject({paymentStatus:'unverified',paymentProvider:null});
  expect(paymentFields({payment_provider:'mercadopago',payment_status:'refunded',payment_ref:'checkout1',payload:{}})).toMatchObject({paymentStatus:'refunded',paymentStatusLabel:'Reembolsado'});
});
