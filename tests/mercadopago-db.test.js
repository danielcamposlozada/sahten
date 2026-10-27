import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const USER='00000000-0000-4000-8000-000000000001';let db,sid,account,cid;
async function rpc(action,args){return (await db.query('select public.sahten_mp_backend($1,$2) result',[action,args])).rows[0].result;}
async function role(name,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:name})]);await db.exec('set role '+name);try{return await fn();}finally{await db.exec('reset role');}}
beforeAll(async()=>{
  db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls;');await db.exec(read('supabase/schema.sql'));
  // Vault lo provee Supabase. La prueba emula su interfaz con secretos ficticios exclusivamente.
  await db.exec(`create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);
    create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(s text) returns uuid language plpgsql as $$declare v uuid;begin insert into vault.secrets(secret) values(s) returning id into v;return v;end$$;`);
  await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid')",[USER]);
  sid=(await db.query("insert into public.stores(slug,name,owner)values('test-shop','Test',$1)returning id",[USER])).rows[0].id;
  await db.query('insert into public.menus(store_id,json)values($1,$2)',[sid,{products:[{id:'p',price:100,image:'https://example.test/photo.jpg'}],payments:{methods:{efectivo:true,mercadopago:false},bank:{alias:'example'}}}]);
  await db.exec(read('supabase/payments.sql'));
  account=await role('service_role',()=>rpc('save_account',{store_id:sid,account_id:'123',account_label:'Fake',mode:'production',site_url:'https://example.test',credentials:{accessToken:'TEST-only-fake',webhookSecret:'fake-only'}}));
},60000);
afterAll(async()=>db?.close());
it('las claves no se exponen a clientes ni otros negocios; el servidor recibe solo lo necesario',async()=>{
  for(const who of ['anon','authenticated']){
    await expect(role(who,()=>rpc('account',{store_id:sid}))).rejects.toThrow(/permission denied/);
    await expect(role(who,()=>db.query('select * from sahten_private.mp_accounts'))).rejects.toThrow(/permission denied/);
  }
  expect(account).not.toHaveProperty('secret_id');expect(account).not.toHaveProperty('credentials');
  expect(await role('service_role',()=>rpc('secrets',{account_id:account.id}))).toHaveProperty('credentials.accessToken','TEST-only-fake');
  expect(await role('service_role',()=>rpc('account',{store_id:'00000000-0000-4000-8000-000000000009'}))).toBeNull();
  expect((await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json).toMatchObject({products:[{id:'p',price:100,image:'https://example.test/photo.jpg'}],payments:{methods:{efectivo:true,mercadopago:true},bank:{alias:'example'}}});
});
it('la reserva es única, detecta doble ejecución y no acepta otra prueba de sesión',async()=>{
  const args={store_id:sid,account_id:account.id,request_id:'00000000-0000-4000-8000-000000000004',proof_hash:'proof1',quote_hash:'quote1',order:{items:[{productId:'p',name:'Plato',qty:1,unitPrice:100,lineTotal:100}],total:100,paymentMethod:'mercadopago',customerName:'Prueba'}};
  const c=await role('service_role',()=>rpc('reserve',args));cid=c.id;
  await expect(role('service_role',()=>rpc('reserve',args))).rejects.toThrow(/checkout_busy/);
  await expect(role('service_role',()=>rpc('reserve',{...args,proof_hash:'another'}))).rejects.toThrow(/checkout_conflict/);
  await role('service_role',()=>rpc('preference',{id:cid,preference_id:'pref',checkout_url:'https://www.mercadopago.com.ar/test'}));
  expect((await role('service_role',()=>rpc('reserve',args))).id).toBe(cid);
  expect((await db.query('select * from public.orders')).rows).toHaveLength(0);
});
it('los pagos parciales se suman; notificaciones repetidas no duplican el pedido y las viejas no revierten el estado',async()=>{
  const record={checkout_id:cid,id:'1',status:'approved',amount_cents:5000,refunded_cents:0,updated_at:'2026-10-21T01:00:00Z'};
  expect((await role('service_role',()=>rpc('payment',record))).payment_status).toBe('partial');
  expect((await db.query('select * from public.orders')).rows).toHaveLength(0);
  const second={...record,id:'2'};
  expect((await role('service_role',()=>rpc('payment',second))).payment_status).toBe('paid');
  await role('service_role',()=>rpc('payment',second));
  await role('service_role',()=>rpc('payment',{...second,status:'rejected',updated_at:'2026-10-20T01:00:00Z'}));
  const rows=(await db.query('select * from public.orders')).rows;expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({payment_provider:'mercadopago',payment_status:'paid',payment_ref:cid});
  expect((await role('service_role',()=>rpc('payment',{...second,status:'refunded',refunded_cents:5000,updated_at:'2026-10-22T01:00:00Z'}))).payment_status).toBe('partially_refunded');
  expect((await role('service_role',()=>rpc('payment',{...record,status:'refunded',refunded_cents:5000,updated_at:'2026-10-22T01:00:00Z'}))).payment_status).toBe('refunded');
});
it('el navegador no puede falsificar acreditaciones en columnas verificadas',async()=>{
  await expect(role('anon',()=>db.query("insert into public.orders(store_id,payload,payment_status)values($1,'{}','paid')",[sid]))).rejects.toThrow(/permission denied/);
  const r=await role('anon',()=>db.query("insert into public.orders(store_id,payload)values($1,'{\"paymentStatus\":\"paid\"}')",[sid]));expect(r.affectedRows).toBe(1);
  expect((await db.query('select payment_status from public.orders where payment_ref is null')).rows[0].payment_status).toBeNull();
});
it('separa los pagos de prueba de las ventas reales y detecta cobros excedentes y disputas',async()=>{
  const initial=(await db.query('select count(*)::int n from public.orders')).rows[0].n;
  const a=await role('service_role',()=>rpc('save_account',{store_id:sid,account_id:'456',account_label:'Prueba',mode:'test',site_url:'https://example.test',credentials:{accessToken:'fake-test',webhookSecret:'fake-only'}}));
  const c=await role('service_role',()=>rpc('reserve',{store_id:sid,account_id:a.id,request_id:'00000000-0000-4000-8000-000000000005',proof_hash:'test-proof',quote_hash:'quote',order:{total:100}}));
  const p={checkout_id:c.id,id:'test1',status:'approved',amount_cents:10000,refunded_cents:0,updated_at:'2026-10-21T02:00:00Z'};
  expect((await role('service_role',()=>rpc('payment',p))).payment_status).toBe('paid');
  expect((await db.query('select count(*)::int n from public.orders')).rows[0].n).toBe(initial);
  expect((await role('service_role',()=>rpc('payment',{...p,id:'test2'}))).payment_status).toBe('overpaid');
  expect((await role('service_role',()=>rpc('payment',{...p,status:'in_mediation',updated_at:'2026-10-22T02:00:00Z'}))).payment_status).toBe('in_mediation');
});
it('deshabilitar no destruye secretos que necesitan los pagos anteriores',async()=>{
  await role('service_role',()=>rpc('disable_account',{store_id:sid}));expect(await role('service_role',()=>rpc('account',{store_id:sid}))).toBeNull();
  expect((await role('service_role',()=>rpc('webhook_accounts',{store_id:sid})))[0]).toHaveProperty('credentials');
  expect((await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json.payments.methods.mercadopago).toBe(false);
});

it('pausar delivery bloquea una reserva nueva pero acredita la reserva previa sin perder el pago',async()=>{
 await db.exec(read('supabase/migrations/20261026_menu_availability.sql'));
 await db.exec(read('supabase/migrations/20261027010000_delivery_service_state.sql'));
 const live=await role('service_role',()=>rpc('save_account',{store_id:sid,account_id:'live-fake',account_label:'Prueba local',mode:'production',site_url:'https://example.test',credentials:{accessToken:'fake-only',webhookSecret:'fake-only'}}));
 const args={store_id:sid,account_id:live.id,request_id:'00000000-0000-4000-8000-000000000011',proof_hash:'before-pause',quote_hash:'same',order:{source:'delivery',items:[{productId:'p',qty:1}],total:100}};
 const reserved=await role('service_role',()=>rpc('reserve',args));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[USER]);
 await role('authenticated',()=>db.query('select public.set_delivery_service_state($1,false)',[sid]));
 await expect(role('service_role',()=>rpc('reserve',{...args,request_id:'00000000-0000-4000-8000-000000000012',proof_hash:'after-pause'}))).rejects.toThrow(/delivery_service_paused/);
 const paid=await role('service_role',()=>rpc('payment',{checkout_id:reserved.id,id:'paused-delivery-paid',status:'approved',amount_cents:10000,refunded_cents:0,updated_at:'2026-10-27T01:00:00Z'}));
 expect(paid.payment_status).toBe('paid');expect(paid.order_id).toBeTruthy();
 expect((await db.query('select payload from public.orders where id=$1',[paid.order_id])).rows[0].payload.source).toBe('delivery');
});
