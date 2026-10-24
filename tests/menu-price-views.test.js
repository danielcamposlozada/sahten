import { beforeAll, expect, it } from 'vitest';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';
beforeAll(() => buildTestBundle(), 120000);
async function setup() {
  const a = await openApp(), w = a.window; loadRawDemo(w); w.showPanel('productos');
  const errors = []; w.addEventListener('error', e => errors.push(e.message));
  return { w, d: w.document, s: w.SAHTEN.state, errors };
}
const change = (w, el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const input = (w, el, value) => { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const tick = () => new Promise(r => setTimeout(r, 0));
it('recorre las cuatro vistas, recuerda la elegida y conserva precios al cambiar la presentación', async () => {
  const { w, d, s, errors } = await setup();
  const before = JSON.stringify(s.products), count = s.products.filter(p => !p.recetaOnly).length;
  for (const view of ['lista', 'tarjetas', 'comparador', 'lateral', 'avanzada']) {
    change(w, d.getElementById('prod-view-select'), view); await tick();
    expect(d.getElementById('prod-view-select').value).toBe(view);
    expect(d.getElementById('prod-advanced-table').hidden).toBe(view !== 'avanzada');
    if (view === 'tarjetas') expect(d.querySelectorAll('.mpv-card')).toHaveLength(count);
    if (view === 'comparador') expect(d.querySelectorAll('.mpv-compare tbody tr')).toHaveLength(count);
  }
  w.showPanel('dashboard'); w.showPanel('productos');
  expect(d.getElementById('prod-view-select').value).toBe('avanzada');
  expect(JSON.stringify(s.products)).toBe(before); expect(errors).toEqual([]); w.close();
});
it('edita la celda del canal seleccionado y refleja el precio fijado e historial en las otras vistas', async () => {
  const { w, d, s, errors } = await setup(); const p = s.products[0];
  w.setProdView('comparador');
  const cell = [...d.querySelectorAll('[data-edit-price]')].find(b => b.dataset.editPrice === p.id && b.dataset.channel === 'fudo');
  expect(cell).toBeTruthy(); cell.click();
  expect(d.getElementById('pricing-channel').value).toBe('fudo');
  d.querySelector('[data-lock="price"]').click(); input(w, d.querySelector('[data-value="price"]'), '12345');
  d.querySelector('[data-save]').click();
  expect(p.pricingPolicies.fudo.price).toBe(12345); expect(p.pricingPolicies.mostrador).toBeUndefined();
  expect(p.pricingHistory).toHaveLength(1);
  expect([...d.querySelectorAll('[data-edit-price]')].find(b => b.dataset.editPrice === p.id && b.dataset.channel === 'fudo').textContent).toContain('12.345');
  w.setProdView('lista'); change(w, d.getElementById('prod-price-channel'), 'fudo'); await tick();
  expect(d.querySelector('.mpv-list-row').textContent).toContain('Precio fijado');
  expect(d.querySelector('.mpv-list-row .mpv-price').textContent).toBe(w.fmt(12345));
  expect(errors).toEqual([]); w.close();
});
it('preserva el borrador lateral al buscar, permite cancelar un cambio de vista y guarda con la fórmula e historial existentes', async () => {
  const { w, d, s, errors } = await setup(); const p = s.products[0]; w.setProdView('lateral');
  expect(d.querySelector('.pricing-inline')).toBeTruthy(); expect(d.querySelector('.pricing-inline').getAttribute('role')).toBe('region');
  expect(d.querySelector('.main').inert).not.toBe(true);
  d.querySelector('[data-lock="price"]').click(); input(w, d.querySelector('[data-value="price"]'), '12000');
  input(w, d.getElementById('prod-search'), 'no existe');
  expect(d.querySelector('[data-value="price"]').value).toBe('12000');
  change(w, d.getElementById('prod-view-select'), 'tarjetas'); await tick();
  const cancel = [...d.querySelectorAll('.sd-btn')].find(b => b.textContent === 'Seguir editando');
  expect(cancel).toBeTruthy(); cancel.click(); await tick();
  expect(d.getElementById('prod-view-select').value).toBe('lateral');
  expect(d.querySelector('[data-value="price"]').value).toBe('12000');
  input(w, d.getElementById('prod-search'), ''); d.querySelector('[data-save]').click();
  expect(p.pricingPolicies.mostrador.price).toBe(12000); expect(p.pricingHistory).toHaveLength(1);
  expect(d.querySelector('.pricing-inline [data-value="price"]').value).toBe('12000');
  expect(errors).toEqual([]); w.close();
});
it('busca por categoría sin tildes, selecciona solo resultados y abre la ficha al pulsar el nombre', async () => {
  const { w, d, s } = await setup();
  s.products[0].category = 'Especial árabe'; s.products[1].recetaOnly = true; w.renderProductos();
  input(w, d.getElementById('prod-search'), 'especial arabe');
  expect(d.querySelectorAll('.mpv-list-row')).toHaveLength(1);
  d.querySelector('[data-select-visible]').checked = true;
  d.querySelector('[data-select-visible]').dispatchEvent(new w.Event('change', { bubbles: true }));
  expect(w.eval('[...selectedSet]')).toEqual([0]);
  let selected; w.openProductDetail = index => { selected = index; };
  d.querySelector('[data-product-detail]').click(); expect(selected).toBe(0); w.close();
});
it('limita el comparador a tres canales, recuerda la selección y no permite dejarlo vacío', async () => {
  const { w, d } = await setup(); w.setProdView('comparador');
  const initial = [...d.querySelectorAll('[data-compare-channel]:checked')].map(el => el.dataset.compareChannel);
  expect(initial).toHaveLength(3);
  const fourth = [...d.querySelectorAll('[data-compare-channel]')].find(el => !el.checked);
  fourth.checked = true; fourth.dispatchEvent(new w.Event('change', { bubbles: true }));
  expect(fourth.checked).toBe(false); expect(d.getElementById('prod-view-feedback').textContent).toContain('hasta 3');
  for (let i = 0; i < 3; i++) { const box = d.querySelector('[data-compare-channel]:checked'); box.checked = false; box.dispatchEvent(new w.Event('change', { bubbles: true })); }
  expect(d.querySelectorAll('[data-compare-channel]:checked')).toHaveLength(1);
  const remaining = d.querySelector('[data-compare-channel]:checked').dataset.compareChannel;
  w.showPanel('dashboard'); w.showPanel('productos');
  expect(d.querySelector('[data-compare-channel]:checked').dataset.compareChannel).toBe(remaining); w.close();
});
it('no muestra costos privados ni controles de precio en las vistas de una caja sin costos', async () => {
  const { w, d, errors } = await setup(); d.body.classList.add('role-no-costs'); d.body.dataset.role = 'cashier';
  for (const view of ['lista', 'tarjetas', 'comparador', 'lateral']) {
    w.setProdView(view);
    expect(d.querySelector('#prod-views-container [data-edit-price]')).toBeNull();
    expect(d.querySelector('#prod-views-container [data-product-detail]')).toBeNull();
    expect(d.querySelector('#prod-views-container .mpv-breakdown')).toBeNull();
    expect(d.querySelector('.pricing-inline')).toBeNull();
  }
  expect(errors).toEqual([]); w.close();
});
it('el borrador lateral se descarta solo al confirmar y no deja editores ocultos al recalcular desde otra sección', async () => {
  const { w, d, s } = await setup(); w.setProdView('lateral'); const p = s.products[0];
  d.querySelector('[data-lock="price"]').click(); input(w, d.querySelector('[data-value="price"]'), '9999');
  change(w, d.getElementById('prod-view-select'), 'comparador'); await tick();
  [...d.querySelectorAll('.sd-btn')].find(b => b.textContent === 'Descartar ajustes').click(); await tick();
  expect(p.pricingPolicies?.mostrador?.price).not.toBe(9999);
  expect(d.getElementById('prod-view-select').value).toBe('comparador');
  w.setProdView('lateral'); w.showPanel('dashboard'); w.recalcAll();
  expect(d.querySelector('.pricing-inline')).toBeNull();
  w.showPanel('productos'); expect(d.querySelector('.pricing-inline')).toBeTruthy(); w.close();
});
