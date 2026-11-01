// SAHTEN: motor puro. Nunca confiar en precios/costos/cupones suministrados por el navegador.
// Recalcular en el servidor antes de aceptar un pedido. Los importes usan centavos enteros.
export const PROMOTIONS_VERSION = 1;
export const PROMOTIONS_TZ = 'America/Argentina/Buenos_Aires';
export const FOUR_FATAY_ID = 'p1779570052552';
const toCents = n => Math.round((Number(n) || 0) * 100);
const fromCents = n => Math.round(n) / 100;
const amount = (base, percent) => Math.round(base * Math.max(0, Math.min(100, Number(percent) || 0)) / 100);
const normDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||'')) ? String(value) : null;
export function localDateParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone:PROMOTIONS_TZ,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const iso = parts.year + '-' + parts.month + '-' + parts.day;
  const dayNumber = Number(parts.day);
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
  const firstWeekday = new Date(Date.UTC(Number(parts.year), Number(parts.month)-1,1)).getUTCDay();
  const nthFriday = 1 + Math.floor((dayNumber - (1+(5-firstWeekday+7)%7))/7);
  return { iso,weekday, dayNumber, month:Number(parts.month), year:Number(parts.year),
    hhmm:parts.hour+':'+parts.minute, fridayOrdinal: weekday===5?nthFriday:weekday===6
      ?1+Math.floor((dayNumber-1-(1+(5-firstWeekday+7)%7))/7):0 };
}
export function scheduleMatches(rule = {}, now = new Date()) {
  const d = localDateParts(now);
  if (rule.from && d.iso < rule.from || rule.until && d.iso > rule.until) return false;
  if (Array.isArray(rule.excludedDates) && rule.excludedDates.includes(d.iso)) return false;
  if (rule.type === 'weekly') {
    if (!Array.isArray(rule.weekdays) || !rule.weekdays.includes(d.weekday)) return false;
  } else if (rule.type === 'central_weekends') {
    if (![5,6].includes(d.weekday) || ![2,3].includes(d.fridayOrdinal)) return false;
  } else if (rule.type === 'dates') {
    if (!Array.isArray(rule.dates) || !rule.dates.includes(d.iso)) return false;
  } else if (rule.type !== 'always') return false;
  return !(rule.startTime && d.hhmm < rule.startTime || rule.endTime && d.hhmm > rule.endTime);
}
export function activeCampaigns(config, now = new Date(), channel = 'online') {
  if (!config?.enabled || !Array.isArray(config.campaigns)) return [];
  return config.campaigns.filter(c => c && c.enabled && c.kind === 'public'
    && (!c.channels || c.channels.includes(channel)) && scheduleMatches(c.schedule,now));
}
export function expiryLabel(isoDate) {
  const d=normDate(isoDate);
  if(!d)return '';
  return 'Válido hasta el '+d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);
}
export function expiresAtLocalDate(date) {
  const d=normDate(date);
  return d ? new Date(d+'T23:59:59.999-03:00') : null;
}
export function couponIsEligible(coupon,{now=new Date(),channel='online', customerId=null, orderId=null}={}) {
  if(!coupon || coupon.status!=='available' || coupon.channel && coupon.channel!==channel) return false;
  if(!normDate(coupon.expiresOn) || now>expiresAtLocalDate(coupon.expiresOn))return false;
  if(coupon.customerId && coupon.customerId!==customerId)return false;
  if(coupon.originOrderId && orderId && coupon.originOrderId===orderId)return false;
  return true;
}
function eligibleLine(candidate,line,lines) {
  if(candidate.productIds && !candidate.productIds.includes(line.productId))return false;
  if(candidate.excludeProductIds?.includes(line.productId))return false;
  if(candidate.kind==='upsell') {
    if(candidate.maxUnits && line.qty<1)return false;
    if(!lines.some(l=>l.productId!==line.productId && candidate.triggerProductIds?.includes(l.productId)))return false;
    if(lines.some(l=>candidate.suppressIfPresent?.includes(l.productId)))return false;
  }
  return true;
}
export function quotePromotions({
  lines = [], method = '', channel = 'online', now = new Date(),
  config = {}, coupon = null, customerId = null,
  commissionPercent = 0, trustedCosts = {}
} = {}) {
  const source = Array.isArray(lines)?lines:[];
  const details=source.filter(l=>Number(l.qty)>0 && Number(l.unitPrice)>=0).map(l=>({
    productId:String(l.productId||l.id||''), qty:Math.floor(Number(l.qty)),
    unitCents:toCents(l.unitPrice)
  })).filter(l=>l.productId && l.qty>0 && l.qty<=999);
  const gross = details.reduce((n,l)=>n+l.qty*l.unitCents,0);
  const cash = ['efectivo','transferencia'].includes(method);
  const paymentPercent = cash ? Math.max(0,Math.min(100,Number(config.paymentPercent??10))) : 0;
  const campaigns = activeCampaigns(config,now,channel);
  const couponValid = couponIsEligible(coupon,{now,channel,customerId});
  const eligibleGross = details.reduce((n,l)=>n+(couponValid&&eligibleLine(coupon,l,details)?l.qty*l.unitCents:0),0);
  const canCoupon = couponValid && eligibleGross>=toCents(coupon.minEligibleSubtotal||0);
  const used = new Set();
  const remainingCoupon = {cents:canCoupon && coupon.maxExtraAmount != null ? toCents(coupon.maxExtraAmount):Infinity};
  const breakdown=details.map(l=>{
    const base=l.unitCents*l.qty, isFour=l.productId===FOUR_FATAY_ID;
    const selections=[];
    if(config.enabled && !isFour) {
      for(const c of campaigns) if(eligibleLine(c,l,details))selections.push({
        id:c.id, name:c.name, extraPercent:Math.min(100,Number(c.extraPercent)||0), priority:Number(c.priority)||0,
        kind:'campaign',maxUnits: c.maxUnits
      });
      for(const c of (config.upsells||[])) if(c.enabled && c.kind==='upsell' && eligibleLine(c,l,details))
        selections.push({id:c.id,name:c.name,extraPercent:Number(c.extraPercent)||0,priority:Number(c.priority)||0,kind:'upsell',maxUnits:c.maxUnits,minMarginPct:c.minMarginPct});
      if(canCoupon && eligibleLine(coupon,l,details))selections.push({
        id:coupon.id,name:coupon.name||'Recompensa',extraPercent:Number(coupon.extraPercent)||0,priority:1000,kind:'coupon'
      });
    }
    // Elegir la mayor rebaja REAL en esta línea (incluidos topes y márgenes).
    const payment=amount(base,paymentPercent);
    const cost=trustedCosts[l.productId];
    const known=cost!=null && Number.isFinite(Number(cost)) && Number(cost)>=0;
    const candidates=selections.map(candidate=>{
      const part=candidate.maxUnits?Math.min(l.qty,candidate.maxUnits)*l.unitCents:base;
      const proposed=amount(part,candidate.extraPercent);
      const extra=candidate.kind==='coupon'?Math.min(proposed,remainingCoupon.cents):proposed;
      const discount=Math.min(base,payment+extra);
      const fee=amount(base-discount,commissionPercent);
      const minMargin=Number(candidate.minMarginPct??config.minMarginPct);
      if(config.requireVerifiedCosts&&!known)return null;
      // Un ingreso cero o negativo nunca supera el piso de margen, aunque el costo también sea cero.
      const realized=base-discount-fee;
      if(known&&Number.isFinite(minMargin)&&minMargin>0&&
        (realized<=0||(realized-toCents(cost)*l.qty)/realized*100<minMargin))return null;
      return {candidate,extra,discount};
    }).filter(Boolean).sort((a,b)=>b.discount-a.discount||b.candidate.priority-a.candidate.priority);
    const chosen=candidates[0]||null, winner=chosen?.candidate||null;
    const extra=chosen?.extra||0;
    const lineDiscount=chosen?.discount??payment;
    if(winner?.kind==='coupon')remainingCoupon.cents-=extra;
    if(winner)used.add(winner.id);
    return {productId:l.productId,qty:l.qty,base:fromCents(base),paymentDiscount:fromCents(payment),
      promotionDiscount:fromCents(extra),discount:fromCents(lineDiscount),
      net:fromCents(base-lineDiscount),appliedPromotionId:winner?.id||null,
      appliedPromotionType:winner?.kind||null,costsVerified:known};
  });
  const totalDiscount=breakdown.reduce((n,l)=>n+toCents(l.discount),0);
  const net=gross-totalDiscount;
  const fee=amount(net,commissionPercent);
  return {version:PROMOTIONS_VERSION,enabled:config.enabled===true,channel,method,paymentPercent,
    subtotal:fromCents(gross),discount:fromCents(totalDiscount),netSubtotal:fromCents(net),
    estimatedPaymentFee:fromCents(fee),lines:breakdown,appliedPromotionIds:[...used],
    couponId:canCoupon&&used.has(coupon.id)?coupon.id:null,
    snapshotAt:new Date(now).toISOString()};
}
// Plan comercial SAHTEN v2: SKUs confirmados contra el catálogo publicado de sahten.online.
// Se configuran como borradores. Ninguna campaña, cupón o anuncio se activa en producción.
export const INITIAL_CAMPAIGNS = [
  {id:'weekly-meals',name:'Lunes a miércoles · Favoritos seleccionados',kind:'public',enabled:false,
    extraPercent:5,priority:20,channels:['online','mostrador'],
    schedule:{type:'weekly',weekdays:[1,2,3]},
    productIds:['p1779467294622','p1779997171373','sandwich_falafel','arabe_clasico','shawarma_pollo'],
    advertising:{enabled:true,placement:['ticket','cart','menu'],message:'Lunes a miércoles · Hasta 15% con efectivo o transferencia en platos seleccionados'}},
  {id:'central-tables',name:'Tablas para compartir · Segundo y tercer viernes/sábado',kind:'public',enabled:false,
    extraPercent:5,priority:30,channels:['online','mostrador'],
    schedule:{type:'central_weekends'},
    productIds:['tabla_celebrar','p1779997050112'],
    advertising:{enabled:true,placement:['ticket','cart','menu'],message:'Segundo y tercer viernes y sábado · Hasta 15% en tablas seleccionadas'}}
];
export const INITIAL_UPSELLS = [
  {id:'baklava-up',name:'Baklava · Complemento dulce',kind:'upsell',enabled:false,
    extraPercent:10,priority:40,minMarginPct:40,productIds:['baklava'],maxUnits:1,
    triggerProductIds:['p1779467294622','p1779997171373','sandwich_falafel','arabe_clasico','shawarma_pollo'],
    suppressIfPresent:['tabla_celebrar']}
];
// Solo planificación y visibilidad en el editor: NO emitir ni canjear cupones desde un borrador.
export const INITIAL_COUPON_PROGRAMS = {
  first_online:{enabled:false,name:'Bienvenida web',channel:'online',extraPercent:5,
    minEligibleSubtotal:30000,validDays:14,maxExtraAmount:null,requiresConfirmedOrigin:false},
  second_online:{enabled:false,name:'Segunda compra web',channel:'online',extraPercent:10,
    minEligibleSubtotal:40000,validDays:14,maxExtraAmount:4000,requiresConfirmedOrigin:true}
};
// Actualiza borradores guardados con la vieja 0.4.34 sin pisar selecciones personalizadas.
// Si una campaña predeterminada no tenía productos elegidos, completamos el plan
// y la mantenemos pausada: no activamos ofertas implícitamente en una migración.
export function preparePromotionPlan(stored) {
  if(!stored || stored.version!==1 || !Array.isArray(stored.campaigns))return initialPromotionConfig();
  if(stored.planVersion>=2)return stored;
  const plan=initialPromotionConfig();
  const campaigns=stored.campaigns.map(c=>{
    const p=plan.campaigns.find(x=>x.id===c.id);
    return p&&(!Array.isArray(c.productIds)||c.productIds.length===0)
      ? {...c,enabled:false,productIds:[...p.productIds]}:c;
  });
  const upsells=(stored.upsells||[]).map(c=>{
    const p=plan.upsells.find(x=>x.id===c.id);
    return p&&(!Array.isArray(c.productIds)||c.productIds.length===0)
      ? {...c,enabled:false,productIds:[...p.productIds],
         triggerProductIds:[...p.triggerProductIds],suppressIfPresent:[...p.suppressIfPresent]}:c;
  });
  return {...stored,planVersion:2,campaigns,upsells,
    couponPrograms:stored.couponPrograms||plan.couponPrograms,
    requireVerifiedCosts:true,checkoutProFeePercent:stored.checkoutProFeePercent??null};
}

export function initialPromotionConfig() {
  return {version:1,planVersion:2,enabled:false,paymentPercent:10,minMarginPct:40,
    requireVerifiedCosts:true,checkoutProFeePercent:null,
    campaigns:JSON.parse(JSON.stringify(INITIAL_CAMPAIGNS)),
    upsells:JSON.parse(JSON.stringify(INITIAL_UPSELLS)),
    couponPrograms:JSON.parse(JSON.stringify(INITIAL_COUPON_PROGRAMS)),
    ticket:{enabled:false,review:true,advertise:true}};
}
