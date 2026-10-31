import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {deliveryConfiguration} from '../src/core/delivery-configuration.js';
import {sahtenDeliveryPolicy,sahtenOpeningHours} from '../src/delivery/preset.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',cashier='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';
const req=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migration=read('supabase/migrations/20261030232047_delivery_configuration_live.sql');
let db,sid,other,pid,initial;
async function as(role,fn,user=owner){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}}
const get=(store=sid)=>db.query('select public.get_store_delivery_configuration($1) result',[store]).then(r=>r.rows[0].result);
const save=(c,base,id,parent=null,store=sid)=>db.query('select public.set_store_delivery_configuration($1,$2,$3,$4,$5) result',[store,c,base,id,parent]).then(r=>r.rows[0].result);
const menu=store=>db.query('select json from public.menus where store_id=$1',[store||sid]).then(r=>r.rows[0].json);
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec(read('supabase/schema.sql'));
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid'),($2,'cashier@test.invalid'),($3,'outsider@test.invalid')",[owner,cashier,outsider]);
 pid=(await as('authenticated',()=>db.query("select public.create_project('Local','{}','{}') id"))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'cajero')",[pid,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id)values('config','Local',$1,$2)returning id",[owner,pid])).rows[0].id;
 other=(await db.query("insert into public.stores(slug,name,owner)values('other-config','Otro',$1)returning id",[outsider])).rows[0].id;
 const p={...sahtenDeliveryPolicy(),active:true};initial={store:{name:'Local',address:p.center.address,lat:p.center.lat,lng:p.center.lng,openingHours:sahtenOpeningHours()},products:[{id:'p',price:20000}],payments:{methods:{efectivo:true},benefit:{percent:10}},site:{title:'Sitio'},delivery:{enabled:true,lat:p.center.lat,lng:p.center.lng,zones:[],deliveryV2:p,hours:p.hours}};
 await db.query('insert into public.menus(store_id,json)values($1,$2),($3,$2)',[sid,initial,other]);
 await db.exec(read('supabase/migrations/20261026_menu_availability.sql'));
 await db.exec(read('supabase/migrations/20261027010000_delivery_service_state.sql'));
 await db.exec(read('supabase/migrations/20261028233706_delivery_zone_operations.sql'));
 await db.exec(read('supabase/migrations/20261030010000_store_service_hours.sql'));
 await db.exec(migration);
},60000);
afterAll(async()=>db?.close());
it('es idempotente al instalar y no cambia los valores comerciales existentes',async()=>{
 await db.exec(migration);expect(await menu()).toEqual(initial);
 for(const role of ['anon','authenticated'])await expect(as(role,()=>db.query('select * from sahten_catalog_private.delivery_configurations'))).rejects.toThrow(/permission denied/);
 await expect(as('anon',()=>get())).rejects.toThrow(/permission denied/);
 const c=deliveryConfiguration({deliveryV2:sahtenDeliveryPolicy()});
 await expect(as('authenticated',()=>save(c,null,req(10)),cashier)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>get(),outsider)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>save(c,null,req(10),null,other))).rejects.toThrow(/forbidden/);
});
it('guarda mínimos, tarifas, cobertura y beneficios sin publicar productos, pagos, sitio ni horarios',async()=>{
 const before=await menu(),otherBefore=await menu(other),c=deliveryConfiguration({...before.delivery,...before.store});c.policy.zones[0].minOrder=12000;c.policy.zones[0].baseCost=1800;c.policy.zones[0].benefits=[{threshold:22000,cost:0}];
 const row=await as('authenticated',()=>save(c,null,req(11)));expect(row.revision).toBe(req(11));
 const after=await menu();expect(after.delivery.configurationRevision).toBe(req(11));expect(after.delivery.deliveryV2).toMatchObject({revision:req(11),zones:[expect.objectContaining({minOrder:12000,baseCost:1800,benefits:[{threshold:22000,cost:0}]}),...c.policy.zones.slice(1)]});
 expect(after.store).toEqual(before.store);expect(after.products).toEqual(before.products);expect(after.payments).toEqual(before.payments);expect(after.site).toEqual(before.site);expect(after.delivery.hours).toEqual(before.delivery.hours);expect(await menu(other)).toEqual(otherBefore);
 expect(await as('authenticated',()=>get(),cashier)).toEqual(row);
 expect((await db.query('select count(*)::int n from sahten_catalog_private.delivery_configuration_history where store_id=$1',[sid])).rows[0].n).toBe(1);
});
it('reintentos son idempotentes; un guardado posterior propio puede seguir al anterior sin permitir pisar otro equipo',async()=>{
 const first=await as('authenticated',()=>get()),c=first.configuration;
 await as('authenticated',()=>save(c,req(11),req(12)));
 expect((await as('authenticated',()=>save(c,req(11),req(12)))).revision).toBe(req(12));
 const next=structuredClone(c);next.policy.zones[0].minOrder=13000;
 expect((await as('authenticated',()=>save(next,req(11),req(13),req(12)))).revision).toBe(req(13));
 await expect(as('authenticated',()=>save(c,req(11),req(14),req(12)))).rejects.toThrow(/delivery_configuration_conflict/);
 await expect(as('authenticated',()=>save(c,req(13),req(13)))).rejects.toThrow(/delivery_configuration_conflict/);
});
it('rechaza claves ajenas, tarifas negativas, mínimos nulos y contornos inválidos sin mutar el menú',async()=>{
 const row=await as('authenticated',()=>get()),before=await menu(),invalid=[{}, {...row.configuration,products:[]},{...row.configuration,legacy:{...row.configuration.legacy,deliveryMinOrder:-1}}];
 for(const change of [z=>z.minOrder=null,z=>z.type=null,z=>z.baseCost=-10,z=>z.benefits=[{threshold:0,cost:0}],z=>{z.type='polygon';z.points=[[0,0]];}]){const c=structuredClone(row.configuration);change(c.policy.zones[0]);invalid.push(c);}
 for(const c of invalid)await expect(as('authenticated',()=>save(c,row.revision,req(15)))).rejects.toThrow(/invalid_delivery_configuration/);
 expect(await menu()).toEqual(before);
});
it('una publicación vieja no revierte tarifas y mínimos; estados y horarios en vivo siguen independientes',async()=>{
 await as('authenticated',()=>db.query('select public.set_delivery_zone_state($1,$2,$3,$4)',[sid,'delivery-1','enabled',false]));
 const h={...sahtenOpeningHours(),enabled:false};await as('authenticated',()=>db.query('select public.set_store_service_hours($1,$2,$3,$4)',[sid,'delivery',h,null]));
 const before=await menu(),old=structuredClone(initial);old.products[0].price=25000;old.payments.methods.transferencia=true;
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,old]);const after=await menu();
 expect(after.delivery.deliveryV2.zones[0]).toMatchObject({enabled:false,minOrder:13000,baseCost:1800});expect(after.delivery.deliveryV2.hours).toEqual(h);expect(after.delivery.configurationRevision).toBe(before.delivery.configurationRevision);
 expect(after.products[0].price).toBe(25000);expect(after.payments.methods.transferencia).toBe(true);
});
it('también aplica configuración clásica sin exigir subir archivos ni crear un motor geográfico',async()=>{
 const row=await as('authenticated',()=>get()),c=structuredClone(row.configuration);c.policy=null;c.legacy={deliveryMinOrder:10000,freeShippingMin:30000,costPerKm:0,zones:[{id:'z',name:'Zona',type:'circle',radiusKm:3,points:[],baseCost:2000}]};
 await as('authenticated',()=>save(c,row.revision,req(16)));const m=await menu();expect(m.delivery.deliveryV2).toBeUndefined();expect(m.delivery.deliveryMinOrder).toBe(10000);expect(m.delivery.zones[0].baseCost).toBe(2000);expect(m.delivery.hours.enabled).toBe(false);
});
it('un administrador del proyecto también puede guardar; una revisión histórica no se reutiliza',async()=>{
 const admin=req(99);await db.query("insert into auth.users(id,email)values($1,'admin@test.invalid')",[admin]);await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'admin')",[pid,admin]);
 const row=await as('authenticated',()=>get(),admin),c=structuredClone(row.configuration);c.legacy.deliveryMinOrder=11000;
 expect((await as('authenticated',()=>save(c,row.revision,req(17)),admin)).revision).toBe(req(17));
 await expect(as('authenticated',()=>save(c,req(17),req(11)),admin)).rejects.toThrow(/delivery_configuration_conflict/);
 const bad=structuredClone(c);bad.origin.lat=null;bad.origin.lng=-58;await expect(as('authenticated',()=>save(bad,req(17),req(18)),admin)).rejects.toThrow(/invalid_delivery_configuration/);
});
