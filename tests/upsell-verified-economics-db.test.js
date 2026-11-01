import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
let db,storeId,projectId;
const owner='00000000-0000-4000-8000-000000000001';
const menu={config:{enabled:true,showPrices:true},promotions:{enabled:false,upsells:[]},
 products:[{id:'fatay',price:5850}]};
async function runAs(role,fn){
 await db.exec('reset role;set role '+role);
 try{return await fn();}finally{await db.exec('reset role');}
}
const query=()=>db.query('select public.sahten_upsell_verified_costs($1,$2) as payload',[storeId,'mostrador'])
 .then(x=>x.rows[0].payload);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(read('tests/fixtures/supabase-prelude.sql'));
 await db.exec('create role service_role nologin;grant usage on schema public to service_role;');
 await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema if not exists sahten_catalog_private;');
 await db.query("insert into auth.users(id,email) values($1,'owner@test.invalid')",[owner]);
 projectId=(await db.query("select public.create_project('Local','{}','{}') as id")).rows[0].id;
 storeId=(await db.query("insert into public.stores(slug,name,owner,project_id) values('upsell-economics','Local',$1,$2) returning id",
 [owner,projectId])).rows[0].id;
 await db.query('insert into public.menus(store_id,json) values($1,$2)',[storeId,menu]);
 await db.exec('grant select on public.projects,public.stores,public.menus to service_role;');
 await db.exec(read('supabase/migrations/20261102001500_upsell_verified_economics.sql'));
},60000);
afterAll(async()=>db?.close());
it('prohíbe consultar costos comerciales privados desde anon y autenticado',async()=>{
 for(const role of ['anon','authenticated'])
  await expect(runAs(role,query)).rejects.toThrow(/permission denied/);
});
it('motor OFF devuelve NULL aunque haya menú, sin revelar estructura financiera',async()=>{
 expect(await runAs('service_role',query)).toBeNull();
});
it('sin aprobación financiera el motor ON nunca devuelve costos utilizables para upsell',async()=>{
 await db.query('update public.menus set json=$2 where store_id=$1',
 [storeId,{...menu,promotions:{enabled:true,upsells:[]}}]);
 await db.query("update public.projects set data=data || '{"promotions":{"enabled":true}}'::jsonb where id=$1",[projectId]);
 const result=await runAs('service_role',query);
 expect(result).toMatchObject({verified:true,trustedOrderCosts:{verified:false}});
 expect(result.trustedPaymentFeePercent).toBeNull();
});
