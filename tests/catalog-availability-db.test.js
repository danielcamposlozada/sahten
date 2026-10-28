import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',cashier='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';let db,sid,pid;
const migration=read('supabase/migrations/20261026_menu_availability.sql');
const deliveryState=read('supabase/migrations/20261027010000_delivery_service_state.sql');
const publishedGuard=read('supabase/migrations/20261027002342_published_pause_guard.sql');
async function as(role,fn,uid=owner){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?uid:''}',false);select set_config('request.jwt.claims','${JSON.stringify({role})}',false);set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}}
const menu=()=>db.query('select json from public.menus where store_id=$1',[sid]).then(r=>r.rows[0].json);
const visibility=(id,visible)=>db.query('select public.set_menu_product_visibility($1,$2,$3) as r',[sid,id,visible]).then(r=>r.rows[0].r);
const pause=(id,paused,until=null)=>db.query('select public.set_product_sales_availability($1,$2,$3,$4) as r',[sid,id,paused,until]).then(r=>r.rows[0].r);
beforeAll(async()=>{db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls;');await db.exec(read('supabase/schema.sql'));
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid'),($2,'cashier@test.invalid'),($3,'other@test.invalid')",[owner,cashier,outsider]);
 pid=(await as('authenticated',()=>db.query("select public.create_project('Prueba','{}','{}') as id"))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'cajero')",[pid,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id)values('catalog-test','Prueba',$1,$2)returning id",[owner,pid])).rows[0].id;
 await db.query('insert into public.menus(store_id,json)values($1,$2)',[sid,{config:{enabled:true,categories:['Platos']},products:[{id:'p',name:'Plato',category:'Platos',price:12000},{id:'q',name:'Segundo',price:5000}],site:{title:'Conservar'},delivery:{unchanged:true},payments:{methods:{efectivo:true}}}]);await db.exec(migration);await db.exec(publishedGuard);await db.exec('alter table public.orders add column if not exists payment_provider text');await db.exec(deliveryState);
},60000);afterAll(()=>db?.close());
it('migración idempotente, tabla privada, límites entre roles y negocios',async()=>{
 await db.exec(migration);await db.exec(publishedGuard);await db.exec(publishedGuard);
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
it('REST respeta una pausa publicada desde una copia importada antes de conectar el proyecto',async()=>{
 const m=await menu();m.products.push({id:'imported-paused',name:'Importado',price:1234,salesAvailability:{paused:true,resumeAt:null}});
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,m]);
 const insert=()=>as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{items:[{productId:'imported-paused',qty:1}],total:1234}]));
 await expect(insert()).rejects.toThrow(/product_paused/);
 const published=await menu(),p=published.products.find(p=>p.id==='imported-paused');p.salesAvailability.resumeAt='not-a-date';
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,published]);await expect(insert()).rejects.toThrow(/product_paused/);
 p.salesAvailability.resumeAt=new Date(Date.now()-1000).toISOString();await db.query('update public.menus set json=$2 where store_id=$1',[sid,published]);await insert();
 await as('authenticated',()=>pause('imported-paused',false));await insert();
});

it('pausa general privada por negocio y roles, sin tocar precios, tarifas ni pedidos existentes',async()=>{
 await db.exec(deliveryState);await db.exec(deliveryState);
 const set=enabled=>db.query('select public.set_delivery_service_state($1,$2)',[sid,enabled]);
 const before=await menu();
 for(const role of ['anon','authenticated'])await expect(as(role,()=>db.query('select * from sahten_catalog_private.delivery_service_state'))).rejects.toThrow(/permission denied/);
 await expect(as('anon',()=>set(false))).rejects.toThrow(/permission denied/);
 await expect(as('authenticated',()=>set(false),cashier)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>set(false),outsider)).rejects.toThrow(/forbidden/);
 await as('authenticated',()=>set(false));
 const paused=await menu();expect(paused).toEqual({...before,delivery:{...before.delivery,enabled:false}});
 const read=await as('authenticated',()=>db.query('select public.get_delivery_service_state($1) as r',[sid]),cashier);expect(read.rows[0].r).toEqual({enabled:false});
 await expect(as('authenticated',()=>db.query('select public.get_delivery_service_state($1)',[sid]),outsider)).rejects.toThrow(/forbidden/);
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,{...paused,delivery:{...paused.delivery,enabled:true}}]);expect((await menu()).delivery.enabled).toBe(false);
 const payload={source:'delivery',items:[{productId:'q',qty:1}],total:5000};
 await expect(as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,payload]))).rejects.toThrow(/delivery_service_paused/);
 // Falsificar el proveedor desde el browser no permite eludir el cierre.
 await expect(as('anon',()=>db.query("insert into public.orders(store_id,payload,payment_provider)values($1,$2,'mercadopago')",[sid,payload]))).rejects.toThrow(/delivery_service_paused|permission denied/);
 await as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{...payload,source:'pickup'}]));
 await as('authenticated',()=>set(true));expect((await menu()).delivery.enabled).toBe(true);
 await as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,payload]));
});

it('zonas en vivo: permisos, aislamiento de booleanos y protección ante catálogos viejos sin cambiar revisión',async()=>{
 const sql=read('supabase/migrations/20261028233706_delivery_zone_operations.sql');await db.exec(sql);await db.exec(sql);
 const m=await menu();m.delivery.deliveryV2={active:true,revision:'r-zones',zones:[{id:'z1',name:'Zona de prueba',enabled:true,requiresAuthorization:true,baseCost:1500,minOrder:17000},{id:'z2',enabled:false,requiresAuthorization:false,baseCost:3000}],hours:{enabled:true}};
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,m]);
 const set=(id,flag,value)=>db.query('select public.set_delivery_zone_state($1,$2,$3,$4)',[sid,id,flag,value]);
 for(const role of ['anon','authenticated'])await expect(as(role,()=>db.query('select * from sahten_catalog_private.delivery_zone_states'))).rejects.toThrow(/permission denied/);
 await expect(as('anon',()=>set('z1','enabled',false))).rejects.toThrow(/permission denied/);
 await expect(as('authenticated',()=>set('z1','requiresAuthorization',false),cashier)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>set('z1','requiresAuthorization',false),outsider)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>set('missing','enabled',false))).rejects.toThrow(/zone_not_published/);
 await expect(as('authenticated',()=>set('z1','baseCost',false))).rejects.toThrow(/invalid_zone_state/);
 await expect(as('authenticated',()=>set('z1','enabled',null))).rejects.toThrow(/invalid_zone_state/);
 await as('authenticated',()=>set('z1','requiresAuthorization',false));
 const expected=structuredClone(m);expected.delivery.deliveryV2.zones[0].requiresAuthorization=false;expect(await menu()).toEqual(expected);
 await as('authenticated',()=>set('z1','enabled',false));expected.delivery.deliveryV2.zones[0].enabled=false;expect(await menu()).toEqual(expected);
 // Una publicación económica legítima conserva sus importes nuevos y los estados operativos vigentes.
 m.delivery.deliveryV2.zones[0].baseCost=1990;await db.query('update public.menus set json=$2 where store_id=$1',[sid,m]);
 const actual=await menu();expect(actual.delivery.deliveryV2.zones[0]).toMatchObject({enabled:false,requiresAuthorization:false,baseCost:1990});expect(actual.delivery.deliveryV2.revision).toBe('r-zones');
 const states=await as('authenticated',()=>db.query('select public.get_delivery_zone_states($1) as r',[sid]),cashier);
 expect(states.rows[0].r).toEqual({revision:'r-zones',zones:[{id:'z1',enabled:false,requiresAuthorization:false},{id:'z2',enabled:false,requiresAuthorization:false}]});expect(JSON.stringify(states.rows[0].r)).not.toMatch(/baseCost|prices|minOrder|hours/);
 await expect(as('anon',()=>db.query('select public.get_delivery_zone_states($1)',[sid]))).rejects.toThrow(/permission denied/);
 await expect(as('authenticated',()=>db.query('select public.get_delivery_zone_states($1)',[sid]),outsider)).rejects.toThrow(/forbidden/);
 await db.query("update public.project_members set role='admin' where project_id=$1 and user_id=$2",[pid,cashier]);await as('authenticated',()=>set('z1','enabled',true),cashier);expect((await menu()).delivery.deliveryV2.zones[0].enabled).toBe(true);
});
