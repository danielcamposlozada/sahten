import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111';
const rid1='22222222-2222-4222-8222-222222222222';
const rid2='33333333-3333-4333-8333-333333333333';
const nonce='AAAAABBBBBCCCCCDDDDDEEEEEFFFFF12';
let db,sid;
async function as(role,task){
 await db.exec('reset role;set role '+role);
 try{return await task();}finally{await db.exec('reset role');}
}
async function use(requestId,expiry='now() + interval \'3 minutes\''){
 return db.query('select public.sahten_consume_upsell_nonce($1,$2,$3,$4,'+expiry+') as consumed',
  [sid,nonce,'session-aaaa',requestId]).then(r=>r.rows[0].consumed);
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(read('tests/fixtures/supabase-prelude.sql'));
 await db.exec('create role service_role nologin; grant usage on schema public to service_role;');
 await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema if not exists sahten_catalog_private;');
 await db.query('insert into auth.users(id,email) values ($1,\'owner@test.invalid\')',[owner]);
 sid=(await db.query('insert into public.stores(slug,name,owner) values (\'nonce-demo\',\'Nonce demo\',$1) returning id',[owner])).rows[0].id;
 await db.exec(read('supabase/migrations/20261101190000_upsell_nonce_consumptions.sql'));
},60000);
afterAll(async()=>db?.close());
describe('El libro de aceptación de upsells es privado, atómico e idempotente',()=>{
 it('no concede lectura ni consumo a usuarios del navegador',async()=>{
  for(const role of ['anon','authenticated']){
   await expect(as(role,()=>use(rid1))).rejects.toThrow(/permission denied/);
   await expect(as(role,()=>db.query('select * from sahten_catalog_private.upsell_nonce_consumptions'))).rejects.toThrow(/permission denied/);
  }
 });
 it('permite la primera aceptación y el reintento idéntico, pero bloquea otro pedido',async()=>{
  expect(await as('service_role',()=>use(rid1))).toBe(true);
  expect(await as('service_role',()=>use(rid1))).toBe(true);
  expect(await as('service_role',()=>use(rid2))).toBe(false);
  const rows=(await db.query('select * from sahten_catalog_private.upsell_nonce_consumptions')).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].request_id).toBe(rid1);
 });
 it('no acepta vencidos, futuros mayores a 5 minutos ni tokens de formato inválido',async()=>{
  await expect(as('service_role',()=>use(rid2,'now() - interval \'1 second\''))).rejects.toThrow(/upsell_nonce_invalid/);
  await expect(as('service_role',()=>use(rid2,'now() + interval \'6 minutes\''))).rejects.toThrow(/upsell_nonce_invalid/);
  await expect(as('service_role',()=>db.query('select public.sahten_consume_upsell_nonce($1,$2,$3,$4,now()+interval \'1 minute\')',
    [sid,'INVALID!','session-aaaa',rid2]))).rejects.toThrow(/upsell_nonce_invalid/);
 });
 it('reaplicar la migración conserva los consumos existentes',async()=>{
  await db.exec(read('supabase/migrations/20261101190000_upsell_nonce_consumptions.sql'));
  expect(await as('service_role',()=>use(rid2))).toBe(false);
 });
});
