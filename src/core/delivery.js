// ═══════════════════════════════════════════════════════════
// Delivery por zonas (puro). Lo usan el Mostrador, el menú publicado y la web: una sola cuenta.
// Este archivo se inyecta tal cual en la web publicada (sin imports): no usar nada fuera de él.
//   tienda = { lat, lng, zones: [{ id, name, type:'circle'|'polygon', radiusKm, points:[[lat,lng],…], baseCost }],
//              freeShippingMin, deliveryMinOrder }
// ═══════════════════════════════════════════════════════════

export const DEFAULT_STORE_POINT = { lat: -34.6037, lng: -58.3816 };

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Punto dentro de un polígono [[lat,lng],…] (ray casting). */
export function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i], [yj, xj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/** Zona de una dirección: las circulares se prueban de menor a mayor radio; los polígonos por contención. */
export function zoneFor(tienda, lat, lng) {
  const t = tienda || {};
  const sLat = t.lat != null ? t.lat : DEFAULT_STORE_POINT.lat, sLng = t.lng != null ? t.lng : DEFAULT_STORE_POINT.lng;
  const distKm = haversineKm(sLat, sLng, lat, lng);
  const zones = [...(t.zones || [])].sort((a, b) => (a.radiusKm || 999) - (b.radiusKm || 999));
  for (const z of zones) {
    if (z.type === 'polygon' && (z.points || []).length >= 3) { if (pointInPolygon(lat, lng, z.points)) return { zone: z, distKm }; }
    else if (distKm <= (z.radiusKm || 0)) return { zone: z, distKm };
  }
  return { zone: null, distKm, out: true };
}

/**
 * Envío de un pedido: costo de la zona, gratis desde `freeShippingMin` y mínimo de pedido para delivery.
 * → { ok, out, zone, distKm, cost, free, belowMin, minOrder }
 */
export function shippingFor(tienda, lat, lng, subtotal, options = {}) {
  const t = tienda || {};
  if (t.enabled === false || t.deliveryEnabled === false) return { ok:false, status:'service_paused', cost:0, free:false, belowMin:false };
  if (t.deliveryV2?.active) return deliveryQuote(deliveryPolicyWithHours(t), {lat,lng}, subtotal, options);
  const hours = deliveryHours(t.hours ?? t.deliveryHours ?? t.deliveryV2?.hours, options.now ?? Date.now());
  if (!hours.open) return { ok:false, status:hours.valid?'closed':'hours_invalid', hours, cost:0, free:false, belowMin:false };
  const z = zoneFor(t, lat, lng);
  if (!z.zone) return { ok: false, out: true, zone: null, distKm: z.distKm, cost: 0, free: false, belowMin: false, minOrder: t.deliveryMinOrder || 0 };
  const freeMin = t.freeShippingMin || 0;
  const free = freeMin > 0 && subtotal >= freeMin;
  const minOrder = t.deliveryMinOrder || 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  return { ok: !belowMin, out: false, zone: z.zone, distKm: z.distKm, cost: free ? 0 : (z.zone.baseCost || 0), free, belowMin, minOrder };
}

export function deliveryPolicyWithHours(delivery) {
  return delivery?.deliveryV2 ? { ...delivery.deliveryV2, hours: delivery.hours ?? delivery.deliveryHours ?? delivery.deliveryV2.hours } : null;
}

/** Motor v2: recibe una ruta comprobada por el servidor. Nunca convierte el radio en recorrido. */
export function deliveryQuote(policy, destination, netSubtotal, { route = null, hasPaymentDiscount = false, authorization = null, now = Date.now() } = {}) {
  const base = { version:2, revision:policy?.revision||'', geographicZone:null, effectiveZone:null, zone:null, distKm:null, routeKm:null, baseCost:0, cost:0, savings:0, free:false, belowMin:false, minOrder:0, nextBenefit:null, progress:0, ok:false, status:'address_required', requiresAuthorization:false };
  if (!policy || !validDeliveryPoint(policy.center) || !policy.center.verifiedAt) return { ...base, status:'store_unverified' };
  const hours=deliveryHours(policy.hours,now); base.hours=hours;
  if (!hours.open) return {...base,status:hours.valid?'closed':'hours_invalid'};
  if (!validDeliveryPoint(destination)) return base;
  const radial = haversineKm(policy.center.lat, policy.center.lng, destination.lat, destination.lng);
  base.distKm = radial;
  const candidates = (policy.zones||[]).filter(z => zoneContains(policy.center,z,destination));
  if (candidates.length !== 1) return { ...base, out:true, status:candidates.length?'ambiguous_zone':'out_of_coverage' };
  const geo = candidates[0]; base.geographicZone = {id:geo.id,name:geo.name};
  if (!geo.enabled) return { ...base, status:'paused' };
  const max = Math.min(8.5, Number(policy.maxRouteKm)||8.5), regular = Math.min(8, Number(policy.regularMaxKm)||8);
  if (radial > max + 1e-7) return { ...base, out:true, status:'out_of_coverage' };
  // La ruta debe estar vinculada al mismo origen y destino. El browser no es autoridad para validarla.
  if (!route || !Number.isFinite(route.distanceMeters) || route.distanceMeters<0 || !route.provider || !validDeliveryPoint(route.origin) || !validDeliveryPoint(route.destination) || haversineKm(route.origin.lat,route.origin.lng,policy.center.lat,policy.center.lng)>.005 || haversineKm(route.destination.lat,route.destination.lng,destination.lat,destination.lng)>.005 || route.distanceMeters/1000 < radial-.15) return { ...base, status:'route_unverified' };
  base.routeKm = route.distanceMeters / 1000;
  if (base.routeKm > max + 1e-7) return { ...base, out:true, status:'out_of_coverage' };
  const floor = [...(policy.zones||[])].sort((a,b)=>a.radiusKm-b.radiusKm).find(z => base.routeKm <= z.radiusKm+1e-7 && base.routeKm > (z.innerRadiusKm||0)-1e-7);
  if (!floor) return { ...base, status:'tariff_unavailable' };
  // Una zona más lejana por calle fija el piso tarifario, con sus condiciones completas.
  const authorized=authorization?.approved===true&&authorization.revision===policy.revision&&authorization.destination?.lat===destination.lat&&authorization.destination?.lng===destination.lng;
  const effective = authorized&&authorization.tariffFloorException ? geo : floor.baseCost>geo.baseCost ? floor : geo;
  if (!effective.enabled || !floor.enabled) return { ...base, status:'paused' };
  base.zone = {id:effective.id,name:effective.name}; base.effectiveZone=base.zone;
  base.minOrder = Math.max(Number(geo.minOrder)||0,Number(effective.minOrder)||0);
  base.belowMin = netSubtotal < base.minOrder;
  base.baseCost = Math.max(0,Number(effective.baseCost)||0);
  base.cost = base.baseCost;
  const benefits = policy.promotionsEnabled && (!hasPaymentDiscount || policy.stackWithPayment!==false) ? (effective.benefits||[]).filter(b=>Number.isFinite(b.threshold)&&b.threshold>0&&Number.isFinite(b.cost)&&b.cost>=0&&b.cost<base.baseCost).sort((a,b)=>a.threshold-b.threshold) : [];
  for (const b of benefits) if (netSubtotal>=b.threshold) base.cost=Math.min(base.cost,b.cost);
  base.savings=+(base.baseCost-base.cost).toFixed(2); base.free=base.cost===0;
  const next=benefits.find(b=>b.threshold>netSubtotal&&b.cost<base.cost);
  base.nextBenefit=next?{threshold:next.threshold,cost:next.cost,remaining:+Math.max(0,next.threshold-netSubtotal).toFixed(2),savings:base.cost-next.cost}:null;
  const target=next?.threshold || [...benefits].reverse().find(b=>b.threshold<=netSubtotal)?.threshold || 0;
  base.progress=target?Math.min(100,Math.max(0,netSubtotal/target*100)):0; base.threshold=target; base.netSubtotal=netSubtotal;
  base.requiresAuthorization=!!(geo.requiresAuthorization||effective.requiresAuthorization||base.routeKm>regular);
  base.status=base.belowMin?'below_minimum':base.requiresAuthorization&&!authorized?'authorization_required':'available';
  base.ok=base.status==='available';
  return base;
}
export function validDeliveryPoint(p) { return !!p && typeof p.lat==='number'&&typeof p.lng==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180; }
export function zoneContains(center,z,p) {
  const km=haversineKm(center.lat,center.lng,p.lat,p.lng);
  if(z.type==='polygon') return pointInPolygon(p.lat,p.lng,z.points||[])&&!(z.holes||[]).some(h=>pointInPolygon(p.lat,p.lng,h));
  return km<=(Number(z.radiusKm)||0)+1e-7 && (km>(Number(z.innerRadiusKm)||0)+1e-7 || !(Number(z.innerRadiusKm)>0));
}
export function deliverySnapshot(q, route, authorization = null) {
  if(!q?.ok) return null;
  return {version:2,revision:q.revision,geographicZone:q.geographicZone,effectiveZone:q.effectiveZone,radialKm:q.distKm,routeKm:q.routeKm,baseCost:q.baseCost,charged:q.cost,discount:q.savings,netSubtotal:q.netSubtotal,provider:route.provider,validatedAt:route.validatedAt,hours:q.hours?.enabled?{timeZone:q.hours.timeZone,checkedAt:q.hours.checkedAt,closesAt:q.hours.closesAt}:null,authorization:authorization?{approved:!!authorization.approved,actor:authorization.actor,reason:authorization.reason,at:authorization.at,tariffFloorException:!!authorization.tariffFloorException}:null};
}
/** Descuento comercial de envío, separado del gasto operativo del repartidor. */
export function deliveryReport(orders) {
 return (orders||[]).filter(o=>o.status!=='cancelado'&&o.deliverySnapshot?.version===2).reduce((r,o)=>{const s=o.deliverySnapshot;r.orders++;r.base+=Number(s.baseCost)||0;r.charged+=Number(s.charged)||0;r.discount+=Number(s.discount)||0;if(s.authorization?.approved)r.authorized++;return r;},{orders:0,base:0,charged:0,discount:0,authorized:0});
}

/** Horarios estructurados: índice 0 domingo; cierre exclusivo. Los feriados son excepciones explícitas. */
export function validDeliveryHours(h) {
  if (!h) return true; // Compatibilidad de negocios que todavía no definieron horarios.
  if (typeof h.enabled !== 'boolean' || typeof h.timeZone !== 'string' || !h.timeZone.trim()) return false;
  try { new Intl.DateTimeFormat('es-AR',{timeZone:h.timeZone}).format(); } catch { return false; }
  const time=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
  const periods=a=>Array.isArray(a)&&a.length<=4&&a.every(p=>p&&time(p.start)&&time(p.end)&&p.start!==p.end);
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  return Array.isArray(h.weekly)&&h.weekly.length===7&&h.weekly.every(periods)&&Array.isArray(h.exceptions)&&h.exceptions.length<=366&&new Set(h.exceptions.map(e=>e?.date)).size===h.exceptions.length&&h.exceptions.every(e=>e&&date(e.date)&&periods(e.periods));
}
export function deliveryHours(h, now=Date.now()) {
  const stamp=new Date(now).getTime();
  if(!Number.isFinite(stamp)||!validDeliveryHours(h))return {enabled:!!h?.enabled,valid:false,open:false,timeZone:h?.timeZone};
  if(!h?.enabled)return {enabled:false,valid:true,open:true};
  const zone=h.timeZone,fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=t=>Object.fromEntries(fmt.formatToParts(new Date(t)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const local=parts(stamp),today=local.year+'-'+local.month+'-'+local.day;
  const day=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const ranges=date=>h.exceptions.find(e=>e.date===date)?.periods||h.weekly[new Date(date+'T12:00:00Z').getUTCDay()];
  const instant=(date,clock)=>{const target=Date.parse(date+'T'+clock+':00Z');let t=target;for(let i=0;i<4;i++){const p=parts(t),asUTC=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z'),offset=asUTC-t;if(t===target-offset)break;t=target-offset;}return t;};
  const windows=date=>ranges(date).map(p=>({start:instant(date,p.start),end:instant(p.end<p.start?day(date,1):date,p.end)}));
  const closedToday=h.exceptions.some(e=>e.date===today&&!e.periods.length);
  const current=[...(closedToday?[]:windows(day(today,-1))),...windows(today)].find(w=>stamp>=w.start&&stamp<w.end);
  const result={enabled:true,valid:true,open:!!current,timeZone:zone,checkedAt:new Date(stamp).toISOString(),closesAt:current?new Date(current.end).toISOString():null,nextOpening:null};
  if(!current){for(let n=0;n<=367;n++){const next=windows(day(today,n)).filter(w=>w.start>stamp).sort((a,b)=>a.start-b.start)[0];if(next){result.nextOpening=new Date(next.start).toISOString();result.nextLabel=new Intl.DateTimeFormat('es-AR',{timeZone:zone,weekday:'long',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(next.start);break;}}}
  return result;
}
/** Texto público del horario de entregas; no reemplaza horarios generales de atención ni SEO del negocio. */
export function deliveryHoursText(h) {
 if(!h?.enabled||!validDeliveryHours(h))return '';
 return h.weekly.map((periods,i)=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][i]+': '+(periods.length?periods.map(p=>p.start+' a '+p.end+(p.end<p.start?' (día siguiente)':'')).join(' y '):'cerrado')).join('\n');
}
