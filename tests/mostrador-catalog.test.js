import { beforeAll, describe, expect, it } from 'vitest';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';
beforeAll(() => buildTestBundle(), 120000);

describe('catálogo del Mostrador', () => {
  it('busca y alterna vistas sin perder filtros ni cantidades del pedido', async () => {
    const { window: w } = await openApp();
    loadRawDemo(w); w.showPanel('mostrador');
    const d = w.document;
    const name = d.querySelector('.most-product-name').textContent;
    d.querySelector('.most-product-add').click();
    const input = d.getElementById('most-search-input');
    input.value = name; input.dispatchEvent(new w.Event('input', { bubbles: true }));
    const results = d.querySelectorAll('.most-product').length;
    d.querySelector('[data-most-view="list"]').click();
    expect(d.getElementById('most-product-grid').classList.contains('most-product-list')).toBe(true);
    expect(d.querySelector('[data-most-view="list"]').getAttribute('aria-pressed')).toBe('true');
    expect(d.querySelectorAll('.most-product')).toHaveLength(results);
    expect(input.value).toBe(name);
    expect(d.querySelector('.most-cart-qty').textContent).toBe('1');
    d.querySelector('.most-product-add').click();
    d.querySelector('[data-most-view="grid"]').click();
    expect(d.querySelector('.most-cart-qty').textContent).toBe('2');
    w.mostradorOnSearch('sin coincidencias 785');
    expect(d.getElementById('most-result-count').textContent).toBe('0 productos');
    expect(d.querySelector('.most-empty')).not.toBeNull();
    w.close();
  });
  it('recuerda la vista por equipo y prepara comanda sin abrir ventanas emergentes', async () => {
    const { window: w } = await openApp({ storage: { 'sahten-pos-view': 'list' } });
    loadRawDemo(w); w.showPanel('mostrador');
    expect(w.document.getElementById('most-product-grid').classList.contains('most-product-list')).toBe(true);
    w.document.querySelector('.most-product-add').click();
    w.document.querySelector('.most-checkout').click();
    let html;
    w.SAHTEN.printDocument = async value => { html = value; };
    w.open = () => { throw new Error('No usar pop-ups'); };
    await w.printComanda(w.eval('SAHTEN_ORDERS[0].id'));
    expect(html).toContain('ORDEN #0001');
    expect(html).toContain('TOTAL');
    expect(html).toContain(w.eval('SAHTEN_ORDERS[0].items[0].name'));
    w.close();
  });
  it('online incluye retiro y delivery, filtra y excluye pedidos locales', async () => {
    const { window: w } = await openApp(); loadRawDemo(w);
    w.eval(`SAHTEN_ORDERS = [
      {id:'web-ret',remoteId:'r',source:'pickup',status:'pendiente',customerName:'Retiro web',items:[],num:1,total:100,createdAt:'2026-10-22T12:00:00Z'},
      {id:'web-del',remoteId:'d',source:'delivery',status:'pendiente',customerName:'Delivery web',items:[],num:2,total:100,createdAt:'2026-10-22T13:00:00Z'},
      {id:'local-del',source:'delivery',orderType:'delivery',status:'pendiente',customerName:'Delivery local',items:[],num:3,total:100},
      {id:'old',remoteId:'o',source:'pickup',status:'cancelado',customerName:'Cancelado',items:[],num:4,total:100}
    ]; showPanel('mostrador'); mostSetTab('online'); _renderDeliveryTab();`);
    const d = w.document;
    expect(d.querySelector('.most-tab-delivery').textContent).toContain('Pedidos online');
    expect(d.querySelector('.most-tab-delivery .most-tab-badge').textContent).toBe('2');
    expect(d.getElementById('most-tab-content').textContent).toContain('Retiro web');
    expect(d.getElementById('most-tab-content').textContent).not.toContain('Delivery local');
    const filters = () => d.querySelectorAll('.online-order-filters button');
    filters()[1].click();
    expect(d.getElementById('most-tab-content').textContent).toContain('Retiro web');
    expect(d.getElementById('most-tab-content').textContent).not.toContain('Delivery web');
    filters()[2].click();
    expect(d.getElementById('most-tab-content').textContent).toContain('Delivery web');
    expect(filters()[2].getAttribute('aria-pressed')).toBe('true');
    w.close();
  });

  it('guarda el QR por negocio y lo conserva al volver a abrir el proyecto', async () => {
    const {window:w} = await openApp(); loadRawDemo(w); w.renderCustPanel();
    const d=w.document;
    d.getElementById('cust-review-enabled').checked=true;
    d.getElementById('cust-review-url').value='https://g.page/r/ejemplo/review';
    d.getElementById('cust-review-text').value='Tu opinión nos ayuda';
    w.custUpdateReview();
    const file=w.SAHTEN.project.collect();
    expect(file.settings.customization).toMatchObject({reviewEnabled:true,reviewUrl:'https://g.page/r/ejemplo/review',reviewText:'Tu opinión nos ayuda'});
    await w.SAHTEN.project.apply(file); w.renderCustPanel();
    expect(d.getElementById('cust-review-enabled').checked).toBe(true);
    expect(d.getElementById('cust-review-text').value).toBe('Tu opinión nos ayuda');
    w.close();
  });

});
