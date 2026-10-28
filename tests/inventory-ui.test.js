import { beforeAll, describe, it, expect } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
beforeAll(async () => { await buildTestBundle(); }, 120000);
const change = (w, el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const field = (d, id, key) => [...d.querySelectorAll('[data-inventory-field]')].find(el => el.dataset.inventoryId === id && el.dataset.inventoryField === key && !el.closest('[hidden]'));
async function app() { const a = await openApp(); await a.window.SAHTEN.project.openDemo(); return a; }

describe('catálogos e inventario con vistas coherentes', () => {
  it('ingredientes: calcula referencias por kg, edita por ID y conserva costos/stock al cambiar de vista', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      w.INGREDIENTES.push({ id: 'prueba_harina', name: 'Harina ácida · prueba', unit: 'kg', cantidad: 2, grPaquete: 2000, precioPkg: 4000 });
      w.PRODUCTS.push({ id: 'prueba_pan', name: 'Pan de prueba', tier: 'T3', ingredients: [{ ingId: 'prueba_harina', qty: 500, unit: 'g' }], packaging: [], combos: [], porciones: 1 });
      w.initStock(); w.STOCK.prueba_harina.actual = 600;
      w.showPanel('ingredientes');
      const search = d.getElementById('ing-search'); search.value = 'acida'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
      expect(d.getElementById('ing-grid').querySelectorAll('.inventory-catalog-card')).toHaveLength(1);
      expect(d.getElementById('ing-grid').textContent).toContain('Costo por kg');
      change(w, field(d, 'prueba_harina', 'precioPkg'), '6000');
      expect(w.costPerUnit(w.PRODUCTS.at(-1))).toBe(1500);
      expect(w.STOCK.prueba_harina.actual).toBe(600);
      w.setIngView('lista');
      expect(d.getElementById('iv-lista').getAttribute('aria-pressed')).toBe('true');
      expect(d.getElementById('ing-list').textContent).toContain('$3.000');
      expect(field(d, 'prueba_harina', 'precioPkg').value).toBe('6000');
      const saved = w.SAHTEN.project.collect(); await w.SAHTEN.project.apply(saved); w.showPanel('ingredientes');
      expect(d.getElementById('iv-lista').getAttribute('aria-pressed')).toBe('true');
      expect(w.STOCK.prueba_harina.actual).toBe(600);
    } finally { w.close(); }
  }, 60000);

  it('envases: tarjetas/lista, proveedor, costo unitario y menú de acciones con Escape', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      w.ENVASES.push({ id: 'prueba_bolsa', name: 'Bolsa de prueba', cantidad: 100, precioPkg: 5000 });
      w.showPanel('envases');
      const search = d.getElementById('env-search'); search.value = 'Bolsa de prueba'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
      change(w, field(d, 'prueba_bolsa', 'cantidad'), '50');
      expect(d.getElementById('env-list').textContent).toContain('$100');
      d.querySelector('[data-env-view="grilla"]').click();
      expect(d.getElementById('env-grid').hidden).toBe(false);
      change(w, field(d, 'prueba_bolsa', 'proveedor'), 'Proveedor de prueba');
      expect(w.ENVASES.find(e => e.id === 'prueba_bolsa').proveedor).toBe('Proveedor de prueba');
      const menuButton = d.querySelector('#env-grid [data-inventory-menu]'); menuButton.click();
      expect(menuButton.getAttribute('aria-expanded')).toBe('true');
      expect(d.getElementById(menuButton.dataset.inventoryMenu).textContent).toContain('Ingresar stock');
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(menuButton.getAttribute('aria-expanded')).toBe('false');
      const saved = w.SAHTEN.project.collect(); await w.SAHTEN.project.apply(saved); w.showPanel('envases');
      expect(d.getElementById('env-grid').hidden).toBe(false);
    } finally { w.close(); }
  }, 60000);

  it('stock: unidades reales, valoración al costo, estados y acciones conservan el movimiento', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      w.INGREDIENTES.push({ id: 'prueba_huevo', name: 'Huevo de prueba', cantidad: 12, grPaquete: 12, unit: 'u', precioPkg: 6000 });
      w.initStock(); w.STOCK.prueba_huevo.actual = 3; w.STOCK.prueba_huevo.minimo = 5;
      w.showPanel('stock'); w.setStockCat('ingredientes');
      const search = d.getElementById('stock-search'); search.value = 'Huevo de prueba'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
      expect(d.getElementById('stock-content').textContent).toContain('Existencias (u)');
      expect(d.getElementById('stock-content').textContent).toContain('Stock bajo');
      expect(d.getElementById('stock-content').textContent).toContain('$1.500');
      w.setStockView('grilla');
      d.querySelector('[data-inventory-stock-action="ingreso"]').click();
      expect(d.getElementById('sm-unit').value).toBe('u');
      d.getElementById('sm-qty').value = '12'; w.registrarMovimiento();
      expect(w.STOCK.prueba_huevo.actual).toBe(15);
      expect(w.MOVIMIENTOS.at(-1)).toMatchObject({ ing: 'Huevo de prueba', categoria: 'ingrediente', unit: 'u', qty: 12 });
      expect(d.getElementById('stock-content').textContent).toContain('Stock OK');
      expect(d.getElementById('stock-content').textContent).toContain('$7.500');
      w.INGREDIENTES.push({id:'prueba_aceite',name:'Aceite de prueba',unit:'L',cantidad:1,grPaquete:1000,precioPkg:1000});
      w.quickMov('prueba_aceite','','ingreso');
      expect(d.getElementById('sm-unit').value).toBe('ml');
      d.getElementById('sm-qty').value='250'; w.registrarMovimiento();
      expect(w.STOCK.prueba_aceite.actual).toBe(250);
      expect(w.MOVIMIENTOS.at(-1)).toMatchObject({unit:'ml',qty:250});
    } finally { w.close(); }
  }, 60000);

  it('Productos avanzado conserva columnas, selección, canales y controles al volver de otra vista', async () => {
    const a = await app(), w = a.window, d = w.document;
    try {
      w.showPanel('productos'); w.setProdView('tabla'); w.setAllCols(true);
      const table = d.querySelector('.prod-table');
      const before = [...table.querySelectorAll('thead [data-col]')].map(el => [el.dataset.col, el.style.display]);
      const prices = w.PRODUCTS.map(p => w.mostradorFinalPrice(p));
      expect(before.every(([, display]) => display !== 'none')).toBe(true);
      expect(d.getElementById('product-advanced-scroll').getAttribute('role')).toBe('region');
      expect(d.querySelector('[data-product-scroll="1"]')).toBeTruthy();
      w.setProdView('tarjetas'); w.setProdView('tabla');
      expect([...table.querySelectorAll('thead [data-col]')].map(el => [el.dataset.col, el.style.display])).toEqual(before);
      expect(w.PRODUCTS.map(p => w.mostradorFinalPrice(p))).toEqual(prices);
      expect(table.querySelectorAll('[data-col="por_canal"] > div > div').length).toBeGreaterThan(0);
    } finally { w.close(); }
  }, 60000);
});
