import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const definition={id:'baklava-up',name:'Baklava adicional',kind:'upsell',maxUnits:1,extraPercent:10,productIds:['baklava'],triggerProductIds:['plato']};
const menu={config:{enabled:true,showPrices:true},products:[{id:'plato',price:30000},{id:'baklava',price:7000}],
 payments:{benefit:{enabled:true,percent:10}},promotions:{enabled:true,campaigns:[],upsells:[]}};
let db,sid,project;
async function as(role,fn,user=owner){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role ${role}`);try{return await fn();}finally{await db.exec('reset role')}}
const ctx=d=>db.query('select public.get_store_upsell_review_context($1,$2) result',[sid,d]).then(r=>r.rows[0].result);
const publish=(d,c,revision=null,exception=false)=>db.query('select public.review_and_publish_store_upsell($1,$2,100,300,$3,$4,$5,$6) result',[sid,d,'Revisados envase, trabajo incremental y gastos por pedido.',c.sourceFingerprint,revision,exception]).then(r=>r.rows[0].result);
const state=(enabled,rev)=>db.query('select public.set_store_upsell_state($1,$2,$3,$4) result',[sid,definition.id,enabled,rev]).then(r=>r.rows[0].result);
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin');await db.exec(read('supabase/schema.sql'));
 await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid'),($2,'other@test.invalid')",[owner,other]);
 project=(await db.query("insert into public.projects(owner,name,data) values($1,'Test',$2) returning id",[owner,{catalog:{productos:[
  {id:'plato',pricingPolicies:{mostrador:{variableCost:5000,fixedCost:3000}}},
  {id:'baklava',pricingPolicies:{mostrador:{variableCost:800,fixedCost:500}}}]}}])).rows[0].id;
 sid=(await db.query("insert into public.stores(owner,slug,name,project_id) values($1,'upsell-test','Test',$2) returning id",[owner,project])).rows[0].id;
 await db.query('insert into public.menus(store_id,json) values($1,$2)',[sid,menu]);
 await db.exec('create schema if not exists sahten_catalog_private');
 await db.exec(read('supabase/migrations/20261101190000_upsell_nonce_consumptions.sql'));
 await db.exec(read('supabase/migrations/20261104131316_upsell_review_publication.sql'));
 await db.exec("create table public.test_committed_upsells(payload jsonb);create function public.sahten_delivery_backend(action text,args jsonb) returns jsonb language plpgsql security definer as $$begin insert into public.test_committed_upsells values(args->'payload');return jsonb_build_object('id','test-order','order',args->'payload');end$$;");
},60000);
afterAll(async()=>db?.close());
describe('Alta de complementos con revisión privada y publicación pausada',()=>{
 it('protege costos, publicación y revisión contra anon y otros dueños',async()=>{
  await expect(as('anon',()=>ctx(definition))).rejects.toThrow(/permission denied/);
  await expect(as('authenticated',()=>ctx(definition),other)).rejects.toThrow(/forbidden/);
  for(const role of ['anon','authenticated','service_role'])
   await expect(as(role,()=>db.query('select * from sahten_catalog_private.upsell_reviews'))).rejects.toThrow(/permission denied/);
 });
 it('publica pausada, activa por revisión y conserva el alta ante un catálogo viejo',async()=>{
  const c=await as('authenticated',()=>ctx(definition));expect(c.costs.baklava.directCost).toBe(800);
  const p=await as('authenticated',()=>publish(definition,c));expect(p).toMatchObject({published:true,enabled:false});
  let doc=(await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json;
  expect(doc.promotions.upsells[0]).toMatchObject({id:'baklava-up',enabled:false});
  expect(JSON.stringify(doc)).not.toMatch(/directCost|additionalIncrementalCost|review_note/);
  const active=await as('authenticated',()=>state(true,p.revision));expect(active.enabled).toBe(true);
  await expect(as('authenticated',()=>state(false,p.revision))).rejects.toThrow(/revision_conflict/);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,menu]);
  doc=(await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json;
  expect(doc.promotions.upsells).toHaveLength(1);expect(doc.promotions.upsells[0].enabled).toBe(true);
  const costs=await as('service_role',()=>db.query('select public.sahten_upsell_economics($1,$2,$3) result',[sid,'baklava-up',['plato','baklava']]));
  expect(costs.rows[0].result.products.baklava.additionalIncrementalCost).toBe(100);
 });
 it('el guardado final comprueba la aceptación consumida y la revisión en la misma transacción',async()=>{
  const record=(await db.query('select * from sahten_catalog_private.upsell_rules where store_id=$1',[sid])).rows[0];
  const nonce='A'.repeat(32),request='33333333-3333-4333-8333-333333333333',session='session-test';
  const payload={source:'pickup',paymentMethod:'transferencia',upsellReviewId:record.review_id,
   upsellAcceptanceDigest:'a'.repeat(64),promotionSnapshot:{lines:[{appliedPromotionType:'upsell',appliedPromotionId:'baklava-up'}]}};
  const commit=()=>db.query('select public.confirm_reviewed_upsell_order($1,$2,$3,$4,$5,$6,$7) result',[sid,'baklava-up',record.review_id,session,request,nonce,payload]);
  await expect(as('authenticated',commit)).rejects.toThrow(/permission denied/);
  await expect(as('service_role',commit)).rejects.toThrow(/acceptance_missing/);
  await as('service_role',()=>db.query("select public.sahten_consume_upsell_nonce($1,$2,$3,$4,now()+interval '3 minutes')",[sid,nonce,session,request]));
  expect((await as('service_role',commit)).rows[0].result.id).toBe('test-order');
  expect((await db.query('select count(*) n from public.test_committed_upsells')).rows[0].n).toBe(1);
  await db.query("update public.menus set json=jsonb_set(json,'{products,1,price}','7001'::jsonb) where store_id=$1",[sid]);
  await expect(as('service_role',commit)).rejects.toThrow(/cost_source_changed/);
  expect((await db.query('select count(*) n from public.test_committed_upsells')).rows[0].n).toBe(1);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,menu]);
 });
 it('un cambio de costo invalida la revisión y exige revisar, manteniendo historial',async()=>{
  await db.query("update public.projects set data=jsonb_set(data,'{catalog,productos,1,pricingPolicies,mostrador,variableCost}','900'::jsonb) where id=$1",[project]);
  const data=await as('service_role',()=>db.query('select public.sahten_upsell_economics($1,$2,$3) result',[sid,'baklava-up',['plato','baklava']]));
  expect(data.rows[0].result).toBeNull();
  const management=(await as('authenticated',()=>db.query('select public.get_store_upsell_management($1) result',[sid]))).rows[0].result;
  expect(management.offers[0].requiresReview).toBe(true);
  await expect(as('authenticated',()=>state(true,management.offers[0].revision))).rejects.toThrow(/cost_source_changed/);
  const c=await as('authenticated',()=>ctx(definition));
  const revised=await as('authenticated',()=>publish(definition,c,management.offers[0].revision));
  expect(revised.enabled).toBe(false);
  expect((await db.query('select count(*) n from sahten_catalog_private.upsell_reviews')).rows[0].n).toBe(2);
 });
 it('registrar costos pendientes crea una excepción auditable; completarlos genera otra revisión sin reescribir la anterior',async()=>{
  const c=await as('authenticated',()=>ctx(definition));
  const deferred=(await as('authenticated',()=>db.query('select public.review_and_publish_store_upsell($1,$2,NULL,NULL,$3,$4,$5,false,true) result',
   [sid,definition,'Revisión de envases y trabajo adicional diferida por el dueño.',c.sourceFingerprint,c.existing.revision]))).rows[0].result;
  const first=(await db.query('select * from sahten_catalog_private.upsell_reviews where id=$1',[deferred.reviewId])).rows[0];
  expect(first.additional_deferred).toBe(true);
  expect(first.economics.products.baklava.incrementalVerified).toBe(false);
  expect(first.economics.orderCosts.verified).toBe(false);
  expect(first.economics.costException).toMatchObject({auditId:deferred.reviewId,approvedBy:owner,assumedOrderCost:0});
  const next=await as('authenticated',()=>ctx(definition));
  const complete=await as('authenticated',()=>publish(definition,next,deferred.revision));
  expect(complete.reviewId).not.toBe(deferred.reviewId);
  expect((await db.query('select additional_deferred from sahten_catalog_private.upsell_reviews where id=$1',[deferred.reviewId])).rows[0].additional_deferred).toBe(true);
 });
 it('editar textos o imágenes no invalida una revisión económica sin cambio de precios',async()=>{
  await db.query("update public.menus set json=jsonb_set(json,'{products,1,description}','\"Nueva descripción\"'::jsonb) where store_id=$1",[sid]);
  const result=(await as('authenticated',()=>db.query('select public.get_store_upsell_management($1) result',[sid]))).rows[0].result;
  expect(result.offers[0].requiresReview).toBe(false);
 });
 it('rechaza porcentajes y costos inválidos antes de publicar y no concede excepción a otros productos',async()=>{
  await expect(as('authenticated',()=>ctx({...definition,extraPercent:20}))).rejects.toThrow(/discount_limit/);
  await expect(as('authenticated',()=>ctx({...definition,discountTiers:[{minEligibleNetSubtotal:20000,totalDiscountPercent:30}]}))).rejects.toThrow(/discount_limit/);
  const c=await as('authenticated',()=>ctx(definition));
  await expect(as('authenticated',()=>db.query('select public.review_and_publish_store_upsell($1,$2,NULL,300,$3,$4,$5,false)',[sid,definition,'Revisión sin costo adicional',c.sourceFingerprint,c.existing.revision]))).rejects.toThrow(/review_incomplete/);
 });
});
