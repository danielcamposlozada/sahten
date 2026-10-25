import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
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
  it('genera tickets con ancho útil explícito, importes largos y QR en cada papel, guardado solo en el equipo', async () => {
    const { window: w } = await openApp(); loadRawDemo(w);
    w.eval("SAHTEN_ORDERS=[{id:'ancho',num:11,createdAt:'2026-10-23T15:00:00Z',status:'pendiente',customerName:'Cliente de prueba con nombre largo',subtotal:19753086,total:19753086,items:[{qty:2,name:'Producto de nombre largo para verificar que la comanda se ajuste sin cortar palabras ni importes',lineTotal:19753086}]}];_cust.reviewEnabled=true;_cust.reviewUrl='https://g.page/r/ejemplo/review';_cust.reviewText='¿Cómo estuvo tu experiencia? Dejanos tu reseña en Google.';");
    let html, options; w.SAHTEN.printDocument = async (h, o) => { html = h; options = o; };
    for (const [paper, width] of [[48,40],[58,48],[80,72]]) {
      w.localStorage.setItem('sahten-receipt-paper', String(paper));
      await w.printComanda('ancho');
      expect(options.paperWidthMm).toBe(paper);
      expect(html).toContain('width: ' + width + 'mm');
      expect(html).toContain('$19.753.086');
      expect(html).toContain('receipt-review-qr');
      expect(html).not.toContain('max-width: 58mm');
      writeFileSync(new URL('../.tmp/receipt-' + paper + '.html', import.meta.url), html);
    }
    w.renderCustPanel(); expect(w.document.getElementById('cust-receipt-paper').value).toBe('80');
    w.document.getElementById('cust-receipt-paper').value='58'; w.custUpdateReceiptPaper();
    expect(w.localStorage.getItem('sahten-receipt-paper')).toBe('58');
    expect(JSON.stringify(w.SAHTEN.project.collect())).not.toContain('sahten-receipt-paper');
    w.close();
  });
  it('Pedidos reúne mostrador y web, muestra retiro y delivery en columnas, permite acciones rápidas y conserva completados recientes', async () => {
    const { window: w } = await openApp(); loadRawDemo(w);
    w.eval("SAHTEN_ORDERS = [\n      {id:'web-ret',remoteId:'r',source:'pickup',status:'pendiente',customerName:'Retiro web',items:[{qty:2}],num:1,total:100,createdAt:'2026-10-22T12:00:00Z'},\n      {id:'web-del',remoteId:'d',source:'delivery',status:'pendiente',customerName:'Delivery web',items:[{qty:3}],num:2,total:100,createdAt:'2026-10-22T13:00:00Z'},\n      {id:'local-del',source:'delivery',orderType:'delivery',status:'pendiente',customerName:'Delivery local',items:[],num:3,total:100},\n      {id:'old',remoteId:'o',source:'pickup',status:'cancelado',customerName:'Cancelado',items:[],num:4,total:100}\n    ]; showPanel('mostrador'); mostSetTab('online'); _renderDeliveryTab();");
    const d = w.document;
    const columns = () => d.querySelectorAll('.online-board-column');
    expect(d.querySelector('.most-tab-delivery').textContent).toContain('Pedidos');
    expect(d.querySelector('.most-tab-delivery .most-tab-badge').textContent).toBe('3');
    expect(columns()).toHaveLength(2);
    expect(columns()[0].textContent).toContain('Retiro web');
    expect(columns()[0].textContent).not.toContain('Delivery web');
    expect(columns()[1].textContent).toContain('Delivery web');
    expect(columns()[1].textContent).toContain('Delivery local');
    expect(columns()[0].getAttribute('aria-label')).toBe('Retiro en local / Mostrador');
    const mobile = d.querySelector('.online-board-mobile-switch');
    mobile.querySelector('[data-online-action="delivery"]').click();
    expect(columns()[1].classList.contains('is-selected')).toBe(true);
    d.querySelector('.online-board-mobile-switch [data-online-action="pickup"]').click();
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

  it('oculta el aviso solo durante la visita y no muestra niveles de precio como categorías', async () => {
    const {window:w} = await openApp(); loadRawDemo(w); w.showPanel('mostrador');
    const d=w.document;
    expect(d.querySelectorAll('.most-cat-tier')).toHaveLength(0);
    const categories=w._getProductCategories();
    for (const category of categories) expect(d.getElementById('most-cats').textContent).toContain(category);
    const tiersBefore=w.eval('JSON.stringify(TIERS)');
    d.querySelector('.most-alpha-close').click();
    expect(d.querySelector('.most-alpha-banner').hidden).toBe(true);
    w.mostSetTab('clientes'); w.mostSetTab('pedido');
    expect(d.querySelector('.most-alpha-banner').hidden).toBe(true);
    w.showPanel('dashboard'); w.showPanel('mostrador');
    await new Promise(r=>setTimeout(r,50));
    expect(d.querySelector('.most-alpha-banner').hidden).toBe(false);
    expect(w.eval('JSON.stringify(TIERS)')).toBe(tiersBefore);
    w.close();
  });
  it('un pedido de mostrador entra en Pedidos y completa su retiro sin desaparecer antes de entregarse', async () => {
    const {window:w} = await openApp(); loadRawDemo(w); w.showPanel('mostrador');
    const d=w.document;
    d.querySelector('.most-product-add').click(); d.querySelector('.most-checkout').click();
    await new Promise(r=>setTimeout(r,50));
    expect(d.querySelector('.most-tab-delivery.active').textContent).toContain('Pedidos');
    expect(d.querySelector('.online-board-column').textContent).toContain('Consumidor Final');
    expect(d.querySelector('.online-board-column').textContent).toContain('Cobro sin confirmar');
    expect(d.querySelector('.online-board-origin').textContent).toBe('Mostrador');
    for (const label of ['Empezar preparación','Marcar listo','Marcar retirado']) {
      const button=d.querySelector('.online-board-column [data-online-action="next"]');
      expect(button.textContent).toBe(label); button.click();
    }
    expect(d.querySelectorAll('.online-board-column .online-board-card')).toHaveLength(0);
    expect(d.querySelector('.online-board-recent-list').textContent).toContain('Retirado');
    w.openOrderDetail(w.eval('SAHTEN_ORDERS[0].id'));
    expect(d.querySelector('#order-detail-overlay select').value).toBe('retirado');
    w.close();
  });
  it('delivery muestra información operativa y separa elección de medio de pago de acreditación', async () => {
    const {window:w} = await openApp(); loadRawDemo(w);
    w.eval("SAHTEN_ORDERS=[{id:'delivery-test',num:1,source:'delivery',orderType:'delivery',status:'enviado',customerName:'Cliente de prueba',address:'Dirección de prueba',customerPhone:'123456',deliveryZone:'Zona de prueba',notes:'Indicación de prueba',paymentName:'Efectivo',shipping:1500,total:12500,createdAt:new Date().toISOString(),items:[{qty:2,name:'Plato de prueba'}]}];showPanel('mostrador');mostSetTab('online');_renderDeliveryTab();");
    const d=w.document, card=d.querySelector('.online-board-column .online-board-card');
    for(const text of ['Dirección de prueba','123456','Zona de prueba','Indicación de prueba','Efectivo','Cobro sin confirmar','12.500','1.500','2 × Plato de prueba','En camino']) expect(card.textContent).toContain(text);
    const details=card.querySelector('details');
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('Dirección de prueba');
    details.querySelector('summary').click(); expect(details.open).toBe(true);
    w._renderDeliveryTab();
    expect(d.querySelector('.online-board-column details').open).toBe(true);
    expect(d.querySelector('.online-board-column a[href^="tel:"]').getAttribute('href')).toBe('tel:123456');
    d.querySelector('.online-board-column [data-online-action="next"]').click();
    expect(w.eval('SAHTEN_ORDERS[0].status')).toBe('entregado');
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

it('guarda entrega y vuelto en Mostrador, imprime solo una vez y agrupa opciones en Impresión',async()=>{
 const {window:w}=await openApp();try{
 await w.SAHTEN.project.newProject('Prueba de impresión');loadRawDemo(w);w.showPanel('mostrador');
 const d=w.document;w.eval("_saveTiendaConfig({..._getTiendaConfig(),paymentMethods:{efectivo:true,transferencia:true}});");w.mostradorSetPayment('standard:efectivo');
 d.querySelector('.most-product-add').click();w.mostradorSetOrderType('delivery');
 w.eval("_mostDeliveryField('address','Calle de ejemplo 1234');_mostDeliveryField('addressFloor','3');_mostDeliveryField('addressApartment','A');_mostDeliveryField('deliveryReference','Timbre 3A');_mostDeliveryField('note','Sin sal');mostradorSetShipping('1000');mostradorSetCash('1');");
 expect(d.querySelector('.most-checkout').disabled).toBe(true);w.eval("mostradorSetCash('50000');");expect(d.getElementById('most-cash-change').textContent).toContain('Vuelto');
 let prints=0,ticket='';w.SAHTEN.printDocument=async h=>{prints++;ticket=h;};w.SAHTEN.receipts.save({autoLocal:true,autoOnline:true});await w.mostradorCheckout();await new Promise(r=>setTimeout(r,0));
 const o=w.sahtenOrders()[0];expect(o).toMatchObject({addressFloor:'3',addressApartment:'A',deliveryReference:'Timbre 3A',cashTendered:50000,notes:'Sin sal'});expect(o.cashChange).toBe(50000-o.total);expect(prints).toBe(1);expect(ticket).toContain('Piso 3 · Depto A');expect(ticket).not.toContain('PENDIENTE');w.SAHTEN.receipts.enqueue(o);await new Promise(r=>setTimeout(r,0));expect(prints).toBe(1);
 w._ajNavTab('impresion');await new Promise(r=>setTimeout(r,120));expect(d.getElementById('aj-tab-impresion').style.display).toBe('');expect(d.querySelectorAll('#cust-receipt-paper')).toHaveLength(1);expect(d.getElementById('receipt-auto-local').checked).toBe(true);
 const f=w.SAHTEN.project.collect();expect(f.sales.orders[0]).toMatchObject({addressFloor:'3',cashTendered:50000});expect(JSON.stringify(f)).not.toContain('sahten-receipt-options');
 }finally{w.close();}
});
