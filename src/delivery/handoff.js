import { validDeliveryPoint } from '../core/delivery.js';

/** URL universal de Google Maps: destino preciso y origen en el dispositivo del repartidor. */
export function deliveryNavigation(order) {
  if (!(order?.source === 'delivery' || order?.orderType === 'delivery') || !['en_preparacion', 'listo', 'enviado'].includes(order.status)) return null;
  const point = { lat: order.lat, lng: order.lng };
  const exact = validDeliveryPoint(point);
  const address = String(order.address || '').trim().slice(0, 300);
  if (!exact && (address.length < 5 || /^retiro en local$/i.test(address))) return null;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', exact ? point.lat + ',' + point.lng : address);
  url.searchParams.set('travelmode', 'driving');
  url.searchParams.set('dir_action', 'navigate');
  // No fijar origen: Maps puede iniciar desde el GPS actual, sin buscar la dirección.
  return { url: url.href, exact, number: '#' + String(order.num || 0).padStart(4, '0') };
}

export function installDeliveryHandoff(w) {
  const details = deliveryNavigation;
  const resolve = id => details(w.sahtenOrders?.().find(o => String(o.id) === String(id)));
  const toast = message => w.sahtenToast?.(message);
  async function manual(route) {
    const body = w.document.createElement('div');
    const p = w.document.createElement('p');
    p.textContent = 'El equipo no permitió copiar automáticamente. El enlace está seleccionado: copialo y pegalo al repartidor.';
    const label = w.document.createElement('label'); label.textContent = 'Enlace de la ruta';
    const input = w.document.createElement('input'); input.className = 'sd-input'; input.readOnly = true; input.value = route.url;
    label.append(input); body.append(p, label);
    return w.sahtenDialog({ title: 'Ruta ' + route.number, body, actions: [{ label: 'Listo', value: true, primary: true }], onOpen() { input.focus(); input.select(); } });
  }
  async function copy(id, unavailable = false) {
    const route = resolve(id);
    if (!route) { toast('La ruta se habilita al aceptar el delivery y necesita un destino.'); return; }
    try {
      await w.navigator.clipboard.writeText(route.url);
      toast(unavailable ? 'Este equipo no permite compartir. Ruta copiada: pegala al repartidor.' : 'Ruta copiada. Pegala al repartidor: abre el destino en Google Maps.');
    } catch { await manual(route); }
  }
  async function share(id) {
    const route = resolve(id);
    if (!route) { toast('La ruta se habilita al aceptar el delivery y necesita un destino.'); return; }
    const data = { title: 'Reparto ' + route.number, text: 'Pedido ' + route.number + ' · Ruta para la entrega', url: route.url };
    if (typeof w.navigator.share !== 'function' || (w.navigator.canShare && !w.navigator.canShare(data))) return copy(id, true);
    try { await w.navigator.share(data); }
    catch (e) { if (e.name !== 'AbortError') await copy(id, true); }
  }
  return { details, copy, share };
}
