// Datos de entrega y efectivo. El importe entregado nunca forma parte de los ingresos.
export function deliveryDetails(input = {}, source = input?.source) {
  if (source !== 'delivery') return {};
  input = input || {};
  const clean = (value, max) => String(value ?? '').trim().slice(0, max);
  return { addressFloor: clean(input.addressFloor, 30), addressApartment: clean(input.addressApartment, 30), deliveryReference: clean(input.deliveryReference, 200) };
}
export function deliveryAddressLines(order = {}) {
  if (order.source !== 'delivery' && order.orderType !== 'delivery') return [];
  const d = deliveryDetails(order, 'delivery');
  return [String(order.address || '').trim(), [d.addressFloor ? 'Piso ' + d.addressFloor : '', d.addressApartment ? 'Depto ' + d.addressApartment : ''].filter(Boolean).join(' · '), d.deliveryReference ? 'Referencia: ' + d.deliveryReference : ''].filter(Boolean);
}
export function cashChangeQuote(total, value, method) {
  const specified = method === 'efectivo' && value !== '' && value != null;
  if (!specified) return { specified: false, valid: true, tendered: null, change: null, shortfall: 0 };
  const tendered = Number(value), due = Number(total);
  if (!Number.isFinite(tendered) || tendered < 0 || tendered > 100000000 || !Number.isFinite(due) || due < 0) return { specified: true, valid: false, tendered: null, change: null, shortfall: 0 };
  const received = Math.round(tendered * 100), centsDue = Math.round(due * 100);
  return { specified: true, valid: received >= centsDue, tendered: received / 100, change: Math.max(0, received - centsDue) / 100, shortfall: Math.max(0, centsDue - received) / 100 };
}
export function cashOrderFields(total, value, method) {
  const q = cashChangeQuote(total, value, method);
  return q.specified && q.valid ? { cashTendered: q.tendered, cashChange: q.change } : {};
}
