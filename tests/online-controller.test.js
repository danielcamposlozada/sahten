import { describe, it, expect, vi } from 'vitest';
import { createController } from '../src/online/controller.js';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const ANON = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.x`;
const URL_OK = 'https://abcd1234.supabase.co';

class FakeWS { static last; constructor() { FakeWS.last = this; this.sent = []; } send(s) { this.sent.push(JSON.parse(s)); } close() {} }

function setup({ routes = {}, conn = {}, storage = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body ? (typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body) : undefined });
    const k = Object.keys(routes).find(x => url.includes(x));
    let r = k ? routes[k] : { status: 404, body: { message: 'no route ' + url } };
    if (typeof r === 'function') r = await r(calls.at(-1));
    if (r instanceof Error) throw r;
    return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.body };
  };
  const orders = [], notes = [], imports = []; let dirty = 0, refreshed = 0; const store = { ...storage };
  const host = {
    conn: { url: '', anonKey: '', storeId: '', ...conn }, projectId: () => 'p1', markDirty: () => { dirty++; }, menuJson: () => ({ store: { name: 'Mi Local' }, products: [{ id: 'a' }, { id: 'b' }], supabase: { x: 1 } }),
    orders: { list: () => orders, add: (o, options) => { orders.unshift(o); imports.push(options); } }, notify: n => notes.push(n), refresh: () => { refreshed++; },
    storage: { get: (k, d) => k in store ? store[k] : d, set: (k, v) => { store[k] = v; } }, fetchImpl, WebSocketImpl: FakeWS,
  };
  return { host, calls, orders, notes, imports, store, get dirty() { return dirty; }, get refreshed() { return refreshed; }, ctl: createController(host) };
}
const LOGIN = { '/auth/v1/token?grant_type=password': { body: { access_token: 'T', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: 'a@x.com' } } } };

describe('conectar el proyecto', () => {
  it('inicia sesión, crea la tienda por slug, guarda la conexión en el proyecto y escucha pedidos', async () => {
    const s = setup({ routes: { ...LOGIN, '/rest/v1/stores?select': { body: [] }, '/rest/v1/stores': { status: 201, body: [{ id: 'st-1', slug: 'mi-local' }] }, '/rest/v1/orders': { body: [] } } });
    const r = await s.ctl.connect({ url: URL_OK, anonKey: ANON, slug: 'mi-local', email: 'a@x.com', password: 'secreta' });
    expect(r.store.id).toBe('st-1');
    expect(s.host.conn).toMatchObject({ url: URL_OK, anonKey: ANON, storeId: 'st-1', slug: 'mi-local' });
    expect(s.dirty).toBe(1);
    expect(s.ctl.info()).toMatchObject({ mode: 'conectado', signedIn: true, email: 'a@x.com', storeId: 'st-1' });
    expect(FakeWS.last).toBeTruthy();
    expect(JSON.stringify(s.host.conn)).not.toMatch(/secreta/);          // la contraseña no se guarda
    expect(JSON.stringify(s.store)).not.toMatch(/secreta/);
    expect(JSON.stringify(s.store)).toMatch(/access_token/);             // la sesión sí, en la config de la APP
  });
  it('reutiliza la tienda si el slug ya existe', async () => {
    const s = setup({ routes: { ...LOGIN, '/rest/v1/stores?select': { body: [{ id: 'st-9', slug: 'mi-local' }] }, '/rest/v1/orders': { body: [] } } });
    await s.ctl.connect({ url: URL_OK, anonKey: ANON, slug: 'mi-local', email: 'a@x.com', password: 'x' });
    expect(s.host.conn.storeId).toBe('st-9');
    expect(s.calls.some(c => c.method === 'POST' && c.url.includes('/rest/v1/stores'))).toBe(false);
  });
  it('rechaza la service_role, un slug inválido y no deja nada guardado', async () => {
    const s = setup();
    const svc = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.x`;
    await expect(s.ctl.connect({ url: URL_OK, anonKey: svc, slug: 'mi-local', email: 'a', password: 'b' })).rejects.toThrow(/service_role/);
    await expect(s.ctl.connect({ url: URL_OK, anonKey: ANON, slug: 'No Valido!', email: 'a', password: 'b' })).rejects.toThrow(/3 y 40/);
    expect(s.host.conn.storeId).toBe(''); expect(s.calls).toHaveLength(0); expect(s.dirty).toBe(0);
  });
  it('contraseña incorrecta: queda desconectado con el motivo', async () => {
    const s = setup({ routes: { '/auth/v1/token': { status: 400, body: { error_code: 'invalid_credentials' } } } });
    await expect(s.ctl.connect({ url: URL_OK, anonKey: ANON, slug: 'mi-local', email: 'a@x.com', password: 'mal' })).rejects.toThrow('Email o contraseña incorrectos.');
    expect(s.ctl.info()).toMatchObject({ mode: 'desconectado', error: 'Email o contraseña incorrectos.', signedIn: false });
  });
  it('crear cuenta nueva pide confirmar el email', async () => {
    const s = setup({ routes: { '/auth/v1/signup': { body: { id: 'u2', email: 'n@x.com' } } } });
    expect(await s.ctl.connect({ url: URL_OK, anonKey: ANON, slug: 'mi-local', email: 'n@x.com', password: '123456', signUp: true })).toEqual({ pendingConfirmation: true });
  });
});

describe('menú y pedidos', () => {
  const conn = { url: URL_OK, anonKey: ANON, storeId: 'st-1', slug: 'mi-local' };
  const session = { access_token: 'T', refresh_token: 'R', expires_at: 9e9, user: { id: 'u1', email: 'a@x.com' } };
  it('sincronizar menú sube el menú sin el bloque de conexión', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] }, '/rest/v1/menus': { status: 204 } } });
    expect(await s.ctl.resume()).toBe(true);
    expect(await s.ctl.syncMenu()).toBe(2);
    const up = s.calls.find(c => c.url.includes('/rest/v1/menus') && c.body);
    expect(up.body.store_id).toBe('st-1'); expect(up.body.json.supabase).toBeUndefined(); expect(up.body.json.products).toHaveLength(2);
    expect(s.ctl.info().lastSync).toBeTruthy();
  });
  it('no publica un menú vacío ni uno que achica mucho el publicado sin confirmar', async () => {
    const big = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] },
      '/rest/v1/menus': c => (c.method === 'GET' ? { body: [{ json: { products: new Array(10).fill({}) } }] } : { status: 204 }) } });
    expect(await big.ctl.resume()).toBe(true);
    await expect(big.ctl.syncMenu()).rejects.toMatchObject({ code: 'menu_shrinks', remote: 10, local: 2 });
    expect(big.calls.some(c => c.url.includes('/rest/v1/menus') && c.body)).toBe(false);
    expect(await big.ctl.syncMenu({ force: true })).toBe(2);
    expect(big.calls.some(c => c.url.includes('/rest/v1/menus') && c.body)).toBe(true);
  });
  it('un menú sin productos nunca se publica, ni forzado', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] }, '/rest/v1/menus': { status: 204 } } });
    expect(await s.ctl.resume()).toBe(true);
    s.host.menuJson = () => ({ store: { name: 'Mi Local' }, products: [] });
    await expect(s.ctl.syncMenu({ force: true })).rejects.toMatchObject({ code: 'empty_menu' });
    expect(s.calls.some(c => c.url.includes('/rest/v1/menus'))).toBe(false);
  });
  it('al abrir el proyecto importa los pedidos pendientes y notifica; no duplica', async () => {
    const rows = [{ id: 'r1', status: 'pendiente', created_at: '2026-10-05T10:00:00Z', payload: { source: 'delivery', customerName: 'Ana', items: [], total: 28500 } },
      { id: 'r2', status: 'entregado', created_at: '2026-10-04T10:00:00Z', payload: { customerName: 'Viejo', total: 1 } }];
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: rows } } });
    await s.ctl.resume();
    expect(s.orders.map(o => o.remoteId)).toEqual(['r1']);                       // el entregado no se trae
    expect(s.notes[0].sound).toBe(false);
    expect(s.imports).toEqual([{initial:true}]);                               // no imprimir el historial al reconectar
    expect(s.notes[0].title).toBe('Nuevo pedido online #0001'); expect(s.notes[0].body).toContain('Ana');
    await s.ctl.resume();
    expect(s.orders).toHaveLength(1);
  });
  it('pedido en vivo por Realtime: entra al Mostrador, avisa y redibuja', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] } } });
    await s.ctl.resume(); const ws = FakeWS.last; await ws.onopen();
    ws.onmessage({ data: JSON.stringify({ topic: ws.sent[0].topic, event: 'postgres_changes', payload: { data: { type: 'INSERT', record: { id: 'live-1', status: 'pendiente', created_at: new Date().toISOString(), payload: { source: 'pickup', customerName: 'Luis', total: 9000, items: [] } } } } }) });
    expect(s.orders[0]).toMatchObject({ remoteId: 'live-1', source: 'pickup', customerName: 'Luis' });
    expect(s.notes.at(-1).sound).toBe(true);
    expect(s.imports).toEqual([{initial:false}]);                              // sí habilita la cola para pedidos nuevos
    expect(s.notes.at(-1).title).toMatch(/Nuevo pedido online/); expect(s.refreshed).toBeGreaterThan(0);
  });
  it('estado del pedido local → web (solo pedidos importados)', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] } } });
    await s.ctl.resume();
    expect(await s.ctl.pushStatus({ remoteId: 'r1', status: 'en_preparacion' })).toBe(true);
    const c = s.calls.find(x => x.method === 'PATCH'); expect(c.url).toContain('id=eq.r1'); expect(c.body).toEqual({ status: 'preparando' });
    expect(await s.ctl.pushStatus({ status: 'listo' })).toBe(false);
  });
  it('una cancelación sin conexión queda pendiente y se reintenta al reconectar sin resucitar el pedido', async () => {
    let fail = true;
    const row = { id: 'cancel-test', status: 'preparando', payload: { source: 'delivery', total: 9000 } };
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': c => c.method === 'PATCH' ? fail ? { status: 503, body: { message: 'sin conexión' } } : { status: 204 } : { body: [row] } } });
    await s.ctl.resume(); const o = s.orders[0]; o.status = 'cancelado';
    expect(await s.ctl.pushStatus(o)).toBe(false); expect(o.remoteStatusPending).toBe('cancelado');
    await s.ctl.resume(); expect(o.status).toBe('cancelado'); expect(o.remoteStatusPending).toBe('cancelado');
    fail = false; row.status = 'cancelado'; await s.ctl.resume(); expect(o.status).toBe('cancelado'); expect(o.remoteStatus).toBe('cancelado'); expect(o.remoteStatusPending).toBeUndefined();
    expect(s.orders).toHaveLength(1); expect(s.notes.filter(n => n.sound)).toHaveLength(0);
  });
  it('cancelar sin una sesión activa conserva la intención para la próxima conexión', async () => {
    const s = setup({ conn }); const o = { remoteId: 'offline', status: 'cancelado' };
    expect(await s.ctl.pushStatus(o)).toBe(false); expect(o.remoteStatusPending).toBe('cancelado'); expect(s.calls).toHaveLength(0);
  });
  it('una respuesta lenta de preparación no pisa una cancelación posterior', async () => {
    let release; const writes = [];
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': async c => {
      if (c.method !== 'PATCH') return { body: [] };
      writes.push(c.body.status); if (writes.length === 1) await new Promise(r => release = r); return { status: 204 };
    } } });
    await s.ctl.resume(); const o = { remoteId: 'sequential-test', status: 'en_preparacion' };
    const first = s.ctl.pushStatus(o); await vi.waitFor(() => expect(writes).toEqual(['preparando']));
    o.status = 'cancelado'; const second = s.ctl.pushStatus(o); expect(writes).toEqual(['preparando']); release();
    await Promise.all([first, second]); expect(writes).toEqual(['preparando', 'cancelado']); expect(o.remoteStatus).toBe('cancelado'); expect(o.remoteStatusPending).toBeUndefined();
  });
  it('actualiza un reembolso de un pedido ya entregado sin duplicarlo ni importar pedidos históricos ajenos', async () => {
    const row={id:'old-paid',status:'entregado',payment_provider:'mercadopago',payment_ref:'ref1',payment_status:'refunded',payload:{customerName:'Ana',total:1000}};
    const s=setup({conn,storage:{'online-session:p1':session},routes:{'/rest/v1/orders':{body:[row,{...row,id:'another-old'}]}}});
    s.orders.push({remoteId:'old-paid',status:'listo',paymentProvider:'mercadopago',paymentStatus:'paid',paymentReference:'ref1'});
    let saves=0;s.host.orders.save=()=>saves++;
    await s.ctl.resume();expect(s.orders).toHaveLength(1);expect(s.orders[0]).toMatchObject({status:'listo',paymentStatus:'refunded'});expect(saves).toBe(1);expect(s.notes).toHaveLength(0);
  });
  it('sin sesión guardada o vencida: lo informa y no escucha', async () => {
    const s = setup({ conn });
    expect(await s.ctl.resume()).toBe(false); expect(s.ctl.info().mode).toBe('sin sesión');
    const v = setup({ conn, storage: { 'online-session:p1': { ...session, expires_at: 1 } }, routes: { '/auth/v1/token?grant_type=refresh_token': { status: 400, body: { error_code: 'x' } } } });
    expect(await v.ctl.resume()).toBe(false); expect(v.ctl.info().error).toMatch(/iniciar sesión/);
  });
  it('desconectar borra la conexión del proyecto y cierra la sesión', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] } } });
    await s.ctl.resume(); s.ctl.disconnect();
    expect(s.host.conn).toEqual({ url: '', anonKey: '', storeId: '' }); expect(s.ctl.info()).toMatchObject({ mode: 'desconectado', signedIn: false });
  });
});


describe('subida de fotos antes de publicar el menú', () => {
  const conn = { url: URL_OK, anonKey: ANON, storeId: 'st-1', slug: 'mi-local' };
  const session = { access_token: 'T', refresh_token: 'R', expires_at: 9e9, user: { id: 'u1' } };
  function photos(routes = {}) {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] }, '/rest/v1/menus': { status: 204 }, ...routes } });
    s.host.images = () => ({ a: 'data:image/png;base64,AQID' });
    s.host.menuJson = () => ({ store: {}, products: [{ id: 'a', image: 'img/a.jpg' }], config: {} });
    return s;
  }
  it('si falla la subida no reemplaza el menú publicado', async () => {
    const s = photos({ '/storage/': { status: 403, body: { message: 'forbidden' } } }); await s.ctl.resume();
    await expect(s.ctl.syncMenu()).rejects.toThrow(/No se pudo subir/);
    expect(s.calls.some(c => c.url.includes('/rest/v1/menus') && c.method === 'POST')).toBe(false);
    expect(s.host.images().a).toContain('data:image');
  });
  it('cambiar de proyecto durante la subida impide publicar en la tienda nueva', async () => {
    let finish, started; const uploading = new Promise(r => { started = r; });
    const s = photos({ '/storage/': () => { started(); return new Promise(r => { finish = r; }); } }); await s.ctl.resume();
    const result = s.ctl.syncMenu(); await uploading;
    s.host.conn.storeId = 'st-other'; finish({ body: {} });
    await expect(result).rejects.toMatchObject({ code: 'project_changed' });
    expect(s.calls.some(c => c.url.includes('/rest/v1/menus') && c.method === 'POST')).toBe(false);
  });
});

it('interruptores y pausas usan RPC solo de estados; nunca suben precios ni reemplazan el menú',async()=>{
 const s=setup({conn:{url:URL_OK,anonKey:ANON,storeId:'st-1'},storage:{'online-session:p1':{access_token:'T',refresh_token:'R',expires_at:9e9,user:{id:'u1'}}},routes:{'/rest/v1/orders':{body:[]},'/rest/v1/rpc/set_menu_product_visibility':{body:{id:'a',visible:false}},'/rest/v1/rpc/set_product_sales_availability':{body:{id:'a',salesAvailability:{paused:true}}}}});
 await s.ctl.resume();s.host.menuJson=()=>({products:[{id:'a',price:9999999}],store:{name:'Borrador'}});
 await s.ctl.setAvailability('a',false);await s.ctl.setSalesAvailability('a',false,'2099-01-01T00:00:00Z');
 expect(s.calls.filter(c=>c.method==='POST').map(c=>c.body)).toEqual([{p_store_id:'st-1',p_product_id:'a',p_visible:false},{p_store_id:'st-1',p_product_id:'a',p_paused:true,p_resume_at:'2099-01-01T00:00:00Z'}]);expect(s.calls.some(c=>c.url.includes('/menus')&&c.body)).toBe(false);
});

it('la pausa general publica solo el booleano del negocio, sin precios ni fotos del borrador',async()=>{
 const s=setup({conn:{url:URL_OK,anonKey:ANON,storeId:'st-1'},storage:{'online-session:p1':{access_token:'T',refresh_token:'R',expires_at:9e9,user:{id:'u1'}}},routes:{'/rest/v1/orders':{body:[]},'/rest/v1/rpc/set_delivery_service_state':{body:{enabled:false}}}});
 await s.ctl.resume();s.host.menuJson=()=>{throw Error('No debe publicar el catálogo');};await s.ctl.setDeliveryAvailability(false);
 expect(s.calls.filter(c=>c.method==='POST').map(c=>c.body)).toEqual([{p_store_id:'st-1',p_enabled:false}]);
});
