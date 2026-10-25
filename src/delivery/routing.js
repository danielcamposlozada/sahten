import { validDeliveryPoint, haversineKm } from '../core/delivery.js';

/** Solo servidor: nunca presentar una localidad como si fuera una dirección exacta. */
export async function geocodeAddress(query,center,{key,fetchImpl=fetch}={}) {
  if(!key)throw new Error('routing_not_configured');
  if(!validDeliveryPoint(center))throw new Error('routing_invalid_coordinates');
  const u=new URL('https://api.heigit.org/pelias/v1/search');
  Object.entries({text:query,size:'5',layers:'address,venue','boundary.country':'ARG','focus.point.lat':center.lat,'focus.point.lon':center.lng}).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  let r;try{r=await fetchImpl(u.href,{headers:{Authorization:key,Accept:'application/geo+json'},signal:AbortSignal.timeout(10000)});}catch{throw new Error('routing_geocoder_unavailable');}
  if(!r.ok)throw new Error(r.status===429?'routing_geocoder_rate_limited':'routing_geocoder_unavailable');
  let j;try{j=await r.json();}catch{throw new Error('routing_geocoder_unavailable');}
  if(!Array.isArray(j.features))throw new Error('routing_geocoder_unavailable');
  return j.features.flatMap(f=>{
    const xy=f?.geometry?.coordinates,p=f?.properties,label=p?.label;
    if(!['address','venue'].includes(p?.layer)||f?.geometry?.type!=='Point'||!Array.isArray(xy)||typeof label!=='string'||!label.trim()||!validDeliveryPoint({lat:xy[1],lng:xy[0]}))return [];
    return [{display_name:label.trim().slice(0,300),lat:String(xy[1]),lon:String(xy[0])}];
  }).slice(0,5);
}
/** Solo servidor. No tiene respaldo radial; si falla el proveedor, no hay ruta validada. */
export async function roadRoute(origin,destination,{key,fetchImpl=fetch,now=()=>new Date().toISOString()}={}) {
  if(!key)throw new Error('routing_not_configured');
  if(!validDeliveryPoint(origin)||!validDeliveryPoint(destination))throw new Error('invalid_coordinates');
  const r=await fetchImpl('https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson',{method:'POST',headers:{Authorization:key,'Content-Type':'application/json'},body:JSON.stringify({coordinates:[[origin.lng,origin.lat],[destination.lng,destination.lat]],radiuses:[100,100],instructions:false,options:{avoid_features:['ferries']}}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(r.status===429?'routing_rate_limited':'routing_unavailable');
  const j=await r.json(),f=j.features?.[0],meters=f?.properties?.summary?.distance,seconds=f?.properties?.summary?.duration,coords=f?.geometry?.coordinates;
  if(!Number.isFinite(meters)||meters<0||!Number.isFinite(seconds)||!Array.isArray(coords)||coords.length<2||haversineKm(origin.lat,origin.lng,coords[0][1],coords[0][0])>.1||haversineKm(destination.lat,destination.lng,coords.at(-1)[1],coords.at(-1)[0])>.1||meters/1000<haversineKm(origin.lat,origin.lng,destination.lat,destination.lng)-.15)throw new Error('routing_invalid_result');
  return {provider:'openrouteservice',profile:'driving-car',distanceMeters:meters,durationSeconds:seconds,origin:{lat:origin.lat,lng:origin.lng},destination:{lat:destination.lat,lng:destination.lng},validatedAt:now()};
}
