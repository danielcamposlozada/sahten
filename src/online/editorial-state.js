import {activeCampaigns} from '../core/promotions.js';
import {salesPaused} from '../core/sales-availability.js';
export const editorialEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function editorialBenefitEnabled(menu){
 const b=menu.payments?.benefit,m=menu.payments?.methods||{};
 return menu.config?.enabled!==false&&b?.enabled===true&&Number(b.percent)===10&&b.channels?.online!==false&&!!(m.efectivo||m.transferencia);
}
export function editorialCampaignMarkup(menu,now=new Date(),shopHref='pedir/'){
 if(menu.config?.enabled===false||menu.config?.showPrices===false)return '';
 const b=menu.payments?.benefit,base=b?.enabled&&b.channels?.online!==false?Number(b.percent)||0:0;
 const methods=['efectivo','transferencia'].filter(m=>menu.payments?.methods?.[m]!==false);
 if(!methods.length)return '';
 return activeCampaigns(menu.promotions,now,'online').map(c=>{
  const products=(menu.products||[]).filter(p=>c.productIds?.includes(p.id)&&!p.retired&&!p.upsellOnly&&!salesPaused(p,Number(now)));
  if(!products.length||!(Number(c.extraPercent)>0))return '';
  const total=base+Number(c.extraPercent||0),names=products.map(p=>p.name),validity=c.schedule?.until?'Hasta '+c.schedule.until:'Sin fecha final programada';
  return '<article class="public-promo" data-public-promotion="'+editorialEscape(c.id)+'"><div><p class="combo-kicker">PROMOCIÓN VIGENTE</p><h2>'+editorialEscape(c.name)+'</h2>'
   +'<p><strong>Hasta '+total+'% total</strong> con '+methods.join(' o ')+'. Incluye el beneficio por medio de pago.</p>'
   +'<p class="promo-conditions">'+(c.maxUnits?'Hasta '+editorialEscape(c.maxUnits)+' unidad'+(Number(c.maxUnits)===1?'':'es')+' participante'+(Number(c.maxUnits)===1?'':'s')+' por pedido. ':'')+editorialEscape(validity)+'. Envío excluido. No acumulable con otras promociones.</p>'
   +'<details><summary>Ver '+names.length+' plato'+(names.length===1?'':'s')+' participante'+(names.length===1?'':'s')+'</summary><ul>'+names.map(n=>'<li>'+editorialEscape(n)+'</li>').join('')+'</ul></details></div><a class="combo-cta" href="'+editorialEscape(shopHref)+'?beneficio='+encodeURIComponent(c.id)+'#pedido">Elegir estos platos ↗</a></article>';
 }).join('');
}
export function editorialLoyaltyMarkup(menu,programs=[],shopHref='pedir/'){
 if(menu.config?.enabled===false||menu.config?.showPrices===false||menu.promotions?.enabled!==true)return '';
 const money=n=>'$'+Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});
 return programs.map(p=>{
  const products=(menu.products||[]).filter(product=>p.productIds?.includes(product.id)&&!product.retired&&!product.upsellOnly&&!salesPaused(product));
  if(!products.length)return '';
  const total=Number(p.totalPercent??Number(p.extraPercent)+Number(p.paymentPercent||0));
  if(!Number.isFinite(total)||total<=0)return '';
  return '<article class="public-promo" data-public-promotion="'+editorialEscape(p.id)+'"><div><p class="combo-kicker">'+(p.id==='first_online'?'TU PRIMER PEDIDO WEB':'VOLVÉ A ELEGIRNOS')+'</p><h2>'+editorialEscape(p.name)+'</h2>'
   +'<p><strong>Hasta '+total+'% total</strong> con efectivo o transferencia, en productos participantes.</p>'
   +(p.mercadopago?.enabled===true?'<p><strong>'+Number(p.mercadopago.totalPercent)+'% pagando con Mercado Pago</strong>'+ (Number(p.mercadopago.minEligibleSubtotal)>0?' desde '+money(p.mercadopago.minEligibleSubtotal)+' en productos participantes':' en productos participantes')+(p.mercadopago.maxExtraAmount==null?', sin tope de descuento.':', tope '+money(p.mercadopago.maxExtraAmount)+'.')+' Envío aparte.</p>':'')
   +'<p class="promo-conditions">'+(Number(p.minEligibleSubtotal)>0?'Desde '+money(p.minEligibleSubtotal)+' en productos participantes.':'Productos participantes.')+'</p><details><summary>Condiciones y productos</summary><p>'+ (Number(p.minEligibleSubtotal)>0?'Mínimo en productos participantes '+money(p.minEligibleSubtotal)+'. ':'')+(p.maxExtraAmount!=null?'Tope del descuento adicional '+money(p.maxExtraAmount)+'. ':'')+'Incluye el beneficio por pago. Envío excluido. Un uso por teléfono. No acumulable con otras promociones. '+(p.endsOn?'Programa hasta '+editorialEscape(p.endsOn)+'. ':'Programa sin fecha final programada. ')+'Cada cupón vence '+Number(p.validDays)+' días después de su emisión.</p>'
   +'<p>'+(p.id==='first_online'?'Ingresá tu teléfono en la tienda para consultar el beneficio.':'El beneficio se emite después de confirmar y cobrar tu primera compra web. Usá el mismo teléfono para encontrarlo en tu próximo pedido.')+'</p>'
   +'<ul>'+products.map(product=>'<li>'+editorialEscape(product.name)+'</li>').join('')+'</ul></details></div><a class="combo-cta" href="'+editorialEscape(shopHref)+'?beneficio='+encodeURIComponent(p.id)+'#pedido">Ver productos del beneficio ↗</a></article>';
 }).join('');
}
