// Configuración comercial de delivery: nunca incluye productos, precios, pagos, horarios ni claves.
const deliveryConfigCopy = value => JSON.parse(JSON.stringify(value));
export function deliveryConfiguration(t = {}) {
  const zone = z => Object.fromEntries(['id','name','type','radiusKm','points','baseCost'].filter(k=>z[k]!==undefined).map(k=>[k,deliveryConfigCopy(z[k])]));
  const p = t.deliveryV2 ? deliveryConfigCopy(t.deliveryV2) : null;
  if (p) { delete p.hours; delete p.revision; delete p.effectiveAt; }
  return {version:1,origin:{address:String(t.address||''),lat:t.lat??null,lng:t.lng??null},
    legacy:{zones:(t.zones||[]).map(zone),deliveryMinOrder:Number(t.deliveryMinOrder)||0,freeShippingMin:Number(t.freeShippingMin)||0,costPerKm:Number(t.costPerKm)||0},policy:p};
}
export function deliveryConfigurationFromMenu(menu) {
  const d=menu?.delivery||{},s=menu?.store||{};
  return deliveryConfiguration({...d,address:s.address||'',lat:d.lat??s.lat??null,lng:d.lng??s.lng??null});
}
export function applyDeliveryConfiguration(t, config, {revision,effectiveAt}={}) {
  const next={...t,...deliveryConfigCopy(config.origin),...deliveryConfigCopy(config.legacy)};
  if (config.policy) {
    const p=deliveryConfigCopy(config.policy);
    p.zones=p.zones.map(z=>{const current=t.deliveryV2?.zones?.find(a=>a.id===z.id);return current?{...z,enabled:current.enabled,requiresAuthorization:current.requiresAuthorization}:z;});
    next.deliveryV2={...p,...(t.deliveryHours??t.deliveryV2?.hours?{hours:deliveryConfigCopy(t.deliveryHours??t.deliveryV2.hours)}:{}),revision:revision??t.deliveryV2?.revision,effectiveAt:effectiveAt??t.deliveryV2?.effectiveAt};
  } else delete next.deliveryV2;
  return next;
}
export function deliveryConfigurationFingerprint(config) {const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;return JSON.stringify(ordered(config));}
