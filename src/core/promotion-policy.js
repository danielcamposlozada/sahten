// A single definition shared by quotes, publication checks and the owner UI.
// Only server-owned catalog data may supply these rules when accepting an order.
export function promotionPaymentFee(config={}) {
  const policy=config.commercialPolicy||{};
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<100;
  if(valid(policy.mercadopagoFeePercent))return {percent:policy.mercadopagoFeePercent,
    provisional:policy.mercadopagoFeeProvisional!==false,source:'commercial_policy',revision:policy.revision||null};
  if(valid(config.checkoutProFeePercent))return {percent:config.checkoutProFeePercent,
    provisional:false,source:'configured_rate',revision:null};
  return {percent:10,provisional:true,source:'provisional_default',revision:null};
}
export function promotionRule(config={},productId='',campaign={}) {
  const policy=config.commercialPolicy||{},override=policy.products?.[productId]||{};
  const number=(value,fallback)=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
  return {
    minMarginPct:number(override.minMarginPct,number(campaign.minMarginPct,number(policy.minMarginPct,number(config.minMarginPct,40)))),
    maxTotalPercent:number(override.maxTotalPercent,number(policy.maxTotalPercent,20)),
    revision:policy.revision||null,
  };
}
export function validatePromotionPolicy(policy) {
  if(!policy||typeof policy!=='object'||Array.isArray(policy))return ['Configuración inválida.'];
  const errors=[],valid=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const check=(p,label)=>{
    if(p.minMarginPct!=null&&!valid(p.minMarginPct,0,95))errors.push(label+': el margen debe estar entre 0 y 95 %.');
    if(p.maxTotalPercent!=null&&!valid(p.maxTotalPercent,10,95))errors.push(label+': el descuento total debe estar entre 10 y 95 %.');
  };
  if(policy.minMarginPct==null||policy.maxTotalPercent==null)errors.push('Completá el margen general y el descuento máximo.');
  check(policy,'General');
  if(policy.mercadopagoFeePercent!=null&&!valid(policy.mercadopagoFeePercent,0,99.99))errors.push('La comisión estimada de Mercado Pago debe estar entre 0 y 99,99 %.');
  if(policy.mercadopagoFeeProvisional!=null&&typeof policy.mercadopagoFeeProvisional!=='boolean')errors.push('Indicá si la comisión de Mercado Pago es provisional.');
  if(policy.products!=null&&(typeof policy.products!=='object'||Array.isArray(policy.products)))errors.push('Las excepciones por producto no son válidas.');
  else for(const [id,p] of Object.entries(policy.products||{})){
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!p||typeof p!=='object'||Array.isArray(p))errors.push('Producto inválido.');
    else check(p,id);
  }
  return errors;
}
export function promotionHeadroom({price,cost,commissionPercent=0,rule={}}){
  if(price==null||cost==null||!Number.isFinite(Number(price))||Number(price)<=0||!Number.isFinite(Number(cost))||Number(cost)<0)
    return {known:false,maxTotalPercent:null,reason:'Falta precio o costo base confirmado.'};
  const margin=Number(rule.minMarginPct??40)/100,fee=Number(commissionPercent)/100;
  if(margin<0||margin>=1||fee<0||fee>=1)return {known:false,maxTotalPercent:null,reason:'Revisá margen y comisión.'};
  // Margin after fees: (net - fee - cost) / (net - fee).
  const maximum=100*(1-Number(cost)/(Number(price)*(1-fee)*(1-margin)));
  return {known:true,maxTotalPercent:Math.floor(Math.max(0,Math.min(Number(rule.maxTotalPercent??20),maximum))*100)/100,
    reason:maximum<0?'El precio actual no alcanza el margen requerido, incluso sin descuento.':null};
}
