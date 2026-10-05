// Lo online dentro de la app real (jsdom): publicar, panel, roles, pedidos en vivo, build sin online.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';

beforeAll(async () => { await buildTestBundle(); await buildTestBundle({ online: false }); }, 180000);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const ANON = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.x`;
const URL_OK = 'https://abcd1234.supabase.co';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function app(opts) {
  const a = await openApp(opts); const w = a.window;
  Object.assign(w.SAHTEN.project.adapter, createMemoryAdapter({ files: {} }));
  a.ev = c => w.eval(c); a.p = w.SAHTEN.project; a.on = w.SAHTEN.online;
  return a;
}
class FakeWS { static last; constructor() { FakeWS.last = this; this.sent = []; } send(s) { this.sent.push(JSON.parse(s)); } close() {} }
function backend(w, routes) {
  const calls = [];
  w.fetch = async (url, o = {}) => { calls.push({ url, method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : undefined }); const k = Object.keys(routes).find(x => url.includes(x)); const r = k ? (typeof routes[k] === 'function' ? routes[k](calls.at(-1)) : routes[k]) : { status: 404, body: { message: 'no route ' + url } }; return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.body }; };
  w.WebSocket = FakeWS; return calls;
}

describe('publicar menú desde la app', () => {
  it('menu.json del proyecto abierto: precios de la app, WhatsApp y avisos de lo que falta', async () => {
    const a = await app(); await a.p.openDemo();
    const m = a.on.publish.currentMenu();
    expect(m.products.length).toBeGreaterThan(4);
    expect(m.products[0].price).toBe(a.ev('mostradorFinalPrice(PRODUCTS.find(p=>p.id===SAHTEN.online.publish.currentMenu().products[0].id))'));
    expect(m.theme.primary).toMatch(/^#/);
    expect(JSON.stringify(m)).not.toMatch(/receta_cost|precioPkg/);
    expect(a.on.publish.publishProblems(m).some(t => /WhatsApp/.test(t))).toBe(false);   // el demo ya trae su número
    a.ev("MENU_CONFIG.whatsappNumber=''");
    expect(a.on.publish.publishProblems(a.on.publish.currentMenu()).some(t => /WhatsApp/.test(t))).toBe(true);
    a.ev("MENU_CONFIG.whatsappNumber='+54 9 11 5555-0123'");
    expect(a.on.publish.publishProblems(a.on.publish.currentMenu()).some(t => /WhatsApp/.test(t))).toBe(false);
    a.window.close();
  }, 60000);
  it('Menú Online trae el botón «Publicar menú» y la vista previa', async () => {
    const a = await app(); await a.p.openDemo(); a.ev("showPanel('menuonline'); renderMenuOnline();"); await wait(30);
    const html = a.window.document.getElementById('panel-menuonline').innerHTML;
    expect(html).toMatch(/Publicar menú/); expect(html).toMatch(/Vista previa/); expect(html).not.toMatch(/Sahten Menu v2/);
    a.window.close();
  }, 60000);
});

describe('roles en pantalla', () => {
  const visibleNav = a => [...a.window.document.querySelectorAll('.nav-item')].filter(e => e.style.display !== 'none').map(e => /showPanel\('([a-z]+)'\)/.exec(e.getAttribute('onclick'))[1]);
  it('cajero: solo Mostrador (y no puede navegar a otra sección)', async () => {
    const a = await app(); await a.p.openDemo(); a.on.setRole('cajero');
    expect(visibleNav(a).filter(p => p !== 'nube')).toEqual(['mostrador']);
    a.ev("showPanel('gastos')"); expect(a.ev('currentPanel')).toBe('mostrador');
    expect(a.window.document.body.classList.contains('role-no-costs')).toBe(true);
    expect(a.window.document.getElementById('role-banner').textContent).toMatch(/Cajero/);
    a.window.close();
  }, 60000);
  it('encargado: Mostrador y Stock, sin costos; lectura: Reportes, Gastos y Proyección en solo lectura; admin: todo', async () => {
    const a = await app(); await a.p.openDemo();
    a.on.setRole('encargado'); expect(visibleNav(a).filter(p => p !== 'nube').sort()).toEqual(['mostrador', 'stock']);
    a.on.setRole('lectura'); expect(visibleNav(a).filter(p => p !== 'nube').sort()).toEqual(['gastos', 'proyeccion', 'reportes']);
    expect(a.window.document.body.classList.contains('role-readonly')).toBe(true);
    expect(a.window.document.body.classList.contains('role-no-costs')).toBe(false);
    a.ev("showPanel('productos')"); expect(['reportes', 'gastos', 'proyeccion']).toContain(a.ev('currentPanel'));
    a.on.setRole('admin'); expect(visibleNav(a).length).toBeGreaterThan(12);
    expect(a.window.document.getElementById('role-banner')).toBeNull();
    a.window.close();
  }, 60000);
});

describe('pedidos en tiempo real y conexión', () => {
  it('conectar → sincronizar menú → entra un pedido de la web (con aviso) → su estado vuelve a la nube', async () => {
    const a = await app(); await a.p.openDemo(); const w = a.window;
    const calls = backend(w, {
      '/auth/v1/token': { body: { access_token: 'T', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: 'dueña@x.com' } } },
      '/rest/v1/stores?select': { body: [] }, '/rest/v1/stores': { status: 201, body: [{ id: 'st-1', slug: 'mi-local' }] },
      '/rest/v1/orders': { body: [] }, '/rest/v1/menus': { status: 204 },
    });
    a.ev("MENU_CONFIG.whatsappNumber='5491155550123'");
    await a.on.connect({ url: URL_OK, anonKey: ANON, slug: 'mi-local', email: 'dueña@x.com', password: 'secreta' });
    expect(a.ev('SAHTEN_SUPABASE.storeId')).toBe('st-1'); expect(a.ev('SAHTEN_SUPABASE.url')).toBe(URL_OK);
    expect(a.p.collect().online.supabase).toMatchObject({ url: URL_OK, storeId: 'st-1', slug: 'mi-local' });    // viaja en el archivo .sahten
    expect(JSON.stringify(a.p.collect())).not.toMatch(/secreta/);
    await a.on.controller.syncMenu();
    const up = calls.find(c => c.url.includes('/rest/v1/menus')); expect(up.body.json.products.length).toBeGreaterThan(4);
    // llega un pedido por Realtime
    const ws = FakeWS.last; await ws.onopen();
    ws.onmessage({ data: JSON.stringify({ topic: ws.sent[0].topic, event: 'postgres_changes', payload: { data: { type: 'INSERT', record: { id: 'web-9', status: 'pendiente', created_at: new Date().toISOString(),
      payload: { num: 4321, source: 'delivery', customerName: 'Ana', address: 'Siempreviva 750', zoneName: 'Zona A', paymentMethod: 'efectivo', items: [{ id: 'pizza_napo', name: 'Pizza Muzzarella', qty: 2, unitPrice: 13500, lineTotal: 27000 }], subtotal: 27000, shipping: 1500, total: 28500 } } } } }) });
    const o = a.ev("SAHTEN_ORDERS.find(o=>o.remoteId==='web-9')"); expect(o).toBeTruthy();
    expect(a.ev("SAHTEN_ORDERS.find(o=>o.remoteId==='web-9').customerName")).toBe('Ana');
    expect(a.ev("_loadNotifications()[0].title")).toMatch(/Nuevo pedido online/);
    a.ev("showPanel('mostrador'); mostSetTab('delivery')"); await wait(60);
    expect(w.document.getElementById('most-tab-content').textContent).toMatch(/Ana/);
    // cambia el estado en el Mostrador → PATCH a la nube
    a.ev("orderSetStatus(SAHTEN_ORDERS.find(o=>o.remoteId==='web-9').id,'en_preparacion')"); await wait(20);
    const patch = calls.find(c => c.method === 'PATCH' && c.url.includes('id=eq.web-9')); expect(patch.body).toEqual({ status: 'preparando' });
    w.close();
  }, 60000);
  it('el panel «Nube y usuarios» muestra la conexión y rechaza la service_role', async () => {
    const a = await app(); await a.p.openDemo(); a.ev("showPanel('nube')"); await wait(30);
    const html = a.window.document.getElementById('panel-nube').innerHTML;
    expect(html).toMatch(/Conexión con Supabase/); expect(html).toMatch(/anon key/i); expect(html).toMatch(/service_role/);
    const svc = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.x`;
    a.window.document.getElementById('nb-url').value = URL_OK; a.window.document.getElementById('nb-key').value = svc;
    a.window.document.getElementById('nb-slug').value = 'mi-local'; a.window.document.getElementById('nb-mail').value = 'a@x.com'; a.window.document.getElementById('nb-pass').value = 'x';
    await a.on.ui.connect();
    expect(a.window.document.getElementById('nube-msg').textContent).toMatch(/service_role/);
    expect(a.ev('SAHTEN_SUPABASE.url')).toBe('');
    a.window.close();
  }, 60000);
});

describe('abrir proyectos no rompe ninguna pantalla', () => {
  it('un proyecto nuevo y vacío: se recorren todos los paneles (menú online y reportes con sus valores de fábrica)', async () => {
    const a = await app(); const w = a.window; const errors = []; w.addEventListener('error', e => errors.push(e.message));
    a.p.adapter.queueSaveAs('Nuevo.sahten'); await a.p.session.newProject('Nuevo');
    w.document.getElementById('sw-ov') && w.document.getElementById('sw-ov').remove();
    for (const p of a.ev('PANELS')) { a.ev(`showPanel('${p}')`); await wait(30); }
    a.ev("showPanel('menuonline'); renderMenuOnline();");
    expect(errors).toEqual([]);
    expect(a.ev('MENU_CONFIG.hiddenProducts')).toEqual([]); expect(a.ev('REP.ventasRaw')).toEqual([]);
    w.close();
  }, 60000);
});

describe('build sin online (SAHTEN_ONLINE=false)', () => {
  it('la UI de conexión queda deshabilitada: «No disponible en esta versión»; el formato y el resto siguen igual', async () => {
    const a = await app({ online: false }); await a.p.openDemo();
    expect(a.on.enabled).toBe(false);
    a.ev("showPanel('nube')"); await wait(30);
    expect(a.window.document.getElementById('panel-nube').textContent).toMatch(/No disponible en esta versión/);
    expect(a.window.document.getElementById('nb-url')).toBeNull();
    // publicar el menú (sin backend) y guardar el proyecto siguen funcionando
    expect(a.on.publish.currentMenu().products.length).toBeGreaterThan(4);
    expect(a.p.collect().format).toBe('sahten');
    a.window.close();
  }, 60000);
  it('abre un archivo con datos online y los conserva al guardar', async () => {
    const a = await app({ online: false }); const w = a.window;
    const { emptyFile, serialize } = await import('../src/project/schema.js');
    const f = emptyFile('Con online'); f.project.id = 'po'; f.catalog.tiers = [{ id: 'T1', name: 'A', factor: 2 }];
    f.online.supabase = { url: URL_OK, anonKey: ANON, storeId: 'st-7', slug: 'mi-local', projectId: 'pr-1' }; f.futuro = { x: 1 };
    const disk = {}; Object.assign(a.p.adapter, createMemoryAdapter({ files: disk }));
    a.p.adapter.queueOpen('Online.sahten', serialize(f)); await a.p.session.openFromPicker();
    a.ev("GASTOS_OP.push({id:'g1',name:'Alquiler',amount:5})"); await a.p.session.saveNow();
    const saved = JSON.parse(disk['Online.sahten']);
    expect(saved.online.supabase).toMatchObject({ url: URL_OK, storeId: 'st-7', projectId: 'pr-1' });
    expect(saved.futuro).toEqual({ x: 1 }); expect(saved.costs.gastosOp[0].name).toBe('Alquiler');
    w.close();
  }, 60000);
});

describe('Menú Online (admin): una sola pantalla con estado, lista por categoría y vista previa', () => {
  const open = async () => { const a = await app(); await a.p.openDemo(); a.window.sahtenTour && a.window.sahtenTour.close(); a.ev("showPanel('menuonline'); renderMenuOnline();"); return a; };
  const $$ = (a, sel) => Array.from(a.window.document.querySelectorAll(sel));
  it('la columna Precio es la del menú publicado y «visibles» cuenta lo que realmente sale', async () => {
    const a = await open();
    const rows = $$(a, '.mo-prod .mo-price').map(e => e.textContent.replace(/\D/g, ''));
    expect(rows.slice().sort()).toEqual(a.on.publish.currentMenu().products.map(p => String(p.price)).sort());
    expect(rows.every(c => +c > 0)).toBe(true);
    const cat = a.ev('PRODUCTS[0].category'); const n = a.ev(`PRODUCTS.filter(p=>!p.recetaOnly && p.category==='${cat}').length`);
    a.ev(`_moCatToggle('${cat}', false)`);
    expect(a.on.publish.currentMenu().products.length).toBe(a.ev('PRODUCTS.filter(p=>!p.recetaOnly).length') - n);
    expect($$(a, '.mo-st-sub')[0].textContent).toContain(a.on.publish.currentMenu().products.length + ' producto');
    a.window.close();
  }, 60000);
  it('estado de publicación: sin publicar → publicado al día → cambios sin publicar; avisos por producto', async () => {
    const a = await open(); const st = () => a.window.document.querySelector('.mo-status').dataset.s;
    expect(st()).toBe('dirty'); expect($$(a, '.mo-st-title')[0].textContent).toMatch(/Todavía no publicaste/);
    expect($$(a, '.mo-warn').some(e => /Sin foto/.test(e.textContent))).toBe(true);           // el demo no trae fotos
    a.on.publish.publish = async () => ({ files: 3, mode: 'zip' });                           // sin abrir selectores de carpeta
    await a.window._moPublish(); expect(st()).toBe('ok'); expect($$(a, '.mo-st-title')[0].textContent).toMatch(/al día/);
    a.ev("_moToggleProduct(PRODUCTS[0].id, false)"); expect(st()).toBe('dirty'); expect($$(a, '.mo-st-title')[0].textContent).toMatch(/cambios sin publicar/);
    a.ev("MENU_CONFIG.whatsappNumber=''; _moRefresh()"); expect(st()).toBe('problem'); expect($$(a, '.mo-problem')[0].textContent).toMatch(/WhatsApp/);
    a.window.close();
  }, 60000);
  it('filtros, búsqueda, orden de categorías y vista previa en vivo', async () => {
    const a = await open(); const doc = a.window.document;
    const total = $$(a, '.mo-prod').length; expect(total).toBe(a.ev('PRODUCTS.filter(p=>!p.recetaOnly).length'));
    a.ev("_moUi.q='napo'; _moRenderList()"); expect($$(a, '.mo-prod').length).toBe(1); a.ev("_moUi.q=''; _moRenderList()");
    a.ev("_moToggleProduct(PRODUCTS[1].id, false)"); a.ev("_moUi.filter='hidden'; _moRefresh()"); expect($$(a, '.mo-prod').length).toBe(1);
    a.ev("_moUi.filter='all'; _moRefresh()");
    const cats = () => $$(a, '.mo-cat-name').map(e => e.textContent);
    const before = cats(); a.ev(`_moCatMove('${before[0]}', 1)`); expect(cats()[1]).toBe(before[0]);
    // la vista previa es el menú publicado: mismo orden de categorías, sin el producto oculto
    const prev = $$(a, '.mo-ph-cat').map(e => e.textContent); expect(prev).toEqual(a.on.publish.currentMenu().config.categories);
    expect(doc.getElementById('mo-side').textContent).not.toContain(a.ev('PRODUCTS[1].name'));
    // ajustes: el título se refleja en la vista previa sin perder el foco
    const input = doc.querySelector('[data-mo-set=title]'); input.value = 'Mi pizzería'; input.dispatchEvent(new a.window.Event('input', { bubbles: true }));
    expect(doc.querySelector('.mo-ph-head b').textContent).toBe('Mi pizzería'); expect(doc.querySelector('[data-mo-set=title]')).toBe(input);
    a.window.close();
  }, 60000);
});
