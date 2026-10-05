import { describe, it, expect, vi } from 'vitest';
import { createClient, validateConnection, slugify, validSlug, SupabaseError } from '../src/online/supabase.js';
import { toLocalOrder, STATUS_TO_REMOTE } from '../src/online/orders.js';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = role => `${b64({ alg: 'HS256' })}.${b64({ role, iss: 'supabase' })}.firma`;
const URL_OK = 'https://abcd1234.supabase.co';
const ANON = jwt('anon');

/** fetch de mentira: rutas → respuesta. Guarda las llamadas. */
function fakeFetch(routes = {}) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : undefined });
    const key = Object.keys(routes).find(k => url.includes(k));
    let r = key ? routes[key] : { status: 404, body: { message: 'no route' } };
    if (typeof r === 'function') r = r(calls.at(-1));
    if (r instanceof Error) throw r;
    const status = r.status || 200;
    return { ok: status < 400, status, json: async () => r.body };
  };
  f.calls = calls; return f;
}

describe('conexión: solo anon key', () => {
  it('acepta la URL del proyecto y la anon key (JWT o publishable)', () => {
    expect(validateConnection({ url: URL_OK + '/', anonKey: ANON })).toMatchObject({ ok: true, url: URL_OK });
    expect(validateConnection({ url: URL_OK, anonKey: 'sb_publishable_abc123' }).ok).toBe(true);
    expect(validateConnection({ url: 'http://localhost:54321', anonKey: ANON }).ok).toBe(true);
  });
  it('rechaza la clave service_role y las secretas: nunca se embeben', () => {
    const r = validateConnection({ url: URL_OK, anonKey: jwt('service_role') });
    expect(r.ok).toBe(false); expect(r.problem).toMatch(/service_role/);
    expect(validateConnection({ url: URL_OK, anonKey: 'sb_secret_xyz' }).problem).toMatch(/SECRETA/);
    expect(() => createClient({ url: URL_OK, anonKey: jwt('service_role') })).toThrow(SupabaseError);
  });
  it('mensajes claros para URL o clave inválidas', () => {
    expect(validateConnection({ url: 'https://example.com', anonKey: ANON }).problem).toMatch(/URL/);
    expect(validateConnection({ url: URL_OK, anonKey: '' }).problem).toMatch(/Falta la anon key/);
    expect(validateConnection({ url: URL_OK, anonKey: 'basura' }).problem).toMatch(/formato/);
  });
  it('slugs de tienda', () => {
    expect(slugify('La Esquina Árabe!')).toBe('la-esquina-arabe');
    expect(validSlug('la-esquina')).toBe(true); expect(validSlug('ab')).toBe(false); expect(validSlug('Mal Slug')).toBe(false);
  });
});

describe('auth y REST', () => {
  it('iniciar sesión guarda el token y se usa en las llamadas siguientes; sin sesión va con la anon key', async () => {
    const f = fakeFetch({
      '/auth/v1/token?grant_type=password': { body: { access_token: 'T1', refresh_token: 'R1', expires_in: 3600, user: { id: 'u1', email: 'a@x.com' } } },
      '/rest/v1/stores?select': { body: [{ id: 's1', slug: 'mi-local', name: 'Mi local' }] },
      '/rest/v1/orders': { body: [] },
    });
    const sessions = []; const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, onSession: s => sessions.push(s) });
    expect((await c.store.bySlug('mi-local')).id).toBe('s1');
    expect(f.calls[0].headers.Authorization).toBe('Bearer ' + ANON);               // visitante: anon
    expect(f.calls[0].headers.apikey).toBe(ANON);
    await c.auth.signIn('a@x.com', 'secreto');
    expect(f.calls[1].body).toEqual({ email: 'a@x.com', password: 'secreto' });
    expect(c.auth.user.email).toBe('a@x.com'); expect(sessions.at(-1).access_token).toBe('T1');
    await c.orders.list('s1');
    expect(f.calls.at(-1).headers.Authorization).toBe('Bearer T1');
    expect(f.calls.at(-1).url).toContain('store_id=eq.s1');
  });
  it('errores en español: credenciales, sin conexión, nombre de tienda repetido', async () => {
    const f = fakeFetch({ '/auth/v1/token': { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }, '/rest/v1/stores': { status: 409, body: { code: '23505', message: 'duplicate key' } } });
    const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f });
    await expect(c.auth.signIn('a@x.com', 'mal')).rejects.toThrow('Email o contraseña incorrectos.');
    const off = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: fakeFetch({ '/rest': new Error('Failed to fetch') }) });
    const e = await off.store.bySlug('x').catch(x => x);
    expect(e).toBeInstanceOf(SupabaseError); expect(e.offline).toBe(true); expect(e.message).toMatch(/Sin conexión/);
    // crear tienda requiere sesión
    await expect(c.store.create({ slug: 'mi-local', name: 'x' })).rejects.toThrow(/Iniciá sesión/);
  });
  it('renueva el token cuando está por vencer', async () => {
    let t = 1000000;
    const f = fakeFetch({ '/auth/v1/token?grant_type=refresh_token': { body: { access_token: 'T2', refresh_token: 'R2', expires_in: 3600 } }, '/rest/v1/orders': { body: [] } });
    const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, now: () => t * 1000, session: { access_token: 'T1', refresh_token: 'R1', expires_at: t + 30, user: { id: 'u' } } });
    await c.orders.list('s1');
    expect(f.calls[0].url).toContain('grant_type=refresh_token');
    expect(f.calls.at(-1).headers.Authorization).toBe('Bearer T2');
  });
  it('crear tienda y publicar menú (upsert) con el usuario logueado', async () => {
    const f = fakeFetch({ '/rest/v1/stores': { status: 201, body: [{ id: 's9', slug: 'nueva' }] }, '/rest/v1/menus': { status: 204 } });
    const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, session: { access_token: 'T', refresh_token: 'R', expires_at: 9e9, user: { id: 'u1' } } });
    expect((await c.store.create({ slug: 'nueva', name: 'Nueva', projectId: 'p1' })).id).toBe('s9');
    expect(f.calls[0].body).toEqual({ slug: 'nueva', name: 'Nueva', owner: 'u1', project_id: 'p1' });
    await c.store.publishMenu('s9', { products: [] });
    const up = f.calls[1]; expect(up.headers.Prefer).toContain('merge-duplicates'); expect(up.url).toContain('on_conflict=store_id'); expect(up.body.store_id).toBe('s9');
  });
  it('funciones del proyecto por rpc con el token del usuario', async () => {
    const f = fakeFetch({ '/rest/v1/rpc/get_project_data': { body: { data: {}, version: 3 } } });
    const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, session: { access_token: 'T', refresh_token: 'R', expires_at: 9e9, user: { id: 'u1' } } });
    expect((await c.rpc('get_project_data', { pid: 'p1' })).version).toBe(3);
    expect(f.calls[0].body).toEqual({ pid: 'p1' });
  });
});

class FakeWS {
  static last = null;
  constructor(url) { this.url = url; this.sent = []; FakeWS.last = this; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.closed = true; }
  async open() { await this.onopen(); }
  msg(o) { this.onmessage({ data: JSON.stringify(o) }); }
}

describe('pedidos en tiempo real', () => {
  const mk = (extra = {}) => {
    const f = fakeFetch({ '/rest/v1/orders': { body: [] } });
    const timers = []; const setTimer = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clearTimer = id => { if (timers[id - 1]) timers[id - 1].fn = null; };
    const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, WebSocketImpl: FakeWS, session: { access_token: 'TOK', refresh_token: 'R', expires_at: 9e9, user: { id: 'u' } }, ...extra });
    const got = [], states = [];
    const sub = c.subscribeOrders('store-1', { onInsert: r => got.push(r), onStatus: s => states.push(s), setTimer, clearTimer });
    return { c, f, sub, got, states, timers };
  };
  it('se une al canal de la tienda con el token del usuario y escucha INSERT de orders', async () => {
    const { got, states, timers } = mk();
    const ws = FakeWS.last; expect(ws.url).toMatch(/^wss:\/\/abcd1234\.supabase\.co\/realtime\/v1\/websocket\?apikey=/);
    await ws.open();
    const join = ws.sent[0];
    expect(join.event).toBe('phx_join'); expect(join.payload.access_token).toBe('TOK');
    expect(join.payload.config.postgres_changes[0]).toEqual({ event: 'INSERT', schema: 'public', table: 'orders', filter: 'store_id=eq.store-1' });
    ws.msg({ topic: join.topic, event: 'phx_reply', payload: { status: 'ok' } });
    expect(states).toContain('en vivo');
    ws.msg({ topic: join.topic, event: 'postgres_changes', payload: { data: { type: 'INSERT', record: { id: 'o1', payload: { customerName: 'Ana' }, created_at: '2026-10-05T10:00:00Z' } } } });
    ws.msg({ topic: join.topic, event: 'postgres_changes', payload: { data: { type: 'INSERT', record: { id: 'o1', payload: {} } } } });   // repetido
    expect(got).toHaveLength(1); expect(got[0].payload.customerName).toBe('Ana');
    timers[0].fn();                                            // latido
    expect(ws.sent.at(-1)).toMatchObject({ topic: 'phoenix', event: 'heartbeat' });
  });
  it('si el canal falla o se cae, sigue por consulta periódica sin perder pedidos', async () => {
    const { f, got, states, timers, sub } = mk();
    const ws = FakeWS.last; await ws.open();
    ws.msg({ topic: ws.sent[0].topic, event: 'phx_reply', payload: { status: 'error' } });
    expect(states).toContain('consulta periódica');
    f.calls.length = 0;
    const poll = timers.find(t => t.ms === 15000);
    await poll.fn();
    expect(f.calls[0].url).toContain('/rest/v1/orders?select=id,payload,status,created_at&store_id=eq.store-1&created_at=gt.');
    sub.close(); expect(ws.closed).toBe(true);
  });
  it('sin WebSocket disponible usa consulta periódica desde el comienzo y entrega lo nuevo', async () => {
    const rows = [{ id: 'n1', payload: {}, created_at: '2999-01-01T00:00:00Z' }];
    const f = fakeFetch({ '/rest/v1/orders': { body: rows } });
    const timers = []; const c = createClient({ url: URL_OK, anonKey: ANON, fetchImpl: f, WebSocketImpl: null, session: { access_token: 'T', refresh_token: 'R', expires_at: 9e9, user: { id: 'u' } } });
    const got = []; const g = globalThis.WebSocket; delete globalThis.WebSocket;
    const sub = c.subscribeOrders('s', { onInsert: r => got.push(r), setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {} });
    if (g) globalThis.WebSocket = g;
    await timers[0].fn(); await timers[0].fn();
    expect(got.map(r => r.id)).toEqual(['n1']);                // no repite
    expect(sub.mode).toBe('consulta periódica');
  });
});

describe('pedido de la web → pedido del Mostrador', () => {
  const row = { id: 'abc-1', status: 'pendiente', created_at: '2026-10-05T12:00:00Z', payload: { num: 4321, source: 'delivery', customerName: 'Ana', customerPhone: '1155', address: 'Siempreviva 750', zoneName: 'Zona A', lat: -34.5, lng: -58.4, paymentMethod: 'transferencia',
    items: [{ id: 'pizza_napo', name: 'Pizza Muzzarella', qty: 2, unitPrice: 13500, lineTotal: 27000 }], subtotal: 27000, shipping: 1500, total: 28500, notes: 'sin ajo' } };
  it('conserva el detalle, el envío y la zona; numera a continuación de los locales', () => {
    const o = toLocalOrder(row, [{ num: 5 }, { num: 9 }]);
    expect(o).toMatchObject({ id: 'web_abc-1', remoteId: 'abc-1', num: 10, webNum: 4321, source: 'delivery', status: 'pendiente', customerName: 'Ana', shipping: 1500, _zoneName: 'Zona A', total: 28500, notes: 'sin ajo', origin: 'menu-online' });
    expect(o.items[0]).toMatchObject({ productId: 'pizza_napo', qty: 2, lineTotal: 27000 });
  });
  it('no duplica un pedido ya importado y tolera payloads raros', () => {
    expect(toLocalOrder(row, [{ remoteId: 'abc-1', num: 1 }])).toBeNull();
    expect(toLocalOrder({ id: 'x', payload: null })).toBeNull();
    const o = toLocalOrder({ id: 'y', payload: { items: [{ name: 'A', qty: '2', unitPrice: '100' }] } }, []);
    expect(o.items[0].lineTotal).toBe(200); expect(o.customerName).toBe('Cliente online'); expect(o.num).toBe(1);
  });
  it('retiro y estados', () => {
    expect(toLocalOrder({ ...row, status: 'preparando', payload: { ...row.payload, source: 'pickup' } }, [])).toMatchObject({ source: 'pickup', status: 'en_preparacion' });
    expect(STATUS_TO_REMOTE.en_preparacion).toBe('preparando');
  });
});
