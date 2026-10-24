import clipping from 'polygon-clipping';
import { validDeliveryPoint, haversineKm, validDeliveryHours } from '../core/delivery.js';
export function circlePoints(center, km, count=128) {
  const lat=center.lat*Math.PI/180, lng=center.lng*Math.PI/180, d=km/6371;
  return Array.from({length:count},(_,i)=>{ const b=2*Math.PI*i/count, y=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b)); return [y*180/Math.PI,(lng+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y)))*180/Math.PI]; });
}
export function zoneRings(center,z) {
  return z.type==='polygon'?[z.points||[],...(z.holes||[])]:[circlePoints(center,z.radiusKm),...(z.innerRadiusKm>0?[circlePoints(center,z.innerRadiusKm)]:[])];
}
export function toPolygon(center,z) { return {...z,type:'polygon',points:circlePoints(center,z.radiusKm),holes:z.innerRadiusKm>0?[circlePoints(center,z.innerRadiusKm)]:[]}; }
const areaRing=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
const area=multi=>multi.reduce((s,poly)=>s+areaRing(poly[0])-poly.slice(1).reduce((v,r)=>v+areaRing(r),0),0);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function selfCross(r) { for(let i=0;i<r.length;i++)for(let j=i+2;j<r.length;j++){if(i===0&&j===r.length-1)continue; const a=r[i],b=r[(i+1)%r.length],c=r[j],d=r[(j+1)%r.length]; if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;} return false; }
/** Rechaza geometrías ambiguas; los huecos se muestran antes de aplicar, sin rellenarlos en silencio. */
export function validateDeliveryPolicy(p) {
  const errors=[],warnings=[];
  if(!validDeliveryHours(p.hours))errors.push("Revisá la zona horaria y los horarios de delivery.");
  if(!validDeliveryPoint(p.center)||!p.center.verifiedAt)errors.push('Confirmá las coordenadas del local.');
  if(!p.revision||p.version!==2)errors.push('Falta la versión de configuración.');
  if(!(p.maxRouteKm>0&&p.maxRouteKm<=8.5&&p.regularMaxKm>0&&p.regularMaxKm<=8&&p.regularMaxKm<=p.maxRouteKm))errors.push('Los máximos permitidos son 8 km regulares y 8,5 km excepcionales.');
  if(!Array.isArray(p.zones)||!p.zones.length||p.zones.length>20)return {errors:[...errors,'Cargá entre 1 y 20 zonas.'],warnings};
  const ids=new Set(),polys=[];
  for(const z of p.zones){
    if(!z.id||ids.has(z.id)||!String(z.name||'').trim())errors.push('Las zonas necesitan nombre e identificador único.'); ids.add(z.id);
    if(!/^#[\da-f]{6}$/i.test(z.color||''))errors.push(z.name+': color inválido.');
    if(!Number.isFinite(z.baseCost)||z.baseCost<0||!Number.isFinite(z.minOrder)||z.minOrder<0||!(z.radiusKm>0&&z.radiusKm<=8.5)||!(z.innerRadiusKm>=0&&z.innerRadiusKm<z.radiusKm))errors.push(z.name+': revisá radios, tarifa y mínimo.');
    if(!['circle','polygon'].includes(z.type))errors.push(z.name+': tipo de cobertura inválido.');
    const benefits=z.benefits||[];
    if(benefits.length>10||benefits.some(b=>!Number.isFinite(b.threshold)||b.threshold<=0||!Number.isFinite(b.cost)||b.cost<0||b.cost>z.baseCost))errors.push(z.name+': beneficio inválido.');
    const rings=zoneRings(p.center,z);
    if(rings.some(r=>r.length<3||r.length>256||r.some(v=>!validDeliveryPoint({lat:v[0],lng:v[1]})||haversineKm(p.center.lat,p.center.lng,v[0],v[1])>8.51)||selfCross(r))){ errors.push(z.name+': el polígono debe ser simple y estar dentro de 8,5 km.'); continue; }
    polys.push({z,poly:rings.map(r=>r.map(([lat,lng])=>[lng,lat]))});
  }
  if(errors.length)return {errors,warnings};
  try{
    for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++)if(area(clipping.intersection(polys[i].poly,polys[j].poly))>1e-10)errors.push('Se superponen '+polys[i].z.name+' y '+polys[j].z.name+'. Ajustá sus límites.');
    const outer=[circlePoints(p.center,Math.max(...p.zones.map(z=>z.radiusKm))).map(([lat,lng])=>[lng,lat])];
    const gap=area(clipping.difference(outer,...polys.map(o=>o.poly)));
    if(gap>1e-8)warnings.push('Quedan sectores sin cobertura entre las zonas. Se rechazarán sus direcciones; no se rellenan automáticamente.');
  }catch{errors.push('No se pudo validar la geometría. Revisá los vértices.');}
  return {errors,warnings};
}
