// Terms come from the authenticated server lookup, never from the checkout form.
export function couponForMethod(coupon,method){
 if(!coupon)return null;
 if(['efectivo','transferencia'].includes(method))return coupon;
 const mp=coupon.mercadopago;
 if(method!=='mercadopago'||mp?.enabled!==true||!Number.isFinite(Number(mp.totalPercent))||Number(mp.totalPercent)<=0)return null;
 return {...coupon,paymentPercent:0,totalPercent:Number(mp.totalPercent),extraPercent:Number(mp.totalPercent),
  minEligibleSubtotal:Number(mp.minEligibleSubtotal)||0,maxExtraAmount:mp.maxExtraAmount??null,
  productIds:mp.productIds||coupon.productIds,method:'mercadopago'};
}
export function couponTerms(coupon={}){
 const money=n=>'$'+Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});
 const parts=[coupon.channel==='mostrador'?'Solo mostrador':'Solo tienda online','Efectivo o transferencia'];
 const extra=Number(coupon.extraPercent),base=Number(coupon.paymentPercent);
 if(extra>0&&Number.isFinite(base))parts.push('Hasta '+(coupon.totalPercent??base+extra)+'% total, incluido el beneficio por pago');
 if(Number(coupon.minEligibleSubtotal)>0)parts.push('Mínimo en productos participantes '+money(coupon.minEligibleSubtotal));
 if(coupon.maxExtraAmount!=null)parts.push('Tope adicional '+money(coupon.maxExtraAmount));
 if(coupon.mercadopago?.enabled===true){const mp=coupon.mercadopago;parts.push('Pagando con Mercado Pago: '+mp.totalPercent+'% total'+(Number(mp.minEligibleSubtotal)>0?' desde '+money(mp.minEligibleSubtotal)+' en productos participantes':'')+(mp.maxExtraAmount!=null?', tope '+money(mp.maxExtraAmount):', sin tope de descuento'));}
 parts.push('Productos participantes','Envío excluido','No acumulable con otras promociones','Un uso por teléfono');
 return parts.join('. ')+'.';
}
