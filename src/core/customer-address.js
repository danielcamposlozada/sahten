// Direcciones de clientes del Mostrador: lectura de la principal y
// guardado de la dirección usada en un delivery. Sin DOM ni red.
import { addressText } from './customer-import.js';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const norm = value => clean(value, 300).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const coord = value => (value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null));

/** Dirección principal lista para precargar el delivery, o null si el cliente no tiene una. */
export function customerPrimaryAddress(customer) {
  if (!customer) return null;
  const list = Array.isArray(customer.addresses) ? customer.addresses : [];
  const primary = list.find(a => a?.isPrimary) || list[0] || null;
  const address = clean(primary ? addressText(primary) : customer.address, 300) || clean(customer.address, 300);
  if (!address) return null;
  const lat = coord(primary?.lat), lng = coord(primary?.lng);
  return {
    address,
    // El piso de una dirección importada ya forma parte del texto (addressText);
    // solo las guardadas desde el Mostrador lo traen por separado.
    addressFloor: clean(primary?.addressFloor, 30),
    addressApartment: clean(primary?.apartment, 30),
    deliveryReference: clean(primary?.reference, 200),
    lat: lat !== null && lng !== null ? lat : null,
    lng: lat !== null && lng !== null ? lng : null,
  };
}

/**
 * Guarda en el cliente la dirección usada en un delivery y la deja como principal.
 * Devuelve true si cambió algo. Una dirección existente (misma calle y altura)
 * se actualiza en lugar de duplicarse; las demás se conservan.
 */
export function rememberCustomerAddress(customer, delivery) {
  if (!customer || !delivery) return false;
  const address = clean(delivery.address, 300);
  if (!address) return false;
  const lat = coord(delivery.lat), lng = coord(delivery.lng);
  const entry = {
    address,
    addressFloor: clean(delivery.addressFloor, 30),
    apartment: clean(delivery.addressApartment, 30),
    reference: clean(delivery.deliveryReference, 200),
    ...(lat !== null && lng !== null ? { lat, lng } : {}),
    source: 'Mostrador',
  };
  const list = Array.isArray(customer.addresses) ? customer.addresses.map(a => ({ ...a })) : [];
  if (!list.length && clean(customer.address, 300) && norm(customer.address) !== norm(address)) {
    list.push({ address: clean(customer.address, 300), isPrimary: false, source: 'Manual' });
  }
  const index = list.findIndex(a => norm(addressText(a)) === norm(address));
  const before = JSON.stringify({ address: customer.address || '', addresses: customer.addresses || [] });
  if (index >= 0) {
    const current = list[index];
    list[index] = { ...current, ...entry, reference: entry.reference || current.reference || '', ...(entry.lat === undefined && current.lat != null ? { lat: current.lat, lng: current.lng } : {}) };
  } else list.unshift(entry);
  const primaryIndex = index >= 0 ? index : 0;
  list.forEach((a, i) => { a.isPrimary = i === primaryIndex; });
  customer.addresses = list;
  customer.address = address;
  return JSON.stringify({ address: customer.address, addresses: customer.addresses }) !== before;
}
