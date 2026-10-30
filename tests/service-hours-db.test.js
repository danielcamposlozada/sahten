import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {sahtenOpeningHours,sahtenDeliveryHours} from '../src/delivery/preset.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000001',admin='00000000-0000-4000-8000-000000000002',cashier='00000000-0000-4000-8000-000000000003',outsider='00000000-0000-4000-8000-000000000004';
let db,sid,other,pid;
const migration=read('supabase/migrations/20261030010000_store_service_hours.sql');
async function as(role,fn,user=owner){await db.exec(`reset role;select set_config('request.jwt.claims','${role==='service_role'?' {"role":"service_role"}':''}',false);select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}}
const set=(kind,h,revision=null,store=sid)=>db.query('select public.set_store_service_hours($1,$2,$3,$4) result',[store,kind,h,revision]).then(r=>r.rows[0].result);
const get=(store=sid)=>db.query('select public.get_store_service_hours($1) result',[store]).then(r=>r.rows[0].result);
const menu=(store=sid)=>db.query('select json from public.menus where store_id=$1',[store]).then(r=>r.rows[0].json);
const closed=()=>({...sahtenOpeningHours(),weekly:Array.from({length:7},()=>[])});
const dbOpen=(h,stamp)=>db.query('select sahten_catalog_private.service_hours_open($1,$2) open',[h,stamp]).then(r=>r.rows[0].open);
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec('create role service_role nologin bypassrls');await db.exec(read('supabase/schema.sql'));
 await db.query("insert into auth.users(id,email)values($1,'owner@test.invalid'),($2,'admin@test.invalid'),($3,'cashier@test.invalid'),($4,'outsider@test.invalid')",[owner,admin,cashier,outsider]);
 pid=(await as('authenticated',()=>db.query("select public.create_project('Local','{}','{}') id"))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role)values($1,$2,'admin'),($1,$3,'cajero')",[pid,admin,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id)values('hours','Local',$1,$2)returning id",[owner,pid])).rows[0].id;
 other=(await db.query("insert into public.stores(slug,name,owner)values('other-hours','Otro',$1)returning id",[outsider])).rows[0].id;
 await db.query('insert into public.menus(store_id,json)values($1,$2),($3,$2)',[sid,{store:{name:'Local'},products:[{id:'p',price:20000}],delivery:{enabled:true,deliveryV2:{active:false,hours:sahtenDeliveryHours()},zones:[{cost:1500}]},payments:{enabled:true}},other]);
 await db.exec(read('supabase/payments.sql'));
 await db.exec('grant usage on schema auth,public to service_role;grant all on public.orders to service_role;');
 await db.exec(read('supabase/migrations/20261026_menu_availability.sql'));
 await db.exec(migration);
},60000);
afterAll(async()=>db?.close());
it('migración idempotente y estados privados inaccesibles para anon/cajero',async()=>{
 await db.exec(migration);
 for(const role of ['anon','authenticated'])await expect(as(role,()=>db.query('select * from sahten_catalog_private.store_service_hours'))).rejects.toThrow(/permission denied/);
 await expect(as('anon',()=>get())).rejects.toThrow(/permission denied/);
 await expect(as('authenticated',()=>set('opening',sahtenOpeningHours()),cashier)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>get(),outsider)).rejects.toThrow(/forbidden/);
 await expect(as('authenticated',()=>set('opening',sahtenOpeningHours(),null,other))).rejects.toThrow(/forbidden/);
});
it('dueño y admin guardan solo un calendario; las revisiones evitan sobrescribir otros equipos y tiendas',async()=>{
 const before=await menu(),otherBefore=await menu(other);
 const opening=await as('authenticated',()=>set('opening',sahtenOpeningHours()));
 expect(opening.revision).toMatch(/^[0-9a-f-]{36}$/);
 const changed=await menu();expect(changed).toEqual({...before,store:{...before.store,openingHours:sahtenOpeningHours()}});expect(await menu(other)).toEqual(otherBefore);
 const delivery=await as('authenticated',()=>set('delivery',sahtenDeliveryHours()),admin);
 expect(await as('authenticated',()=>get(),cashier)).toEqual({opening,delivery});
 expect((await menu()).delivery.hours).toEqual(sahtenDeliveryHours());
 expect((await menu()).delivery.deliveryV2.hours).toEqual(sahtenDeliveryHours());
 await expect(as('authenticated',()=>set('opening',closed()))).rejects.toThrow(/service_hours_conflict/);
 const next=await as('authenticated',()=>set('opening',closed(),opening.revision));expect(next.revision).not.toBe(opening.revision);
 await expect(as('authenticated',()=>set('opening',sahtenOpeningHours(),opening.revision))).rejects.toThrow(/service_hours_conflict/);
});
it('rechaza calendarios corruptos y claves ajenas sin mutar datos',async()=>{
 const before=await menu(),state=await as('authenticated',()=>get());
 const invalid=[{}, {enabled:false}, {...sahtenOpeningHours(),timeZone:''}, {...sahtenOpeningHours(),timeZone:'Mars/Test'}, {...sahtenOpeningHours(),weekly:[]}, {...sahtenOpeningHours(),extra:1}, {...sahtenOpeningHours(),exceptions:[{date:'2026-02-30',periods:[]}]}, {...sahtenOpeningHours(),weekly:[[{start:'12:00',end:'12:00'}],[],[],[],[],[],[]]}];
 for(const h of invalid)await expect(as('authenticated',()=>set('opening',h,state.opening.revision))).rejects.toThrow(/invalid_service_hours/);
 await expect(as('authenticated',()=>set('unknown',sahtenOpeningHours()))).rejects.toThrow(/invalid_service_hours/);
 expect(await menu()).toEqual(before);
});
it('publicar desde una app vieja conserva los dos horarios confirmados, sin alterar otros campos nuevos',async()=>{
 const h=await as('authenticated',()=>get()),old={store:{name:'Nombre nuevo'},products:[{id:'p',price:23000}],delivery:{deliveryV2:{active:false,hours:null},enabled:false}};
 await db.query('update public.menus set json=$2 where store_id=$1',[sid,old]);
 expect(await menu()).toEqual({...old,store:{...old.store,openingHours:h.opening.hours},delivery:{...old.delivery,hours:h.delivery.hours,deliveryV2:{...old.delivery.deliveryV2,hours:h.delivery.hours}}});
});
it('horas independientes, cierre exacto, turnos nocturnos y feriados coinciden con el motor cliente',async()=>{
 const opening=sahtenOpeningHours(),delivery=sahtenDeliveryHours();
 for(const [stamp,a,d] of [['2026-10-30T14:59:59Z',false,false],['2026-10-30T15:00:00Z',true,false],['2026-10-30T18:29:59Z',true,false],['2026-10-30T18:30:00Z',false,false],['2026-10-30T21:00:00Z',true,true],['2026-10-31T02:00:00Z',false,false]]){expect(await dbOpen(opening,stamp)).toBe(a);expect(await dbOpen(delivery,stamp)).toBe(d);}
 const overnight={...delivery,weekly:[[],[],[],[],[],[{start:'22:00',end:'02:00'}],[]]};expect(await dbOpen(overnight,'2026-10-31T04:00:00Z')).toBe(true);expect(await dbOpen({...overnight,exceptions:[{date:'2026-10-31',periods:[]}]},'2026-10-31T04:00:00Z')).toBe(false);
 expect(await dbOpen({...opening,enabled:false},'2026-11-01T12:00:00Z')).toBe(true);expect(await dbOpen(null,'2026-11-01T12:00:00Z')).toBe(true);
});
it('el servidor cierra nuevas órdenes y checkouts; una acreditación ya iniciada y las ventas históricas continúan',async()=>{
 let h=await as('authenticated',()=>get());await as('authenticated',()=>set('delivery',closed(),h.delivery.revision));
 for(const source of ['pickup','delivery'])await expect(as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{source,items:[],total:20000}]))).rejects.toThrow(source==='pickup'?/pickup_closed/:/delivery_hours_closed/);
 const account=(await db.query("insert into sahten_private.mp_accounts(store_id,account_id,account_label,mode,site_url,enabled,secret_id)values($1,'test','Test','test','https://example.test',true,gen_random_uuid())returning id",[sid])).rows[0].id;
 await expect(db.query("insert into sahten_private.mp_checkouts(store_id,account_id,request_id,proof_hash,quote_hash,order_payload)values($1,$2,gen_random_uuid(),'a','b',$3)",[sid,account,{source:'pickup'}])).rejects.toThrow(/pickup_closed/);
 const order=(await as('service_role',()=>db.query("insert into public.orders(store_id,payload,payment_provider)values($1,$2,'mercadopago')returning id",[sid,{source:'pickup',items:[],total:20000}]))).rows[0].id;
 await as('authenticated',()=>db.query("update public.orders set status='listo' where id=$1",[order]));expect((await db.query('select status from public.orders where id=$1',[order])).rows[0].status).toBe('listo');
 h=await as('authenticated',()=>get());await as('authenticated',()=>set('opening',{...closed(),enabled:false},h.opening.revision));await as('anon',()=>db.query('insert into public.orders(store_id,payload)values($1,$2)',[sid,{source:'pickup',items:[],total:20000}]));
});
