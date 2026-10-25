import {it,expect,vi} from 'vitest';
import {geocodeAddress} from '../src/delivery/routing.js';
import {createDeliveryRepository} from '../src/delivery/repository.js';
import {createDeliveryClient} from '../src/delivery/client.js';
const center={lat:-34.5264,lng:-58.4818},key='fake-private-key-test-only';
const features=[{geometry:{type:'Point',coordinates:[-58.482,-34.527]},properties:{layer:'address',label:'Calle ficticia 123, Vicente López',secret:key}},{geometry:{type:'Point',coordinates:[-58.48,-34.52]},properties:{layer:'locality',label:'Vicente López'}},{geometry:{type:'Point',coordinates:[999,999]},properties:{layer:'address',label:'Inválida'}}];
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
it('no confunde el centro de una ciudad con una dirección y nunca devuelve la clave',async()=>{
 const fetchImpl=vi.fn(async()=>json({features})),rows=await geocodeAddress('Calle ficticia 123',center,{key,fetchImpl});
 expect(rows).toEqual([{display_name:'Calle ficticia 123, Vicente López',lat:'-34.527',lon:'-58.482'}]);
 const [url,opts]=fetchImpl.mock.calls[0],u=new URL(url);expect(u.origin+u.pathname).toBe('https://api.heigit.org/pelias/v1/search');expect(u.searchParams.get('layers')).toBe('address,venue');expect(u.searchParams.get('boundary.country')).toBe('ARG');expect(opts.headers.Authorization).toBe(key);expect(url+JSON.stringify(rows)).not.toContain(key);
});
it('conserva fallos explícitos y no inventa un punto cuando el proveedor falla',async()=>{
 for(const [status,error] of [[403,'routing_geocoder_unavailable'],[503,'routing_geocoder_unavailable'],[429,'routing_geocoder_rate_limited']])await expect(geocodeAddress('Calle 123',center,{key,fetchImpl:async()=>json({},status)})).rejects.toThrow(error);
 await expect(geocodeAddress('Calle 123',center,{key,fetchImpl:async()=>{throw Error('timeout')}})).rejects.toThrow('routing_geocoder_unavailable');
 await expect(geocodeAddress('Calle 123',center,{key,fetchImpl:async()=>json({})})).rejects.toThrow('routing_geocoder_unavailable');
 expect(await geocodeAddress('Calle 123',center,{key,fetchImpl:async()=>json({features:[features[1]]})})).toEqual([]);
});
it('la caché se separa por tienda/clave y los resultados vacíos siguen limitando las consultas de respaldo',async()=>{
 let revision='a',empty=false,slot=true;
 const fetchImpl=vi.fn(async(url,options)=>{if(url.endsWith('/sahten_delivery_backend')){const {action}=JSON.parse(options.body);return json(action==='provider'?{key,updated_at:revision}:slot);}return json({features:empty?[]:features});});
 const {geocode}=createDeliveryRepository({url:'https://test.invalid',serviceKey:'fake-service',anonKey:'fake-anon',fetchImpl});
 await geocode('Calle 123',center,'a');await geocode('Calle 123',center,'a');expect(fetchImpl.mock.calls.filter(([u])=>u.includes('/pelias/'))).toHaveLength(1);
 await geocode('Calle 123',center,'b');revision='b';await geocode('Calle 123',center,'a');expect(fetchImpl.mock.calls.filter(([u])=>u.includes('/pelias/'))).toHaveLength(3);
 empty=true;await geocode('Otra calle 123',center,'a');slot=false;await expect(geocode('Otra calle 123',center,'a')).rejects.toThrow('routing_rate_limited');
});
it('Mostrador conserva búsqueda directa sin inventar rutas, y no saltea límites de la API',async()=>{
 const fetch=vi.fn(async url=>url.includes('/sahten-delivery/')?json([]):json([{display_name:'Calle 123',lat:'-34.527',lon:'-58.482'}]));
 const w={fetch,SAHTEN:{online:{conn:()=>({url:'https://test.invalid',storeId:'test',anonKey:'public-test'}),controller:{client:null}}}};
 expect(await createDeliveryClient(w).geocode('Calle 123')).toHaveLength(1);expect(fetch.mock.calls[1][0]).toContain('nominatim.openstreetmap.org/search');
 fetch.mockClear();fetch.mockImplementation(async()=>json({error:'routing_rate_limited',message:'Esperá un momento.'},503));
 await expect(createDeliveryClient(w).geocode('Calle 123')).rejects.toThrow('Esperá un momento');expect(fetch).toHaveBeenCalledTimes(1);
});
