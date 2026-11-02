import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
let db,sid;
const before={products:[{id:'baklava',name:'Baklava',price:7350},
 {id:'torta_de_chocolate',name:'Torta de chocolate',price:8200}],
 payments:{benefit:{enabled:true,percent:10}},
 promotions:{enabled:true,paymentPercent:10,campaigns:[
  {id:'weekly-meals',name:'Platos semanales',enabled:true,channels:['online'],kind:'public',
    productIds:['baklava'],extraPercent:5,schedule:{type:'weekly',weekdays:[1]}}
 ]},
 site:{name:'No cambiar'},cartRecommendations:{complements:[{id:'cake',productId:'torta_de_chocolate'}]}};
const menu=async()=>db.query('select json from public.menus where store_id=$1',[sid]).then(r=>r.rows[0].json);
const launch=()=>db.exec(read('supabase/migrations/20261102152500_emergency_limited_dessert_promotion.sql'));
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(read('tests/fixtures/supabase-prelude.sql'));
 await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema if not exists sahten_catalog_private;');
 await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid')",[owner]);
 sid=(await db.query("insert into public.stores(slug,name,owner) values('sahten','Sahten',$1) returning id",[owner])).rows[0].id;
 await db.query('insert into public.menus(store_id,json) values($1,$2)',[sid,before]);
 await db.exec(read('supabase/migrations/20261101073000_promotion_campaign_live_states.sql'));
 await db.exec("create or replace function public.sahten_promotion_costs(sid uuid,channel text) returns jsonb language sql stable as $$ select '{\"baklava\":3536.19,\"torta_de_chocolate\":3942.75}'::jsonb $$;");
 await db.exec(read('supabase/migrations/20261102110000_publish_campaign_drafts_safe.sql'));
},60000);
afterAll(async()=>db?.close());
describe('Emergency limited production campaign migration',()=>{
 it('refuses to launch after SKU price changed; rolls back atomically',async()=>{
  const data=structuredClone(before);data.products[0].price=7300;
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,data]);
  await expect(launch()).rejects.toThrow(/cost_or_price_revision_required/);
  const count=await db.query("select count(*)::integer n from sahten_catalog_private.promotion_draft_publications");
  expect(count.rows[0].n).toBe(0);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,before]);
 });
 it('publishes one-unit desserts-only campaign, keeps existing menu exactly',async()=>{
  await launch();
  const after=await menu();
  expect(after.products).toEqual(before.products);
  expect(after.payments).toEqual(before.payments);
  expect(after.cartRecommendations).toEqual(before.cartRecommendations);
  expect(after.site).toEqual(before.site);
  expect(after.promotions.campaigns).toHaveLength(2);
  const rule=after.promotions.campaigns.find(x=>x.id==='postres-extra-online-nov26');
  expect(rule).toMatchObject({enabled:true,channels:['online'],productIds:['baklava','torta_de_chocolate'],
    extraPercent:2,maxUnits:1,minMarginPct:45,requiresVerifiedCosts:false});
  expect(after.promotions.campaigns[0].id).toBe('weekly-meals');
  await expect(launch()).rejects.toThrow(/dessert_campaign_already_exists/);
  expect((await menu()).promotions.campaigns).toHaveLength(2);
 });
});
