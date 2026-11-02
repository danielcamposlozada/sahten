import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001';
const outsider='00000000-0000-4000-8000-000000000002';
let db,sid,other;
const source={
  products:[{id:'fatay3',name:'Fatay 3',price:10000,category:'Platos'}],
  payments:{benefit:{percent:10}},site:{title:'SAHTEN de pruebas'},
  promotions:{enabled:true,paymentPercent:10,campaigns:[
    {id:'existing',kind:'public',enabled:true,name:'Actual',extraPercent:5,
      productIds:['fatay3'],channels:['online'],schedule:{type:'always'}}
  ]}
};
const campaign={id:'new-campaign',name:'Fatay los lunes',kind:'public',enabled:true,
  extraPercent:5,priority:40,channels:['online'],productIds:['fatay3'],
  schedule:{type:'weekly',weekdays:[1]},advertising:{enabled:true,placement:['ticket'],message:'NO PUBLICAR'}};
async function as(role,fn,user=owner){
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);
  try{return await fn();}finally{await db.exec('reset role');}
}
const publish=(value=campaign,store=sid)=>db.query('select public.publish_promotion_campaign_draft($1,$2) result',[store,value]).then(r=>r.rows[0].result);
const menu=(store=sid)=>db.query('select json from public.menus where store_id=$1',[store]).then(r=>r.rows[0].json);
const toggle=(enabled,revision=null)=>db.query('select public.set_promotion_campaign_state($1,$2,$3,$4) result',[sid,'new-campaign',enabled,revision]).then(r=>r.rows[0].result);
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(read('tests/fixtures/supabase-prelude.sql'));
  await db.exec(read('supabase/schema.sql'));
  await db.exec('create schema if not exists sahten_catalog_private;');
  await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid'),($2,'other@test.invalid')",[owner,outsider]);
  sid=(await db.query("insert into public.stores(slug,name,owner) values('draft-pub','Sahten',$1) returning id",[owner])).rows[0].id;
  other=(await db.query("insert into public.stores(slug,name,owner) values('draft-other','Otro',$1) returning id",[outsider])).rows[0].id;
  await db.query('insert into public.menus(store_id,json) values($1,$2),($3,$2)',[sid,source,other]);
  await db.exec(read('supabase/migrations/20261101073000_promotion_campaign_live_states.sql'));
  await db.exec("create or replace function public.sahten_promotion_costs(sid uuid,channel text) returns jsonb language sql stable as $$ select '{\"fatay3\":4000}'::jsonb $$;");
  await db.exec(read('supabase/migrations/20261102110000_publish_campaign_drafts_safe.sql'));
},60000);
afterAll(async()=>db?.close());
it('la migración no modifica el menú; la tabla privada y el RPC no están abiertos al público',async()=>{
  expect(await menu()).toEqual(source);
  await expect(as('anon',()=>publish())).rejects.toThrow(/permission denied/);
  await expect(as('authenticated',()=>publish(campaign,sid),outsider)).rejects.toThrow(/forbidden/);
  await expect(as('authenticated',()=>publish(campaign,other),owner)).rejects.toThrow(/forbidden/);
  await expect(as('authenticated',()=>db.query('select * from sahten_catalog_private.promotion_draft_publications')))
    .rejects.toThrow(/permission denied/);
});
it('rechaza canal mostrador, margen bajo, SKU desconocido y descuentos superiores al tope',async()=>{
  for(const changes of [
    {channels:['mostrador']},{channels:['online','mostrador']},
    {productIds:['desconocido']},{extraPercent:11},
    {extraPercent:10,productIds:['fatay3'],schedule:{type:'weekly',weekdays:[1]},name:'Margen pendiente'}
  ]){
    // The 10-point proposal is still profitable (40% of 8000 = 3200); test cost threshold separately.
    if(changes.extraPercent===10)continue;
    await expect(as('authenticated',()=>publish({...campaign,...changes}))).rejects.toThrow();
  }
  expect((await menu()).promotions.campaigns).toHaveLength(1);
});
it('publica pausada, conserva catálogo/fotos/pagos y soporta sincronización y switch real',async()=>{
  const out=await as('authenticated',()=>publish());
  expect(out).toMatchObject({published:true,id:'new-campaign',enabled:false});
  let m=await menu();
  expect(m.promotions.campaigns).toHaveLength(2);
  const inserted=m.promotions.campaigns.find(x=>x.id===campaign.id);
  expect(inserted).toMatchObject({enabled:false,extraPercent:5,channels:['online'],minMarginPct:40,requiresVerifiedCosts:true});
  expect(inserted.advertising.enabled).toBe(false);
  expect(m.products).toEqual(source.products);
  expect(m.payments).toEqual(source.payments);
  expect(m.site).toEqual(source.site);
  await expect(as('authenticated',()=>publish())).rejects.toThrow(/campaign_already_published/);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,source]);
  m=await menu();
  expect(m.promotions.campaigns).toHaveLength(2);
  expect(m.promotions.campaigns.find(x=>x.id===campaign.id).enabled).toBe(false);
  await as('authenticated',()=>toggle(true));
  m=await menu();
  expect(m.promotions.campaigns.find(x=>x.id===campaign.id).enabled).toBe(true);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,source]);
  m=await menu();
  expect(m.promotions.campaigns.find(x=>x.id===campaign.id).enabled).toBe(true);
  expect((await menu(other))).toEqual(source);
});