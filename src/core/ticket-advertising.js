import { activeCampaigns, scheduleMatches, localDateParts, expiryLabel } from './promotions.js';
function upcomingDate(c,now,maxDays) {
  for(let d=1;d<=maxDays;d++){
    const check=new Date(new Date(now).getTime()+d*86400000);
    if(scheduleMatches(c.schedule,check))return localDateParts(check).iso;
  }
  return null;
}
const clean=(s,max=150)=>String(s||'').replace(/[\r\n<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function selectTicketAdvertisement(config,{now=new Date(),channel='mostrador',coupon=null,excludedPromotionIds=[],rotationKey=null}={}){
  if(config?.enabled!==true||config.ticket?.enabled!==true)return null;
  // El código individual YA debe haberse emitido por el backend; jamás generarlo al imprimir.
  if(coupon?.code&&coupon?.expiresOn&&coupon?.status==='available'){
    return {kind:'coupon',couponId:clean(coupon.id,90),code:clean(coupon.code,64),
      expiresOn:coupon.expiresOn,headline:clean(coupon.headline||'Tu próxima compra online'),label:expiryLabel(coupon.expiresOn)};
  }
  if(config.ticket?.advertise===false)return null;
  const applied=new Set(Array.isArray(excludedPromotionIds)?excludedPromotionIds:[]);
  const listed=Array.isArray(config.campaigns)?config.campaigns.filter(c=>!applied.has(c?.id)&&c?.enabled&&c.advertising?.enabled&&
    c.advertising?.placement?.includes('ticket')&&(!c.channels||c.channels.includes(channel))):[];
  const upcoming=listed.map(c=>({c,next:upcomingDate(c,now,Math.max(0,Math.min(14,Number(c.advertising.advanceDays)||4)))}))
    .filter(v=>v.next).sort((a,b)=>a.next.localeCompare(b.next) || (b.c.priority||0)-(a.c.priority||0));
  // Las promociones activas se alternan entre tickets; sólo se elige UNA.
  // Las usadas en esta compra están excluidas y las próximas fechas sólo
  // aparecen cuando no hay una campaña actualmente disponible.
  const live=activeCampaigns(config,now,channel).filter(c=>
    !applied.has(c.id)&&c.advertising?.enabled&&c.advertising.placement?.includes('ticket'))
    .sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id)));
  if(rotationKey!==null){
    const eligible=live.length?live:upcoming.map(v=>v.c);
    if(!eligible.length)return null;
    const index=(Math.abs(Number(rotationKey)||0)%eligible.length);
    const chosen=eligible[index];
    const next=live.length?null:upcoming.find(v=>v.c.id===chosen.id)?.next;
    return {kind:'campaign',campaignId:clean(chosen.id,90),
      headline:clean(chosen.advertising?.message||chosen.name),
      ...(next?{startsOn:next}:{}),selectedAt:new Date(now).toISOString()};
  }
  const found=upcoming[0] ? {c:upcoming[0].c,upcoming:upcoming[0].next}
    : activeCampaigns(config,now,channel).filter(c=>!applied.has(c.id)&&c.advertising?.enabled&&c.advertising.placement?.includes('ticket'))
      .sort((a,b)=>(b.priority||0)-(a.priority||0)).map(c=>({c}))[0];
  if(!found)return null;
  return {kind:'campaign',campaignId:clean(found.c.id,90),
    headline:clean(found.c.advertising?.message||found.c.name),
    ...(found.upcoming?{startsOn:found.upcoming}:{}),
    selectedAt:new Date(now).toISOString()};
}
