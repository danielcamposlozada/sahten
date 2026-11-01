// Manifiesto público de campañas: publicar tanto las activas como las pausadas.
// Mantener los IDs de las pausadas permite reactivarlas mediante un RPC, sin reexportar la web.
// Nunca incluir costos, márgenes, clientes, cupones privados ni credenciales.
export function promotionCampaignManifest(campaigns = []) {
  return (Array.isArray(campaigns) ? campaigns : [])
    .filter(c => c && c.kind === 'public' && typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(c.id))
    .map(c => ({
      id:c.id, name:String(c.name || '').slice(0,120), kind:'public', enabled:c.enabled===true,
      extraPercent:c.extraPercent, priority:c.priority,
      channels:Array.isArray(c.channels)?c.channels.filter(x=>['online','mostrador'].includes(x)):[],
      productIds:Array.isArray(c.productIds)?c.productIds.filter(x=>typeof x==='string'):[],
      schedule:c.schedule,
      ...(c.advertising?.enabled===true ? {advertising:{
        enabled:true,
        placement:Array.isArray(c.advertising.placement)?c.advertising.placement.filter(x=>['ticket','cart','checkout','menu'].includes(x)):[],
        message:String(c.advertising.message||'').slice(0,180),
        advanceDays:c.advertising.advanceDays||4
      }} : {})
    }));
}
