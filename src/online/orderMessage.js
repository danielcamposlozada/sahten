// Pedido del menú publicado → mensaje de WhatsApp. Puro. Se inyecta tal cual en la web publicada (sin imports).
export const PAY_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', tarjeta: 'Tarjeta' };

const money = (n, symbol = '$', locale = 'es-AR') => symbol + Number(n || 0).toLocaleString(locale, { maximumFractionDigits: 0 });

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
  if (o.source === 'delivery' && o.address) msg += 'Dirección: ' + o.address + (o.zoneName ? ' (' + o.zoneName + ')' : '') + '\n';
  msg += '\n*Detalle:*\n';
  (o.items || []).forEach(it => { msg += '  • ' + it.name + ' ×' + it.qty + ' — ' + m(it.lineTotal) + '\n'; });
  msg += '\nSubtotal: ' + m(o.subtotal) + '\n';
  if (o.source === 'delivery') msg += 'Envío: ' + (o.shipping ? m(o.shipping) : 'Gratis') + '\n';
  msg += '*Total: ' + m(o.total) + '*\n';
  msg += 'Pago: ' + (PAY_LABELS[o.paymentMethod] || o.paymentMethod || '') + '\n';
  if (o.notes) msg += 'Notas: ' + o.notes + '\n';
  return msg;
}

export function waUrl(number, order, opts) {
  const n = normalizePhone(number);
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(buildWaMessage(order, opts));
}
