import { beforeAll, it, expect } from 'vitest';
import { customerPrimaryAddress, rememberCustomerAddress } from '../src/core/customer-address.js';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';

beforeAll(() => buildTestBundle(), 120000);

it('lee la dirección principal: texto simple, importada o guardada desde el Mostrador con piso y ubicación', () => {
  expect(customerPrimaryAddress(null)).toBeNull();
  expect(customerPrimaryAddress({ name: 'Sin dirección' })).toBeNull();
  expect(customerPrimaryAddress({ address: 'Calle Falsa 123' })).toMatchObject({ address: 'Calle Falsa 123', addressFloor: '', lat: null, lng: null });
  const imported = { address: 'x', addresses: [{ street: 'Calle Uno', number: '10', floor: '2B', city: 'Ciudad', isPrimary: false }, { street: 'Calle Dos', number: '20', city: 'Ciudad', reference: 'Portón verde', isPrimary: true }] };
  expect(customerPrimaryAddress(imported)).toMatchObject({ address: 'Calle Dos, 20, Ciudad', deliveryReference: 'Portón verde', addressFloor: '' });
  const saved = { addresses: [{ address: 'Calle Tres 30', addressFloor: '4', apartment: 'C', reference: 'Timbre 4C', lat: -34.5, lng: -58.5, isPrimary: true }] };
  expect(customerPrimaryAddress(saved)).toEqual({ address: 'Calle Tres 30', addressFloor: '4', addressApartment: 'C', deliveryReference: 'Timbre 4C', lat: -34.5, lng: -58.5 });
});

it('guarda la dirección del delivery como principal sin duplicar ni perder las anteriores', () => {
  const c = { id: 'c1', name: 'Cliente', address: 'Dirección vieja 1' };
  expect(rememberCustomerAddress(c, { address: 'Calle Nueva 99', addressFloor: '1', addressApartment: 'A', deliveryReference: 'Rejas', lat: -34.51, lng: -58.49 })).toBe(true);
  expect(c.address).toBe('Calle Nueva 99');
  expect(c.addresses).toHaveLength(2);
  expect(c.addresses.filter(a => a.isPrimary)).toEqual([expect.objectContaining({ address: 'Calle Nueva 99', addressFloor: '1', apartment: 'A', reference: 'Rejas', lat: -34.51, lng: -58.49 })]);
  expect(c.addresses.some(a => a.address === 'Dirección vieja 1')).toBe(true);
  // Misma dirección (con otra escritura): se actualiza, no se duplica; sin cambios no informa cambio.
  expect(rememberCustomerAddress(c, { address: 'calle nueva  99', addressFloor: '1', addressApartment: 'A', deliveryReference: 'Rejas', lat: -34.51, lng: -58.49 })).toBe(true);
  expect(c.addresses).toHaveLength(2);
  expect(rememberCustomerAddress(c, { address: 'calle nueva  99', addressFloor: '1', addressApartment: 'A', deliveryReference: 'Rejas', lat: -34.51, lng: -58.49 })).toBe(false);
  // Volver a la anterior la marca como principal y conserva una referencia ya guardada.
  rememberCustomerAddress(c, { address: 'Dirección vieja 1' });
  expect(c.address).toBe('Dirección vieja 1');
  expect(c.addresses.find(a => a.isPrimary).address).toBe('Dirección vieja 1');
  expect(rememberCustomerAddress(c, { address: '   ' })).toBe(false);
});

const customers = [
  { id: 'geo', name: 'Cliente Ubicado', phone: '1100000001', address: 'Calle Tres 30', addresses: [{ address: 'Calle Tres 30', addressFloor: '4', apartment: 'C', reference: 'Timbre 4C', lat: -34.53, lng: -58.48, isPrimary: true }] },
  { id: 'txt', name: 'Cliente Texto', phone: '1100000002', address: 'Avenida Ejemplo 1500' },
  { id: 'none', name: 'Cliente Sin Dirección', phone: '1100000003' },
];
async function page() {
  const { window: w } = await openApp(); loadRawDemo(w); w.eval('SAHTEN_CUSTOMERS=' + JSON.stringify(customers));
  w.showPanel('mostrador'); w.mostradorAddToCart(w.SAHTEN.state.products[0].id); return w;
}
const pick = (w, query) => {
  const input = w.document.getElementById('most-customer-search'); input.focus(); input.value = query; input.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.document.querySelector('#most-customer-options [role=option]').click();
};
const tick = () => new Promise(r => setTimeout(r, 20));

it('Mostrador: al elegir un cliente en delivery se carga su dirección, piso y referencia; otro cliente la reemplaza', async () => {
  const w = await page(); try {
    w.mostradorSetOrderType('delivery');
    pick(w, 'Ubicado'); await tick();
    expect(w.mostradorDeliveryValue()).toMatchObject({ address: 'Calle Tres 30', addressFloor: '4', addressApartment: 'C', deliveryReference: 'Timbre 4C', lat: -34.53, lng: -58.48, autofillFrom: 'geo' });
    expect(w.document.getElementById('most-addr-input').value).toBe('Calle Tres 30');
    expect(w.document.getElementById('most-cart-extras').textContent).toContain('Dirección guardada del cliente');
    pick(w, 'Texto'); await tick();
    expect(w.mostradorDeliveryValue()).toMatchObject({ address: 'Avenida Ejemplo 1500', lat: null, autofillFrom: 'txt' });
    expect(w.mostradorDeliveryValue().addressFloor).toBe('');
    pick(w, 'Sin Dirección'); await tick();
    expect(w.mostradorDeliveryValue()).toBeNull();
  } finally { w.close(); }
});

it('Mostrador: elegir el cliente en retiro y pasar a delivery también precarga; una dirección escrita a mano no se pisa', async () => {
  const w = await page(); try {
    pick(w, 'Ubicado'); expect(w.mostradorDeliveryValue()).toBeNull();
    w.mostradorSetOrderType('delivery');
    expect(w.mostradorDeliveryValue()).toMatchObject({ address: 'Calle Tres 30', autofillFrom: 'geo' });
    w._mostAddrInput('Otra calle escrita 77');
    expect(w.mostradorDeliveryValue().autofillFrom).toBeUndefined();
    pick(w, 'Texto'); await tick();
    expect(w.mostradorDeliveryValue().address).toBe('Otra calle escrita 77');
  } finally { w.close(); }
});

it('Mostrador: al confirmar un delivery la dirección usada queda guardada como principal del cliente', async () => {
  const w = await page(); try {
    w.mostradorSetOrderType('delivery'); pick(w, 'Texto'); await tick();
    w._mostAddrInput('Calle Confirmada 456'); w._mostDeliveryField('addressFloor', '7'); w._mostDeliveryField('deliveryReference', 'Puerta negra');
    w.mostradorSetShipping('0');
    w.mostradorSetPayment(w.eval('_mostPaymentOptions()[0].id'));
    await w.mostradorCheckout();
    expect(w.sahtenOrders()[0]).toMatchObject({ customerId: 'txt', address: 'Calle Confirmada 456', addressFloor: '7' });
    const saved = w.sahtenCustomers().find(c => c.id === 'txt');
    expect(saved.address).toBe('Calle Confirmada 456');
    expect(saved.addresses.find(a => a.isPrimary)).toMatchObject({ address: 'Calle Confirmada 456', addressFloor: '7', reference: 'Puerta negra' });
    expect(saved.addresses.some(a => a.address === 'Avenida Ejemplo 1500')).toBe(true);
    expect(JSON.parse(w.localStorage.getItem('sahten_customers')).find(c => c.id === 'txt').address).toBe('Calle Confirmada 456');
  } finally { w.close(); }
});

it('Mostrador: «Nuevo cliente» durante un delivery propone la dirección en curso y la guarda con su piso', async () => {
  const w = await page(); try {
    w.mostradorSetOrderType('delivery'); w._mostAddrInput('Calle Del Pedido 12'); w._mostDeliveryField('addressFloor', '3');
    const input = w.document.getElementById('most-customer-search'); input.focus(); input.value = 'Persona Nueva'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    w.document.querySelector('.most-customer-create').click();
    expect(w.document.getElementById('qc-addr').value).toBe('Calle Del Pedido 12');
    w.mostQuickAddClientSave();
    const created = w.sahtenCustomers().find(c => c.name === 'Persona Nueva');
    expect(created.addresses[0]).toMatchObject({ address: 'Calle Del Pedido 12', addressFloor: '3', isPrimary: true });
    expect(w.mostradorDeliveryValue().address).toBe('Calle Del Pedido 12');
  } finally { w.close(); }
});
