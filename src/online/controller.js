// ═══════════════════════════════════════════════════════════
// Conexión online del proyecto (Supabase, opcional): conectar, sincronizar el menú y recibir pedidos en tiempo real.
// El controlador no toca el DOM: habla con la app a través de `host` (inyectable, así se prueba sin navegador).
//
// host = {
//   conn: { url, anonKey, storeId, slug }   conexión del proyecto (va a online.supabase del archivo)
//   projectId(), markDirty(), menuJson()    proyecto abierto
//   orders: { list(), add(order) }          pedidos locales del Mostrador
//   notify({ title, body }), refresh()      aviso y redibujado
//   storage: { get(k,d), set(k,v) }         configuración de la APP (sesión; nunca contraseñas ni datos del negocio)
//   fetchImpl, WebSocketImpl                red
// }
// ═══════════════════════════════════════════════════════════
import { createClient, validateConnection, validSlug, slugify, SupabaseError } from './supabase.js';
import { toLocalOrder, STATUS_TO_REMOTE } from './orders.js';

export function createController(host) {
  let client = null, feed = null, mode = 'desconectado', error = null, lastSync = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(api.info()); } catch (e) { console.error(e); } });
  const set = (m, e) => { mode = m; error = e || null; emit(); };
  const sessKey = () => 'online-session:' + (host.projectId() || 'x');
  const mk = (conn, session) => createClient({ url: conn.url, anonKey: conn.anonKey, fetchImpl: host.fetchImpl, WebSocketImpl: host.WebSocketImpl, session, onSession: s => host.storage.set(sessKey(), s) });

  function importRow(row) {
    const o = toLocalOrder(row, host.orders.list());
    if (!o) return;
    host.orders.add(o);
    host.notify({ title: 'Nuevo pedido online #' + String(o.num).padStart(4, '0'), body: o.customerName + ' · $' + Math.round(o.total).toLocaleString('es-AR') + (o.source === 'delivery' ? ' · delivery' : ' · retiro') });
    host.refresh();
  }

  async function startFeed() {
    stopFeed();
    if (!client || !host.conn.storeId) return;
    try { (await client.orders.list(host.conn.storeId)).filter(r => ['pendiente', 'preparando'].includes(r.status)).forEach(importRow); } catch (e) { set('conectado', e.message); }
    feed = client.subscribeOrders(host.conn.storeId, { onInsert: importRow, onStatus: s => { lastFeed = s; emit(); } });
  }
  let lastFeed = '';
  const stopFeed = () => { if (feed) { feed.close(); feed = null; } lastFeed = ''; };

  const api = {
    info: () => ({ mode, error, signedIn: !!(client && client.auth.user), email: client && client.auth.user && client.auth.user.email, configured: !!(host.conn.url && host.conn.anonKey), storeId: host.conn.storeId || '', slug: host.conn.slug || '', feed: lastFeed, lastSync }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get client() { return client; },

    /** Conectar: valida, inicia sesión (o crea la cuenta), busca o crea la tienda por slug y guarda la conexión en el proyecto. */
    async connect({ url, anonKey, slug, email, password, signUp = false, projectId = null }) {
      const v = validateConnection({ url, anonKey }); if (!v.ok) throw new SupabaseError(v.problem, { code: 'invalid_connection' });
      slug = slug || slugify(host.menuJson().store.name); if (!validSlug(slug)) throw new SupabaseError('El nombre de la tienda en la web debe tener entre 3 y 40 letras, números o guiones (ej.: mi-local).', { code: 'invalid_slug' });
      set('conectando');
      try {
        client = mk(v, null);
        const r = signUp ? await client.auth.signUp(email, password) : await client.auth.signIn(email, password);
        if (r.pendingConfirmation) { set('desconectado'); return { pendingConfirmation: true }; }
        let store = await client.store.bySlug(slug);
        if (!store) store = await client.store.create({ slug, name: host.menuJson().store.name, projectId });
        Object.assign(host.conn, { url: v.url, anonKey: v.anonKey, storeId: store.id, slug });
        host.markDirty();
        set('conectado'); await startFeed(); return { store };
      } catch (e) { client = null; set('desconectado', e.message); throw e; }
    },

    /** Al abrir un proyecto ya conectado: retoma la sesión guardada (si no vence) y escucha pedidos. */
    async resume() {
      stopFeed(); client = null;
      if (!host.conn.url || !host.conn.anonKey) { set('desconectado'); return false; }
      const session = host.storage.get(sessKey(), null);
      try { client = mk(host.conn, session); } catch (e) { set('desconectado', e.message); return false; }
      if (!session) { set('sin sesión'); return false; }
      try { await client.auth.token(); set('conectado'); await startFeed(); return true; }
      catch (e) { client = null; set('sin sesión', e.offline ? e.message : 'Hay que iniciar sesión de nuevo.'); return false; }
    },

    async signIn(email, password) {
      if (!host.conn.url) throw new SupabaseError('Primero conectá el proyecto.');
      client = mk(host.conn, null); await client.auth.signIn(email, password); set('conectado'); await startFeed();
    },

    disconnect() { stopFeed(); if (client) client.auth.signOut(); client = null; Object.keys(host.conn).forEach(k => delete host.conn[k]); Object.assign(host.conn, { url: '', anonKey: '', storeId: '' }); host.markDirty(); set('desconectado'); },

    /** Sube el menú actual para que la web lo lea en vivo (sin republicar archivos). */
    async syncMenu() {
      if (!client || !host.conn.storeId) throw new SupabaseError('Conectá el proyecto primero.');
      const m = host.menuJson(); delete m.supabase;
      await client.store.publishMenu(host.conn.storeId, m); lastSync = new Date().toISOString(); emit(); return m.products.length;
    },

    /** Cuando cambia el estado de un pedido importado, se avisa a la web/otros dispositivos. */
    async pushStatus(order) {
      if (!client || !order || !order.remoteId) return false;
      const st = STATUS_TO_REMOTE[order.status]; if (!st) return false;
      try { await client.orders.setStatus(order.remoteId, st); return true; } catch (e) { return false; }
    },
  };
  return api;
}
