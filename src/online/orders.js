// Pedido que llega de la web (tabla orders de Supabase) → pedido del Mostrador. Puro.
import { savedPaymentDiscount } from '../core/payment-benefit.js';
export const STATUS_FROM_REMOTE = { pendiente: 'pendiente', recibido: 'pendiente', preparando: 'en_preparacion', listo: 'listo', entregado: 'listo', cancelado: 'cancelado' };
export const STATUS_TO_REMOTE = { pendiente: 'pendiente', en_preparacion: 'preparando', listo: 'listo', completada: 'entregado', cancelado: 'cancelado' };
export const PAYMENT_LABELS = { paid: 'Pago acreditado', overpaid: 'Cobro excedente · revisar', in_mediation: 'Pago en disputa', pending: 'Pago pendiente', partial: 'Pago incompleto', rejected: 'Pago rechazado', refunded: 'Reembolsado', partially_refunded: 'Reembolso parcial', charged_back: 'Contracargo', unverified: 'Sin pago verificado' };
export function paymentFields(row) {
  const verified = row.payment_provider === 'mercadopago' && row.payment_ref;
  const status = verified && PAYMENT_LABELS[row.payment_status] ? row.payment_status : row.payload?.paymentMethod === 'mercadopago' ? 'unverified' : null;
  return { paymentProvider: verified ? 'mercadopago' : null, paymentStatus: status, paymentStatusLabel: PAYMENT_LABELS[status] || '', paymentReference: verified ? row.payment_ref : null };
}

/**
 * row = { id, payload, status, created_at }. `existing` = pedidos locales (para numerar y no duplicar).
 * Devuelve el pedido local, o null si ya estaba importado.
 */
export function toLocalOrder(row, existing = []) {
  if (!row || !row.payload || typeof row.payload !== 'object') return null;
  if (existing.some(o => o.remoteId === row.id)) return null;
  const p = row.payload;
  const num = existing.reduce((m, o) => Math.max(m, o.num || 0), 0) + 1;
  const discount = Math.max(0, Math.min(Number(p.subtotal) || 0, Number(p.discountAmount ?? p.discount) || 0));
  const paymentDiscount = savedPaymentDiscount(p);
  const items = (Array.isArray(p.items) ? p.items : []).map(i => ({
    productId: i.productId || i.id, name: String(i.name || '?'), qty: +i.qty || 0, unitPrice: +i.unitPrice || 0, lineTotal: +i.lineTotal || (+i.unitPrice || 0) * (+i.qty || 0),
    ...(typeof i.priceRevision === 'string' ? { priceRevision: i.priceRevision.slice(0, 100) } : {}),
  }));
  return {
    ...paymentFields(row),
    id: 'web_' + row.id, remoteId: row.id, num, webNum: p.num || null, source: p.source === 'pickup' ? 'pickup' : 'delivery', origin: 'menu-online',
    createdAt: row.created_at || p.createdAt || new Date().toISOString(), status: STATUS_FROM_REMOTE[row.status] || 'pendiente', remoteStatus: row.status,
    customerName: String(p.customerName || 'Cliente online'), customerPhone: String(p.customerPhone || ''), customerEmail: String(p.customerEmail || ''), customerId: null,
    address: String(p.address || ''), lat: p.lat ?? null, lng: p.lng ?? null, paymentMethod: p.paymentMethod || '', paymentId: null, paymentName: ({efectivo:'Efectivo',transferencia:'Transferencia',mercadopago:'Mercado Pago',tarjeta:'Tarjeta'})[p.paymentMethod] || p.paymentMethod || '',
    items, subtotal: +p.subtotal || items.reduce((s, i) => s + i.lineTotal, 0), discount, discountAmount: discount, discountId: paymentDiscount ? 'cash-transfer' : null, discountName: paymentDiscount?.label || (discount ? String(p.discountName || 'Descuento').slice(0,150) : null), paymentDiscount,
    shipping: +p.shipping || 0, _zoneName: p.zoneName || '', total: +p.total || 0, notes: String(p.notes || ''),
  };
}
