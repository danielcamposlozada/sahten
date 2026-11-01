import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',
      cashier='00000000-0000-4000-8000-000000000002',
      outsider='00000000-0000-4000-8000-000000000003';
let db,sid,other,pid;
const initial={products:[{id:'fatay3',price:16850}],payments:{benefit:{percent:10}},
  store:{name:'Sahten de prueba'},site:{title:'Sitio'},
  promotions:{enabled:true,campaigns:[
    {id:'weekly-meals',enabled:true,kind:'public',name:'Semana',productIds:['fatay3']},
    {id:'central-tables',enabled:true,kind:'public',name:'Tablas',productIds:['tabla']}
  ]}};
async function as(role,fn,user=owner){
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);
  try{return await fn();}finally{await db.exec('reset role');}
}
const menu=store=>db.query('select json from public.menus where store_id=$1',[store||sid]).then(r=>r.rows[0].json);
const get=(store=sid)=>db.query('select public.get_promotion_campaign_states($1) result',[store]).then(r=>r.rows[0].result);
const set=(id,enabled,revision=null,store=sid)=>db.query('select public.set_promotion_campaign_state($1,$2,$3,$4) result',
  [store,id,enabled,revision]).then(r=>r.rows[0].result);
const migration=read('supabase/migrations/20261101073000_promotion_campaign_live_states.sql');

beforeAll(async()=>{
  db=new PGlite();
  await db.exec(read('tests/fixtures/supabase-prelude.sql'));
  await db.exec(read('supabase/schema.sql'));
  await db.exec('create schema if not exists sahten_catalog_private;');
  await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid'),($2,'cashier@test.invalid'),($3,'outside@test.invalid')",[owner,cashier,outsider]);
  pid=(await as('authenticated',()=>db.query("select public.create_project('Local','{}','{}') id"))).rows[0].id;
  await db.query("insert into public.project_members(project_id,user_id,role) values($1,$2,'cajero')",[pid,cashier]);
  sid=(await db.query("insert into public.stores(slug,name,owner,project_id) values('promo-live','Local',$1,$2) returning id",[owner,pid])).rows[0].id;
  other=(await db.query("insert into public.stores(slug,name,owner) values('promo-other','Otro',$1) returning id",[outsider])).rows[0].id;
  await db.query('insert into public.menus(store_id,json) values($1,$2),($3,$2)',[sid,initial,other]);
  await db.exec(migration);
},60000);
afterAll(async()=>db?.close());

it('la migración no activa nada ni modifica un catálogo existente; los datos privados no son públicos',async()=>{
  expect(await menu()).toEqual(initial);
  await db.exec(migration);
  for(const role of ['anon','authenticated'])
    await expect(as(role,()=>db.query('select * from sahten_catalog_private.promotion_campaign_states'))).rejects.toThrow(/permission denied/);
  await expect(as('anon',()=>get())).rejects.toThrow(/permission denied/);
  await expect(as('authenticated',()=>set('weekly-meals',false),cashier)).rejects.toThrow(/forbidden/);
  await expect(as('authenticated',()=>set('weekly-meals',false,null,other),owner)).rejects.toThrow(/forbidden/);
  await expect(as('authenticated',()=>get(other),owner)).rejects.toThrow(/forbidden/);
});

it('pausa exclusivamente una campaña sin modificar precios, el 10% ni la otra campaña',async()=>{
  const before=await menu();
  const r=await as('authenticated',()=>set('weekly-meals',false));
  expect(r.enabled).toBe(false);
  expect(r.revision).toBeTruthy();
  const after=await menu();
  expect(after.promotions.campaigns).toMatchObject([{id:'weekly-meals',enabled:false},{id:'central-tables',enabled:true}]);
  expect(after.products).toEqual(before.products);
  expect(after.payments).toEqual(before.payments);
  expect(after.site).toEqual(before.site);
  expect(await menu(other)).toEqual(initial);
  expect((await as('authenticated',()=>get())).campaigns[0].enabled).toBe(false);
  expect((await as('authenticated',()=>get(),cashier)).campaigns[0].enabled).toBe(false);
});

it('reintentos idempotentes, colisión entre equipos y posterior reactivación',async()=>{
  const a=await as('authenticated',()=>get());
  const rev=a.campaigns[0].revision;
  const repeated=await as('authenticated',()=>set('weekly-meals',false));
  expect(repeated.revision).toBe(rev);
  expect(repeated.unchanged).toBe(true);
  await expect(as('authenticated',()=>set('weekly-meals',true))).rejects.toThrow(/promotion_state_conflict/);
  const b=await as('authenticated',()=>set('weekly-meals',true,rev));
  expect(b.enabled).toBe(true);
  await expect(as('authenticated',()=>set('weekly-meals',false,rev))).rejects.toThrow(/promotion_state_conflict/);
});

it('una publicación antigua no revierte la pausa y rechaza campañas inexistentes',async()=>{
  const latest=(await as('authenticated',()=>get())).campaigns[0];
  await as('authenticated',()=>set('weekly-meals',false,latest.revision));
  await expect(as('authenticated',()=>set('unknown',true))).rejects.toThrow(/campaign_not_published/);
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,initial]);
  const after=await menu();
  expect(after.promotions.campaigns.map(c=>c.enabled)).toEqual([false,true]);
});

it('no habilita promociones si el motor global todavía no está publicado',async()=>{
  await db.query('update public.menus set json=$2 where store_id=$1',[sid,{...initial,promotions:{enabled:false,campaigns:initial.promotions.campaigns}}]);
  await expect(as('authenticated',()=>set('central-tables',false))).rejects.toThrow(/promotions_not_published/);
});
