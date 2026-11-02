// Campañas: creación guiada sin publicar descuentos.
export const WEEK_DAYS=[['Lun',1],['Mar',2],['Mié',3],['Jue',4],['Vie',5],['Sáb',6],['Dom',0]];
const clean=v=>String(v??'').trim();
export function campaignTemplate(preset='weekly',id='custom'){
  const base={id,name:'Nueva campaña',kind:'public',enabled:false,priority:10,
    extraPercent:5,channels:['online'],productIds:[],
    advertising:{enabled:false,placement:[],message:''}};
  if(preset==='mon-wed')return {...base,name:'Lunes y miércoles · selección especial',schedule:{type:'weekly',weekdays:[1,3]}};
  if(preset==='central')return {...base,name:'Fines de semana centrales',schedule:{type:'central_weekends'}};
  if(preset==='dates')return {...base,name:'Promoción de fechas especiales',schedule:{type:'dates',dates:[]}};
  return {...base,schedule:{type:'weekly',weekdays:[1,3]}};
}
export function validateCampaignDraft(c){
  const issues=[];
  if(clean(c?.name).length<4||clean(c?.name).length>100)issues.push('Escribí un nombre de entre 4 y 100 caracteres.');
  if(!Number.isFinite(Number(c?.extraPercent))||Number(c.extraPercent)<=0||Number(c.extraPercent)>20)
    issues.push('Elegí un descuento adicional mayor que 0 y de hasta 20 puntos.');
  if(!Array.isArray(c?.productIds)||c.productIds.length===0)issues.push('Seleccioná al menos un producto.');
  if(!Array.isArray(c?.channels)||c.channels.length===0)issues.push('Seleccioná al menos un canal de venta.');
  const r=c?.schedule||{};
  if(r.type==='weekly'&&(!Array.isArray(r.weekdays)||!r.weekdays.length||r.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)))
    issues.push('Elegí por lo menos un día de la semana.');
  else if(r.type==='dates'&&(!Array.isArray(r.dates)||!r.dates.length||r.dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d))))
    issues.push('Agregá por lo menos una fecha válida.');
  else if(!['weekly','dates','central_weekends','always'].includes(r.type))issues.push('Elegí cuándo se repite la campaña.');
  if(r.from&&r.until&&r.until<r.from)issues.push('La fecha de finalización debe ser posterior a la inicial.');
  if(r.startTime&&r.endTime&&r.endTime<r.startTime)issues.push('La hora de cierre debe ser posterior a la apertura.');
  return issues;
}
export function describeSchedule(schedule={}){
  const r=schedule;
  if(r.type==='weekly'){
    const selected=WEEK_DAYS.filter(([,id])=>r.weekdays?.includes(id)).map(([name])=>name);
    return selected.length?'Todos los '+selected.join(', '):'Elegí los días';
  }
  if(r.type==='central_weekends')return 'Segundo y tercer viernes y sábado de cada mes';
  if(r.type==='dates')return (r.dates||[]).length+' fechas elegidas';
  return r.type==='always'?'Todos los días':'Sin programación';
}
