import {beforeAll,it,expect,vi} from 'vitest';
import {buildTestBundle,openApp,loadRawDemo} from './app-harness.js';
beforeAll(()=>buildTestBundle(),120000);
it('Productos abre la lista esencial, conserva favoritos y abre el mismo editor histórico en las cuatro vistas',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);w.eval("_saveTabState('prodView','tabla')");w.showPanel('productos');const d=w.document,p=w.SAHTEN.state.products.find(p=>!p.recetaOnly);
 expect(d.querySelector('#product-view-select').value).toBe('lista');expect(d.querySelectorAll('.product-list-row').length).toBeGreaterThan(0);expect(d.querySelector('.product-cost-summary').open).toBe(false);
 const favorite=d.querySelector(`[data-product-favorite="${p.id}"]`),old=p.star;favorite.click();expect(p.star).toBe(!old);expect(d.querySelector(`[data-product-favorite="${p.id}"]`).getAttribute('aria-pressed')).toBe(String(!old));
 d.querySelector(`[data-product-selection="${p.id}"]`).click();expect(d.getElementById('bulk-bar').classList.contains('visible')).toBe(true);
 for(const view of ['lista','lateral','tarjetas','comparador']){w.setProdView(view);expect(d.getElementById('product-view-select').value).toBe(view);expect(d.querySelector('#prod-grid-container .product-channel').textContent).toBe(w.SAHTEN.state.channels.find(c=>c.enabled).name);if(view==='lateral'){expect(d.querySelector('[data-product-editor] [data-lock="price"]')).toBeTruthy();expect(d.querySelector('[data-product-editor] .pricing-dialog').getAttribute('role')).toBe('region');}else{d.querySelector('[data-product-edit]').click();expect(d.querySelector('.pricing-dialog [data-lock="price"]')).toBeTruthy();d.querySelector('.pricing-heading [data-close]').click();}}
 w.setProdView('tabla');expect(d.querySelector('#prod-tbody').rows.length).toBeGreaterThan(0);
 w.setProdView('lateral');d.querySelector('[data-product-editor] [data-lock="price"]').click();const input=d.querySelector('[data-product-editor] [data-value="price"]');input.value='12345';input.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('[data-product-editor] [data-save]').click();
 expect(w.channelPriceWithDisc(p,'mostrador')).toBe(12345);expect(p.pricingHistory.length).toBeGreaterThan(0);expect(d.querySelector('[data-product-editor]')).toBeTruthy();expect(d.getElementById('prod-grid-container').textContent).toContain('Precio fijado');
 }finally{w.close();}
});
it('pausar delivery conserva tarifas y selección de retiro, guarda el estado en el proyecto y no confirma envíos locales',async()=>{
 const {window:w}=await openApp();try{loadRawDemo(w);w.SAHTEN.libs.leaflet=async()=>{throw Error('Mapa no usado en la prueba');};w.eval("_ajNavTab('delivery')");const d=w.document;
 expect(d.getElementById('delivery-service-control').closest('#aj-tab-delivery')).toBeTruthy();expect(d.getElementById('delivery-admin').closest('#aj-tab-delivery')).toBeTruthy();expect(d.getElementById('mp-account-slot').closest('#aj-tab-tienda')).toBeTruthy();
 const cfg=w._getTiendaConfig();w.SAHTEN.delivery.operation.set(false);const next=w._getTiendaConfig();expect(next).toEqual({...cfg,deliveryEnabled:false});expect(w.SAHTEN.online.publish.currentMenu().delivery.enabled).toBe(false);
 expect(d.getElementById('delivery-service-control').textContent).toContain('Pausada');expect(d.getElementById('delivery-service-control').textContent).toContain('Solo en este proyecto');
 expect(w.SAHTEN.project.collect().online.tiendaConfig.deliveryEnabled).toBe(false);
 w.showPanel('mostrador');w.mostradorAddToCart(w.SAHTEN.state.products.find(p=>!p.recetaOnly).id);w.mostradorSetOrderType('delivery');expect(d.getElementById('most-cart-extras').textContent).toContain('Delivery pausado');expect(d.getElementById('most-cart-extras').textContent).toContain('Retiro');w.alert=vi.fn();await w.mostradorCheckout();expect(w.sahtenOrders()).toHaveLength(0);
 w.mostradorSetOrderType('retiro');expect(w.eval('_calcCartTotals().deliveryQuote')).toBeNull();
 d.body.dataset.role='cajero';w.SAHTEN.delivery.operation.set(true);expect(w._getTiendaConfig().deliveryEnabled).toBe(false);
 }finally{w.close();}
});
