import { beforeAll, it, expect } from 'vitest';
import { customerMatches } from '../src/ui/customer-picker.js';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';

beforeAll(() => buildTestBundle(), 120000);
const customers = [{ id: 'a', name: 'Ángela Gómez', phone: '+54 9 11 1111-2222', email: 'angela@example.test' }, { id: 'b', name: 'Ana López', phone: '11 3333-4444', email: '' }, { id: 'c', name: 'Ángela Pérez', phone: '+5491111112222', email: '' }];
async function page() {
  const { window: w } = await openApp(); loadRawDemo(w); w.eval('SAHTEN_CUSTOMERS=' + JSON.stringify(customers)); w.showPanel('mostrador'); w.mostradorAddToCart(w.SAHTEN.state.products[0].id); return w;
}
const type = (w, value) => { const input = w.document.getElementById('most-customer-search'); input.focus(); input.value = value; input.dispatchEvent(new w.Event('input', { bubbles: true })); return input; };
const key = (w, input, value) => input.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));

it('busca por nombre sin tildes, teléfono sin formato y correo; limita resultados sin fusionar teléfonos compartidos', () => {
  expect(customerMatches(customers, 'angela').map(c => c.id)).toEqual(['a', 'c']);
  expect(customerMatches(customers, '1111112222')).toHaveLength(2);
  expect(customerMatches(customers, 'example.test')[0].id).toBe('a');
  expect(customerMatches(customers, '', 1)).toHaveLength(1); expect(customerMatches(customers, 'no existe')).toHaveLength(0);
});
it('combobox con teclado: no asigna una coincidencia hasta elegirla y limpia la selección al escribir otra búsqueda', async () => {
  const w = await page(); try {
    expect(w.document.getElementById('most-customer')).toBeNull(); const input = type(w, 'angela');
    expect(input.getAttribute('role')).toBe('combobox'); expect(input.getAttribute('aria-expanded')).toBe('true'); expect(w.document.querySelectorAll('#most-customer-options [role=option]')).toHaveLength(2);
    expect(w.eval('mostradorActiveCustomerId')).toBeNull(); expect(w.document.activeElement).toBe(input);
    key(w, input, 'ArrowDown'); expect(input.getAttribute('aria-activedescendant')).toBe('most-customer-option-0'); key(w, input, 'Enter');
    expect(w.eval('mostradorActiveCustomerId')).toBe('a'); expect(w.document.getElementById('most-customer-selection').textContent).toContain('Asignado: Ángela Gómez'); expect(input.getAttribute('aria-expanded')).toBe('false');
    type(w, 'ana'); expect(w.eval('mostradorActiveCustomerId')).toBeNull(); key(w, input, 'Escape'); expect(input.getAttribute('aria-expanded')).toBe('false');
    await w.mostradorCheckout(); expect(w.sahtenOrders()).toHaveLength(0); expect(w.document.getElementById('most-customer-selection').textContent).toContain('Elegí un cliente');
    w.document.querySelector('[aria-label="Usar Consumidor Final"]').click(); await w.mostradorCheckout(); expect(w.sahtenOrders()[0].customerName).toBe('Consumidor Final');
  } finally { w.close(); }
});
it('un cliente seleccionado aporta teléfono al pedido; la selección resiste cambios de pago sin perderse', async () => {
  const w = await page(); try {
    type(w, '33334444'); w.document.querySelector('#most-customer-options [role=option]').click();
    w.mostradorSetPayment(w.eval('_mostPaymentOptions()[0].id'));
    expect(w.document.getElementById('most-customer-search').value).toContain('Ana López');
    await w.mostradorCheckout(); expect(w.sahtenOrders()[0]).toMatchObject({ customerId: 'b', customerPhone: '11 3333-4444', customerName: 'Ana López' });
  } finally { w.close(); }
});
it('sin coincidencias permite crear y asignar, precarga nombre o teléfono y conserva los clientes anteriores', async () => {
  const w = await page(); try {
    type(w, 'Cliente nuevo ficticio'); expect(w.document.getElementById('most-customer-selection').textContent).toContain('No hay coincidencias'); w.document.querySelector('.most-customer-create').click();
    expect(w.document.getElementById('qc-name').value).toBe('Cliente nuevo ficticio'); w.document.getElementById('qc-phone').value = '+5491100000000'; w.mostQuickAddClientSave();
    expect(w.sahtenCustomers()).toHaveLength(4); expect(w.document.getElementById('most-customer-selection').textContent).toContain('Asignado: Cliente nuevo ficticio');
    type(w, '55556666'); w.document.querySelector('.most-customer-create').click(); expect(w.document.getElementById('qc-phone').value).toBe('55556666'); expect(w.document.getElementById('qc-name').value).toBe('');
    key(w, w.document.getElementById('qc-name'), 'Escape'); expect(w.document.getElementById('quick-client-overlay')).toBeNull(); expect(w.sahtenCustomers()).toHaveLength(4);
  } finally { w.close(); }
});
