import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
const req1='00000000-0000-4000-8000-000000000002';
const req2='00000000-0000-4000-8000-000000000003';
const digest='a'.repeat(64);
let db,storeId,couponId;
async function issue(){
 return db.query("select public.sahten_coupon_backend('issue',$1) as result",
 [{store_id:storeId,code_digest:digest,program:'manual',name:'Cupón prueba',
  eligible_product_ids:['baklava'],min_eligible_subtotal:5000,extra_percent:2,
  max_extra_amount:1000,channel:'online',expires_at:'2027-01-01T12:00:00Z'}]);
}
const payload=()=>({paymentMethod:'efectivo',source:'pickup',
 items:[{productId:'baklava',qty:1,unitPrice:7350}],
 promotionSnapshot:{couponId},subtotal:7350,total:6468,couponCodeDigest:digest});
const confirm=(p,req=req1)=>db.query('select public.sahten_coupon_confirm_order($1,$2,$3,$4) result',
 [storeId,digest,req,p]).then(r=>r.rows[0].result);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(read('tests/fixtures/supabase-prelude.sql'));
 await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema if not exists sahten_private;create schema if not exists sahten_catalog_private;create role service_role;');
 await db.query("insert into auth.users(id,email) values($1,'test@invalid.test')",[owner]);
 storeId=(await db.query("insert into public.stores(slug,name,owner) values('coupon-test','Cupón test',$1) returning id",[owner])).rows[0].id;
 await db.exec(read('supabase/migrations/20261101000100_promotion_coupons.sql'));
 await db.exec(`create or replace function public.sahten_delivery_backend(action text,args jsonb) returns jsonb language plpgsql as $$
 declare oid uuid;
 begin
 if action<>'order' then raise exception 'unsupported';end if;
 insert into public.orders(store_id,payload,status)
 values((args->>'store_id')::uuid,args->'payload','pendiente') returning id into oid;
 if coalesce((args->'payload'->>'testFailure')::boolean,false)
 then raise exception 'simulated_order_failure';end if;
 return jsonb_build_object('id',oid,'order',args->'payload');
 end $$;`);
 await db.exec(read('supabase/migrations/20261102174500_coupon_atomic_delivery_order.sql'));
 couponId=(await issue()).rows[0].result.id;
},60000);
afterAll(async()=>db?.close());
describe('Coupon order is a single transaction',()=>{
 it('rolls back a reserved coupon if order insert fails',async()=>{
  await expect(confirm({...payload(),testFailure:true})).rejects.toThrow(/simulated_order_failure/);
  const r=await db.query('select status from sahten_private.promotion_coupons where id=$1',[couponId]);
  expect(r.rows[0].status).toBe('available');
  const n=await db.query('select count(*)::int n from public.orders where store_id=$1',[storeId]);
  expect(n.rows[0].n).toBe(0);
 });
 it('refuses mismatched quote without consuming the coupon',async()=>{
  await expect(confirm({...payload(),promotionSnapshot:{couponId:owner}})).rejects.toThrow(/coupon_order_quote_mismatch/);
  const r=await db.query('select status from sahten_private.promotion_coupons where id=$1',[couponId]);
  expect(r.rows[0].status).toBe('available');
 });
 it('redeems exactly once with confirmed order, never for a second request',async()=>{
  const result=await confirm(payload());
  expect(result.order.couponCodeDigest).toBe(digest);
  const r=await db.query('select status,redeemed_order_id from sahten_private.promotion_coupons where id=$1',[couponId]);
  expect(r.rows[0].status).toBe('redeemed');
  expect(r.rows[0].redeemed_order_id).toBe(result.id);
  await expect(confirm(payload(),req2)).rejects.toThrow(/coupon_unavailable/);
  const n=await db.query('select count(*)::int n from public.orders where store_id=$1',[storeId]);
  expect(n.rows[0].n).toBe(1);
 });
 it('never grants browser roles direct coupon issuance or atomic confirmation',async()=>{
  const r=await db.query("select has_function_privilege('anon','public.sahten_coupon_confirm_order(uuid,text,uuid,jsonb)','execute') anon,has_function_privilege('authenticated','public.sahten_coupon_confirm_order(uuid,text,uuid,jsonb)','execute') auth");
  expect(r.rows[0]).toMatchObject({anon:false,auth:false});
 });
});
