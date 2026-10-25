import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import * as C from '../src/core/index.js';
import { buildMenuJson, orderedCategories } from '../src/online/menuJson.js';
import { normalizeSite, SITE_ORDER, reviewsFromGoogle, normalizePlaceId, exportSiteContent, parseSiteContent, applySiteContent } from '../src/online/site.js';
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

  it('pedido accesible: etiquetas asociadas, foco, Escape y datos conservados al reabrir', async () => {
    const a = await web({ menu: baseMenu() });
    a.click('[data-inc]');
    const trigger = a.d.querySelector('#bar button'); trigger.focus(); trigger.click();
    const sheet = a.d.getElementById('sheet');
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(a.d.activeElement).toBe(sheet);
    a.click('#cart-next');
    expect(a.d.getElementById('menuwrap').inert).toBe(true);
    expect(a.d.querySelector('label[for="f-name"]').control).toBe(a.d.getElementById('f-name'));
    a.type('#f-name', 'Pedido de prueba'); a.type('#f-phone', '1100000000');
    a.click('[data-type="pickup"]');
    expect(a.d.getElementById('f-name').value).toBe('Pedido de prueba');
    expect(a.d.getElementById('send').disabled).toBe(false);
    sheet.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(a.d.getElementById('ov').classList.contains('on')).toBe(false);
    expect(a.d.getElementById('menuwrap').inert).toBe(false);
    expect(a.d.activeElement).toBe(trigger);
    trigger.click(); a.click('#cart-next'); expect(a.d.getElementById('f-name').value).toBe('Pedido de prueba');
    a.w.close();
  });

  it('el primer paso permite sumar, restar y quitar productos sin enviar pedidos ni pedir datos', async () => {
    const a=await web({menu:baseMenu()});try{
      a.click('[data-inc]');a.click('#bar button');
      expect(a.d.querySelector('#f-name')).toBeNull();expect(a.d.querySelector('#send')).toBeNull();
      expect(a.d.querySelector('[aria-current="step"]').textContent).toContain('Pedido');
      let plus=a.d.querySelector('.cart-items [data-inc]');const id=plus.id;plus.focus();plus.click();
      expect(a.d.querySelector('.cart-quantity output').textContent).toBe('2');expect(a.d.activeElement.id).toBe(id);
      const amount=a.d.querySelector('.cart-item-price').textContent;
      a.click('.cart-items [data-dec]');expect(a.d.querySelector('.cart-quantity output').textContent).toBe('1');expect(a.d.querySelector('.cart-item-price').textContent).not.toBe(amount);
      expect(a.d.querySelector('.cart-items [data-dec]').disabled).toBe(true);
      a.click('[data-remove]');expect(a.d.querySelector('#sheet').textContent).toContain('Tu pedido está vacío');expect(a.d.querySelector('#cart-next')).toBeNull();expect(a.d.querySelector('#send')).toBeNull();
      expect(a.d.querySelector('#bar-n').textContent).toBe('0 productos');expect(a.calls.some(c=>c.opts.method==='POST')).toBe(false);
    }finally{a.w.close();}
  });
  it('volver a editar conserva datos y efectivo; la orden final usa la cantidad y total nuevos',async()=>{
    const m=baseMenu({supabase:{url:'https://abc.supabase.co',anonKey:'anon',storeId:'store-1'}});m.products=[{id:'p',name:'Plato de prueba',price:10000,category:'Platos'}];m.payments.benefit={enabled:true,percent:10,channels:{online:true,mostrador:true}};
    const a=await web({menu:m,fetchMap:{'/rest/v1/stores':{body:[]},'/rest/v1/orders':{status:201,body:null}}});try{
      a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');
      a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');a.type('#f-floor','2');a.type('#f-apartment','B');a.type('#f-reference','Timbre 2B');a.type('#f-notes','Sin cebolla');a.type('#f-cash','20000');
      a.click('[data-checkout-step="cart"]');a.click('.cart-items [data-inc]');a.click('#cart-next');
      for(const [selector,value] of [['#f-name','Cliente de prueba'],['#f-phone','1112345678'],['#f-floor','2'],['#f-apartment','B'],['#f-reference','Timbre 2B'],['#f-notes','Sin cebolla'],['#f-cash','20000']])expect(a.d.querySelector(selector).value).toBe(value);
      a.click('[data-type="pickup"]');expect(a.d.getElementById('cash-status').textContent).toContain('$2.000');expect(a.d.querySelector('#send').textContent).toContain('$18.000');
      a.click('#send');await a.wait(30);const posts=a.calls.filter(c=>c.url.includes('/rest/v1/orders'));
      expect(posts).toHaveLength(1);const order=JSON.parse(posts[0].opts.body).payload;
      expect(order.items[0].qty).toBe(2);expect(order).toMatchObject({subtotal:20000,discountAmount:2000,total:18000,cashTendered:20000,cashChange:2000,notes:'Sin cebolla'});
    }finally{a.w.close();}
  });

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
    a.click('[data-inc]'); a.click('#bar button');a.click('#cart-next');
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
    a.click('[data-inc]'); a.click('[data-inc]'); a.click('[data-inc]'); a.click('#bar button');a.click('#cart-next');
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
    a.click('[data-inc]'); a.click('#bar button');a.click('#cart-next'); a.click('[data-type="pickup"]'); a.type('#f-name', 'Ana'); a.type('#f-phone', '1155551234'); a.click('#send');
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
    a.click('[data-inc]'); a.click('#bar button');a.click('#cart-next'); a.click('[data-type="pickup"]'); a.type('#f-name', 'Ana'); a.type('#f-phone', '1155551234'); a.click('#send');
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
  it('una foto nueva de Storage se ve en el menú en vivo sin republicar la carpeta', async () => {
    const m = baseMenu({ supabase: { url: 'https://abc.supabase.co', anonKey: 'anon', storeId: 'store-1' } });
    const live = JSON.parse(JSON.stringify(m)); delete live.supabase;
    live.products[0].image = 'https://abc.supabase.co/storage/v1/object/public/sahten-photos/store-1/new.jpg';
    const a = await web({ menu: m, fetchMap: { '/rest/v1/stores': { body: [{ id: 'store-1', menus: [{ json: live }] }] } } });
    expect([...a.d.querySelectorAll('.card img')].map(i => i.getAttribute('src'))).toContain(live.products[0].image);
    live.products[0].image = null;
    const b = await web({ menu: m, fetchMap: { '/rest/v1/stores': { body: [{ id: 'store-1', menus: [{ json: live }] }] } } });
    expect(b.d.querySelectorAll('.card img')).toHaveLength(0);
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

describe('sitio web: módulos (secciones) junto al menú', () => {
  const SITE = { enabled: true, order: ['historia', 'hero', 'menu', 'favoritos', 'faq', 'contacto'],
    hero: { on: true, title: 'Pizza <b>de barrio</b>', subtitle: 'Hecha al momento', cta: 'Pedí', highlights: [{ icon: '🍕', title: 'Masa de 48 h', text: 'Liviana' }, { title: '' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, { title: 'E' }] },
    favoritos: { on: true, title: 'Favoritos', text: '' }, como: { on: false },
    historia: { on: true, title: 'Historia', text: 'Primer párrafo.\n\nSegundo párrafo.', badgeWord: 'Sahten', badgeMeaning: 'buen provecho' },
    banda: { on: false }, resenas: { on: true, items: Array.from({ length: 12 }, (_, i) => ({ text: 'Muy rica ' + i, author: 'Ana' })).concat([{ text: '   ' }]) },
    catering: { on: false }, delivery: { on: true, hours: 'Lun a Jue 18 a 22' },
    faq: { on: true, items: [{ q: '¿Cómo pido?', a: 'Desde acá.' }, { q: '', a: 'sin pregunta' }] }, contacto: { on: true, instagram: '@mi.local!<x>' } };
  const st = () => { const x = demoState(); x.project.currencySymbol = '$'; return x; };
  const menuCon = (site, images) => buildMenuJson(st(), { menuConfig: { whatsappNumber: '+54 9 11 5555-0123', title: 'Mi local', site }, tienda: TIENDA, store: { name: 'Mi local' }, images });

  it('apagado no agrega nada; encendido deja solo las secciones encendidas, en orden, con el texto recortado', () => {
    expect(menuCon({ ...SITE, enabled: false }).site).toBeNull(); expect(menuCon(undefined).site).toBeNull();
    const m = menuCon(SITE).site;
    expect(m.order).toEqual(['historia', 'hero', 'menu', 'favoritos', 'faq', 'contacto', 'resenas', 'delivery']);       // apagadas fuera (como, banda, catering); menú siempre
    expect(m.como).toBeUndefined(); expect(m.hero.highlights.map(h => h.title)).toEqual(['Masa de 48 h', 'B', 'C', 'D']);
    expect(m.faq.items).toEqual([{ q: '¿Cómo pido?', a: 'Desde acá.' }]); expect(m.contacto.instagram).toBe('mi.localx');
    expect(menuCon({ ...SITE, resenas: { on: true, items: SITE.resenas.items } }).site.resenas.items).toHaveLength(9);
    expect(menuCon(SITE, { site_hero: 'data:image/png;base64,AA' }).site.images).toEqual({ hero: 'img/site_hero.jpg', historia: null });
  });
  it('normalizeSite completa lo que falta y repara el orden', () => {
    const n = normalizeSite({ enabled: true, order: ['faq', 'faq', 'inventada', 'hero'] });
    expect(n.order.slice(0, 2)).toEqual(['faq', 'hero']); expect(n.order).toHaveLength(SITE_ORDER.length); expect(new Set(n.order).size).toBe(SITE_ORDER.length);
    expect(n.como.steps).toHaveLength(3); expect(n.menu.title).toBe('Nuestro menú');
  });
  it('la página dibuja las secciones en el orden elegido, escapa el texto y sigue vendiendo', async () => {
    const m = menuCon(SITE); const a = await web({ menu: m }); const d = a.d;
    expect(d.querySelector('.hero h1').textContent).toBe('Pizza <b>de barrio</b>'); expect(d.querySelector('.hero h1 b')).toBeNull();      // nada de HTML
    expect(d.querySelectorAll('.hl > div').length).toBe(4);
    const html = d.body.innerHTML; expect(html.indexOf('id="s-about"')).toBeLessThan(html.indexOf('id="s-hero"')); expect(html.indexOf('id="s-hero"')).toBeLessThan(html.indexOf('id="menu"'));
    expect(d.querySelector('.badge .w').textContent).toBe('Sahten'); expect(d.querySelectorAll('#s-about p').length).toBe(2);
    expect(d.querySelectorAll('#s-fav .card').length).toBe(m.products.filter(p => p.star).length);
    expect(d.querySelectorAll('.faq details').length).toBe(1); expect(d.querySelector('#s-how')).toBeNull(); expect(d.querySelector('.band')).toBeNull();
    expect(d.querySelector('.sfoot a[href^="https://instagram.com/"]').getAttribute('href')).toBe('https://instagram.com/mi.localx');
    expect(d.querySelector('.fab').getAttribute('href')).toContain('wa.me/');
    a.click('[data-inc]'); expect(d.querySelector('.snav .pedido').textContent).toBe('Mi pedido (1)');
  });
  it('con sitio: el inicio muestra tarjetas por categoría y «Pedir online»; la carta completa se abre en su propia vista (#pedido) y «Atrás» vuelve', async () => {
    const m = menuCon(SITE); const a = await web({ menu: m }); const { d, w } = a;
    const cats = [...new Set(m.products.map(p => p.category).filter(Boolean))];
    expect(d.body.classList.contains('view-order')).toBe(false);
    expect(d.querySelectorAll('.ctile').length).toBeGreaterThan(0); expect(d.querySelectorAll('.ctile').length).toBeLessThanOrEqual(cats.length);
    expect(d.querySelector('.pedir-cta').getAttribute('href')).toBe('#pedido');
    const first = d.querySelector('.ctile'); const k = decodeURIComponent(first.getAttribute('href').replace('#pedido/', ''));
    w.location.hash = first.getAttribute('href'); await a.wait(40);
    expect(d.body.classList.contains('view-order')).toBe(true); expect(d.querySelector('.cat.on').textContent).toBe(k);
    expect(d.querySelectorAll('#grid .card').length).toBe(m.products.filter(p => p.category === k).length);
    a.click('.cat[data-cat="all"]'); expect(d.querySelectorAll('#grid .card').length).toBe(m.products.length);
    w.location.hash = ''; await a.wait(40);
    expect(d.body.classList.contains('view-order')).toBe(false);
  });
  it('sin sitio, #pedido no cambia nada: la página ya es la carta', async () => {
    const a = await web({ menu: menuCon({ ...SITE, enabled: false }) });
    a.w.location.hash = '#pedido'; await a.wait(40);
    expect(a.d.body.classList.contains('view-order')).toBe(false); expect(a.d.querySelectorAll('#grid .card').length).toBeGreaterThan(0);
  });
  it('sin sitio, la página es la de siempre (encabezado simple, sin portada)', async () => {
    const a = await web({ menu: menuCon({ ...SITE, enabled: false }) });
    expect(a.d.body.classList.contains('has-site')).toBe(false); expect(a.d.querySelector('.hero')).toBeNull(); expect(a.d.querySelector('#h-title').textContent).toBe('Mi local'); expect(a.d.querySelector('.fab')).toBeNull();
  });
  it('las fotos del sitio viajan en la carpeta publicada', async () => {
    const m = menuCon(SITE, { site_hero: 'data:image/png;base64,iVBORw0KGgo=' }); const files = await buildPublishFiles(m, { site_hero: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(files.map(f => f.path)).toContain('img/site_hero.jpg');
  });
  it('la descripción corta de cada producto sale en el menú', async () => {
    const x = st(); x.products[0].description = 'Con aceitunas'; const m = buildMenuJson(x, { menuConfig: { whatsappNumber: '+54 9 11 5555-0123' }, tienda: TIENDA, store: { name: 'Mi local' } });
    expect(m.products.find(p => p.id === x.products[0].id).description).toBe('Con aceitunas');
    const a = await web({ menu: m }); expect(a.d.querySelector('.desc').textContent).toBe('Con aceitunas');
  });
});

describe('sitio web: reseñas de Google y contenido exportable', () => {
  it('convierte la respuesta de Places API en reseñas editables (máx. 5) y un resumen', () => {
    const place = { rating: 4.8, userRatingCount: 120, reviews: [1, 2, 3, 4, 5, 6].map(i => ({ rating: 5, text: { text: 'Muy rico ' + i }, authorAttribution: { displayName: 'Cliente ' + i } })).concat([{ rating: 5 }]) };
    const r = reviewsFromGoogle(place);
    expect(r.items).toHaveLength(5); expect(r.items[0]).toEqual({ text: 'Muy rico 1', author: 'Cliente 1', source: 'Google' }); expect(r.lead).toBe('★ 4,8 · 120 reseñas en Google');
    expect(reviewsFromGoogle({}).items).toEqual([]); expect(normalizePlaceId(' places/ChIJ-abc_1 ')).toBe('ChIJ-abc_1');
  });
  it('exporta e importa el contenido: solo pisa las secciones que trae el archivo y valida el formato', () => {
    const origen = normalizeSite({ enabled: true, historia: { on: true, title: 'Mi historia', text: 'Texto' }, faq: { on: true, items: [{ q: 'P', a: 'R' }] } });
    const txt = exportSiteContent(origen); const parsed = parseSiteContent(txt);
    expect(parsed.modules).toContain('historia');
    const destino = normalizeSite({ enabled: false, hero: { on: true, title: 'Otra portada' } });
    const r = applySiteContent(destino, parsed);
    expect(r.historia.title).toBe('Mi historia'); expect(r.faq.items).toHaveLength(1); expect(r.enabled).toBe(false);
    const parcial = parseSiteContent(JSON.stringify({ format: 'sahten-sitio', version: 1, site: { catering: { on: true, title: 'Eventos' } } }));
    const r2 = applySiteContent(r, parcial); expect(r2.catering.title).toBe('Eventos'); expect(r2.historia.title).toBe('Mi historia');   // lo demás no se toca
    expect(() => parseSiteContent('no json')).toThrow(/válido/); expect(() => parseSiteContent('{"a":1}')).toThrow(/contenido de sitio/);
  });
});

describe('Mercado Pago en la web sin claves privadas',()=>{
  function menuMP(){const m=buildMenuJson(demoState(),{menuConfig:{whatsappNumber:'5491155550123'},tienda:TIENDA,store:{name:'Mi local'},supabase:{url:'https://abcd1234.supabase.co',anonKey:'sb_publishable_test',storeId:'store-1'}});m.payments.methods={mercadopago:true,efectivo:true};return m;}
  it('oculta Mercado Pago cuando el servidor no está conectado y conserva efectivo',async()=>{
    const a=await web({menu:menuMP()});a.click('[data-inc]');a.w.document.querySelector('.bar button').click();a.click('#cart-next');
    expect(a.d.querySelector('#f-pay')).toBeNull();
    expect([...a.d.querySelectorAll('[data-payment-choice]')].map(o=>o.dataset.paymentChoice)).toEqual(['efectivo']);a.w.close();
  });
  it('ofrece checkout cuando la cuenta del negocio está habilitada y no inserta un pedido sin verificar pago',async()=>{
    const a=await web({menu:menuMP(),fetchMap:{'/sahten-payments/config':{body:{enabled:true,mode:'test'}},'/sahten-payments/checkout':{status:503,ok:false,body:{message:'Prueba sin cobro real'}}}});
    a.click('[data-inc]');a.w.document.querySelector('.bar button').click();a.click('#cart-next');a.click('[data-type="pickup"]');a.type('#f-name','Cliente de prueba');a.type('#f-phone','1112345678');
    a.click('[data-checkout-step="cart"]');a.click('.cart-items [data-inc]');a.click('#cart-next');
    expect(a.d.querySelector('#f-name').value).toBe('Cliente de prueba');
    expect(a.d.querySelector('#send').textContent).toContain('Ir a Mercado Pago');a.click('#send');await a.wait(10);
    const checkout=a.calls.find(c=>c.url.includes('/sahten-payments/checkout'));
    expect(checkout).toBeTruthy();const order=JSON.parse(checkout.opts.body).order;expect(order.items[0].qty).toBe(2);expect(order.total).toBe(order.items[0].unitPrice*2);
    expect(a.calls.some(c=>c.url.includes('/rest/v1/orders')&&c.opts.method==='POST')).toBe(false);
    expect(a.d.querySelector('#err').textContent).toContain('Prueba sin cobro real');a.w.close();
  });
  it('no confía en un success de la URL de regreso sin una sesión de compra válida',async()=>{
    const a=await web({menu:menuMP(),search:'?mp_checkout=00000000-0000-4000-8000-000000000001&status=approved',fetchMap:{'/sahten-payments/config':{body:{enabled:true}}}});
    expect(a.d.querySelector('#sheet').textContent).toContain('no confirma por sí solo');
    expect(a.d.querySelector('#sheet').textContent).not.toContain('Pago acreditado.');a.w.close();
  });
});

describe('opciones de pago visibles y beneficio histórico',()=>{
  it('alterna métodos con botones, conserva los datos y envía productos con descuento y envío completo',async()=>{
    const m=buildMenuJson(demoState(),{tienda:{...TIENDA,deliveryMinOrder:0,freeShippingMin:0,paymentBenefit:{enabled:true,percent:10,revision:'promo-1',channels:{online:true,mostrador:true}}},supabase:{url:'https://test.supabase.co',anonKey:'sb_publishable_test',storeId:'store1'}});
    m.products=[{id:'plato',name:'Plato ficticio',price:10000}];m.config.categories=[];
    m.payments.methods={efectivo:true,transferencia:true,mercadopago:true};
    const a=await web({menu:m,fetchMap:{'/sahten-payments/config':{body:{enabled:true,mode:'test'}},'nominatim.openstreetmap.org':{body:[{display_name:'Calle ficticia 123, Ciudad',lat:TIENDA.lat,lon:TIENDA.lng}]},'/rest/v1/orders':{status:201,body:[]}}});
    a.click('[data-inc]');a.click('#bar button');a.click('#cart-next');a.type('#f-name','Cliente ficticio');a.type('#f-phone','1100000000');a.type('#f-addr','Calle ficticia 123');await a.wait(560);a.click('[data-sug="0"]');
    expect(a.d.querySelector('#f-pay')).toBeNull();
    expect(a.d.querySelector('.payment-choices').textContent).toContain('10 % de descuento');
    expect(a.d.querySelector('[data-payment-choice="mercadopago"] svg')).toBeTruthy();
    expect(a.d.querySelector('#send').textContent).toContain('$10.500');
    a.click('[data-payment-choice="mercadopago"]');
    expect(a.d.querySelector('#send').textContent).toContain('$11.500');
    expect(a.d.querySelector('#f-name').value).toBe('Cliente ficticio');
    a.click('[data-payment-choice="efectivo"]');a.click('[data-payment-choice="transferencia"]');
    expect(a.d.querySelector('#send').textContent).toContain('$10.500');a.click('#send');await a.wait(20);
    const request=a.calls.find(c=>c.url.includes('/rest/v1/orders')&&c.opts.method==='POST');
    const o=JSON.parse(request.opts.body).payload;
    expect(o).toMatchObject({paymentMethod:'transferencia',subtotal:10000,shipping:1500,discountAmount:1000,total:10500,paymentDiscount:{percent:10,revision:'promo-1',amount:1000}});
    expect(a.d.querySelector('#sheet').textContent).toContain('Datos para la transferencia');
    expect(a.d.querySelector('#sheet').textContent).toContain('10 % por efectivo o transferencia');a.w.close();
  });
});

describe('invitación a reseñar en Google', () => {
  it('muestra la invitación aun sin reseñas y solo acepta enlaces de Google', async () => {
    const menu = buildMenuJson(demoState(), { tienda: TIENDA });
    menu.site = { enabled: true, order: ['resenas','menu'], resenas: { title: 'Opiniones', items: [], reviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJdemo', reviewTitle: '¿Ya probaste nuestra comida?', reviewText: 'Contanos tu experiencia' } };
    const { w, d } = await web({ menu });
    const button = d.querySelector('.google-review-button');
    expect(button.textContent).toContain('Dejar una reseña en Google');
    expect(button.href).toBe(menu.site.resenas.reviewUrl);
    expect(button.rel).toContain('noopener');
    expect(d.querySelector('.google-review-button img').src).toMatch(/^https:\/\/www.gstatic.com/);
    w.close();
    menu.site.resenas.reviewUrl = 'javascript:alert(1)';
    const bad = await web({ menu });
    expect(bad.d.querySelector('.google-review-button')).toBeNull(); bad.w.close();
  });
});
