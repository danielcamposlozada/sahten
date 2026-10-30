// Configuración comercial solicitada por el dueño. Se prepara apagada; no cambia la tienda publicada.
export const SAHTEN_CENTER = Object.freeze({ lat: -34.5264314, lng: -58.4818959, verifiedAt: '2026-10-24', source: 'https://www.openstreetmap.org/way/369183696', address: 'General Julio Argentino Roca 1489, Vicente López, Buenos Aires, Argentina' });
export function sahtenDeliveryHours(){return {enabled:true,timeZone:'America/Argentina/Buenos_Aires',weekly:[[],...Array.from({length:4},()=>[{start:'18:00',end:'22:00'}]),...Array.from({length:2},()=>[{start:'18:00',end:'23:00'}])],exceptions:[]};}
// Confirmado por el dueño el 30/10/2026: Maps decía 11:00; la apertura correcta es 12:00.
export function sahtenOpeningHours(){const h=sahtenDeliveryHours();h.weekly=h.weekly.map(p=>p.length?[{start:'12:00',end:'15:30'},...p]:[]);return h;}
export function sahtenDeliveryPolicy() {
  const rows = [
    [2,2190,15000,[[25000,0]],'#397450'],[3.5,2990,15000,[[35000,0]],'#4a7e8c'],
    [5,3990,15000,[[35000,1990],[50000,0]],'#8c7540'],[6.5,5490,30000,[[55000,2750],[80000,0]],'#9d6744'],
    [8,6990,40000,[[80000,3500]],'#805f87'],[8.5,9000,15000,[],'#7b6262'],
  ];
  return { version: 2, revision: 'sahten-delivery-preparada-2026-10-24', active: false, promotionsEnabled: false, stackWithPayment: true,
    hours:sahtenDeliveryHours(), center: { ...SAHTEN_CENTER }, regularMaxKm: 8, maxRouteKm: 8.5, routingProvider: 'openrouteservice',
    zones: rows.map(([radiusKm,baseCost,minOrder,benefits,color],i) => ({ id: 'delivery-'+(i+1), name: i===5?'Excepcional':'Zona '+(i+1), type:'circle', innerRadiusKm:i?rows[i-1][0]:0, radiusKm, baseCost, minOrder, benefits:benefits.map(([threshold,cost])=>({threshold,cost})), enabled:true, requiresAuthorization:i===5, color, points:[], holes:[] })) };
}
export function prepareDeliveryConfig(t = {}, slug = '') {
  const address=String(t.address||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (slug !== 'sahten' && !(address.includes('roca') && address.includes('1489') && address.includes('vicente'))) return t;
  if(t.openingHours==null)t={...t,openingHours:sahtenOpeningHours()};
  if(t.deliveryV2)return t.deliveryV2.hours?t:{...t,deliveryV2:{...t.deliveryV2,hours:sahtenDeliveryHours()}};
  return { ...t, deliveryV2: sahtenDeliveryPolicy() };
}
