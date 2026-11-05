import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {normalizeLoyaltyPhone} from '../src/core/loyalty-phone.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
let db,sid,origin;
const terms={name:'Segunda compra prueba',extraPercent:10,minEligibleSubtotal:1000,maxExtraAmount:4000,validDays:14,eligibleProductIds:['baklava']};
const rpc=(name,args)=>db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args).then(r=>r.rows[0].result);
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema sahten_private;create schema sahten_catalog_private;create role service_role;alter table public.orders add column payment_status text,add column payment_provider text,add column payment_ref uuid,add column payment_updated_at timestamptz;');
 await db.query("insert into auth.users values($1,'test@invalid.test')",[owner]);
 sid=(await db.query("insert into public.stores(slug,name,owner) values('loyalty-test','Ficticio',$1) returning id",[owner])).rows[0].id;
 await db.query('insert into public.menus values($1,$2,now())',[sid,{products:[{id:'baklava',name:'Baklava',price:10000}],payments:{benefit:{enabled:true,percent:10}},promotions:{enabled:true}}]);
 await db.exec(read('supabase/migrations/20261101000100_promotion_coupons.sql'));
 await db.exec("create or replace function public.sahten_promotion_costs(sid uuid,channel text default 'mostrador') returns jsonb language sql as $$select '{\"baklava\":4000}'::jsonb$$;");
 // Policy migration also replaces existing functions; fixture their referenced row type.
 await db.exec('create table sahten_catalog_private.promotion_campaign_states(store_id uuid,campaign_id text,enabled boolean,revision uuid,updated_by uuid,updated_at timestamptz,primary key(store_id,campaign_id));');
 await db.exec(read('supabase/migrations/20261105010000_promotion_commercial_policy.sql'));
 await db.exec(read('supabase/migrations/20261105020000_phone_loyalty_programs.sql'));
 await db.exec(read('supabase/migrations/20261105040000_public_promotion_programs.sql'));
 await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
},60000);
afterAll(async()=>db?.close());
it('normalizes equivalent Argentine numbers identically in JS and SQL',async()=>{
 for(const phone of ['+54 9 11 2345-6789','541123456789','01123456789','1123456789','0034678123456','+4512345678','+5412345678','123']){
  expect((await db.query('select public.sahten_loyalty_phone($1) p',[phone])).rows[0].p).toBe(normalizeLoyaltyPhone(phone));
 }
});
it('saves programs with no end date, enforces cost rules and optimistic revision',async()=>{
 const r=await rpc('set_store_loyalty_program',[sid,'second_online',terms,true,null]);expect(r.saved).toBe(true);
 await expect(rpc('set_store_loyalty_program',[sid,'second_online',terms,true,null])).rejects.toThrow(/conflict/);
 expect((await rpc('get_store_loyalty_programs',[sid]))[0].terms.endsOn).toBeUndefined();
});
it('pending cash order grants nothing; confirming collection issues one reward and no new sale',async()=>{
 origin=(await db.query("insert into public.orders(store_id,payload) values($1,$2) returning id",[sid,{source:'pickup',customerPhone:'1123456789',paymentMethod:'efectivo',total:10000}])).rows[0].id;
 expect(await rpc('get_order_promotion_reward',[sid,origin])).toBeNull();
 const collected=await rpc('confirm_store_order_collection',[sid,origin,10000]);
 expect(collected.paid).toBe(true);expect(collected.reward.code).toMatch(/^SHT-[A-HJ-NP-Z2-9]+$/);
 const again=await rpc('confirm_store_order_collection',[sid,origin,10000]);expect(again.alreadyConfirmed).toBe(true);expect(again.reward.code).toBe(collected.reward.code);
 expect((await db.query('select count(*)::int n from public.orders')).rows[0].n).toBe(1);
 expect((await db.query('select count(*)::int n from sahten_private.promotion_coupons')).rows[0].n).toBe(1);
});
it('reward is bound to normalized phone and cancelled when original purchase is cancelled',async()=>{
 const reward=await rpc('get_order_promotion_reward',[sid,origin]);
 const c=(await db.query('select code_digest from sahten_private.promotion_coupons where id=$1',[reward.id])).rows[0];
 expect((await rpc('sahten_customer_coupon_lookup',[sid,c.code_digest,'+54 9 11 2345 6789'])).ok).toBe(true);
 await expect(rpc('sahten_customer_coupon_lookup',[sid,c.code_digest,'1199999999'])).rejects.toThrow(/coupon_unavailable/);
 await db.query("update public.orders set status='cancelado' where id=$1",[origin]);
 expect(await rpc('get_order_promotion_reward',[sid,origin])).toBeNull();
 expect((await db.query('select status from sahten_private.promotion_coupons where id=$1',[reward.id])).rows[0].status).toBe('cancelled');
});
it('anonymous clients cannot access coupon identities, codes or collection endpoints',async()=>{
 await db.exec('set role anon');
 try{
  await expect(rpc('sahten_phone_benefit',[sid,'1123456789'])).rejects.toThrow(/permission denied/);
  await expect(rpc('confirm_store_order_collection',[sid,origin,10000])).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from sahten_private.loyalty_store_keys')).rejects.toThrow(/permission denied/);
 }finally{await db.exec('reset role');}
});

it('Mercado Pago must be paid with a verified reference; refunds invalidate the unused reward',async()=>{
 const insert=async payload=>(await db.query("insert into public.orders(store_id,payload,payment_provider,payment_status,payment_ref) values($1,$2,'mercadopago','paid',gen_random_uuid()) returning id",[sid,payload])).rows[0].id;
 const id=await insert({source:'pickup',customerPhone:'1188888888',paymentMethod:'mercadopago',total:10000});
 const reward=await rpc('get_order_promotion_reward',[sid,id]);expect(reward.code).toBeTruthy();
 await db.query("update public.orders set payment_status='refunded' where id=$1",[id]);
 expect(await rpc('get_order_promotion_reward',[sid,id])).toBeNull();
 expect((await db.query('select status from sahten_private.promotion_coupons where id=$1',[reward.id])).rows[0].status).toBe('cancelled');
});
it('an owner can emit a phone-bound manual coupon; another phone cannot redeem it',async()=>{
 const coupon=await rpc('issue_store_manual_coupon',[sid,{...terms,name:'Manual de prueba'},'1177777777']);
 expect(coupon.code).toMatch(/^SHT-[A-HJ-NP-Z2-9]{16}$/);
 const digest=(await db.query('select code_digest from sahten_private.promotion_coupons where id=$1',[coupon.id])).rows[0].code_digest;
 expect((await rpc('sahten_customer_coupon_lookup',[sid,digest,'+54 9 11 7777 7777'])).ok).toBe(true);
 await expect(rpc('sahten_customer_coupon_lookup',[sid,digest,'1166666666'])).rejects.toThrow(/coupon_unavailable/);
});

it('public marketing endpoint excludes identities, codes, private economics and order data',async()=>{
 await db.exec('set role anon');
 try{const result=await rpc('get_public_loyalty_programs',[sid]);expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({id:'second_online',totalPercent:20,minEligibleSubtotal:1000});
  const text=JSON.stringify(result);for(const forbidden of ['code_digest','customer_key','salt','origin_order','confirmed_by','revision','4000.00'])expect(text).not.toContain(forbidden);
 }finally{await db.exec('reset role');}
});

it('audits the provisional fee without booking expenses and rejects invalid values',async()=>{
 const policy={minMarginPct:40,maxTotalPercent:20,products:{},mercadopagoFeePercent:10,mercadopagoFeeProvisional:true};
 const saved=await rpc('set_store_promotion_policy',[sid,policy,null]);
 expect((await rpc('get_store_promotion_policy',[sid])).policy).toMatchObject(policy);
 expect((await db.query("select detail->'after' after from sahten_private.promotion_changes where store_id=$1 and action='promotion_policy_updated' order by created_at desc limit 1",[sid])).rows[0].after).toMatchObject(policy);
 await expect(rpc('set_store_promotion_policy',[sid,{...policy,mercadopagoFeePercent:100},saved.revision])).rejects.toThrow(/invalid_payment_fee_assumption/);
 await expect(rpc('set_store_promotion_policy',[sid,{...policy,mercadopagoFeeProvisional:'false'},saved.revision])).rejects.toThrow(/invalid_payment_fee_assumption/);
});

it('does not reprint a second-purchase benefit after that phone completed another paid purchase',async()=>{
 const insert=async()=>(await db.query("insert into public.orders(store_id,payload,payment_provider,payment_status,payment_ref) values($1,$2,'mercadopago','paid',gen_random_uuid()) returning id",[sid,{source:'pickup',customerPhone:'1155555555',paymentMethod:'mercadopago',total:10000}])).rows[0].id;
 const first=await insert();expect((await rpc('get_order_promotion_reward',[sid,first])).code).toBeTruthy();
 await insert();expect(await rpc('get_order_promotion_reward',[sid,first])).toBeNull();
});
