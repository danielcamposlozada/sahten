import { scheduleMatches } from './promotions.js';

// La configuración publicada tiene precedencia sobre los borradores del equipo.
// get_promotion_campaign_states es la fuente de verdad para enabled/revision.
// get_store_ticket_promotions completa los campos públicos que la vista necesita.
export function publishedPromotionCatalog(localCampaigns=[],live=null,ticketSnapshot=null) {
  if(live?.published!==true || !Array.isArray(live.campaigns)) return localCampaigns;
  const locally=new Map((Array.isArray(localCampaigns)?localCampaigns:[]).map(c=>[c.id,c]));
  const ticket=new Map((Array.isArray(ticketSnapshot?.campaigns)?ticketSnapshot.campaigns:[]).map(c=>[c.id,c]));
  return live.campaigns.map(row=>{
    const local=locally.get(row.id)||{},server=ticket.get(row.id)||{};
    return {...local,...server,id:row.id,name:server.name||local.name||row.id,
      kind:'public',enabled:row.enabled===true,
      schedule:Object.hasOwn(server,'schedule')?server.schedule:local.schedule,
      advertising:server.advertising||local.advertising||{enabled:false,placement:[]},
      channels:server.channels||local.channels||[]};
  });
}

export function livePromotionStatus(row,campaign,now=new Date()) {
  if(!row) return {status:'unknown',label:'Sin verificar'};
  if(row.enabled!==true)return {status:'inactive',label:'Pausada'};
  if(campaign && !scheduleMatches(campaign.schedule,now))
    return {status:'scheduled',label:'Activa · fuera de calendario'};
  return {status:'active',label:'Activa ahora'};
}

export function ticketCampaignDetails(campaign={}) {
  const schedule=campaign.schedule||null;
  const limit=Number(campaign.maxUnits);
  const terms=[];
  if(Number.isFinite(limit)&&limit>0) terms.push('Hasta '+limit+' unidad'+(limit===1?'':'es')+' participante'+(limit===1?'':'s'));
  if(Array.isArray(campaign.channels)&&campaign.channels.length===1&&campaign.channels[0]==='online')
    terms.push('Solo online');
  if(Number(campaign.extraPercent)>0&&Array.isArray(campaign.channels)&&campaign.channels.includes('online'))
    terms.push('Efectivo o transferencia');
  const until=schedule?.until||null;
  return {terms,expiry:until?'Hasta '+until.slice(8,10)+'/'+until.slice(5,7)+'/'+until.slice(0,4):
    !schedule||schedule.type==='always'?'Sin fecha de fin programada':null};
}
