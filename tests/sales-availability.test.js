import {it,expect} from 'vitest';
import {salesPaused,endOfBusinessDay,businessDateTime} from '../src/core/sales-availability.js';
import {createAvailabilityPublisher} from '../src/online/availability.js';
import {quoteOrder} from '../src/payments/core.js';
const NOW=Date.parse('2026-10-26T23:30:00Z');
it('por hoy usa la medianoche del negocio, valida fechas y reactiva por vencimiento sin necesitar la app',()=>{
 expect(endOfBusinessDay('America/Argentina/Buenos_Aires',NOW)).toBe('2026-10-27T03:00:00.000Z');
 expect(businessDateTime('2026-10-27T10:15','America/Argentina/Buenos_Aires')).toBe('2026-10-27T13:15:00.000Z');
 expect(businessDateTime('2026-02-31T10:15','America/Argentina/Buenos_Aires')).toBeNull();
 expect(businessDateTime('2026-03-08T02:30','America/New_York')).toBeNull();
 const p={salesAvailability:{paused:true,resumeAt:'2026-10-27T03:00:00Z'}};
 expect(salesPaused(p,NOW)).toBe(true);expect(salesPaused(p,Date.parse('2026-10-27T03:00:00Z'))).toBe(false);
 expect(salesPaused({salesAvailability:{paused:true,resumeAt:'broken'}},NOW)).toBe(true);
 expect(salesPaused({},NOW)).toBe(false);
});
function setup(publish=async()=>{}){let ctx='project-A',on=true;const data={},tasks=[];const store={get:(k,d)=>data[k]??d,set:(k,v)=>{data[k]=JSON.parse(JSON.stringify(v));}};const args={publish,context:()=>ctx,enabled:()=>on,store,timer:{set:f=>{tasks.push(f);return tasks.length;},clear:()=>{}}};return {args,q:createAvailabilityPublisher(args),data,tasks,context:v=>ctx=v,enable:v=>on=v};}
it('publica solo estados, agrupa clics y conserva la intención más nueva durante una petición',async()=>{
 const calls=[];let release;const s=setup(async(...args)=>{calls.push(args);if(calls.length===1)await new Promise(r=>release=r);});
 s.q.set('p',false,'2026-10-27T03:00:00Z');const job=s.q.flush();s.q.set('p',true);release();await job;
 expect(calls).toEqual([['p',false,'2026-10-27T03:00:00Z'],['p',true,null]]);expect(s.q.info().pending).toBe(0);expect(JSON.stringify(calls)).not.toMatch(/price|products|customers/);
});
it('conserva la cola al reiniciar y otro producto avanza aunque el primero requiera publicación inicial',async()=>{
 const calls=[];const s=setup(async id=>{calls.push(id);if(id==='new')throw new Error('product_not_published');});
 s.q.set('new',true);s.q.set('old',false);await s.q.flush();expect(calls).toEqual(['new','old']);expect(s.q.info().pending).toBe(1);
 const restored=createAvailabilityPublisher(s.args);expect(restored.info().changes.new.available).toBe(true);
});
it('sin conexión reintenta; una respuesta de otro proyecto no elimina sus pendientes ni toca el proyecto actual',async()=>{
 const s=setup(async()=>{throw Object.assign(new Error('offline'),{offline:true});});s.q.set('p',false);await expect(s.q.flush()).rejects.toThrow('offline');expect(s.q.info()).toMatchObject({state:'sin conexión',pending:1});expect(s.tasks.length).toBeGreaterThan(1);
 let done;const other=setup(()=>new Promise(r=>done=r));other.q.set('p',false);const job=other.q.flush();other.context('project-B');other.q.cancel();done();await job;expect(other.q.info().pending).toBe(0);other.context('project-A');expect(other.q.info().pending).toBe(1);
});
it('el servidor rechaza un carrito anterior a la pausa y vuelve a permitirlo al vencer, sin modificar precios',()=>{
 const menu={config:{enabled:true},store:{currency:{symbol:'$',locale:'es-AR'}},products:[{id:'p',name:'Plato',price:12000,salesAvailability:{paused:true,resumeAt:'2026-10-27T03:00:00Z'}}]};
 const order={items:[{id:'p',qty:1}],source:'pickup',customerName:'Ficticio',customerPhone:'1112345678'};
 expect(()=>quoteOrder(menu,order,{now:NOW})).toThrow(/no está disponible/);
 expect(quoteOrder(menu,order,{now:Date.parse('2026-10-27T03:00:00Z')})).toMatchObject({total:12000});
});
it('descarta una pausa temporal que venció desconectada, sin reactivar una pausa más nueva de otro equipo',async()=>{
 const calls=[];const s=setup((...args)=>calls.push(args));const q=createAvailabilityPublisher({...s.args,namespace:'sales'});q.set('p',false,'2000-01-01T00:00:00Z');await q.flush();expect(calls).toHaveLength(0);expect(q.info().pending).toBe(0);
});
it('el servidor de Mostrador toma la pausa reciente aunque la copia del proyecto todavía diga disponible',async()=>{
 const {createDeliveryRepository}=await import('../src/delivery/repository.js');
 const repo=createDeliveryRepository({url:'https://db.test',serviceKey:'service-test',anonKey:'public-test',fetchImpl:async(url,options={})=>{
  if(url.includes('/stores?'))return Response.json([{project_id:'project-test'}]);
  if(url.includes('/projects?'))return Response.json([{public:{products:[{id:'p',name:'Plato',fixedPrices:{mostrador:12000},salesAvailability:{paused:false}}]}}]);
  if(url.includes('/rpc/get_product_sales_availability')){expect(JSON.parse(options.body)).toEqual({p_store_id:'store-test'});return Response.json({sales:[{id:'p',salesAvailability:{paused:true,resumeAt:null}}]});}
  throw new Error('Ruta inesperada');
 }});
 expect((await repo.repo.posRules('store-test')).catalog[0].salesAvailability.paused).toBe(true);
});
