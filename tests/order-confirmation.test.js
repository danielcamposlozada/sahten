import { beforeAll, it, expect, vi } from 'vitest';
import { estimateMinutes, estimateSnapshot, whatsappPhone, confirmationMessage } from '../src/core/order-confirmation.js';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';
import { paymentBenefitReport } from '../src/core/payment-benefit.js';

beforeAll(() => buildTestBundle(), 120000);
const tick = () => new Promise(r => setTimeout(r, 20));
function seed(w, extras = {}) {
  loadRawDemo(w);
  const order = { id: 'contact-test', num: 12, remoteId: 'web-test', origin: 'menu-online', source: 'pickup', status: 'pendiente', customerName: 'Cliente ficticio', customerPhone: '+5491100000000', total: 18000, subtotal: 20000, paymentName: 'Efectivo', items: [{ productId: w.SAHTEN.state.products[0].id, name: 'Plato ficticio', qty: 2, unitPrice: 9000, lineTotal: 18000 }], createdAt: new Date().toISOString(), ...extras };
  w.eval('SAHTEN_ORDERS=' + JSON.stringify([order])); w.showPanel('mostrador'); w.mostSetTab('online');
  return w.sahtenOrders()[0];
}
const input = (w, label, value) => { const node = [...w.document.querySelectorAll('.order-contact-form label')].find(n => n.firstChild.textContent === label)?.querySelector('input'); expect(node, label).toBeTruthy(); node.value = value; node.dispatchEvent(new w.Event('input', { bubbles: true })); return node; };
const action = (w, label) => { const b = [...w.document.querySelectorAll('.sd-actions button')].find(b => b.textContent === label); expect(b, label).toBeTruthy(); b.click(); };

it('valida minutos y teléfonos sin adivinar códigos de país ajenos al negocio', () => {
  for (const v of ['', null, -1, 0, 1.5, 'NaN', 1441]) expect(estimateMinutes(v)).toBeNull();
  expect(estimateSnapshot('30', '2026-10-26T20:00:00Z')).toEqual({ minutes: 30, updatedAt: '2026-10-26T20:00:00.000Z', dueAt: '2026-10-26T20:30:00.000Z' });
  expect(whatsappPhone('11 0000-0000', '+5491122222222')).toBe('5491100000000');
  expect(whatsappPhone('11 0000-0000', '+34123456789')).toBe('');
  expect(whatsappPhone('+34 612 345 678')).toBe('34612345678');
  expect(whatsappPhone('00549 11 00000000')).toBe('5491100000000');
  expect(whatsappPhone('123')).toBe('');
});
it('el mensaje usa referencia web, modalidad, dirección completa, total final y pago verificado sin inventarlo', () => {
  const o = { num: 1, webNum: 42, source: 'delivery', address: 'Calle ficticia 123', addressFloor: '2', addressApartment: 'B', total: 18000, paymentName: 'Transferencia', items: [{ qty: 2, name: 'Plato' }] };
  const text = confirmationMessage(o, { store: { name: 'Negocio de prueba' }, minutes: 45 });
  for (const part of ['#0042', 'Negocio de prueba', '2 × Plato', 'Piso 2', 'Depto B', '45 minutos', '$18.000', 'Medio de pago: Transferencia']) expect(text).toContain(part);
  expect(text).not.toContain('Pago acreditado'); expect(text).not.toContain('undefined');
  expect(confirmationMessage({ ...o, source: 'pickup', paymentStatus: 'paid' }, { minutes: 15 })).toContain('Listo para retirar: aproximadamente 15 minutos');
  expect(confirmationMessage(o, { minutes: '' })).toBe('');
});
it.each(['retiro', 'delivery'])('Mostrador guarda el tiempo opcional al crear %s y lo conserva en el proyecto', async type => {
  const { window: w } = await openApp(); try {
    loadRawDemo(w); w.showPanel('mostrador'); w.mostradorAddToCart(w.SAHTEN.state.products[0].id);
    w.mostradorSetOrderType(type); w.mostradorSetEstimate('25');
    if (type === 'delivery') { w.eval("mostradorDelivery={address:'Dirección ficticia 123',note:'',zone:{name:'Zona de prueba',baseCost:1500}};mostradorShipManual=true"); }
    await w.mostradorCheckout(); const o = w.sahtenOrders()[0]; expect(o.fulfillmentEstimate.minutes).toBe(25);
    const f = w.SAHTEN.project.collect(); expect(f.sales.orders[0].fulfillmentEstimate).toEqual(o.fulfillmentEstimate);
    w.mostSetTab('pedido'); expect(w.document.getElementById('most-estimate-minutes').value).toBe('');
  } finally { w.close(); }
});
it('tarjeta web prepara WhatsApp con tiempo editable; abrirlo no marca enviado ni cobra y conserva las estimaciones', async () => {
  const { window: w } = await openApp(); try {
    const o = seed(w, { fulfillmentEstimate: estimateSnapshot(10) }); const open = vi.fn(() => ({})); w.open = open;
    const button = w.document.querySelector('[data-online-action="confirm"]'); expect(button.closest('details')).toBeNull(); button.click();
    input(w, 'Tiempo estimado (minutos)', '35');
    expect(w.document.querySelector('textarea[aria-label="Vista previa de la confirmación"]').value).toContain('35 minutos'); expect(open).not.toHaveBeenCalled();
    action(w, 'Guardar y abrir WhatsApp'); await tick();
    const url = new URL(open.mock.calls[0][0]); expect(url.hostname).toBe('wa.me'); expect(url.pathname).toBe('/5491100000000'); expect(url.searchParams.get('text')).toContain('35 minutos');
    expect(o.status).toBe('pendiente'); expect(o.paymentStatus).toBeUndefined(); expect(o.whatsappConfirmation.openedAt).toBeTruthy(); expect(o.whatsappConfirmation.sent).toBeUndefined();
    expect(o.fulfillmentEstimateHistory.map(e => e.minutes)).toEqual([10, 35]);
    const f = w.SAHTEN.project.collect(); await w.SAHTEN.project.apply(f); expect(w.sahtenOrders()[0].fulfillmentEstimateHistory).toEqual(o.fulfillmentEstimateHistory);
  } finally { w.close(); }
});
it('permite guardar solo el tiempo sin teléfono y no pierde el formulario si WhatsApp está bloqueado', async () => {
  const { window: w } = await openApp(); try {
    const o = seed(w, { customerPhone: '' }); w.open = vi.fn(() => null);
    w.SAHTEN.orderActions.confirm(o.id); input(w, 'Tiempo estimado (minutos)', '20'); action(w, 'Guardar y abrir WhatsApp'); await tick();
    expect(w.document.querySelector('.sd-error').textContent).toContain('código de país'); expect(w.open).not.toHaveBeenCalled();
    input(w, 'WhatsApp del cliente', '+5491100000000'); action(w, 'Guardar y abrir WhatsApp'); await tick(); expect(w.document.querySelector('.sd-error').textContent).toContain('No se pudo abrir WhatsApp'); expect(o.fulfillmentEstimate).toBeUndefined();
    action(w, 'Guardar tiempo'); await tick(); expect(o.fulfillmentEstimate.minutes).toBe(20); expect(o.whatsappConfirmation).toBeUndefined();
    w.SAHTEN.orderActions.confirm(o.id); input(w, 'WhatsApp del cliente', ''); action(w, 'Guardar tiempo'); await tick(); expect(o.customerPhone).toBe('');
  } finally { w.close(); }
});
it.each(['pickup', 'delivery'])('cancelar %s desde la tarjeta conserva historial y pago; no requiere recorrer los estados', async source => {
  const { window: w } = await openApp(); try {
    const o = seed(w, { source, paymentProvider: 'mercadopago', paymentStatus: 'paid', paymentReference: 'payment-test' });
    const button = w.document.querySelector('[data-online-action="cancel"]'); expect(button.closest('details')).toBeNull(); button.click();
    expect(w.document.querySelector('.sd-body').textContent).toContain('no anula ni reembolsa');
    input(w, 'Motivo (opcional)', 'El cliente canceló'); action(w, 'Cancelar pedido'); await tick();
    expect(o).toMatchObject({ status: 'cancelado', paymentStatus: 'paid', paymentReference: 'payment-test', cancellation: { reason: 'El cliente canceló', stockRestored: false } });
    expect(o.completedAt).toBeTruthy(); expect(w.sahtenOrders()).toHaveLength(1); expect(w.document.querySelector('.online-board-column [data-online-action="cancel"]')).toBeNull();
    expect(w.SAHTEN.project.collect().sales.orders[0].cancellation.reason).toBe('El cliente canceló');
    expect(paymentBenefitReport([o]).count).toBe(0);
  } finally { w.close(); }
});
it('cancelar permite devolver stock explícitamente y cerrar el diálogo no cancela', async () => {
  const { window: w } = await openApp(); try {
    const o = seed(w, { origin: 'mostrador', remoteId: undefined, orderType: 'retiro', stockDeducted: { at: 'test', items: { ingrediente_test: 3 } } });
    const restore = vi.spyOn(w, 'orderRestoreStock');
    w.SAHTEN.orderActions.cancel(o.id); action(w, 'Conservar pedido'); await tick(); expect(o.status).toBe('pendiente'); expect(restore).not.toHaveBeenCalled();
    w.SAHTEN.orderActions.cancel(o.id); w.document.querySelector('.order-contact-form input[type=checkbox]').checked = true;
    action(w, 'Cancelar pedido'); await tick(); expect(restore).toHaveBeenCalledOnce(); expect(o.cancellation.stockRestored).toBe(true); expect(o.stockDeducted).toBeUndefined();
  } finally { w.close(); }
});
it('los avisos locales, de sistema y al conectar quedan mudos; solo un pedido web nuevo reproduce el audio', async () => {
  const { window: w } = await openApp(); try {
    loadRawDemo(w); w.SAHTEN.notificationSound.play = vi.fn();
    for (const n of [{type:'order',source:'mostrador'}, {type:'delivery',source:'delivery'}, {type:'info',source:'sistema'}, {type:'order',source:'menu-online',sound:false}]) w.pushNotification(n);
    expect(w.SAHTEN.notificationSound.play).not.toHaveBeenCalled();
    w.pushNotification({ type: 'order', source: 'menu-online', sound: true }); expect(w.SAHTEN.notificationSound.play).toHaveBeenCalledOnce();
  } finally { w.close(); }
});
it('un pedido reemplazado mientras el diálogo está abierto no recibe datos ni abre WhatsApp', async () => {
  const { window: w } = await openApp(); try {
    const o = seed(w); w.open = vi.fn(() => ({})); w.SAHTEN.orderActions.confirm(o.id); input(w, 'Tiempo estimado (minutos)', '30'); w.eval('SAHTEN_ORDERS=[]');
    action(w, 'Guardar y abrir WhatsApp'); await tick(); expect(w.open).not.toHaveBeenCalled(); expect(w.document.querySelector('.sd-error').textContent).toContain('cambió');
  } finally { w.close(); }
});
