// Resumen puro para el Centro de Promociones. No cambia flags ni publica ofertas.
import { scheduleMatches } from './promotions.js';
const asArray=value=>Array.isArray(value)?value:[];
const names={campaigns:'Campaña',upsells:'Complemento',crossSells:'Sugerencia',productUpgrades:'Mejora'};
export function promotionOverview(config={}, {live=null,now=new Date()}={}){
  const published=live?.published===true;
  const liveRows=new Map(asArray(live?.campaigns).filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
  // Los flags de planificación no equivalen al estado del servidor.
  const list=[];
  for(const [type,label] of Object.entries(names)){
    for(const item of asArray(config[type])){
      if(!item||typeof item.id!=='string')continue;
      const row=type==='campaigns'?liveRows.get(item.id):null;
      const inWindow=type!=='campaigns'||scheduleMatches(item.schedule??null,now);
      // Nunca interpretar un flag local como beneficio en vivo.
      // La web prevalece sobre el borrador local: un proyecto puede estar desactualizado.
      const liveConfirmed=type==='campaigns'&&published&&row?.enabled===true;
      const active=liveConfirmed&&inWindow;
      const status=active?'active':liveConfirmed&&!inWindow?'scheduled'
        :type==='campaigns'&&published&&row?'inactive'
        :item.enabled===true?'pending':'draft';
      const detail=type==='upsells'&&Array.isArray(item.discountTiers)&&item.discountTiers.length
        ?item.discountTiers.map(t=>Number(t.totalDiscountPercent)+'% total desde $'+Number(t.minEligibleNetSubtotal).toLocaleString('es-AR')).join(' · ')
        :Number(item.extraPercent)>0?(type==='campaigns'?'+'+Number(item.extraPercent)+' puntos adicionales':Number(item.extraPercent)+' puntos adicionales')
        :'Sin descuento adicional';
      list.push({id:item.id,name:String(item.name||item.id),type,label,status,active,detail,scheduled:status==='scheduled',localEnabled:item.enabled===true});
    }
  }
  const programs=config.couponPrograms&&typeof config.couponPrograms==='object'&&!Array.isArray(config.couponPrograms)?config.couponPrograms:{};
  for(const [id,item] of Object.entries(programs)){
    if(!item||typeof item!=='object')continue;
    list.push({id,name:String(item.name||id),type:'couponPrograms',label:'Cupón',status:item.enabled?'pending':'draft',
      active:false,detail:Number(item.extraPercent||0)+' puntos adicionales · mínimo $'+Number(item.minEligibleSubtotal||0).toLocaleString('es-AR'),
      localEnabled:item.enabled===true});
  }
  return {items:list,active:list.filter(x=>x.active).length,inactive:list.filter(x=>x.status==='inactive'||x.status==='draft').length,
    pending:list.filter(x=>x.status==='pending'||x.status==='scheduled').length,liveKnown:published};
}
export function filterPromotionOverview(rows,filter='all'){
  return rows.filter(x=>filter==='all'||filter==='active'&&x.active||filter==='inactive'&&!x.active);
}
