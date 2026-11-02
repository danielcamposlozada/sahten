import {scheduleMatches,localDateParts} from './promotions.js';
const week=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const nice=(v)=>String(v||'').replace(/^0/,'');
const date=d=> /^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?
  String(d).slice(8,10)+'/'+String(d).slice(5,7)+'/'+String(d).slice(0,4):null;
const names=list=>list.length===7?'todos los días':list.map(n=>week[n]||'').filter(Boolean).join(', ');
export function campaignContext(c,{now=new Date(),paymentPercent=10,productNames={}}={}) {
  const s=c?.schedule,kind=s?.type||'always',base=Number(paymentPercent)||0;
  const extra=Number(c?.extraPercent)||0;
  const total=base+extra,days=kind==='weekly'?names(s.weekdays||[]):
    kind==='central_weekends'?'segundo y tercer viernes y sábado de cada mes':
    kind==='dates'?'fechas seleccionadas: '+(s.dates||[]).map(date).filter(Boolean).join(', '):
    'todos los días';
  const hours=s?.startTime||s?.endTime?'De '+(s.startTime||'00:00')+' a '+(s.endTime||'23:59'):'Todo el horario de atención';
  const ends=date(s?.until);
  const begins=date(s?.from);
  const scheduleText=days.charAt(0).toUpperCase()+days.slice(1);
  const dates=ends?'Hasta '+ends:begins?'Desde '+begins+' · sin fecha final programada':
    'Sin fecha de finalización programada';
  const channelNames=(c.channels||[]).map(x=>x==='online'?'Web / pedidos online':x==='mostrador'?'Mostrador':x);
  const cap=Number(c.maxUnits)>0?'Máximo '+c.maxUnits+' unidad'+(Number(c.maxUnits)===1?'':'es')+' elegible'+(Number(c.maxUnits)===1?'':'s'):'Sin límite específico por unidades publicado';
  const participating=(c.productIds||[]).map(id=>({id,name:productNames[id]||id}));
  const status=!c.enabled?'Pausada':scheduleMatches(s,now)?'Habilitada y aplicable hoy':'Habilitada · fuera del calendario';
  const ads=(c.advertising?.placement||[]).map(id=>({
    ticket:'Ticket de cliente',cart:'Carrito',checkout:'Checkout',menu:'Menú web'
  }[id]||id));
  return {
    scheduleText,hours,dates,status,dayText:days,from:begins,until:ends,
    daysOfWeek:kind==='weekly'?[...(s.weekdays||[])]:kind==='always'?[0,1,2,3,4,5,6]:[],
    channelNames,cap,participating,ads,
    discount:`${total}% total (${base}% habitual + ${extra} puntos adicionales)`,
    methods:'Efectivo o transferencia; los descuentos adicionales no se aplican con Mercado Pago',
    cumulative:'El porcentaje total incluye el beneficio habitual; no se suma otra vez.',
    requiresAdditionalProduct:!c.triggerProductIds?.length,
    extraRequirement:c.triggerProductIds?.length?
      'Requiere carrito con los productos disparadores configurados':'No exige agregar otro producto: alcanza con uno elegible.',
    expiryText:dates,
    applicability:status
  };
}
