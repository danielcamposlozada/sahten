// Pedido que llega de la web (tabla orders de Supabase) → pedido del Mostrador. Puro.
export const STATUS_FROM_REMOTE = { pendiente: 'pendiente', recibido: 'pendiente', preparando: 'en_preparacion', listo: 'listo', entregado: 'listo', cancelado: 'cancelado' };
export const STATUS_TO_REMOTE = { pendiente: 'pendiente', en_preparacion: 'preparando', listo: 'listo', completada: 'entregado', cancelado: 'cancelado' };

/**
 * row = { id, payload, status, created_at }. `existing` = pedidos locales (para numerar y no duplicar).
 * Devuelve el pedido local, o null si ya estaba importado.
 */
export function toLocalOrder(row, existing = []) {
  if (!row || !row.payload || typeof row.payload !== 'object') return null;
  if (existing.some(o => o.remoteId === row.id)) return null;
  const p = row.payload;
  const num = existing.reduce((m, o) => Math.max(m, o.num || 0), 0) + 1;
  const items = (Array.isArray(p.items) ? p.items : []).map(i => ({
    productId: i.productId || i.id, name: String(i.name || '?'), qty: +i.qty || 0, unitPrice: +i.unitPrice || 0, lineTotal: +i.lineTotal || (+i.unitPrice || 0) * (+i.qty || 0),
  }));
  return {
    id: 'web_' + row.id, remoteId: row.id, num, webNum: p.num || null, source: p.source === 'pickup' ? 'pickup' : 'delivery', origin: 'menu-online',
    createdAt: row.created_at || p.createdAt || new Date().toISOString(), status: STATUS_FROM_REMOTE[row.status] || 'pendiente',
    customerName: String(p.customerName || 'Cliente online'), customerPhone: String(p.customerPhone || ''), customerEmail: String(p.customerEmail || ''), customerId: null,
    address: String(p.address || ''), lat: p.lat ?? null, lng: p.lng ?? null, paymentMethod: p.paymentMethod || '', paymentId: null, paymentName: p.paymentMethod || '',
    items, subtotal: +p.subtotal || items.reduce((s, i) => s + i.lineTotal, 0), discount: 0, discountId: null, discountName: null,
    shipping: +p.shipping || 0, _zoneName: p.zoneName || '', total: +p.total || 0, notes: String(p.notes || ''),
  };
}
