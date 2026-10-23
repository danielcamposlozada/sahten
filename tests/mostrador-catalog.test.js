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
  it('online muestra retiro y delivery en columnas, permite acciones rápidas y conserva completados recientes', async () => {
    const { window: w } = await openApp(); loadRawDemo(w);
    w.eval("SAHTEN_ORDERS = [\n      {id:'web-ret',remoteId:'r',source:'pickup',status:'pendiente',customerName:'Retiro web',items:[{qty:2}],num:1,total:100,createdAt:'2026-10-22T12:00:00Z'},\n      {id:'web-del',remoteId:'d',source:'delivery',status:'pendiente',customerName:'Delivery web',items:[{qty:3}],num:2,total:100,createdAt:'2026-10-22T13:00:00Z'},\n      {id:'local-del',source:'delivery',orderType:'delivery',status:'pendiente',customerName:'Delivery local',items:[],num:3,total:100},\n      {id:'old',remoteId:'o',source:'pickup',status:'cancelado',customerName:'Cancelado',items:[],num:4,total:100}\n    ]; showPanel('mostrador'); mostSetTab('online'); _renderDeliveryTab();");
    const d = w.document;
    const columns = () => d.querySelectorAll('.online-board-column');
    expect(d.querySelector('.most-tab-delivery').textContent).toContain('Pedidos online');
    expect(d.querySelector('.most-tab-delivery .most-tab-badge').textContent).toBe('2');
    expect(columns()).toHaveLength(2);
    expect(columns()[0].textContent).toContain('Retiro web');
    expect(columns()[0].textContent).not.toContain('Delivery web');
    expect(columns()[1].textContent).toContain('Delivery web');
    expect(d.querySelector('.online-board').textContent).not.toContain('Delivery local');
    const mobile = d.querySelector('.online-board-mobile-switch');
    mobile.querySelector('[data-online-action="delivery"]').click();
    expect(columns()[1].classList.contains('is-selected')).toBe(true);
    mobile.querySelector('[data-online-action="pickup"]').click();
    expect(columns()[0].classList.contains('is-selected')).toBe(true);
    d.querySelector('.online-board-column [data-online-action="next"]').click();
    expect(d.querySelector('.online-board-column').textContent).toContain('En preparación');
    expect(d.querySelector('.delivery-list')).not.toBeNull();
    w.orderSetStatus('web-ret', 'listo');
    w.orderSetStatus('web-ret', 'retirado');
    expect(columns()[0].textContent).not.toContain('Retiro web');
    expect(d.querySelector('.online-board-recent-list').textContent).toContain('Retiro web');
    d.querySelector('[data-online-action="recent"]').click();
    expect(d.querySelector('.online-board-recent-list').hidden).toBe(true);
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
