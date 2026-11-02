import {describe,it,expect,vi} from 'vitest';
import {createSync} from '../src/online/sync.js';
import {emptyFile} from '../src/project/schema.js';
const copy=o=>JSON.parse(JSON.stringify(o));
function rig({role='owner',promotionEnabled=false,cloudProjectId=null,changeDuringFetch=false}={}){
 const local=emptyFile('Sahten');local.project.id='p1';local.catalog.productos=[{id:'x',name:'Producto'}];
 local.sales.orders=[{id:'orden-1',total:12}];
 local.promotions={version:1,enabled:false,campaigns:[],upsells:[]};
 const remote=copy(local);
 remote.catalog.productos=[{id:'x',name:'REMOTO'}];remote.sales.orders=[];
 remote.promotions={version:1,enabled:promotionEnabled,campaigns:[{id:'weekly',enabled:promotionEnabled}],upsells:[]};
 if(cloudProjectId)remote.project.id=cloudProjectId;
 let current=copy(local),writes=0,backupCount=0,saved=0,cloudWrites=0;
 const client={rpc:vi.fn(async(name)=>{
   if(name==='get_project_data'){if(changeDuringFetch)current.catalog.productos[0].name='CAMBIADO';return {version:323,data:copy(remote)};}
   if(name==='save_project')cloudWrites++;
   throw Error('RPC inesperada: '+name);
 }),auth:{token:async()=> 'token'}};
 const s=createSync({
  remoteId:()=> 'cloud-id',role:()=>role,projectId:()=>current.project.id,client,
  collect:()=>copy(current),apply:async f=>{writes++;current=copy(f)},
  backupBefore:async()=>{backupCount++},saveLocal:async()=>{saved++},
  store:{get:()=>null,set:()=>{}},timer:{set:()=>0,clear:()=>{}},
 });
 return {s,client,get current(){return current},get writes(){return writes},get backupCount(){return backupCount},
   get saved(){return saved},get cloudWrites(){return cloudWrites}};
}
describe('sincronización selectiva en un .sahten',()=>{
 it('trae solo promociones, respalda el proyecto y no escribe nunca el remoto',async()=>{
  const r=rig();const v=await r.s.pullPromotionsFromCloud();
  expect(v.action).toBe('promotions_pull');expect(v.version).toBe(323);
  expect(r.current.promotions.campaigns).toHaveLength(1);
  expect(r.current.catalog.productos[0].name).toBe('Producto');
  expect(r.current.sales.orders).toHaveLength(1);
  expect(r.backupCount).toBe(1);expect(r.saved).toBe(1);
  expect(r.cloudWrites).toBe(0);expect(r.s.info().state).toBe('promociones locales actualizadas');
 });
 it('no duplica respaldo si ya está idéntico',async()=>{
  const r=rig();await r.s.pullPromotionsFromCloud();
  expect((await r.s.pullPromotionsFromCloud()).action).toBe('unchanged');
  expect(r.backupCount).toBe(1);expect(r.writes).toBe(1);
 });
 it('bloquea acceso sin rol administrativo y proyectos diferentes',async()=>{
  await expect(rig({role:'encargado'}).s.pullPromotionsFromCloud()).rejects.toThrow();
  const mismatch=rig({cloudProjectId:'different'});
  await expect(mismatch.s.pullPromotionsFromCloud()).rejects.toThrow('no coinciden');
  expect(mismatch.writes).toBe(0);expect(mismatch.backupCount).toBe(0);
 });
 it('no reemplaza cambios realizados durante la descarga',async()=>{
  const r=rig({changeDuringFetch:true});
  await expect(r.s.pullPromotionsFromCloud()).rejects.toThrow('cambió');
  expect(r.writes).toBe(0);expect(r.backupCount).toBe(0);
 });
});
