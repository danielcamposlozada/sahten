import {activeCampaigns} from '../core/promotions.js';
import {salesPaused} from '../core/sales-availability.js';
const editorialEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function editorialBenefitEnabled(menu){
 const b=menu.payments?.benefit,m=menu.payments?.methods||{};
 return menu.config?.enabled!==false&&b?.enabled===true&&Number(b.percent)===10&&b.channels?.online!==false&&!!(m.efectivo||m.transferencia);
}
export function editorialCampaignMarkup(menu,now=new Date()){
 if(menu.config?.enabled===false)return '';
 return activeCampaigns(menu.promotions,now,'online').filter(c=>c.advertising?.enabled!==false&&c.advertising?.placement?.includes('menu')&&
  c.productIds?.some(id=>menu.products.some(p=>p.id===id&&!p.retired&&!p.upsellOnly&&!salesPaused(p,Number(now)))))
  .slice(0,2).map(c=>'<article class="public-promo"><div><p class="combo-kicker">PROMOCIÓN VIGENTE</p><h2>'+editorialEscape(c.name)+'</h2><p>'+editorialEscape(c.advertising.message||'Consultá las condiciones al armar tu pedido.')+'</p><p class="promo-conditions">Efectivo o transferencia. Productos seleccionados. '+(c.maxUnits?'Hasta '+editorialEscape(c.maxUnits)+' unidad por pedido. ':'')+'El envío se calcula aparte.</p></div><a class="combo-cta" href="pedir/">Ver platos y condiciones ↗</a></article>').join('');
}
