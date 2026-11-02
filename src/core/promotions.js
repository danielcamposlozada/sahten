// SAHTEN: motor puro. Nunca confiar en precios/costos/cupones suministrados por el navegador.
// Recalcular en el servidor antes de aceptar un pedido. Los importes usan centavos enteros.
import { assessIncrementalUpsell } from './upsell-economics.js';
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
  // Publicaciones comerciales sin calendario se mantienen siempre activas.
  // Un objeto inválido/no configurado no habilita descuentos accidentalmente.
  if(rule===null)rule={type:'always'};
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
  commissionPercent = 0, trustedCosts = {}, clientPreview = false,
  trustedEconomics = {}, trustedUpsellSelection = null, trustedOrderCosts = null
} = {}) {
  const source = Array.isArray(lines)?lines:[];
  const details=source.filter(l=>Number(l.qty)>0 && Number(l.unitPrice)>=0).map(l=>({
    productId:String(l.productId||l.id||''), qty:Math.floor(Number(l.qty)),
    unitCents:toCents(l.unitPrice)
  })).filter(l=>l.productId && l.qty>0 && l.qty<=999);
  const gross = details.reduce((n,l)=>n+l.qty*l.unitCents,0);
  const cash = ['efectivo','transferencia'].includes(method);
  const paymentPercent = cash ? Math.max(0,Math.min(100,Number(config.paymentPercent??10))) : 0;
  const campaigns = cash ? activeCampaigns(config,now,channel) : [];
  const strictUpsells = config.upsellGuardRequired === true || config.activationPolicy?.requireIncrementalAndBasketMarginCheck === true;
  const couponValid = cash && couponIsEligible(coupon,{now,channel,customerId});
  const eligibleGross = details.reduce((n,l)=>n+(couponValid&&eligibleLine(coupon,l,details)?l.qty*l.unitCents:0),0);
  const canCoupon = couponValid && eligibleGross>=toCents(coupon.minEligibleSubtotal||0);
  const used = new Set();
  const remainingCoupon = {cents:canCoupon && coupon.maxExtraAmount != null ? toCents(coupon.maxExtraAmount):Infinity};
  const breakdown=details.map(l=>{
    const base=l.unitCents*l.qty, isFour=l.productId===FOUR_FATAY_ID;
    const selections=[];
    if(config.enabled && !isFour) {
      for(const c of campaigns) if(eligibleLine(c,l,details))selections.push({
        id:c.id, name:c.name, extraPercent:Math.max(0,Math.min(20-paymentPercent,Number(c.extraPercent)||0)), priority:Number(c.priority)||0,
        kind:'campaign',maxUnits:c.maxUnits,minMarginPct:c.minMarginPct,requiresVerifiedCosts:c.requiresVerifiedCosts===true
      });
      for(const c of (config.upsells||[])) if(!strictUpsells && cash && c.enabled && c.kind==='upsell' && eligibleLine(c,l,details))
        selections.push({id:c.id,name:c.name,extraPercent:Number(c.extraPercent)||0,priority:Number(c.priority)||0,kind:'upsell',maxUnits:c.maxUnits,minMarginPct:c.minMarginPct});
      if(canCoupon && eligibleLine(coupon,l,details))selections.push({
        id:coupon.id,name:coupon.name||'Recompensa',extraPercent:Math.max(0,Math.min(20-paymentPercent,Number(coupon.extraPercent)||0)),priority:1000,kind:'coupon'
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
      // Una regla con piso de margen siempre exige un costo firmado por el servidor.
      // Evita aplicar descuentos ante la pérdida de un snapshot de costos.
      if((!clientPreview&&(config.requireVerifiedCosts||candidate.requiresVerifiedCosts||
          (candidate.minMarginPct!=null && Number.isFinite(Number(candidate.minMarginPct))
            && Number(candidate.minMarginPct)>0)))&&!known)return null;
      // Un ingreso cero o negativo nunca supera el piso de margen, aunque el costo también sea cero.
      const realized=base-discount-fee;
      if(!clientPreview&&known&&Number.isFinite(minMargin)&&minMargin>0&&
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
  // En modo servidor estricto, primero calcular campañas/cupones. Después,
  // de manera independiente, como máximo UN upsell por pedido. No confiar en
  // marcas de "artículo añadido" provenientes del JSON del cliente.
  if(config.enabled && strictUpsells && trustedUpsellSelection?.verified === true) {
    const pending=[];
    for(const promotion of config.upsells || []) {
      if(!promotion?.enabled || promotion.kind !== 'upsell' || promotion.maxUnits !== 1)continue;
      const entry=details.find(l=>promotion.productIds?.includes(l.productId));
      if(!entry || !eligibleLine(promotion,entry,details))continue;
      const current=breakdown.find(l=>l.productId===entry.productId);
      if(!current || current.appliedPromotionId || entry.qty!==1)continue;
      // Escala Fatay: el mínimo se calcula sobre los platos disparadores
      // ya cotizados por servidor (NETO, sin Fatay, envío ni otros complementos).
      // El descuento objetivo es TOTAL en todos los medios de pago, no +30pp.
      let extra=fromCents(amount(entry.unitCents,promotion.extraPercent));
      if(Array.isArray(promotion.discountTiers) && promotion.discountTiers.length){
        const qualifiedNet=breakdown.filter(l=>l.productId!==entry.productId
          && promotion.triggerProductIds?.includes(l.productId))
          .reduce((sum,l)=>sum+toCents(l.net),0);
        const tier=promotion.discountTiers.filter(t=>
          Number.isFinite(Number(t.minEligibleNetSubtotal))
          && qualifiedNet>=toCents(t.minEligibleNetSubtotal)
          && Number(t.totalDiscountPercent)>0 && Number(t.totalDiscountPercent)<=100
        ).sort((a,b)=>Number(b.minEligibleNetSubtotal)-Number(a.minEligibleNetSubtotal))[0];
        if(!tier)continue;
        const targetTotal=amount(entry.unitCents,tier.totalDiscountPercent);
        extra=fromCents(Math.max(0,targetTotal-toCents(current.discount)));
      }
      const verified=assessIncrementalUpsell({
        lines:details,currentLines:breakdown,upsell:promotion,productId:entry.productId,
        proposedExtra:extra,methodCommissionPercent:commissionPercent,
        trustedEconomics,trustedUpsellSelection,trustedOrderCosts,
        minBasketMarginPct:Number(config.activationPolicy?.basketContributionTargetPct||40),
        minIncrementalMarginPct:Number(config.activationPolicy?.minIncrementalContributionPct||40)
      });
      if(verified.approved)pending.push({promotion,entry,current,extra,verified});
    }
    pending.sort((a,b)=>(Number(b.promotion.priority)||0)-(Number(a.promotion.priority)||0) ||
      b.extra-a.extra || a.promotion.id.localeCompare(b.promotion.id));
    if(pending[0]) {
      const {promotion,entry,current,extra}=pending[0];
      current.promotionDiscount=extra;
      current.discount=fromCents(toCents(current.discount)+toCents(extra));
      current.net=fromCents(toCents(current.net)-toCents(extra));
      current.appliedPromotionId=promotion.id;
      current.appliedPromotionType='upsell';
      used.add(promotion.id);
    }
  }
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
