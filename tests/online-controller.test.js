import { describe, it, expect } from 'vitest';
import { createController } from '../src/online/controller.js';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const ANON = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.x`;
const URL_OK = 'https://abcd1234.supabase.co';

class FakeWS { static last; constructor() { FakeWS.last = this; this.sent = []; } send(s) { this.sent.push(JSON.parse(s)); } close() {} }

function setup({ routes = {}, conn = {}, storage = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
    const k = Object.keys(routes).find(x => url.includes(x));
    let r = k ? routes[k] : { status: 404, body: { message: 'no route ' + url } };
    if (typeof r === 'function') r = r(calls.at(-1));
    if (r instanceof Error) throw r;
    return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.body };
  };
  const orders = [], notes = []; let dirty = 0, refreshed = 0; const store = { ...storage };
  const host = {
    conn: { url: '', anonKey: '', storeId: '', ...conn }, projectId: () => 'p1', markDirty: () => { dirty++; }, menuJson: () => ({ store: { name: 'Mi Local' }, products: [{ id: 'a' }, { id: 'b' }], supabase: { x: 1 } }),
    orders: { list: () => orders, add: o => orders.unshift(o) }, notify: n => notes.push(n), refresh: () => { refreshed++; },
    storage: { get: (k, d) => k in store ? store[k] : d, set: (k, v) => { store[k] = v; } }, fetchImpl, WebSocketImpl: FakeWS,
  };
  return { host, calls, orders, notes, store, get dirty() { return dirty; }, get refreshed() { return refreshed; }, ctl: createController(host) };
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
    const up = s.calls.find(c => c.url.includes('/rest/v1/menus'));
    expect(up.body.store_id).toBe('st-1'); expect(up.body.json.supabase).toBeUndefined(); expect(up.body.json.products).toHaveLength(2);
    expect(s.ctl.info().lastSync).toBeTruthy();
  });
  it('al abrir el proyecto importa los pedidos pendientes y notifica; no duplica', async () => {
    const rows = [{ id: 'r1', status: 'pendiente', created_at: '2026-10-05T10:00:00Z', payload: { source: 'delivery', customerName: 'Ana', items: [], total: 28500 } },
      { id: 'r2', status: 'entregado', created_at: '2026-10-04T10:00:00Z', payload: { customerName: 'Viejo', total: 1 } }];
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: rows } } });
    await s.ctl.resume();
    expect(s.orders.map(o => o.remoteId)).toEqual(['r1']);                       // el entregado no se trae
    expect(s.notes[0].title).toBe('Nuevo pedido online #0001'); expect(s.notes[0].body).toContain('Ana');
    await s.ctl.resume();
    expect(s.orders).toHaveLength(1);
  });
  it('pedido en vivo por Realtime: entra al Mostrador, avisa y redibuja', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] } } });
    await s.ctl.resume(); const ws = FakeWS.last; await ws.onopen();
    ws.onmessage({ data: JSON.stringify({ topic: ws.sent[0].topic, event: 'postgres_changes', payload: { data: { type: 'INSERT', record: { id: 'live-1', status: 'pendiente', created_at: new Date().toISOString(), payload: { source: 'pickup', customerName: 'Luis', total: 9000, items: [] } } } } }) });
    expect(s.orders[0]).toMatchObject({ remoteId: 'live-1', source: 'pickup', customerName: 'Luis' });
    expect(s.notes.at(-1).title).toMatch(/Nuevo pedido online/); expect(s.refreshed).toBeGreaterThan(0);
  });
  it('estado del pedido local → web (solo pedidos importados)', async () => {
    const s = setup({ conn, storage: { 'online-session:p1': session }, routes: { '/rest/v1/orders': { body: [] } } });
    await s.ctl.resume();
    expect(await s.ctl.pushStatus({ remoteId: 'r1', status: 'en_preparacion' })).toBe(true);
    const c = s.calls.find(x => x.method === 'PATCH'); expect(c.url).toContain('id=eq.r1'); expect(c.body).toEqual({ status: 'preparando' });
    expect(await s.ctl.pushStatus({ status: 'listo' })).toBe(false);
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
