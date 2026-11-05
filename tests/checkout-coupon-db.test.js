import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {quoteOrder} from '../src/payments/core.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
let db,sid,aid,first,cid;
const rpc=(name,args)=>db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args).then(r=>r.rows[0].result);
const backend=(action,args)=>rpc('sahten_mp_backend',[action,args]);
const requestId='00000000-0000-4000-8000-000000000004';
const coupon=async phone=>{
 const benefit=await rpc('sahten_phone_benefit',[sid,phone]);
 const row=(await db.query('select code_digest from sahten_private.promotion_coupons where id=$1',[benefit.id])).rows[0];
 return {...benefit,digest:row.code_digest};
};
const reserve=async(c,phone,rid=requestId)=>{
 const menu=(await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json;
 const order=quoteOrder(menu,{source:'pickup',items:[{id:'x',qty:1}],customerName:'Ficticio',customerPhone:phone},{trustedCosts:{x:3000},trustedCoupon:c});
 order.couponCodeDigest=c.digest;
 return backend('reserve',{store_id:sid,account_id:aid,request_id:rid,proof_hash:'fixture-proof',quote_hash:'fixture-quote',order});
};
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls;');await db.exec(read('supabase/schema.sql'));
 await db.exec(`create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;create function vault.create_secret(s text) returns uuid language plpgsql as $$declare v uuid;begin insert into vault.secrets(secret)values(s)returning id into v;return v;end$$;`);
 await db.query("insert into auth.users values($1,'fixture@invalid.test')",[owner]);
 sid=(await db.query("insert into public.stores(slug,name,owner)values('coupon-checkout','Ficticio',$1)returning id",[owner])).rows[0].id;
 await db.query('insert into public.menus values($1,$2,now())',[sid,{config:{enabled:true},products:[{id:'x',name:'Ficticio',price:10000}],payments:{benefit:{enabled:true,percent:10}},promotions:{enabled:true,commercialPolicy:{minMarginPct:40,maxTotalPercent:25,mercadopagoFeePercent:10,mercadopagoFeeProvisional:true}}}]);
 await db.exec(read('supabase/payments.sql'));
 aid=(await backend('save_account',{store_id:sid,account_id:'123',account_label:'Ficticio',mode:'production',site_url:'https://fixture.invalid',credentials:{accessToken:'ONLY-FAKE',webhookSecret:'ONLY-FAKE'}})).id;
 await db.exec(read('supabase/migrations/20261101000100_promotion_coupons.sql'));
 await db.exec("create or replace function public.sahten_promotion_costs(sid uuid,channel text default 'mostrador')returns jsonb language sql as $$select '{\"x\":3000}'::jsonb$$;create schema sahten_catalog_private;create table sahten_catalog_private.promotion_campaign_states(store_id uuid,campaign_id text,enabled boolean,revision uuid,updated_by uuid,updated_at timestamptz,primary key(store_id,campaign_id));");
 for(const file of ['20261105010000_promotion_commercial_policy.sql','20261105020000_phone_loyalty_programs.sql','20261105040000_public_promotion_programs.sql','20261105131202_checkout_coupon_redemption.sql'])await db.exec(read('supabase/migrations/'+file));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 for(const id of ['first_online','second_online'])await rpc('set_store_loyalty_program',[sid,id,{name:'Beneficio ficticio',extraPercent:10,totalPercent:20,paymentPercent:10,minEligibleSubtotal:0,maxExtraAmount:null,validDays:14,eligibleProductIds:['x'],mercadopago:{enabled:true,totalPercent:id==='first_online'?5:10,minEligibleSubtotal:id==='first_online'?0:40000,maxExtraAmount:null}},true,null]);
},60000);
afterAll(async()=>db?.close());
it('reserves the Sahten coupon without redeeming or creating an order while payment is pending',async()=>{
 first=await coupon('1123456789');const c=await reserve(first,'1123456789');cid=c.id;
 expect(c.order).toMatchObject({subtotal:10000,discount:500,total:9500,promotionSnapshot:{estimatedPaymentFee:950}});
 await backend('preference',{id:cid,preference_id:'fake-pref',checkout_url:'https://www.mercadopago.com.ar/ficticio'});
 await backend('payment',{checkout_id:cid,id:'100',status:'in_process',amount_cents:950000,refunded_cents:0,updated_at:new Date().toISOString()});
 expect((await db.query('select status from sahten_private.promotion_coupons where id=$1',[first.id])).rows[0].status).toBe('reserved');
 expect((await db.query('select count(*)::int n from public.orders')).rows[0].n).toBe(0);
 expect((await reserve(first,'1123456789')).id).toBe(cid);
 await expect(reserve(first,'1123456789','00000000-0000-4000-8000-000000000005')).rejects.toThrow(/coupon_unavailable/);
});
it('accreditation uses the stored price, redeems once, and emits the second-purchase reward',async()=>{
 await db.query("update public.menus set json=jsonb_set(json,'{products,0,price}','999999') where store_id=$1",[sid]);
 const args={checkout_id:cid,id:'100',status:'approved',amount_cents:950000,refunded_cents:0,updated_at:new Date(Date.now()+1000).toISOString()};
 await backend('payment',args);await backend('payment',args);
 const orders=(await db.query('select * from public.orders')).rows;expect(orders).toHaveLength(1);expect(orders[0].payload.total).toBe(9500);
 expect((await db.query('select status,redeemed_order_id from sahten_private.promotion_coupons where id=$1',[first.id])).rows[0]).toMatchObject({status:'redeemed',redeemed_order_id:orders[0].id});
 const reward=await rpc('get_order_promotion_reward',[sid,orders[0].id]);expect(reward.mercadopago).toMatchObject({totalPercent:10,minEligibleSubtotal:40000,maxExtraAmount:null});
});
it('anonymous users cannot inspect or release a reserved coupon',async()=>{
 await db.exec('set role anon');try{
  await expect(rpc('sahten_mp_checkout_request',[sid,requestId,'fixture-proof'])).rejects.toThrow(/permission denied/);
  await expect(rpc('sahten_mp_release_coupon',[cid,'fixture-proof'])).rejects.toThrow(/permission denied/);
 }finally{await db.exec('reset role');}
});
it('expiry alone does not release a pending payment; explicit checked release permits retry and late funds still create an order',async()=>{
 await db.query("update public.menus set json=jsonb_set(json,'{products,0,price}','10000') where store_id=$1",[sid]);
 const benefit=await coupon('1199999999');const rid='00000000-0000-4000-8000-000000000006',c=await reserve(benefit,'1199999999',rid);
 await db.query("update sahten_private.mp_checkouts set expires_at=now()-interval '1 minute' where id=$1",[c.id]);
 const pay={checkout_id:c.id,id:'200',status:'in_process',amount_cents:950000,refunded_cents:0,updated_at:new Date().toISOString()};await backend('payment',pay);
 await expect(rpc('sahten_mp_release_coupon',[c.id,'fixture-proof'])).rejects.toThrow(/coupon_payment_pending/);
 await backend('payment',{...pay,status:'rejected',updated_at:new Date(Date.now()+1000).toISOString()});
 expect(await rpc('sahten_mp_release_coupon',[c.id,'fixture-proof'])).toMatchObject({released:true});
 await backend('payment',{...pay,status:'approved',updated_at:new Date(Date.now()+2000).toISOString()});
 const late=(await db.query('select order_id,coupon_review from sahten_private.mp_checkouts where id=$1',[c.id])).rows[0];
 expect(late.order_id).toBeTruthy();expect(late.coupon_review).toBe('late_payment_coupon_conflict');
});
