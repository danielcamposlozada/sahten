// Flujos del tablero operativo de pedidos online. No contiene DOM ni dependencias del navegador.
export const ONLINE_FLOWS = Object.freeze({
  pickup: ['pendiente', 'en_preparacion', 'listo', 'retirado'],
  delivery: ['pendiente', 'en_preparacion', 'listo', 'enviado', 'entregado'],
});
export const ONLINE_FINAL = Object.freeze(['retirado', 'entregado', 'cancelado']);
export const ONLINE_RECENT_MS = 30 * 60 * 1000;

export function isOnlineOrder(order) {
  return !!order && (!!order.remoteId || order.origin === 'menu-online' ||
    (!order.orderType && (order.source === 'delivery' || order.source === 'pickup')));
}

export function onlineOrderType(order) {
  return order?.source === 'pickup' || order?.orderType === 'retiro' ? 'pickup' : 'delivery';
}

export function allowedStatuses(order) {
  if (!isOnlineOrder(order)) return ['pendiente', 'en_preparacion', 'listo', 'cancelado'];
  return [...ONLINE_FLOWS[onlineOrderType(order)], 'cancelado'];
}

export function nextOnlineStatus(order) {
  if (!isOnlineOrder(order) || ONLINE_FINAL.includes(order.status)) return null;
  const steps = ONLINE_FLOWS[onlineOrderType(order)];
  const index = steps.indexOf(order.status);
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
  const labels = {
    en_preparacion: 'Empezar preparación',
    listo: 'Marcar listo',
    enviado: 'Marcar enviado',
    retirado: 'Marcar retirado',
    entregado: 'Confirmar entrega',
  };
  return next ? { status: next, label: labels[next] } : null;
}

export function onlineStatusLabel(order) {
  const labels = {
    pendiente: 'Pendiente',
    en_preparacion: 'En preparación',
    listo: onlineOrderType(order) === 'pickup' ? 'Listo para retirar' : 'Listo para enviar',
    enviado: 'En camino',
    retirado: 'Retirado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  return labels[order?.status] || String(order?.status || 'Pendiente');
}

export function activeOnlineOrders(orders) {
  return (orders || []).filter(o => isOnlineOrder(o) &&
    ['pendiente', 'en_preparacion', 'listo', 'enviado'].includes(o.status));
}

export function recentOnlineOrders(orders, now = Date.now(), windowMs = ONLINE_RECENT_MS) {
  return (orders || []).filter(o => {
    if (!isOnlineOrder(o) || !ONLINE_FINAL.includes(o.status)) return false;
    const end = Date.parse(o.completedAt || o.updatedAt || '');
    return Number.isFinite(end) && end <= now && now - end <= windowMs;
  }).sort((a, b) => Date.parse(b.completedAt || b.updatedAt) - Date.parse(a.completedAt || a.updatedAt));
}

export function orderUnitCount(order) {
  return (order?.items || []).reduce((n, item) => n + (Number(item.qty) || 0), 0);
}

// Primero los pedidos que aún necesitan cocina; después los listos y los enviados.
export function operationalSort(a, b) {
  const rank = { pendiente: 0, en_preparacion: 1, listo: 2, enviado: 3 };
  const diff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
  return diff || (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
}
