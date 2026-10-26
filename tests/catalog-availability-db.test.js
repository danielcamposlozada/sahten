import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',cashier='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';let db,sid,pid;
const migration=read('supabase/migrations/20261026_menu_availability.sql');
async function as(role,fn,uid=owner){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?uid:''}',false);select set_config('request.jwt.claims','${JSON.stringify({role})}',false);set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}}
const menu=()=>db.query('select json from public.menus where store_id=$1',[sid]).then(r=>r.rows[0].json);
const visibility=(id,visible)=>db.query('select public.set_menu_product_visibility($1,$2,$3) as r',[sid,id,visible]).then(r=>r.rows[0].r);
const pause=(id,paused,until=null)=>db.query('select public.set_product_sales_availability($1,$2,$3,$4) as r',[sid,id,paused,until]).then(r=>r.rows[0].r);
beforeAll(async()=>{db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls;');await db.exec(read('supabase/schema.sql'));
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid'),($2,'cashier@test.invalid'),($3,'other@test.invalid')",[owner,cashier,outsider]);
 pid=(await as('authenticated',()=>db.query("select public.create_project('Prueba','{}','{}') as id"))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'cajero')",[pid,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id)values('catalog-test','Prueba',$1,$2)returning id",[owner,pid])).rows[0].id;
 await db.query('insert into public.menus(store_id,json)values($1,$2)',[sid,{config:{enabled:true,categories:['Platos']},products:[{id:'p',name:'Plato',category:'Platos',price:12000},{id:'q',name:'Segundo',price:5000}],site:{title:'Conservar'},delivery:{unchanged:true},payments:{methods:{efectivo:true}}}]);await db.exec(migration);
},60000);afterAll(()=>db?.close());
it('migración idempotente, tabla privada, límites entre roles y negocios',async()=>{
 await db.exec(migration);
 for(const role of ['anon','authenticated'])await expect(as(role,()=>db.query('select * from sahten_catalog_private.visibility'))).rejects.toThrow(/permission denied/);
 await expect(as('anon',()=>visibility('p',false))).rejects.toThrow(/permission denied/);
 await expect(as('authenticated',()=>pause('p',true),cashier)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>visibility('p',false),outsider)).rejects.toThrow(/forbidden/);
});
it('ocultar y volver a mostrar conserva el último precio publicado y todos los otros datos',async()=>{
 const before=await menu();await as('authenticated',()=>visibility('p',false));expect((await menu()).products.map(p=>p.id)).toEqual(['q']);await as('authenticated',()=>visibility('p',true));expect(await menu()).toEqual(before);
 await expect(as('authenticated',()=>visibility('never-published',true))).rejects.toThrow(/product_not_published/);
 expect(await as('authenticated',()=>visibility('never-published',false))).toMatchObject({published:false});
});
it('pausar conserva el producto gris y publicar un catálogo nuevo no anula la pausa',async()=>{
 const until=new Date(Date.now()+3600000).toISOString();await as('authenticated',()=>pause('p',true,until));let m=await menu();expect(m.products[0]).toMatchObject({id:'p',price:12000,salesAvailability:{paused:true}});
 const changed={...m,products:m.products.map(p=>({...p,price:p.id==='p'?15000:p.price,salesAvailability:{paused:false}}))};await db.query('update public.menus set json=$2 where store_id=$1',[sid,changed]);m=await menu();expect(m.products[0]).toMatchObject({price:15000,salesAvailability:{paused:true}});
 await as('authenticated',()=>visibility('p',false));await as('authenticated',()=>visibility('p',true));expect((await menu()).products[0].salesAvailability.paused).toBe(true);
});
it('REST no puede crear una venta de un producto pausado; el vencimiento funciona sin una tarea ni app abierta',async()=>{
 await expect(as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{items:[{productId:'p',qty:1}],total:15000}]))).rejects.toThrow(/product_paused/);
 await db.query("update sahten_catalog_private.sales_availability set resume_at=now()-interval '1 second' where store_id=$1 and product_id='p'",[sid]);
 await as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{items:[{productId:'p',qty:1}],total:15000}]));
 const r=await as('authenticated',()=>db.query('select public.get_product_sales_availability($1) as r',[sid]),cashier);expect(r.rows[0].r.sales[0].id).toBe('p');expect(JSON.stringify(r.rows[0].r)).not.toMatch(/cost|customers|price/);
});
it('una publicación antigua no vuelve a mostrar un producto oculto; la confirmada nueva sí puede hacerlo',async()=>{
 await as('authenticated',()=>visibility('p',false));const m=await menu();const next={...m,products:[{id:'p',name:'Plato',category:'Platos',price:18000},...m.products]};await db.query('update public.menus set json=$2 where store_id=$1',[sid,next]);expect((await menu()).products.some(p=>p.id==='p')).toBe(false);
 next.config.productVisibility={p:true,q:true};await db.query('update public.menus set json=$2 where store_id=$1',[sid,next]);expect((await menu()).products.find(p=>p.id==='p').price).toBe(18000);expect((await menu()).config.productVisibility).toBeUndefined();
});
