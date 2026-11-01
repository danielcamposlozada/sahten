import { deliveryAddressLines, cashChangeQuote } from '../core/order-details.js';
const escapeReceipt = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** El motor imprime importes confirmados; no calcula ni otorga promociones.
 * Solo desglosa las cifras del snapshot cuando cuadran exactamente con el
 * descuento recotizado. Si no coinciden, conserva el total original. */
export function receiptDiscountLines(order) {
  const cents=value=>{
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
    return Math.round(value*100);
  };
  const total=cents(order.discountAmount??order.discount??0);
  const subtotal=cents(order.subtotal);
  if(total===null||subtotal===null||total>subtotal)return null;
  const snapshot=order.promotionSnapshot;
  if(!snapshot || !Array.isArray(snapshot.lines) ||
     cents(snapshot.subtotal)!==subtotal ||
     cents(snapshot.discount)!==total ||
     cents(snapshot.netSubtotal)!==subtotal-total)
    return null;
  const products=new Map((order.items||[]).map(x=>[x.productId,x]));
  if(snapshot.lines.length!==products.size)return null;
  let basic=0,extra=0,used=new Set();
  const specials=[];
  for(const line of snapshot.lines){
    if(!products.has(line.productId)||used.has(line.productId))return null;
    used.add(line.productId);
    const item=products.get(line.productId);
    const base=cents(line.base),payment=cents(line.paymentDiscount),
      promotion=cents(line.promotionDiscount),discount=cents(line.discount),
      net=cents(line.net);
    if(base===null||payment===null||promotion===null||discount===null||net===null||
       Number(line.qty)!==Number(item.qty)||
       base!==cents(item.lineTotal)||payment+promotion!==discount||
       base-discount!==net)return null;
    basic+=payment;extra+=promotion;
    if(promotion>0)specials.push({productId:line.productId,name:String(item.name).slice(0,65),
      amount:promotion/100,kind:String(line.appliedPromotionType||'promotion')});
  }
  if(basic+extra!==total)return null;
  return {paymentAmount:basic/100,extras:specials};
}
export function buildReceipt(order, { paper, logoHtml = '', reviewHtml = '' } = {}) {
  const esc = escapeReceipt, money = value => '$' + Number(value || 0).toLocaleString('es-AR', {maximumFractionDigits:2});
  const compact = paper.contentMm <= 50, number = esc(String(order.num || 0).padStart(4,'0'));
  const textSize = compact ? 11 : 14, itemSize = compact ? 11.5 : 14;
  const headingSize = compact ? 14 : 17, totalSize = compact ? 13 : 17, metaSize = compact ? 10 : 12;
  const date = new Date(order.createdAt), delivery = order.source === 'delivery' || order.orderType === 'delivery';
  const address = deliveryAddressLines(order), cash = cashChangeQuote(order.total, order.cashTendered, order.paymentMethod);
  const row = (name,value,cls='') => '<div class="receipt-row '+cls+'"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comanda #${number}</title><style>
@page{margin:0;size:${paper.pageSize || 'auto'}}
*{box-sizing:border-box;margin:0;padding:0}html{background:#fff}
body{width: ${paper.contentMm}mm;max-width: ${paper.contentMm}mm;padding:1mm;margin:0;font-family:Arial,Helvetica,sans-serif;font-size:${textSize}px;line-height:1.2;color:#000;-webkit-print-color-adjust:exact;overflow-wrap:anywhere}
.logo-wrap{text-align:center;margin:0 0 3px}.logo-img,.logo-svg{display:block;width:auto;max-width:100%;height:auto;max-height:10mm;object-fit:contain;margin:auto}.logo-svg{width:100%}.brand{text-align:center;font-size:17px;font-weight:800}
.order-num{text-align:center;font-size:${headingSize}px;font-weight:800;margin:3px 0}.fulfilment{text-align:center;font-size:${textSize}px;font-weight:700}.meta{text-align:center;font-size:${metaSize}px;line-height:1.25}.customer{font-size:${itemSize}px;font-weight:700;margin:3px 0}
.delivery-details{border-block:1px solid #000;padding:3px 0;margin:4px 0;font-weight:600}.delivery-details h2{font-size:${textSize}px;font-weight:700}.delivery-details p{margin-top:2px}.delivery-details .phone{font-weight:400}
.receipt-items{border-block:1px dashed #000;margin:4px 0;padding:2px 0}.receipt-item{break-inside:avoid;padding:2px 0}.item-name{font-size:${itemSize}px;font-weight:600}.item-price{text-align:right;font-size:${itemSize}px;font-weight:700;white-space:normal;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.receipt-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 4px;font-size:${compact?11:13}px;padding:2px 0}.receipt-row span{min-width:0}.receipt-row strong{flex:0 0 auto;max-width:100%;margin-left:auto;text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.total-row{border-top:1px solid #000;margin-top:3px;padding-top:4px;font-size:${totalSize}px;font-weight:800}
.payment,.notes{font-size:${compact?11:13}px;font-weight:600;border-top:1px dashed #000;margin-top:4px;padding-top:3px}.notes{white-space:pre-wrap}.footer{text-align:center;font-size:${metaSize}px;margin-top:4px}
.receipt-review{text-align:center;border-top:1px dashed #000;margin-top:5px;padding-top:4px;break-inside:avoid;font-size:${compact?11:13}px;line-height:1.2;font-weight:400}.receipt-google-brand{display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:3px;font-size:${compact?13:15}px;font-weight:700}.receipt-google-logo{width:${compact?4:5}mm;height:${compact?4:5}mm;filter:grayscale(1) brightness(0)}.receipt-review-qr{display:block;width:30mm;height:30mm;max-width:100%;margin:3px auto}.receipt-review-help{display:none}
.receipt-promo{text-align:center;border-top:1px dashed #000;margin-top:5px;padding:5px 2px;break-inside:avoid;font-size:${compact?11:13}px}.receipt-promo strong{display:block;font-weight:800}.receipt-promo p{margin-top:3px}.receipt-promocode{font-size:${compact?14:17}px;font-weight:800;letter-spacing:.5px}
</style></head><body>${logoHtml}<div class="order-num">ORDEN #${number}</div><div class="fulfilment">${delivery?'DELIVERY':'RETIRO'}</div><div class="meta">${esc(date.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'}))} ${esc(date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false}))}</div><div class="customer">${esc(order.customerName || 'Consumidor Final')}</div>
${delivery?'<section class="delivery-details"><h2>ENTREGAR EN</h2>'+address.map(a=>'<p>'+esc(a)+'</p>').join('')+(!address.length?'<p>Dirección sin registrar</p>':'')+(order.customerPhone?'<p class="phone">Tel. '+esc(order.customerPhone)+'</p>':'')+'</section>':''}
<div class="receipt-items">${(order.items||[]).map(i=>'<div class="receipt-item"><div class="item-name">'+esc(i.qty)+'× '+esc(i.name)+'</div><div class="item-price">'+esc(money(i.lineTotal))+'</div></div>').join('')}</div>
${Number(order.discountAmount ?? order.discount)>0?row('Subtotal',money(order.subtotal))+(function(){const parts=receiptDiscountLines(order);if(!parts)return row(order.paymentDiscount?'Dto. '+order.paymentDiscount.percent+' %':order.discountName || 'Descuento','−'+money(order.discountAmount ?? order.discount));let v='';if(parts.paymentAmount)v+=row('Beneficio por pago'+(order.promotionSnapshot?.paymentPercent?' '+order.promotionSnapshot.paymentPercent+' %':''),'−'+money(parts.paymentAmount));for(const extra of parts.extras)v+=row('Descuento en '+extra.name,'−'+money(extra.amount));return v;})():''}
${delivery?row('Envío',order.shipping?money(order.shipping):'Gratis'):''}${order.deliverySnapshot?.discount>0?row('Ahorro envío',money(order.deliverySnapshot.discount)):''}${row('TOTAL',money(order.total),'total-row')}
${order.paymentName || order.paymentMethod?'<div class="payment">'+esc(order.paymentName || ({efectivo:'Efectivo',transferencia:'Transferencia',mercadopago:'Mercado Pago'})[order.paymentMethod] || order.paymentMethod)+'</div>':''}
${cash.specified && cash.valid?row('Paga con',money(cash.tendered))+row('Vuelto',money(cash.change)):''}
${order.notes?'<div class="notes">Nota: '+esc(order.notes)+'</div>':''}<div class="footer">Gracias por tu compra</div>${reviewHtml}</body></html>`;
}
