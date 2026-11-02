import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111';
const rid1='22222222-2222-4222-8222-222222222222';
const rid2='33333333-3333-4333-8333-333333333333';
const nonce='AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH';
const nonce2='ZZZZYYYYXXXXWWWWVVVVUUUUTTTTSSSS';
let db,sid;
const expiry=()=>new Date(Date.now()+180000).toISOString();
async function as(role,fn){
 await db.exec('reset role;set role '+role);
 try{return await fn();}finally{await db.exec('reset role');}
}
const payload=(extra={})=>({source:'pickup',paymentMethod:'transferencia',
 items:[{productId:'fatay',qty:1,unitPrice:5000,lineTotal:5000}],
 customerName:'Cliente de prueba',customerPhone:'1112345678',
 subtotal:5000,shipping:0,discount:500,total:4500,...extra});
const rpc=(r=rid1,n=nonce,p=payload(),sidOverride=sid)=>db.query(
 'select public.sahten_delivery_upsell_order($1,$2,$3,$4,$5,$6) as result',
 [sidOverride,n,'test-session',r,expiry(),p]).then(x=>x.rows[0].result);
const count=async()=>Number((await db.query('select count(*)::int n from public.orders where store_id=$1',[sid])).rows[0].n);
const consumed=async()=>Number((await db.query('select count(*)::int n from sahten_catalog_private.upsell_nonce_consumptions where store_id=$1',[sid])).rows[0].n);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(read('tests/fixtures/supabase-prelude.sql'));
 await db.exec('create role service_role nologin bypassrls; grant usage on schema public to service_role');
 await db.exec(read('supabase/schema.sql'));
 await db.exec(`create schema vault;
  create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);
  create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(s text) returns uuid language plpgsql
   as $$declare v uuid;begin insert into vault.secrets(secret)values(s)returning id into v;return v;end$$;`);
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid')",[owner]);
 sid=(await db.query("insert into public.stores(slug,name,owner)values('test-atomic-processor','Local',$1)returning id",[owner])).rows[0].id;
 await db.query("insert into public.menus(store_id,json)values($1,$2)",[sid,{delivery:{deliveryV2:{active:true}},promotions:{enabled:false}}]);
 await db.exec(read('supabase/migrations/20261024_delivery.sql'));
 await db.exec('create schema if not exists sahten_catalog_private;');
 await db.exec(read('supabase/migrations/20261101190000_upsell_nonce_consumptions.sql'));
 await db.exec(read('supabase/migrations/20261102013000_delivery_upsell_atomic_order.sql'));
 // Forzar un fallo real después del consumo pero antes del INSERT en public.orders.
 await db.exec(`create function public.test_reject_order() returns trigger language plpgsql as $$
 begin if new.payload->>'simulateFailure'='true' then raise exception 'simulated_order_failure'; end if;return new;end $$;
 create trigger test_reject_order before insert on public.orders
 for each row execute function public.test_reject_order();`);
},60000);
afterAll(async()=>db?.close());
describe('Delivery: nonce y pedido atómicos en PostgreSQL, sin publicar el RPC al navegador',()=>{
 it('anon y authenticated nunca pueden invocar la RPC privada',async()=>{
  for(const role of ['anon','authenticated'])
   await expect(as(role,()=>rpc())).rejects.toThrow(/permission denied/);
  expect(await consumed()).toBe(0);expect(await count()).toBe(0);
 });
 it('si falla insertar la orden, PostgreSQL también revierte el nonce; reintento funciona',async()=>{
  await expect(as('service_role',()=>rpc(rid1,nonce,payload({simulateFailure:true}))))
   .rejects.toThrow(/simulated_order_failure/);
  expect(await consumed()).toBe(0);expect(await count()).toBe(0);
  const first=await as('service_role',()=>rpc());
  expect(first.order.total).toBe(4500);expect(await count()).toBe(1);
  expect(await consumed()).toBe(1);
  const again=await as('service_role',()=>rpc());
  expect(again.id).toBe(first.id);
  expect(await count()).toBe(1);expect(await consumed()).toBe(1);
 });
 it('el mismo nonce para otro requestId falla sin crear segundo pedido',async()=>{
  await expect(as('service_role',()=>rpc(rid2))).rejects.toThrow(/upsell_nonce_reused/);
  expect(await count()).toBe(1);expect(await consumed()).toBe(1);
 });
 it('otro nonce no permite mutar un requestId ya confirmado',async()=>{
  await expect(as('service_role',()=>rpc(rid1,nonce2,payload({total:4000}))))
   .rejects.toThrow(/order_conflict/);
  expect(await consumed()).toBe(1);expect(await count()).toBe(1);
 });
});
