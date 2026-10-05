import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import * as C from '../src/core/index.js';
import { buildMenuJson, orderedCategories } from '../src/online/menuJson.js';
import { buildWaMessage, waUrl, normalizePhone } from '../src/online/orderMessage.js';
import { buildPublishFiles, buildIndexHtml, dataUrlToBytes } from '../src/online/publish.js';
import { createZip, crc32 } from '../src/online/zip.js';
import { demoState } from './helpers.js';

const TIENDA = {
  address: 'Av. Siempreviva 742, Buenos Aires', lat: -34.6037, lng: -58.3816, freeShippingMin: 45000, deliveryMinOrder: 15000, costPerKm: 1500,
  zones: [
    { id: 'z1', name: 'Zona A', type: 'circle', radiusKm: 2, baseCost: 1500, points: [] },
    { id: 'z2', name: 'Zona B', type: 'circle', radiusKm: 4, baseCost: 3000, points: [] },
    { id: 'poly', name: 'Barrio norte', type: 'polygon', baseCost: 2500, points: [[-34.40, -58.60], [-34.40, -58.50], [-34.30, -58.50], [-34.30, -58.60]] },
  ],
  paymentMethods: { efectivo: true, transferencia: true, mercadopago: false }, bankDetails: { alias: 'sahten.pagos', cbu: '000' },
};

describe('delivery por zonas (compartido entre Mostrador, menú publicado y web)', () => {
  it('círculos de menor a mayor radio; fuera de zona', () => {
    const a = C.zoneFor(TIENDA, -34.6037, -58.3816);                // en el local
    expect(a.zone.id).toBe('z1');
    const b = C.zoneFor(TIENDA, -34.6037 + 0.03, -58.3816);         // ≈3,3 km
    expect(b.zone.id).toBe('z2');
    const out = C.zoneFor(TIENDA, -35.3, -58.3816);
    expect(out).toMatchObject({ zone: null, out: true });
    expect(out.distKm).toBeGreaterThan(40);
  });
  it('polígonos por contención', () => {
    expect(C.pointInPolygon(-34.35, -58.55, TIENDA.zones[2].points)).toBe(true);
    expect(C.zoneFor(TIENDA, -34.35, -58.55).zone.id).toBe('poly');
    expect(C.pointInPolygon(-34.2, -58.55, TIENDA.zones[2].points)).toBe(false);
  });
  it('envío: costo de la zona, gratis desde el monto y mínimo de pedido', () => {
    expect(C.shippingFor(TIENDA, -34.6037, -58.3816, 20000)).toMatchObject({ ok: true, cost: 1500, free: false });
    expect(C.shippingFor(TIENDA, -34.6037, -58.3816, 45000)).toMatchObject({ ok: true, cost: 0, free: true });
    expect(C.shippingFor(TIENDA, -34.6037, -58.3816, 10000)).toMatchObject({ ok: false, belowMin: true, minOrder: 15000 });
    expect(C.shippingFor(TIENDA, -35.3, -58.48, 50000)).toMatchObject({ ok: false, out: true });
  });
  it('sin configuración usa el punto por defecto y no rompe', () => {
    expect(C.zoneFor({}, -34.6037, -58.3816)).toMatchObject({ zone: null, out: true });
    expect(C.zoneFor(undefined, 0, 0).out).toBe(true);
  });
});

describe('mensaje de WhatsApp', () => {
  const order = { num: 7, createdAt: '2026-10-05T15:30:00Z', source: 'delivery', customerName: 'Ana', customerPhone: '11 5555-1234', address: 'Siempreviva 750', zoneName: 'Zona A',
    paymentMethod: 'transferencia', items: [{ name: 'Pizza Muzzarella', qty: 2, lineTotal: 27000 }], subtotal: 27000, shipping: 1500, total: 28500, notes: 'Sin ajo' };
  it('normaliza teléfonos argentinos', () => {
    expect(normalizePhone('+54 9 11 5555-0123')).toBe('5491155550123');
    expect(normalizePhone('11 5555-0123')).toBe('5491155550123');
    expect(normalizePhone('')).toBe('');
  });
  it('incluye detalle, total, envío por zona, pago y datos del cliente', () => {
    const m = buildWaMessage(order);
    ['Pedido #0007', '*Delivery*', 'Ana', '11 5555-1234', 'Dirección: Siempreviva 750 (Zona A)', 'Pizza Muzzarella ×2 — $27.000', 'Envío: $1.500', '*Total: $28.500*', 'Pago: Transferencia', 'Notas: Sin ajo'].forEach(t => expect(m).toContain(t));
  });
  it('retiro sin línea de envío y envío gratis rotulado', () => {
    expect(buildWaMessage({ ...order, source: 'pickup', address: 'Retiro en local' })).not.toContain('Envío:');
    expect(buildWaMessage({ ...order, shipping: 0 })).toContain('Envío: Gratis');
  });
  it('el mensaje no lleva emojis (wa.me los rompe al redirigir)', () => {
    expect(buildWaMessage(order)).not.toMatch(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/u);
  });
  it('wa.me/<número>?text=… codificado', () => {
    const u = waUrl('+54 9 11 5555-0123', order);
    expect(u.startsWith('https://wa.me/5491155550123?text=')).toBe(true);
    expect(decodeURIComponent(u.split('text=')[1])).toContain('Pedido #0007');
  });
});

describe('menu.json', () => {
  const s = () => { const x = demoState(); x.project.currencySymbol = '$'; return x; };
  const cfg = { title: 'Menú', whatsappNumber: '+54 9 11 5555-0123', hiddenProducts: ['pizza_napo'], hiddenCategories: ['Bebidas'], categoryOrder: ['Pizzas', 'Empanadas'], showPrices: true, showImages: true };
  it('publica solo lo visible, con el mismo precio que la app, sin costos ni datos internos', () => {
    const st = s();
    const m = buildMenuJson(st, { menuConfig: cfg, tienda: TIENDA, images: { pizza_muzza: 'data:image/png;base64,AAAA' }, now: new Date('2026-10-05T12:00:00Z') });
    const ids = m.products.map(p => p.id);
    expect(ids).not.toContain('pizza_napo');                                  // oculto
    expect(m.products.find(p => p.category === 'Bebidas')).toBeUndefined(); // categoría oculta
    expect(ids).not.toContain('pizza_napo' && 'pizza_napo');
    const sc = m.products.find(p => p.id === 'pizza_muzza');
    expect(sc.price).toBe(C.mostradorFinalPrice(st, st.products.find(p => p.id === 'pizza_muzza')));
    expect(sc.image).toBe('img/pizza_muzza.jpg');
    expect(m.config.categories.slice(0, 2)).toEqual(['Pizzas', 'Empanadas']);
    const text = JSON.stringify(m);
    ['receta_cost', 'ingredients', 'packaging', 'precioPkg', 'gastosOp', 'commission', 'customers', 'orders'].forEach(k => expect(text).not.toContain(k));
    expect(m.store.whatsapp).toBe('+54 9 11 5555-0123');
    expect(m.delivery.zones).toHaveLength(3);
    expect(m.payments.bank.alias).toBe('sahten.pagos');
    expect(m.supabase).toBeNull();
  });
  it('sin precios / sin imágenes según la configuración; supabase solo si está completo', () => {
    const st = s();
    const m = buildMenuJson(st, { menuConfig: { showPrices: false, showImages: false }, tienda: TIENDA, images: { pizza_muzza: 'data:image/png;base64,AAAA' }, supabase: { url: 'https://x.supabase.co', anonKey: 'k', storeId: '' } });
    expect(m.products.every(p => p.price === 0 && p.image === null)).toBe(true);
    expect(m.supabase).toBeNull();
    expect(buildMenuJson(st, { supabase: { url: 'https://x.supabase.co', anonKey: 'k', storeId: 's1', slug: 'mi-local' } }).supabase).toEqual({ url: 'https://x.supabase.co', anonKey: 'k', storeId: 's1', slug: 'mi-local' });
  });
  it('orden de categorías: primero las elegidas, después el resto', () => {
    expect(orderedCategories([{ category: 'B' }, { category: 'A' }, { category: 'C' }], { categoryOrder: ['C'], hiddenCategories: ['A'] })).toEqual(['C', 'B']);
  });
});

describe('carpeta publicada', () => {
  const st = demoState();
  const menu = buildMenuJson(st, { menuConfig: { whatsappNumber: '5491155550123' }, tienda: TIENDA, images: { pizza_muzza: 'data:image/png;base64,iVBORw0KGgo=' } });
  it('index.html + menu.json + imágenes', async () => {
    const files = await buildPublishFiles(menu, { pizza_muzza: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(files.map(f => f.path)).toEqual(['index.html', 'menu.json', 'img/pizza_muzza.jpg']);
    expect(files[2].data).toBeInstanceOf(Uint8Array);
    const html = files[0].data;
    expect(html).toContain('function shippingFor');          // la cuenta de zonas viaja adentro
    expect(html).toContain('function buildWaMessage');
    expect(html).not.toMatch(/^export /m);
    expect(html).not.toContain('localStorage');               // la web no guarda datos del negocio
    expect(JSON.parse(files[1].data).products.length).toBe(menu.products.length);
  });
  it('el JSON incrustado no puede cerrar el <script>', () => {
    const m = { ...menu, store: { ...menu.store, name: 'x</script><script>alert(1)</script>' } };
    const html = buildIndexHtml(m);
    expect(html.split('</script>').length).toBe(buildIndexHtml(menu).split('</script>').length);
  });
  it('dataURL → bytes', () => { expect(Array.from(dataUrlToBytes('data:text/plain;base64,aG9sYQ=='))).toEqual([104, 111, 108, 97]); expect(dataUrlToBytes('nada')).toBeNull(); });
  it('zip válido: cabeceras, CRC y contenido', () => {
    const zip = createZip([{ path: 'a.txt', data: 'hola' }, { path: 'img/b.bin', data: Uint8Array.from([1, 2, 3]) }]);
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22; expect(dv.getUint32(eocd, true)).toBe(0x06054b50); expect(dv.getUint16(eocd + 10, true)).toBe(2);
    const cdOff = dv.getUint32(eocd + 16, true); expect(dv.getUint32(cdOff, true)).toBe(0x02014b50);
    expect(dv.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hola')));
    expect(new TextDecoder().decode(zip.slice(30 + 5, 30 + 5 + 4))).toBe('hola');
  });
});

// ── La web publicada, en jsdom ───────────────────────────
async function web({ menu, fetchMap = {}, fallbackOnly = false, search = '' }) {
  const html = buildIndexHtml(menu);
  const calls = [], opened = [];
  const dom = new JSDOM(html, {
    url: 'https://mi-local.pages.dev/' + search, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async (url, opts = {}) => {
        calls.push({ url: String(url), opts });
        for (const [k, v] of Object.entries(fetchMap)) if (String(url).includes(k)) { const r = typeof v === 'function' ? await v(url, opts) : v; if (r instanceof Error) throw r; return { ok: r.ok !== false, status: r.status || 200, json: async () => r.body }; }
        if (String(url).endsWith('menu.json') && !fallbackOnly) return { ok: true, status: 200, json: async () => menu };
        throw new Error('sin red: ' + url);
      };
      w.open = u => { opened.push(u); return null; };
      w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, 60));
  const w = dom.window, d = w.document;
  const click = sel => d.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const type = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, d, calls, opened, click, type, wait: ms => new Promise(r => setTimeout(r, ms)) };
}

describe('web publicada', () => {
  const st = demoState();
  const baseMenu = (extra = {}) => ({ ...buildMenuJson(st, { menuConfig: { whatsappNumber: '+54 9 11 5555-0123', title: 'Sahten' }, tienda: TIENDA, store: { name: 'Sahten' } }), ...extra });

  it('muestra categorías y productos con precio; agrega al carrito', async () => {
    const m = baseMenu(); const a = await web({ menu: m });
    expect(a.d.querySelector('#h-title').textContent).toBe('Sahten');
    expect(a.d.querySelectorAll('.card').length).toBe(m.products.length);
    expect(a.d.querySelector('.card .price').textContent).toMatch(/^\$/);
    a.click('[data-inc]'); a.click('[data-inc]');
    expect(a.d.querySelector('#bar').classList.contains('on')).toBe(true);
    expect(a.d.querySelector('#bar-n').textContent).toBe('2 productos');
  });
  it('sin red igual abre desde el menú incrustado (archivo local)', async () => {
    const a = await web({ menu: baseMenu(), fallbackOnly: true });
    expect(a.d.querySelectorAll('.card').length).toBeGreaterThan(0);
  });
  it('menú desactivado muestra el aviso', async () => {
    const m = baseMenu(); m.config.enabled = false;
    expect((await web({ menu: m })).d.querySelector('#msg').textContent).toMatch(/no disponible/);
  });
  it('retiro: el pedido sale por wa.me con detalle y total', async () => {
    const m = baseMenu(); const a = await web({ menu: m });
    a.click('[data-inc]'); a.click('#bar button');
    a.click('[data-type="pickup"]');
    a.type('#f-name', 'Ana'); a.type('#f-phone', '11 5555-1234');
    expect(a.d.querySelector('#send').disabled).toBe(false);
    a.click('#send');
    expect(a.opened).toHaveLength(1);
    expect(a.opened[0].startsWith('https://wa.me/5491155550123?text=')).toBe(true);
    const msg = decodeURIComponent(a.opened[0].split('text=')[1]);
    expect(msg).toContain('Retiro en local'); expect(msg).toContain('Ana'); expect(msg).toContain('Total');
    expect(a.d.querySelector('#sheet').textContent).toMatch(/Gracias, Ana/);
    expect(a.calls.filter(c => c.url.includes('/rest/v1/orders'))).toHaveLength(0);   // sin backend
  });
  it('delivery: calcula el envío por zona (misma cuenta que el Mostrador) y bloquea fuera de zona', async () => {
    const m = baseMenu();
    const a = await web({ menu: m, fetchMap: { 'nominatim': { body: [{ display_name: 'Siempreviva 750, Buenos Aires, Buenos Aires', lat: '-34.6040', lon: '-58.3820' }, { display_name: 'Lejos 1, Mar del Plata', lat: '-38.0', lon: '-57.55' }] } } });
    a.click('[data-inc]'); a.click('[data-inc]'); a.click('[data-inc]'); a.click('#bar button');
    a.type('#f-name', 'Ana'); a.type('#f-phone', '1155551234');
    a.type('#f-addr', 'Siempreviva 750'); await a.wait(650);
    expect(a.d.querySelectorAll('[data-sug]').length).toBe(2);
    a.click('[data-sug="0"]');
    const sub = a.w.eval('document.querySelector("#sheet").textContent');
    expect(sub).toMatch(/Zona A/); expect(sub).toMatch(/Envío/);
    expect(a.d.querySelector('#send').disabled).toBe(false);
    // fuera de zona
    a.type('#f-addr', 'Lejos 1'); await a.wait(650); a.click('[data-sug="1"]');
    expect(a.d.querySelector('#sheet').textContent).toMatch(/fuera de la zona/);
    expect(a.d.querySelector('#send').disabled).toBe(true);
  });
  it('con Supabase: guarda el pedido en la tabla orders con el store_id', async () => {
    const m = baseMenu({ supabase: { url: 'https://abc.supabase.co', anonKey: 'anon', storeId: 'store-1', slug: 'mi-local' } });
    const a = await web({ menu: m, fetchMap: { '/rest/v1/stores': { body: [] }, '/rest/v1/orders': { status: 201, body: null } } });
    a.click('[data-inc]'); a.click('#bar button'); a.click('[data-type="pickup"]'); a.type('#f-name', 'Ana'); a.type('#f-phone', '1155551234'); a.click('#send');
    await a.wait(30);
    const post = a.calls.find(c => c.url.includes('/rest/v1/orders'));
    expect(post.opts.method).toBe('POST');
    expect(post.opts.headers.apikey).toBe('anon');
    const body = JSON.parse(post.opts.body);
    expect(body.store_id).toBe('store-1'); expect(body.payload.customerName).toBe('Ana'); expect(body.payload.items.length).toBe(1);
    expect(a.opened).toHaveLength(0);
    expect(a.d.querySelector('#sheet').textContent).toMatch(/Recibimos tu pedido/);
  });
  it('con Supabase y sin conexión: avisa al cliente y ofrece WhatsApp; no da el pedido por enviado', async () => {
    const m = baseMenu({ supabase: { url: 'https://abc.supabase.co', anonKey: 'anon', storeId: 'store-1' } });
    const a = await web({ menu: m, fetchMap: { '/rest/v1/orders': new Error('Failed to fetch') } });
    a.click('[data-inc]'); a.click('#bar button'); a.click('[data-type="pickup"]'); a.type('#f-name', 'Ana'); a.type('#f-phone', '1155551234'); a.click('#send');
    await a.wait(30);
    expect(a.d.querySelector('#err').textContent).toMatch(/No pudimos enviar tu pedido/);
    expect(a.d.querySelector('#err a').href).toContain('wa.me/5491155550123');
    expect(a.d.querySelector('#sheet').textContent).not.toMatch(/Recibimos/);
    expect(a.d.querySelector('#send')).toBeTruthy();                    // se puede reintentar
  });
  it('con Supabase: lee el menú en vivo por slug (?store=) y deja el menu.json si falla', async () => {
    const m = baseMenu({ supabase: { url: 'https://abc.supabase.co', anonKey: 'anon', storeId: 'store-1' } });
    const live = { ...m, products: m.products.slice(0, 2) }; delete live.supabase;
    const a = await web({ menu: m, search: '?store=mi-local', fetchMap: { '/rest/v1/stores': { body: [{ id: 'store-9', menus: [{ json: live }] }] } } });
    expect(a.calls.find(c => c.url.includes('slug=eq.mi-local'))).toBeTruthy();
    expect(a.d.querySelectorAll('.card').length).toBe(2);
    const b = await web({ menu: m, search: '?store=mi-local', fetchMap: { '/rest/v1/stores': new Error('offline') } });
    expect(b.d.querySelectorAll('.card').length).toBe(m.products.length);
  });
  it('fotos con el menú en vivo: solo se muestran las que existen en la carpeta publicada', async () => {
    const m = baseMenu({ supabase: { url: 'https://abc.supabase.co', anonKey: 'anon', storeId: 'store-1' } });
    m.products[0].image = 'img/a.jpg';                                   // publicada
    const live = JSON.parse(JSON.stringify(m)); delete live.supabase;
    live.products[1].image = 'img/nueva.jpg';                            // foto cargada después, sin volver a publicar
    const a = await web({ menu: m, fetchMap: { '/rest/v1/stores': { body: [{ id: 'store-1', menus: [{ json: live }] }] } } });
    const srcs = [...a.d.querySelectorAll('.card img')].map(i => i.getAttribute('src'));
    expect(srcs).toEqual(['img/a.jpg']);
  });
});
