import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',cashier='00000000-0000-4000-8000-000000000002';let db,sid,pid,other;
async function as(role,fn,user=owner){await db.exec("reset role;select set_config('request.jwt.claims','',false);select set_config('request.jwt.claim.sub','"+(role==='authenticated'?user:'')+"',false);set role "+role);try{return await fn();}finally{await db.exec('reset role');}}
const rpc=(action,args)=>db.query('select public.sahten_delivery_backend($1,$2) result',[action,args]).then(r=>r.rows[0].result);
const migration=read('supabase/migrations/20261024_delivery.sql')+'\n'+read('supabase/migrations/20261025015321_delivery_function_search_paths.sql');
const old={id:'legacy',source:'delivery',items:[],shipping:100,subtotal:100,total:200,discount:0};
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls;');await db.exec(read('supabase/schema.sql'));
 await db.exec(`create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;create function vault.create_secret(s text) returns uuid language plpgsql as $$declare v uuid;begin insert into vault.secrets(secret)values(s)returning id into v;return v;end$$;`);
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid'),($2,'cashier@test.invalid')",[owner,cashier]);
 pid=(await as('authenticated',()=>db.query('select public.create_project($1,$2,$3) id',['Local',{sales:{orders:[old]}},{}]))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'cajero')",[pid,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id)values('test-delivery','Prueba',$1,$2)returning id",[owner,pid])).rows[0].id;
 other=(await db.query("insert into public.stores(slug,name,owner)values('other-delivery','Otro',$1)returning id",[owner])).rows[0].id;
 await db.query('insert into public.menus(store_id,json)values($1,$2),($3,$4)',[sid,{delivery:{deliveryV2:{active:true}}},other,{delivery:{}}]);
 await db.exec(migration);
},60000);
afterAll(async()=>db?.close());
it('migración idempotente y secretos inaccesibles desde anon/authenticated',async()=>{
 await db.exec(migration);
 for(const role of ['anon','authenticated']){await expect(as(role,()=>rpc('provider',{store_id:sid}))).rejects.toThrow(/permission denied/);await expect(as(role,()=>db.query('select * from sahten_delivery_private.quotes'))).rejects.toThrow(/permission denied/);}
 const result=await as('service_role',()=>rpc('save_provider',{store_id:sid,key:'fake-private-test-key'}));expect(result).toEqual({configured:true});expect(JSON.stringify(result)).not.toContain('fake-private');
 expect((await as('service_role',()=>rpc('provider',{store_id:sid}))).key).toBe('fake-private-test-key');
 expect(await as('service_role',()=>rpc('provider',{store_id:other}))).toBeNull();
});
it('no permite esquivar el servidor en menús nuevos y mantiene compatibilidad con los anteriores',async()=>{
 await expect(as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{items:[],total:1}]))).rejects.toThrow(/server_validation_required/);
 await as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[other,{items:[],total:1}]));
});
it('protege las aprobaciones, vincula negocio y vencimiento y limita el geocodificador global',async()=>{
 const q=await as('service_role',()=>rpc('save_quote',{store_id:sid,payload:{customerName:'Ficticio'},route:{distanceMeters:8200},result:{},revision:'r1'}));
 expect(await as('service_role',()=>rpc('quote',{store_id:other,id:q.id}))).toBeNull();
 await expect(as('authenticated',()=>rpc('authorize',{store_id:sid,id:q.id,actor:owner,reason:'Falso'}))).rejects.toThrow(/permission denied/);
 await as('service_role',()=>rpc('authorize',{store_id:sid,id:q.id,actor:owner,reason:'Validado'}));
 expect((await as('service_role',()=>rpc('quote',{store_id:sid,id:q.id}))).authorization_reason).toBe('Validado');
 await db.query("update sahten_delivery_private.quotes set expires_at=now()-interval '1 minute' where id=$1",[q.id]);expect(await as('service_role',()=>rpc('quote',{store_id:sid,id:q.id}))).toBeNull();
 expect(await as('service_role',()=>rpc('geocode_slot',{}))).toBe(true);expect(await as('service_role',()=>rpc('geocode_slot',{}))).toBe(false);
});
it('crear pedidos es idempotente por negocio y los reintentos no generan otra orden',async()=>{
 const id='00000000-0000-4000-8000-000000000004',args={store_id:sid,request_id:id,payload:{items:[],total:200}};
 const a=await as('service_role',()=>rpc('order',args)),b=await as('service_role',()=>rpc('order',args));expect(a.id).toBe(b.id);await expect(as('service_role',()=>rpc('order',{...args,payload:{...args.payload,total:201}}))).rejects.toThrow(/order_conflict/);expect((await db.query('select count(*)::int n from public.orders where store_id=$1',[sid])).rows[0].n).toBe(1);
});
it('POS rechaza importes y destinos alterados, conserva ventas anteriores y acepta cambios de estado',async()=>{
 const o={id:'ord_prueba123',source:'delivery',address:'Destino de prueba',lat:-34.5,lng:-58.48,items:[{productId:'p',qty:1,unitPrice:40000,lineTotal:40000}],paymentMethod:'efectivo',subtotal:40000,discount:4000,shipping:1990,total:37990,deliverySnapshot:{version:2,revision:'r1',charged:1990,discount:2000}};
 await expect(as('authenticated',()=>db.query('select public.save_ops($1,$2,null)',[pid,{orders:[old,o]}]),cashier)).rejects.toThrow(/delivery_server_validation_required/);
 const id=(await as('service_role',()=>db.query('select public.validate_delivery_pos_record($1,$2,$3) id',[sid,o.id,o]))).rows[0].id;o.deliveryValidationId=id;
 await as('authenticated',()=>db.query('select public.save_ops($1,$2,null)',[pid,{orders:[old,o]}]),cashier);
 await as('authenticated',()=>db.query('select public.save_ops($1,$2,null)',[pid,{orders:[old,{...o,status:'listo'}]}]),cashier);
 for(const change of [{total:1},{lat:-35},{shipping:0}])await expect(as('authenticated',()=>db.query('select public.save_ops($1,$2,null)',[pid,{orders:[old,{...o,...change}]}]),cashier)).rejects.toThrow(/delivery_server_validation_required/);
 expect((await db.query('select sales from public.project_ops where project_id=$1',[pid])).rows[0].sales.orders[0]).toEqual(old);
});
