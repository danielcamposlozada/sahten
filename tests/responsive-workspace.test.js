import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';
import { isBusinessKey } from '../src/project/kv.js';
import { contrastRatio, contrastText } from '../src/ui/contrast.js';

beforeAll(() => buildTestBundle(), 120000);
function resize(w, width) {
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: width });
  w.dispatchEvent(new w.Event('resize'));
}

describe('espacio de venta y navegación retráctil', () => {
  it('recuerda el menú por equipo y conserva enlaces accesibles al plegarlo', async () => {
    const a = await openApp({ storage: { 'sahten-navigation': 'expanded' } });
    const w = a.window, d = w.document, toggle = d.getElementById('nav-toggle');
    expect(d.documentElement.dataset.navigation).toBe('expanded');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(w.localStorage.getItem('sahten-navigation')).toBe('compact');
    expect(isBusinessKey('sahten-navigation')).toBe(false);
    const menu = d.querySelector('.sidebar [data-panel="mostrador"]');
    expect(menu.getAttribute('aria-label')).toContain('Mostrador');
    menu.click(); expect(w.currentPanel).toBe('mostrador');
    w.close();
    const b = await openApp({ storage: { 'sahten-navigation': 'compact' } });
    expect(b.window.document.documentElement.dataset.navigation).toBe('compact');
    b.window.close();
  });

  it('el menú de secciones se abre con foco, cierra con Escape y devuelve el foco', async () => {
    const a = await openApp(); const w = a.window, d = w.document;
    loadRawDemo(w); resize(w, 390);
    const toggle = d.getElementById('nav-toggle'); toggle.focus(); toggle.click();
    const drawer = d.querySelector('.app-drawer');
    expect(d.activeElement).toBe(drawer);
    expect(d.querySelector('.main').inert).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    drawer.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(d.querySelector('.app-drawer-overlay').classList.contains('open')).toBe(false);
    expect(d.querySelector('.main').inert).toBe(false);
    expect(d.activeElement).toBe(toggle);
    w.close();
  });

  it('Retiro: plegar, abrir y redimensionar conserva el pedido y permite cobrarlo', async () => {
    const a = await openApp(); const w = a.window, d = w.document;
    loadRawDemo(w); resize(w, 640); w.showPanel('mostrador');
    d.querySelector('.most-product-add').click();
    const opener = d.getElementById('most-cart-open');
    expect(opener.textContent).toContain('1');
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    opener.click();
    expect(d.getElementById('most-cart').getAttribute('role')).toBe('dialog');
    expect(d.querySelector('.topbar').inert).toBe(true);
    d.querySelector('.most-cart-close').click();
    expect(d.querySelector('.topbar').inert).toBe(false);
    resize(w, 1366);
    expect(d.documentElement.dataset.orderLayout).toBe('columns');
    expect(d.getElementById('most-cart').inert).toBe(false);
    expect(d.querySelector('.most-cart-qty').textContent).toBe('1');
    d.getElementById('nav-toggle').click();
    expect(d.querySelector('.most-cart-qty').textContent).toBe('1');
    d.querySelector('.most-checkout').click();
    expect(w.eval('SAHTEN_ORDERS.length')).toBe(1);
    expect(w.eval('SAHTEN_ORDERS[0].orderType')).toBe('retiro');
    expect(w.eval('SAHTEN_ORDERS[0].total')).toBeGreaterThan(0);
    w.close();
  });

  it('Delivery: un error de dirección conserva el carrito; al completar se crea la orden', async () => {
    const a = await openApp(); const w = a.window, d = w.document;
    loadRawDemo(w); resize(w, 960); w.showPanel('mostrador');
    d.querySelector('.most-product-add').click(); d.getElementById('most-cart-open').click();
    w.mostradorSetOrderType('delivery'); d.querySelector('.most-checkout').click();
    expect(w.eval('SAHTEN_ORDERS.length')).toBe(0);
    d.querySelector('.sd-actions button').click();
    const address=d.getElementById('most-addr-input'); address.value='Dirección de prueba';
    address.dispatchEvent(new w.Event('input',{bubbles:true}));
    d.querySelector('.most-checkout').click();
    expect(w.eval('SAHTEN_ORDERS.length')).toBe(0);
    d.querySelector('.sd-actions button').click();
    const shipping=d.getElementById('most-ship-val'); shipping.value='1500';
    shipping.dispatchEvent(new w.Event('input',{bubbles:true}));
    d.querySelector('.most-checkout').click();
    expect(w.eval('SAHTEN_ORDERS[0].orderType')).toBe('delivery');
    expect(w.eval('SAHTEN_ORDERS[0].shipping')).toBe(1500);
    expect(w.eval('SAHTEN_ORDERS[0].address')).toContain('Dirección de prueba');
    expect(d.querySelector('.topbar').inert).toBe(false);
    expect(d.querySelector('.sidebar').inert).toBe(false);
    w.close();
  });
});

describe('texto sobre colores configurables de marca', () => {
  it('el naranja y las zonas de transición entre texto claro y oscuro cumplen AA', () => {
    expect(contrastText('#F28C00')).toBe('#1c1c1e');
    expect(contrastRatio('#ffffff', '#F28C00')).toBeLessThan(3);
    for (let n = 0; n < 256; n++) {
      const bg = '#' + n.toString(16).padStart(2, '0').repeat(3);
      expect(contrastRatio(contrastText(bg), bg), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
