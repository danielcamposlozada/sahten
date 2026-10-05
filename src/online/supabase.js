// ═══════════════════════════════════════════════════════════
// Cliente mínimo de Supabase (REST + Auth + Realtime) sin SDK. Todo inyectable (fetch, WebSocket, reloj) para probarlo.
// SOLO anon key: una service_role key se rechaza (nunca va en la app ni en la web).
// ═══════════════════════════════════════════════════════════

export class SupabaseError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) { super(message); this.name = 'SupabaseError'; this.status = status; this.code = code; this.offline = offline; }
}

const b64urlDecode = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'); };

/** Valida URL y clave. Devuelve { ok, problem }. Rechaza claves de servicio. */
export function validateConnection({ url, anonKey }) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.(supabase\.co|supabase\.in)$/i.test(u) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) return { ok: false, problem: 'La URL debe ser la de tu proyecto, por ejemplo https://abcd1234.supabase.co.' };
  const k = String(anonKey || '').trim();
  if (!k) return { ok: false, problem: 'Falta la anon key (Project Settings › API).' };
  if (/^sb_secret_/.test(k)) return { ok: false, problem: 'Esa es una clave SECRETA. Usá la anon key (pública): la clave secreta nunca va en la app.' };
  if (k.split('.').length === 3) {
    try { const pl = JSON.parse(b64urlDecode(k.split('.')[1])); if (pl.role === 'service_role') return { ok: false, problem: 'Esa es la clave service_role. Usá la anon key (pública): la service_role da acceso total y nunca va en la app.' }; } catch (e) { return { ok: false, problem: 'La anon key no tiene un formato válido.' }; }
  } else if (!/^sb_publishable_/.test(k)) return { ok: false, problem: 'La anon key no tiene un formato válido.' };
  return { ok: true, url: u, anonKey: k };
}

export const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
export const validSlug = s => /^[a-z0-9][a-z0-9-]{2,39}$/.test(s || '');

const MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos.', email_not_confirmed: 'Todavía no confirmaste tu email: revisá tu bandeja.',
  user_already_exists: 'Ya existe una cuenta con ese email: iniciá sesión.', weak_password: 'La contraseña es muy débil (mínimo 6 caracteres).',
  '23505': 'Ese nombre de tienda ya existe: elegí otro.', '42501': 'No tenés permiso para hacer eso con tu rol.', '23514': 'El valor no es válido.',
};

export function createClient({ url, anonKey, fetchImpl, WebSocketImpl, now = () => Date.now(), session = null, onSession = () => {} }) {
  const v = validateConnection({ url, anonKey }); if (!v.ok) throw new SupabaseError(v.problem, { code: 'invalid_connection' });
  const base = v.url, key = v.anonKey;
  const f = fetchImpl || ((...a) => fetch(...a));
  let sess = session;

  async function raw(path, { method = 'GET', body, headers = {}, token } = {}) {
    let res;
    try { res = await f(base + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new SupabaseError('Sin conexión con Supabase. Revisá tu internet.', { offline: true }); }
    let data = null; try { data = res.status === 204 ? null : await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const code = (data && (data.code || data.error_code || data.error)) || '';
      const msg = MESSAGES[code] || MESSAGES[data && data.error_code] || (data && (data.message || data.msg || data.error_description)) || ('Error ' + res.status);
      throw new SupabaseError(msg, { status: res.status, code: String(code) });
    }
    return data;
  }

  // ── Auth ─────────────────────────────────────────────
  const setSession = d => { sess = d ? { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + (d.expires_in || 3600), user: d.user || (sess && sess.user) } : null; onSession(sess); return sess; };
  const auth = {
    get session() { return sess; },
    async signIn(email, password) { return setSession(await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })); },
    async signUp(email, password) { const d = await raw('/auth/v1/signup', { method: 'POST', body: { email, password } }); return d && d.access_token ? setSession(d) : { pendingConfirmation: true, user: d && (d.user || d) }; },
    async refresh() { if (!sess || !sess.refresh_token) throw new SupabaseError('Hay que volver a iniciar sesión.', { code: 'no_session' }); return setSession(await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } })); },
    signOut() { sess = null; onSession(null); },
    async token() { if (!sess) return null; if (sess.expires_at - 60 <= Math.floor(now() / 1000)) await auth.refresh(); return sess.access_token; },
    get user() { return sess && sess.user; },
  };

  const authed = async (path, o = {}) => raw(path, { ...o, token: (await auth.token()) || undefined });
  const rpc = (name, args) => authed('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} });

  // ── Tienda y menú ────────────────────────────────────
  const store = {
    async bySlug(slug) { const r = await raw('/rest/v1/stores?select=id,slug,name&slug=eq.' + encodeURIComponent(slug)); return r && r[0] || null; },
    async create({ slug, name, projectId }) {
      const u = auth.user; if (!u) throw new SupabaseError('Iniciá sesión para crear la tienda.', { code: 'no_session' });
      const r = await authed('/rest/v1/stores', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { slug, name, owner: u.id, project_id: projectId || null } });
      return r[0];
    },
    async publishMenu(storeId, json) { await authed('/rest/v1/menus?on_conflict=store_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { store_id: storeId, json, updated_at: new Date(now()).toISOString() } }); },
  };

  // ── Pedidos ──────────────────────────────────────────
  const orders = {
    async list(storeId, sinceIso) { return authed('/rest/v1/orders?select=id,payload,status,created_at&store_id=eq.' + storeId + (sinceIso ? '&created_at=gt.' + encodeURIComponent(sinceIso) : '') + '&order=created_at.asc&limit=200'); },
    async setStatus(id, status) { await authed('/rest/v1/orders?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { status } }); },
  };

  // ── Tiempo real (protocolo Phoenix de Supabase Realtime) con respaldo por consulta periódica ──
  function subscribeOrders(storeId, { onInsert, onStatus = () => {}, pollMs = 15000, heartbeatMs = 25000, setTimer = setInterval, clearTimer = clearInterval }) {
    let ws = null, hb = null, poll = null, closed = false, ref = 0, last = new Date(now()).toISOString(), mode = 'conectando';
    const status = s => { mode = s; onStatus(s); };
    const seen = new Set();
    const emit = row => { if (!row || seen.has(row.id)) return; seen.add(row.id); if (row.created_at && row.created_at > last) last = row.created_at; onInsert(row); };
    const startPolling = () => { if (poll || closed) return; status('consulta periódica'); poll = setTimer(async () => { try { (await orders.list(storeId, last)).forEach(emit); } catch (e) { onStatus('sin conexión'); } }, pollMs); };
    try {
      const WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
      if (!WS) throw new Error('sin websocket');
      const wsUrl = base.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(key) + '&vsn=1.0.0';
      ws = new WS(wsUrl);
      const send = (topic, event, payload) => ws.send(JSON.stringify({ topic, event, payload, ref: String(++ref) }));
      ws.onopen = async () => {
        const tok = (await auth.token()) || key;
        send('realtime:orders-' + storeId, 'phx_join', { config: { postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'orders', filter: 'store_id=eq.' + storeId }] }, access_token: tok });
        hb = setTimer(() => send('phoenix', 'heartbeat', {}), heartbeatMs);
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.event === 'phx_reply' && m.topic.startsWith('realtime:orders-')) { if (m.payload && m.payload.status === 'ok') status('en vivo'); else { status('error'); startPolling(); } }
        else if (m.event === 'postgres_changes') { const d = m.payload && m.payload.data; if (d && d.type === 'INSERT') emit(d.record); }
      };
      ws.onclose = () => { if (!closed) { clearTimer(hb); startPolling(); } };
      ws.onerror = () => { if (!closed) startPolling(); };
    } catch (e) { startPolling(); }
    return { get mode() { return mode; }, close() { closed = true; clearTimer(hb); clearTimer(poll); try { ws && ws.close(); } catch (e) { /* */ } } };
  }

  return { url: base, anonKey: key, auth, rpc, store, orders, subscribeOrders, raw };
}
