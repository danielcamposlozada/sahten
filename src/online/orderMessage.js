import {deliveryAddressLines,cashChangeQuote} from '../core/order-details.js';
// Pedido del menú publicado → mensaje de WhatsApp. El generador inyecta también sus dependencias y elimina los imports.
export const PAY_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', tarjeta: 'Tarjeta' };

const money = (n, symbol = '$', locale = 'es-AR') => symbol + Number(n || 0).toLocaleString(locale, { maximumFractionDigits: 2 });

/** Solo dígitos, con el 54 9 de Argentina si viene un número local de 10 dígitos. */
export function normalizePhone(raw, defaultCountry = '549') {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  d = d.replace(/^00/, '');
  if (d.length === 10) d = defaultCountry + d;
  if (d.startsWith('54') && !d.startsWith('549') && d.length === 12) d = '549' + d.slice(2);
  return d;
}

/**
 * order = { num, createdAt, source:'delivery'|'pickup', customerName, customerPhone, customerEmail, address, zoneName,
 *           paymentMethod, items:[{ name, qty, lineTotal }], subtotal, shipping, total, notes }
 */
export function buildWaMessage(o, { symbol = '$', locale = 'es-AR' } = {}) {
  const num = '#' + String(o.num || 0).padStart(4, '0');
  const d = new Date(o.createdAt || Date.now());
  const when = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }) + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const m = n => money(n, symbol, locale);
  // Sin emojis: wa.me los convierte en «�» al redirigir en algunos navegadores (probado con un redirect real).
  let msg = 'Hola! Quiero hacer un pedido.\n\n';
  msg += '*Pedido ' + num + '* · ' + when + '\n';
  msg += o.source === 'delivery' ? '*Delivery*\n' : '*Retiro en local*\n';
  msg += '\nCliente: *' + (o.customerName || 'Cliente') + '*\n';
  if (o.customerPhone) msg += 'Tel: ' + o.customerPhone + '\n';
  if (o.customerEmail) msg += 'Email: ' + o.customerEmail + '\n';
  if (o.source === 'delivery' && o.address) msg += 'Dirección: ' + o.address + (o.zoneName ? ' (' + o.zoneName + ')' : '') + '\n' + deliveryAddressLines(o).slice(1).join('\n') + (deliveryAddressLines(o).length>1?'\n':'');
  msg += '\n*Detalle:*\n';
  (o.items || []).forEach(it => { msg += '  • ' + it.name + ' ×' + it.qty + ' — ' + m(it.lineTotal) + '\n'; });
  msg += '\nSubtotal: ' + m(o.subtotal) + '\n';
  if (Number(o.discountAmount ?? o.discount) > 0) msg += (o.discountName || 'Descuento') + ': −' + m(o.discountAmount ?? o.discount) + '\n';
  if (o.source === 'delivery') msg += 'Envío: ' + (o.shipping ? m(o.shipping) : 'Gratis') + '\n';
  if (o.deliverySnapshot?.discount > 0) msg += 'Ahorro en envío: ' + m(o.deliverySnapshot.discount) + '\n';
  msg += '*Total: ' + m(o.total) + '*\n';
  msg += 'Pago: ' + (PAY_LABELS[o.paymentMethod] || o.paymentMethod || '') + '\n';
  if (o.notes) msg += 'Notas: ' + o.notes + '\n';
  const cash = cashChangeQuote(o.total, o.cashTendered, o.paymentMethod);
  if(cash.specified && cash.valid) msg += 'Paga con: ' + m(cash.tendered) + '\nVuelto: ' + m(cash.change) + '\n';
  return msg;
}

export function waUrl(number, order, opts) {
  const n = normalizePhone(number);
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(buildWaMessage(order, opts));
}
