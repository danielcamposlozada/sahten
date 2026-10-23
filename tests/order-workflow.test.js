import { describe, it, expect } from 'vitest';
import { isOnlineOrder, onlineOrderType, allowedStatuses, nextOnlineStatus, onlineStatusLabel, activeOnlineOrders, recentOnlineOrders, orderUnitCount, operationalSort } from '../src/online/order-workflow.js';

const order = (source, status, extra = {}) => ({
  id: source + status, remoteId: source + status, source, status, createdAt: '2026-10-23T12:00:00Z', items: [{ qty: 2 }, { qty: 3 }], ...extra,
});

describe('tablero Pedidos online', () => {
  it('separa pedidos importados de ventas de mostrador', () => {
    expect(isOnlineOrder(order('pickup', 'pendiente'))).toBe(true);
    expect(isOnlineOrder({ id: 'local', source: 'delivery', orderType: 'delivery' })).toBe(false);
    expect(onlineOrderType(order('pickup', 'pendiente'))).toBe('pickup');
    expect(onlineOrderType(order('delivery', 'pendiente'))).toBe('delivery');
  });
  it('mantiene recorridos independientes de retiro y delivery', () => {
    expect(allowedStatuses(order('pickup', 'listo'))).toContain('retirado');
    expect(allowedStatuses(order('pickup', 'listo'))).not.toContain('enviado');
    expect(nextOnlineStatus(order('pickup', 'listo'))).toEqual({ status: 'retirado', label: 'Marcar retirado' });
    expect(nextOnlineStatus(order('delivery', 'listo'))).toEqual({ status: 'enviado', label: 'Marcar enviado' });
    expect(nextOnlineStatus(order('delivery', 'enviado'))).toEqual({ status: 'entregado', label: 'Confirmar entrega' });
    expect(nextOnlineStatus(order('delivery', 'entregado'))).toBe(null);
    expect(onlineStatusLabel(order('pickup', 'listo'))).toBe('Listo para retirar');
    expect(onlineStatusLabel(order('delivery', 'listo'))).toBe('Listo para enviar');
  });
  it('muestra enviados hasta confirmar la entrega y excluye finalizados', () => {
    const data = ['pendiente','en_preparacion','listo','enviado','entregado','cancelado'].map(s => order('delivery', s));
    expect(activeOnlineOrders(data).map(x => x.status)).toEqual(['pendiente','en_preparacion','listo','enviado']);
    expect(orderUnitCount(data[0])).toBe(5);
    expect([...activeOnlineOrders(data)].reverse().sort(operationalSort).map(x => x.status)).toEqual(['pendiente','en_preparacion','listo','enviado']);
  });
  it('muestra completados durante 30 minutos sin perder el historial', () => {
    const now = Date.parse('2026-10-23T13:00:00Z');
    const data = [
      order('pickup','retirado',{completedAt:'2026-10-23T12:45:00Z'}),
      order('delivery','entregado',{completedAt:'2026-10-23T12:10:00Z'}),
      order('delivery','cancelado',{completedAt:'2026-10-23T12:58:00Z'}),
    ];
    expect(recentOnlineOrders(data,now).map(x=>x.status)).toEqual(['cancelado','retirado']);
  });
});
