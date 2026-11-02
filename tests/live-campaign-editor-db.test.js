import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='00000000-0000-4000-8000-000000000011',cashier='00000000-0000-4000-8000-000000000012';
const initial={products:[{id:'baklava',name:'Baklava',price:7350},{id:'torta',name:'Torta',price:8200}],
  payments:{benefit:{percent:10}},promotions:{enabled:true,paymentPercent:10,ticket:{enabled:true,advertise:true},
   campaigns:[{id:'dessert-12',kind:'public',name:'Postres con 12%',enabled:true,priority:35,
     extraPercent:2,maxUnits:1,channels:['online'],productIds:['baklava','torta'],schedule:null,
     minMarginPct:45,advertising:{enabled:true,message:'Baklava o torta con 12% total',placement:['ticket','cart','checkout']}}]}};
let db,sid,pid;
async function as(role,fn,user=owner){
 await db.exec(`reset role;select set_config('request.jwt.claim.sub','${role==='authenticated'?user:''}',false);set role ${role}`);
 try{return await fn();}finally{await db.exec('reset role');}
}
const get=()=>db.query('select public.get_store_promotion_management($1) result',[sid]).then(x=>x.rows[0].result);
const set=(id,patch,rev)=>db.query('select public.set_store_promotion_campaign_details($1,$2,$3,$4) result',[sid,id,patch,rev]).then(x=>x.rows[0].result);
const ticket=(settings,rev)=>db.query('select public.set_store_promotion_ticket_settings($1,$2,$3) result',[sid,settings,rev]).then(x=>x.rows[0].result);
beforeAll(async()=>{
 db=new PGlite();await db.exec(read('tests/fixtures/supabase-prelude.sql'));await db.exec(read('supabase/schema.sql'));
 await db.exec('create schema if not exists sahten_catalog_private;');
 await db.query("insert into auth.users(id,email) values($1,'liveowner@test.invalid'),($2,'cashier@test.invalid')",[owner,cashier]);
 pid=(await as('authenticated',()=>db.query("select public.create_project('Test','{}','{}') id"))).rows[0].id;
 await db.query("insert into public.project_members(project_id,user_id,role) values($1,$2,'cajero')",[pid,cashier]);
 sid=(await db.query("insert into public.stores(slug,name,owner,project_id) values('liveedit','Sahten',$1,$2) returning id",[owner,pid])).rows[0].id;
 await db.query('insert into public.menus(store_id,json) values($1,$2)',[sid,initial]);
 await db.exec(read('supabase/migrations/20261101073000_promotion_campaign_live_states.sql'));
 await db.exec(read('supabase/migrations/20261102210000_promotion_live_editor_and_ticket_settings.sql'));
},60000);
afterAll(async()=>db?.close());
it('el propietario edita texto y fechas en el menú publicado, sin tocar precios ni pagos',async()=>{
 const a=await as('authenticated',get);
 const rev=a.campaigns[0].revision;
 const patch={name:'Postres 12% todos los días',schedule:{type:'always',until:'2026-12-15'},
   advertising:{message:'Todos los días: 12% en Baklava o Torta',enabled:true,placement:['ticket','cart','checkout']}};
 const result=await as('authenticated',()=>set('dessert-12',patch,rev));
 expect(result.saved).toBe(true);
 const b=await as('authenticated',get);
 expect(b.campaigns[0].name).toBe('Postres 12% todos los días');
 expect(b.campaigns[0].schedule.until).toBe('2026-12-15');
 expect(b.campaigns[0].revision).not.toBe(rev);
 expect((await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json.products).toEqual(initial.products);
 expect((await db.query('select json from public.menus where store_id=$1',[sid])).rows[0].json.payments).toEqual(initial.payments);
 await expect(as('authenticated',()=>set('dessert-12',{name:'Cambio obsoleto'},rev))).rejects.toThrow(/promotion_state_conflict/);
});
it('no se puede cambiar enabled, minMargin, descuentos ni productos sin validación privada',async()=>{
 await expect(as('authenticated',()=>set('dessert-12',{enabled:false},null))).rejects.toThrow(/campaign_patch_forbidden_fields/);
 await expect(as('authenticated',()=>set('dessert-12',{minMarginPct:1},null))).rejects.toThrow(/campaign_patch_forbidden_fields/);
 const current=await as('authenticated',get);
 await expect(as('authenticated',()=>set('dessert-12',{extraPercent:9},current.campaigns[0].revision))).rejects.toThrow();
 const after=await as('authenticated',get);
 expect(after.campaigns[0].extraPercent).toBe(2);
});
it('cajeros no editan y cambios en switches de publicidad son globales y con revisión',async()=>{
 await expect(as('authenticated',()=>set('dessert-12',{name:'Nuevo'},null),cashier)).rejects.toThrow(/forbidden/);
 const a=await as('authenticated',get);
 const result=await as('authenticated',()=>ticket({enabled:true,advertise:false},a.ticket.revision??null));
 expect(result.advertise).toBe(false);
 const b=await as('authenticated',get);expect(b.ticket.advertise).toBe(false);
 await expect(as('authenticated',()=>ticket({enabled:false,advertise:false},a.ticket.revision??null))).rejects.toThrow(/promotion_ticket_conflict/);
 await expect(as('authenticated',()=>ticket({enabled:false,advertise:false},b.ticket.revision),cashier)).rejects.toThrow(/forbidden/);
});
