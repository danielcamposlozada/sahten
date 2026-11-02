// Historial de publicidad basada en tickets efectivamente preparados.
// No guarda nuevos datos personales: aprovecha los pedidos conservados en el
// proyecto y sus snapshots. Nunca identifica a alguien por el nombre.
const raw = value => String(value||'').trim();
const normalizePhone = phone => {
  const digits=raw(phone).replace(/\D/g,'');
  return digits.length>=10?digits.slice(-10):digits.length>=8?digits:'';
};
export function ticketCustomerKeys(order) {
  const keys=[];
  if(raw(order?.customerId))keys.push('id:'+raw(order.customerId));
  const phone=normalizePhone(order?.customerPhone);
  if(phone)keys.push('phone:'+phone);
  const email=raw(order?.customerEmail).toLowerCase();
  if(email.includes('@')&&email.length>3)keys.push('email:'+email);
  return keys;
}
const sameOrder = (a,b) => a===b ||
  !!(a?.id && a.id===b?.id) ||
  !!(a?.remoteId && a.remoteId===b?.remoteId);
const adOf = row => {
  const snap=row?.promotionTicketSnapshot;
  if(!snap||!['campaign','coupon'].includes(snap.kind))return null;
  const at=Date.parse(snap.selectedAt||row.createdAt||'');
  if(!Number.isFinite(at))return null;
  return {kind:snap.kind,campaignId:snap.campaignId||null,couponId:snap.couponId||null,shownAt:at};
};

/**
 * Historial verificable por cliente: 90 días entre anuncios de una misma
 * campaña. Para ventas anónimas no inventamos una identidad; solamente
 * evitamos repetir los últimos 3 anuncios de la tienda en este equipo.
 * No ocultamos el descuento realmente aplicado en el comprobante.
 */
export function ticketAdvertisingHistory(order, orders=[], {
  now=new Date(),cooldownDays=90,anonymousRecent=3
}={}) {
  const id=new Set(ticketCustomerKeys(order));
  const identified=id.size>0;
  const timestamp=Number(new Date(now)),since=timestamp-cooldownDays*86400000;
  const records=(Array.isArray(orders)?orders:[])
    .filter(row=>!sameOrder(row,order))
    .map(row=>({row,ad:adOf(row)}))
    .filter(({ad})=>ad&&ad.shownAt<=timestamp&&ad.shownAt>=since)
    .sort((a,b)=>b.ad.shownAt-a.ad.shownAt);
  if(identified) {
    const matched=records.filter(({row})=>ticketCustomerKeys(row).some(k=>id.has(k)));
    return {identityKnown:true,
      recentAdvertisements:matched.map(({ad})=>ad),
      avoidCampaignIds:[]};
  }
  const avoidCampaignIds=[...new Set(records
    .filter(({ad})=>ad.kind==='campaign'&&ad.campaignId)
    .slice(0,Math.max(0,anonymousRecent))
    .map(({ad})=>ad.campaignId))];
  return {identityKnown:false,recentAdvertisements:[],avoidCampaignIds};
}
