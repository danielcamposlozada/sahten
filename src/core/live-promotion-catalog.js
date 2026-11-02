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
  if(row.enabled!==true)return {status:'inactive',label:'Pausada en web'};
  if(campaign && !scheduleMatches(campaign.schedule,now))
    return {status:'scheduled',label:'Activa en web · fuera de calendario'};
  return {status:'active',label:'Activa en web · ahora'};
}

export function ticketCampaignDetails(campaign={}) {
  const schedule=campaign.schedule||null;
  const limit=Number(campaign.maxUnits);
  const terms=[];
  if(schedule?.type==='weekly')terms.push('Días: '+(schedule.weekdays||[]).map(x=>({0:'dom',1:'lun',2:'mar',3:'mié',4:'jue',5:'vie',6:'sáb'}[x]||'')).filter(Boolean).join('/'));
  else if(schedule?.type==='central_weekends')terms.push('2.º y 3.º viernes/sábado');
  else if(schedule?.type==='dates')terms.push('Fechas elegidas');
  else terms.push('Todos los días');
  if(schedule?.startTime||schedule?.endTime)terms.push((schedule.startTime||'00:00')+'–'+(schedule.endTime||'23:59'));
  if(Number.isFinite(limit)&&limit>0) terms.push('Hasta '+limit+' unidad'+(limit===1?'':'es')+' participante'+(limit===1?'':'s'));
  if(Array.isArray(campaign.channels)&&campaign.channels.length===1&&campaign.channels[0]==='online')
    terms.push('Solo online');
  if(Number(campaign.extraPercent)>0&&Array.isArray(campaign.channels)&&campaign.channels.includes('online'))
    terms.push('Efectivo o transferencia');
  const until=schedule?.until||null;
  return {terms,expiry:until?'Hasta '+until.slice(8,10)+'/'+until.slice(5,7)+'/'+until.slice(0,4):
    'Sin fecha de fin programada'};
}
