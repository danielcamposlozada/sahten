import { createDeliveryService, authorizationFrom } from './service.js';
import { roadRoute, geocodeAddress } from './routing.js';
import { validDeliveryPoint, haversineKm } from '../core/delivery.js';
export function createDeliveryRepository({url,serviceKey,anonKey,fetchImpl=fetch}){
 async function request(path,{method='GET',body,token=serviceKey}={}){
  const r=await fetchImpl(url+path,{method,headers:{apikey:token===serviceKey?serviceKey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('delivery_database_unavailable');return r.status===204?null:r.json();
 }
 const run=(action,args)=>request('/rest/v1/rpc/sahten_delivery_backend',{method:'POST',body:{action,args}});
 async function role(sid,user,roles){
  const s=(await request('/rest/v1/stores?select=id,owner,project_id&id=eq.'+sid,{token:user.token}))?.[0];
  if(!s)return false;if(s.owner===user.id)return true;
  return !!s.project_id&&await request('/rest/v1/rpc/has_project_role',{method:'POST',token:user.token,body:{pid:s.project_id,roles}})===true;
 }
 const repo={run,menu:async sid=>(await request('/rest/v1/menus?select=json&store_id=eq.'+sid))?.[0]?.json,canManage:(sid,u)=>role(sid,u,['owner','admin']),canOperate:(sid,u)=>role(sid,u,['owner','admin','encargado','cajero'])};
 repo.posRules=async sid=>{const store=(await request('/rest/v1/stores?select=project_id&id=eq.'+sid))?.[0];if(!store?.project_id)return {};const project=(await request('/rest/v1/projects?select=public&id=eq.'+store.project_id))?.[0];const pub=project?.public;return {...(pub?.sales||{}),catalog:pub?.products,project:pub?.project,tienda:pub?.online?.tiendaConfig};};
 repo.savePos=(sid,lid,p)=>request('/rest/v1/rpc/validate_delivery_pos_record',{method:'POST',body:{sid,lid,p}});
 async function authenticate(req){const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!token||token===anonKey||token===serviceKey)return null;try{const u=await request('/auth/v1/user',{token});return u?.id?{id:u.id,token}:null;}catch{return null;}}
 // Caché breve por origen/destino exactos. No se mezclan negocios ni se reutiliza tras cambiar la clave.
 const cache=new Map();
 const addresses=new Map();
 async function geocode(query,center,sid){
  const account=sid?await run('provider',{store_id:sid}):null;
  const k=sid+':'+account?.updated_at+':'+query.toLocaleLowerCase()+':'+center.lat+':'+center.lng,cached=addresses.get(k);if(cached&&cached.until>Date.now()){if(!cached.rows.length&&!await run('geocode_slot',{}))throw new Error('routing_rate_limited');return cached.rows;}
  if(!await run('geocode_slot',{}))throw new Error('routing_rate_limited');
  if(account?.key){const rows=await geocodeAddress(query,center,{key:account.key,fetchImpl});if(addresses.size>300)addresses.clear();addresses.set(k,{rows,until:Date.now()+30*60000});return rows;}
  const u=new URL('https://nominatim.openstreetmap.org/search');Object.entries({format:'json',addressdetails:'1',limit:'5',countrycodes:'ar','accept-language':'es',q:query,viewbox:[center.lng-.15,center.lat+.15,center.lng+.15,center.lat-.15].join(',')}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchImpl(u.href,{headers:{'User-Agent':'Sahten/0.4 (https://sahten.online)'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('routing_geocoder_unavailable');
  const rows=(await r.json()).filter(a=>validDeliveryPoint({lat:+a.lat,lng:+a.lon})).slice(0,5);if(addresses.size>300)addresses.clear();addresses.set(k,{rows,until:Date.now()+30*60000});return rows;
 }
 async function resolveRoute(sid,origin,destination){
  if(!validDeliveryPoint(origin)||!validDeliveryPoint(destination)||haversineKm(origin.lat,origin.lng,destination.lat,destination.lng)>8.6)throw new Error('routing_invalid_coordinates');
  const account=await run('provider',{store_id:sid});
  const key=sid+':'+account?.updated_at+':'+[origin.lat,origin.lng,destination.lat,destination.lng].join(',');
  const old=cache.get(key);if(old&&old.until>Date.now())return old.route;
  const route=await roadRoute(origin,destination,{key:account?.key,fetchImpl});
  if(cache.size>500)cache.clear();cache.set(key,{until:Date.now()+5*60000,route});return route;
 }
 async function resolveDelivery(sid,menu,input){
  const p=menu.delivery.deliveryV2,destination={lat:Number(input.lat),lng:Number(input.lng)},route=await resolveRoute(sid,p.center,destination);
  const record=input.deliveryQuoteId&&/^[\da-f-]{36}$/i.test(input.deliveryQuoteId)?await run('quote',{store_id:sid,id:input.deliveryQuoteId}):null;
  return {route,authorization:authorizationFrom(record,p,destination)};
 }
 async function originKey(req){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')))).map(b=>b.toString(16).padStart(2,'0')).join('');}
 return {repo,authenticate,resolveRoute,resolveDelivery,originKey,geocode};
}
export function deliveryHandler(options){return createDeliveryService(createDeliveryRepository(options));}
