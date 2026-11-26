import { beforeAll, it, expect } from 'vitest';
import { localRecommendationPolicy, installPosUpsell } from '../src/ui/pos-upsell.js';
import { buildTestBundle, openApp, loadRawDemo } from './app-harness.js';

beforeAll(() => buildTestBundle(), 120000);

it('política local: apagada si no está habilitada; excluye reglas pausadas', () => {
  expect(localRecommendationPolicy({})).toEqual({ enabled: false });
  expect(localRecommendationPolicy({ cartRecommendationPolicy: { enabled: false, complements: [{ id: 'a' }] } })).toEqual({ enabled: false });
  const p = localRecommendationPolicy({
    cartRecommendationPolicy: { enabled: true, complements: [{ id: 'a', enabled: true }, { id: 'b', enabled: false }] },
    beverageUpsellPolicy: { enabled: true, contexts: [{ id: 'bev', enabled: true }, { id: 'off', enabled: false }] },
  });
  expect(p.complements.map(x => x.id)).toEqual(['a']);
  expect(p.beverageContexts.map(x => x.id)).toEqual(['bev']);
});

it('con tienda conectada usa las reglas PUBLICADAS (las mismas de la web) y no las del borrador local', async () => {
  const calls = [];
  const published = { enabled: true, complements: [{ id: 'pub', name: '¿Sumás postre?', productId: 'dessert', triggerProductIds: ['main'] }], beverageContexts: [] };
  const w = { SAHTEN_SUPABASE: { url: 'https://example.test', anonKey: 'anon-public', storeId: 'store-1' }, localStorage: { getItem: () => null, setItem: () => {} } };
  const upsell = installPosUpsell(w, { fetchImpl: async (url, opts) => { calls.push([url, opts.headers.apikey]); return { ok: true, json: async () => [{ rec: published }] }; } });
  const products = [{ id: 'main', name: 'Plato', price: 100, category: 'Platos' }, { id: 'dessert', name: 'Postre', price: 50, category: 'Postres' }];
  expect(upsell._suggestions(products, [{ productId: 'main', qty: 1 }])).toEqual([]);
  await new Promise(r => setTimeout(r, 0));
  expect(calls[0][0]).toContain('/rest/v1/menus?select=rec:json->cartRecommendations&store_id=eq.store-1');
  expect(calls[0][1]).toBe('anon-public');
  expect(upsell._suggestions(products, [{ productId: 'main', qty: 1 }]).map(s => s.id)).toEqual(['dessert']);
});

async function page(rules) {
  const { window: w } = await openApp(); loadRawDemo(w);
  const [a, b] = w.SAHTEN.state.products.filter(p => p.name && !p.recetaOnly);
  w.localStorage.setItem('sahten_promotions', JSON.stringify({ cartRecommendationPolicy: { enabled: true, complements: [{ id: 'r1', name: '¿Algo para acompañar?', productId: b.id, triggerProductIds: [a.id], ...rules }] } }));
  w.showPanel('mostrador'); return { w, a, b };
}

it('Mostrador: muestra la sugerencia con contexto, la agrega a precio normal y registra lo ofrecido y aceptado', async () => {
  const { w, a, b } = await page({}); try {
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(true);
    w.mostradorAddToCart(a.id);
    const box = w.document.getElementById('most-cart-upsell');
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain('¿Algo para acompañar?');
    expect(box.textContent).toContain(b.name);
    expect(box.textContent).toContain('Va bien con ' + a.name);
    const before = w.eval('_calcCartTotals().total');
    box.querySelector('[data-pos-upsell-add]').click();
    expect(w.eval('mostradorCart').map(l => l.productId)).toEqual([a.id, b.id]);
    expect(w.eval('_calcCartTotals().total')).toBeGreaterThan(before);
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(true);
    w.mostradorSetPayment(w.eval('_mostPaymentOptions()[0].id'));
    await w.mostradorCheckout();
    expect(w.sahtenOrders()[0].suggestions).toMatchObject({ channel: 'mostrador', source: 'local', shown: [{ productId: b.id }], accepted: [{ productId: b.id }] });
    // Pedido nuevo: la sugerencia vuelve a ofrecerse (el registro se reinicia).
    w.mostSetTab('pedido'); w.mostradorAddToCart(a.id);
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(false);
  } finally { w.close(); }
});

it('Mostrador: «No, gracias» la oculta solo para este pedido; una regla pausada no se ofrece', async () => {
  const { w, a } = await page({}); try {
    w.mostradorAddToCart(a.id);
    w.document.querySelector('[data-pos-upsell-skip]').click();
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(true);
    w.mostradorAddToCart(a.id);
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(true);
    w.mostradorClearCart(); w.mostradorAddToCart(a.id);
    expect(w.document.getElementById('most-cart-upsell').hidden).toBe(false);
  } finally { w.close(); }
  const paused = await page({ enabled: false }); try {
    paused.w.mostradorAddToCart(paused.a.id);
    expect(paused.w.document.getElementById('most-cart-upsell').hidden).toBe(true);
  } finally { paused.w.close(); }
});
