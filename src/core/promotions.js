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
    // El mayor beneficio gana: nunca sumar campaña pública, upselling y cupón.
    selections.sort((a,b)=>b.extraPercent-a.extraPercent || b.priority-a.priority);
    let winner=selections[0]||null;
    let extra=winner?amount(winner.maxUnits?Math.min(l.qty,winner.maxUnits)*l.unitCents:base,winner.extraPercent):0;
    // Cupones: tope global por pedido, no por línea.
    if(winner?.kind==='coupon') {extra=Math.min(extra,remainingCoupon.cents);remainingCoupon.cents-=extra;}
    const payment=amount(base,paymentPercent);
    let lineDiscount=Math.min(base,payment+extra);
    const cost=trustedCosts[l.productId];
    const known=cost!=null && Number.isFinite(Number(cost)) && Number(cost)>=0;
    if(winner && config.requireVerifiedCosts && !known) {winner=null;extra=0;lineDiscount=payment;}
    const minMargin=Number(winner?.minMarginPct??config.minMarginPct);
    const fee=amount(base-lineDiscount,commissionPercent);
    if(winner && known && Number.isFinite(minMargin) && minMargin>0
      && base-lineDiscount-fee>0
      && (base-lineDiscount-fee-toCents(cost)*l.qty)/(base-lineDiscount-fee)*100 < minMargin) {
      winner=null;extra=0;lineDiscount=payment;
    }
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
export const INITIAL_CAMPAIGNS = [
  {id:'weekly-meals',name:'Lunes a miércoles · Platos seleccionados',kind:'public',enabled:false,
    extraPercent:5,priority:20,channels:['online','mostrador'],
    schedule:{type:'weekly',weekdays:[1,2,3]},
    productIds:[],
    advertising:{enabled:true,placement:['ticket','cart'],message:'Hasta 15% en platos seleccionados'}},
  {id:'central-tables',name:'Tablas para compartir · Fines de semana centrales',kind:'public',enabled:true,
    extraPercent:5,priority:30,channels:['online','mostrador'],
    schedule:{type:'central_weekends'},
    productIds:[],
    advertising:{enabled:true,placement:['ticket','cart'],message:'Fines de semana de tablas · Hasta 15%'} }
];
export const INITIAL_UPSELLS = [
  {id:'baklava-up',name:'Complemento dulce',kind:'upsell',enabled:false,extraPercent:10,priority:40,
    productIds:[],maxUnits:1,
    triggerProductIds:[],
    suppressIfPresent:[]}
];
export function initialPromotionConfig() {
  return {version:1,enabled:false,paymentPercent:10,minMarginPct:40,checkoutProFeePercent:null,campaigns:JSON.parse(JSON.stringify(INITIAL_CAMPAIGNS)),
    upsells:JSON.parse(JSON.stringify(INITIAL_UPSELLS)),ticket:{enabled:false,review:true,advertise:true}};
}
