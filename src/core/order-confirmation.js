import { normalizeImportPhone } from './customer-import.js';
import { deliveryAddressLines } from './order-details.js';

export function estimateMinutes(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1440 ? n : null;
}
export function estimateSnapshot(value, now = new Date()) {
  const minutes = estimateMinutes(value);
  if (!minutes) return null;
  const at = new Date(now);
  return { minutes, updatedAt: at.toISOString(), dueAt: new Date(+at + minutes * 60000).toISOString() };
}
export function estimateLabel(order) {
  const estimate = order?.fulfillmentEstimate;
  if (!estimateMinutes(estimate?.minutes)) return '';
  const due = new Date(estimate.dueAt);
  if (Number.isFinite(+due)) return (order.source === 'delivery' || order.orderType === 'delivery' ? 'Entrega estimada: ' : 'Retiro estimado: ') + due.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' · ' + estimate.minutes + ' min';
  return estimate.minutes + ' min estimados';
}
export function whatsappPhone(value, businessPhone = '') {
  const text = String(value || '').trim();
  const digits = text.replace(/\D/g, '');
  if (/^(\+|00)/.test(text)) {
    const n = text.startsWith('00') ? digits.slice(2) : digits;
    return /^[1-9]\d{7,14}$/.test(n) ? n : '';
  }
  if (/^54\d{10,11}$/.test(digits)) return digits;
  if (String(businessPhone).replace(/\D/g, '').startsWith('54')) {
    return normalizeImportPhone(text, 'AR').phone.replace(/\D/g, '');
  }
  return '';
}
export function confirmationMessage(order, { store = {}, minutes } = {}) {
  const eta = estimateMinutes(minutes);
  if (!eta) return '';
  const delivery = order.orderType === 'delivery' || order.source === 'delivery';
  const name = String(order.customerName || '').trim();
  const number = '#' + String(order.webNum || order.num || 0).padStart(4, '0');
  const currency = store.currency || {};
  const total = (currency.symbol || '$') + Number(order.total || 0).toLocaleString(currency.locale || 'es-AR', { maximumFractionDigits: 2 });
  return [
    name && name !== 'Consumidor Final' ? 'Hola, ' + name + '.' : 'Hola.',
    'Recibimos tu pedido ' + number + (store.name ? ' en ' + store.name : '') + '.',
    ...(order.items || []).map(i => i.qty + ' × ' + i.name),
    delivery ? 'Entrega a domicilio: ' + deliveryAddressLines(order).join(' · ') : 'Retiro en el local' + (store.address ? ': ' + store.address : '') + '.',
    (delivery ? 'Entrega estimada' : 'Listo para retirar') + ': aproximadamente ' + eta + ' minutos desde este aviso.',
    'Total: ' + total + '.',
    order.paymentStatus === 'paid' ? 'Pago acreditado.' : order.paymentName ? 'Medio de pago: ' + order.paymentName + '.' : '',
    '¡Gracias por tu pedido!',
  ].filter(Boolean).join('\n');
}
