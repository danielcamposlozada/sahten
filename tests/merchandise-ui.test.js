import { beforeAll, describe, it, expect } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
import { emptyFile } from '../src/project/schema.js';
beforeAll(async () => { await buildTestBundle(); }, 120000);
const change = (w, el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const json = value => JSON.parse(JSON.stringify(value));
async function app() {
  const a = await openApp();
  await a.window.SAHTEN.project.openDemo();
  a.window.showPanel('mercaderia');
  return a;
}

describe('pantalla Mercadería integrada con la app real', () => {
  it('carga docena/proveedor, filtra sin tildes y crea venta con editor sin receta', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      d.querySelector('#panel-mercaderia [data-merch-action="new"]').click();
      const field = key => d.querySelector(`[data-merch-field="${key}"]`);
      change(w, field('name'), 'Gaseosa de limón');
      change(w, field('cantidad'), '12'); change(w, field('precioPkg'), '12000');
      change(w, field('presentacion'), 'Docena'); change(w, field('proveedor'), 'Distribuidor de prueba');
      expect(d.querySelector('.merch-unit-cost').textContent).toContain('1.000');
      change(w, field('cantidad'), '0');
      expect(w.SAHTEN.state.merchandise[0].cantidad).toBe(12);
      expect(field('cantidad').validationMessage).toBeTruthy();
      change(w, field('cantidad'), '12');
      const search = d.getElementById('merch-search'); search.value = 'limon'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
      expect(d.querySelectorAll('.merch-card')).toHaveLength(1);
      d.querySelector('[data-merch-view="lista"]').click();
      expect(d.querySelector('.merch-table')).toBeTruthy();
      d.querySelector('[data-merch-action="sell"]').click();
      const p = w.SAHTEN.state.products.at(-1);
      expect(p.productType).toBe('resale');
      expect(w.eval('MENU_CONFIG.hiddenProducts')).toContain(p.id);
      expect(d.getElementById('recipe-title').textContent).toContain('reventa');
      expect(d.querySelector('.merch-resale')).toBeTruthy();
      expect(d.querySelector('#recipe-name-input')).toBeNull();
      expect(d.querySelectorAll('[data-merch-product-field="name"]')).toHaveLength(1);
      expect(d.querySelector('#recipe-body [onclick^="addRI"]')).toBeNull();
      change(w, d.querySelector('[data-merch-sale-qty]'), '2');
      expect(w.costPerUnit(p)).toBe(2000);
      const saved = w.SAHTEN.project.collect();
      expect(json(saved.catalog.mercaderia)).toMatchObject([{ cantidad: 12, precioPkg: 12000, proveedor: 'Distribuidor de prueba' }]);
      expect(saved.catalog.productos.at(-1)).toMatchObject({ productType: 'resale', merchandise: [{ qty: 2 }] });
      await w.SAHTEN.project.apply(saved);
      expect(w.SAHTEN.state.merchandise).toHaveLength(1);
      expect(w.costPerUnit(w.SAHTEN.state.products.at(-1))).toBe(2000);
      expect(w.SAHTEN.project.collect().ui.merchandiseView).toBe('lista');
      await w.SAHTEN.project.apply(emptyFile('Otro negocio'));
      expect(w.SAHTEN.state.merchandise).toHaveLength(0);
    } finally { w.close(); }
  }, 60000);

  it('agrega mercadería a una receta y registra compras en unidades en su stock propio', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      w.MERCADERIA.push({ id: 'lata', name: 'Lata de prueba', cantidad: 12, precioPkg: 12000, unit: 'u' });
      w.openRecipe(0);
      d.querySelector('[data-merch-action="add-component"]').click();
      change(w, d.querySelector('[data-merch-component-field="merchId"]'), 'lata');
      change(w, d.querySelector('[data-merch-component-field="qty"]'), '3');
      expect(w.merchandiseCost(w.SAHTEN.state.products[0])).toBe(3000);
      w.closeRecipe(); w.showPanel('mercaderia');
      d.querySelector('[data-merch-action="purchase"]').click();
      expect(d.getElementById('sm-categoria').value).toBe('mercaderia');
      expect(d.getElementById('sm-unit').value).toBe('u');
      expect(d.getElementById('sm-unit').disabled).toBe(true);
      d.getElementById('sm-qty').value = '12'; w.registrarMovimiento();
      expect(w.STOCK.lata.actual).toBe(12);
      expect(w.MOVIMIENTOS.at(-1)).toMatchObject({ categoria: 'mercaderia', qty: 12, unit: 'u' });
      w.showPanel('stock'); w.setStockCat('mercaderia');
      expect(d.getElementById('stock-content').textContent).toContain('Lata de prueba');
      expect(d.getElementById('stock-content').textContent).toContain('Valor al costo');
      expect(w.gfGetProductList('mercaderia')[0]).toMatchObject({ unit: 'u.', precio: 1000 });
    } finally { w.close(); }
  }, 60000);
});
