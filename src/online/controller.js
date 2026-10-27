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
import { createImageStore, menuWithCloudImages } from './images.js';
import { toLocalOrder, STATUS_FROM_REMOTE, STATUS_TO_REMOTE, paymentFields } from './orders.js';

export function createController(host) {
  let client = null, feed = null, mode = 'desconectado', error = null, lastSync = null;
  const listeners = new Set();
  const imageStores = new WeakMap();
  const statusWrites = new WeakMap();
  const imagesFor = c => { if (!imageStores.has(c)) imageStores.set(c, createImageStore(c)); return imageStores.get(c); };
  const context = () => ({ client, storeId: host.conn.storeId, projectId: host.projectId() });
  const check = ctx => { if (ctx.client !== client || ctx.storeId !== host.conn.storeId || ctx.projectId !== host.projectId()) throw new SupabaseError('Cambió el proyecto o la sesión. Volvé a sincronizar.', { code: 'project_changed' }); };
  let publishing = false;
  const emit = () => listeners.forEach(fn => { try { fn(api.info()); } catch (e) { console.error(e); } });
  const set = (m, e) => { mode = m; error = e || null; emit(); };
  const sessKey = () => 'online-session:' + (host.projectId() || 'x');
  const mk = (conn, session) => createClient({ url: conn.url, anonKey: conn.anonKey, fetchImpl: host.fetchImpl, WebSocketImpl: host.WebSocketImpl, session, onSession: s => host.storage.set(sessKey(), s) });

  function importRow(row, { initial = false } = {}) {
    const existing = host.orders.list().find(o => o.remoteId === row.id);
    if (existing) {
      const fields = paymentFields(row);
      // Solo adoptar estados remotos nuevos; no revertir una acción local aún en tránsito.
      if (!existing.remoteStatusPending && row.status && existing.remoteStatus !== row.status && STATUS_FROM_REMOTE[row.status]) {
        fields.status = STATUS_FROM_REMOTE[row.status];
        fields.remoteStatus = row.status;
        if (['retirado', 'entregado', 'cancelado'].includes(fields.status)) fields.completedAt = row.updated_at || new Date().toISOString();
        else fields.completedAt = undefined;
      }
      if (JSON.stringify(fields) !== JSON.stringify(Object.fromEntries(Object.keys(fields).map(k => [k, existing[k]])))) { Object.assign(existing, fields); host.orders.save?.(); host.markDirty(); host.refresh(); }
      return;
    }
    if (!['pendiente', 'preparando'].includes(row.status)) return;
    const o = toLocalOrder(row, host.orders.list());
    if (!o) return;
    host.orders.add(o, { initial });
    host.notify({ sound: !initial, title: 'Nuevo pedido online #' + String(o.num).padStart(4, '0'), body: o.customerName + ' · $' + Math.round(o.total).toLocaleString('es-AR') + (o.source === 'delivery' ? ' · delivery' : ' · retiro') });
    host.refresh();
  }

  async function startFeed() {
    stopFeed();
    if (!client || !host.conn.storeId) return;
    const ctx = context();
    try {
      for (const o of host.orders.list().filter(o => o.remoteId && o.remoteStatusPending)) { await api.pushStatus(o); check(ctx); }
      const rows = await ctx.client.orders.list(ctx.storeId); check(ctx);
      rows.reverse().forEach(row => importRow(row, { initial: true }));
    } catch (e) { if (e.code === 'project_changed') return; set('conectado', e.message); }
    feed = client.subscribeOrders(host.conn.storeId, { onInsert: importRow, onStatus: s => { lastFeed = s; emit(); } });
  }
  let lastFeed = '';
  /** El nombre de la tienda en Supabase sigue al nombre del negocio de este proyecto (best-effort: si falla no molesta). */
  async function syncStoreName() {
    try {
      if (!client || !host.conn.storeId) return false;
      const name = String((host.menuJson().store || {}).name || '').trim(); if (!name) return false;
      await client.raw('/rest/v1/stores?id=eq.' + host.conn.storeId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { name }, token: await client.auth.token() });
      return true;
    } catch (e) { return false; }
  }
  const stopFeed = () => { if (feed) { feed.close(); feed = null; } lastFeed = ''; };

  async function stateRpc(name, args) {
    if (!client || !host.conn.storeId) throw new SupabaseError('Conectá la tienda e iniciá sesión primero.', {code:'no_session'});
    if (publishing) throw new SupabaseError('Esperando la publicación del catálogo.', {code:'menu_busy'});
    publishing=true;const ctx=context();
    try {const result=await ctx.client.rpc(name,{p_store_id:ctx.storeId,...args});check(ctx);return result;}
    catch(e){const msg=String(e.message||'');
      if(e.code==='PGRST202')e.message='Falta actualizar el servidor de disponibilidad. El cambio queda pendiente; no se publicó el catálogo completo.';
      else if(/product_not_published|menu_not_published/.test(msg))e.message='Este producto todavía no tiene una versión publicada. Publicá el catálogo una vez para habilitar este interruptor.';
      else if(/category_not_published/.test(msg))e.message='La categoría está oculta en la tienda. Publicá su categoría desde «Publicar catálogo en la tienda».';
      throw e;
    }finally{publishing=false;}
  }

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
        set('conectado'); await startFeed(); syncStoreName(); return { store };
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
      client = mk(host.conn, null); await client.auth.signIn(email, password); set('conectado'); await startFeed(); syncStoreName();
    },

    /** Cerrar sesión SIN perder la conexión del proyecto (URL, clave y tienda quedan guardadas para volver a entrar con email y contraseña). */
    signOut() {
      stopFeed(); if (client) client.auth.signOut(); host.storage.set(sessKey(), null);
      client = mk(host.conn, null); set('sin sesión');
    },
    async recover(email) {
      if (!host.conn.url || !host.conn.anonKey) throw new SupabaseError('Primero conectá el proyecto.');
      const c = client || mk(host.conn, null); return c.auth.recover(email);
    },

    disconnect() { stopFeed(); if (client) client.auth.signOut(); client = null; Object.keys(host.conn).forEach(k => delete host.conn[k]); Object.assign(host.conn, { url: '', anonKey: '', storeId: '' }); host.markDirty(); set('desconectado'); },

    /** Cuántos productos tiene el menú del proyecto y cuántos el publicado (para confirmar antes de reemplazarlo). */
    async previewMenu() {
      if (!client || !host.conn.storeId) throw new SupabaseError('Conectá el proyecto primero.');
      const m = host.menuJson(); let remote = null; try { remote = await client.store.menuCount(host.conn.storeId); } catch (e) { /* no se pudo leer */ }
      return { local: m.products.length, remote, name: (m.store && m.store.name) || '', slug: host.conn.slug || '' };
    },

    /** Estado aislado: sin precio, foto, texto ni proyecto en la petición. */
    async setAvailability(id, visible) { return stateRpc('set_menu_product_visibility', { p_product_id:id, p_visible:visible }); },
    async setSalesAvailability(id, available, resumeAt = null) { return stateRpc('set_product_sales_availability', { p_product_id:id, p_paused:!available, p_resume_at:resumeAt }); },
    async readAvailability() {
      if (!client || !host.conn.storeId) return { sales:[], visibility:[] };
      const ctx=context(), result=await ctx.client.rpc('get_product_sales_availability', {p_store_id:ctx.storeId});check(ctx);return result;
    },

    async prepareFile(file, onProgress) {
      const ctx = context();
      if (!ctx.client) throw new SupabaseError('Iniciá sesión para sincronizar las fotos.');
      const prepared = await imagesFor(ctx.client).prepare(file, ctx.storeId, onProgress); check(ctx); return prepared;
    },
    async restoreFile(file, localImages = {}, onProgress) {
      const ctx = context();
      if (!ctx.client) throw new SupabaseError('Iniciá sesión para descargar las fotos.');
      const restored = await imagesFor(ctx.client).restore(file, localImages, onProgress); check(ctx); return restored;
    },

    /** Sube el menú actual para que la web lo lea en vivo (sin republicar archivos). */
    async syncMenu({ force = false, allowed = () => true } = {}) {
      if (!client || !host.conn.storeId) throw new SupabaseError('Conectá el proyecto primero.');
      if (publishing) throw new SupabaseError('Ya se está actualizando el menú. Esperá un momento.', { code: 'menu_busy' });
      publishing = true; const ctx = context(), task = host.progress?.start('Actualizando el menú de la web');
      try {
        let m = host.menuJson(); delete m.supabase;
        // Protección: un menú vacío (o mucho más chico) no pisa el publicado sin avisar.
        if (!m.products.length) throw new SupabaseError('Este proyecto no tiene productos para publicar, así que no se sube: vaciaría el menú publicado de la tienda' + (host.conn.slug ? ' «' + host.conn.slug + '»' : '') + '. Revisá que tengas abierto el proyecto correcto («Abrir proyecto de la nube…») y volvé a sincronizar.', { code: 'empty_menu' });
        if (!force) {
          let remote = 0; try { remote = await client.store.menuCount(host.conn.storeId); } catch (e) { /* si no se puede leer, no se bloquea */ }
          if (remote > 0 && m.products.length < remote * 0.5) { const e = new SupabaseError(`El menú publicado tiene ${remote} productos y este proyecto solo ${m.products.length}. Si seguís, el menú de la web se reemplaza.`, { code: 'menu_shrinks' }); e.remote = remote; e.local = m.products.length; throw e; }
        }
        m = await menuWithCloudImages(m, host.images ? host.images() : {}, imagesFor(ctx.client), ctx.storeId, task?.update);
        check(ctx);
        if (!allowed()) throw new SupabaseError('Se canceló la publicación automática.', { code: 'project_changed' });
        task?.update({ detail: 'Guardando el menú publicado…' });
        await ctx.client.store.publishMenu(ctx.storeId, m); check(ctx); lastSync = new Date().toISOString(); syncStoreName(); emit(); task?.finish(); return m.products.length;
      } catch (e) { task?.fail(e); throw e; } finally { publishing = false; }
    },

    /** Cuando cambia el estado de un pedido importado, se avisa a la web/otros dispositivos. */
    async pushStatus(order) {
      if (!order || !order.remoteId) return false;
      const st = STATUS_TO_REMOTE[order.status]; if (!st) return false;
      const ctx = context(); order.remoteStatusPending = st; host.orders.save?.();
      if (!ctx.client) { host.refresh(); return false; }
      if (!statusWrites.has(ctx.client)) statusWrites.set(ctx.client, new Map());
      const queue = statusWrites.get(ctx.client), before = queue.get(order.remoteId) || Promise.resolve();
      const task = before.then(async () => {
        try {
          check(ctx); const target = STATUS_TO_REMOTE[order.status];
          await ctx.client.orders.setStatus(order.remoteId, target); check(ctx);
          order.remoteStatus = target;
          if (STATUS_TO_REMOTE[order.status] === target) delete order.remoteStatusPending;
          host.orders.save?.(); host.refresh(); return true;
        } catch (e) { if (ctx.client === client && ctx.projectId === host.projectId()) host.refresh(); return false; }
      });
      queue.set(order.remoteId, task);
      try { return await task; } finally { if (queue.get(order.remoteId) === task) queue.delete(order.remoteId); }
    },
  };
  return api;
}
