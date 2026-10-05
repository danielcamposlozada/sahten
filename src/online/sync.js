// ═══════════════════════════════════════════════════════════
// Sincronización del proyecto con la nube (opcional). LOCAL PRIMERO: el .sahten siempre se guarda; la nube es una copia
// que se actualiza por detrás. Conflictos por versión: si cambiaron los dos lados, se avisa y se elige.
// ═══════════════════════════════════════════════════════════
import { contentHash } from '../project/schema.js';
import { SupabaseError } from './supabase.js';
import { writeScope, applyPublicToFile } from './roles.js';

const clone = v => JSON.parse(JSON.stringify(v));
export const BACKOFF_MS = [30000, 60000, 120000, 300000];

/** Lo que viaja a la nube: el proyecto sin imágenes (pesan mucho y se quedan en cada equipo). */
export const stripForSync = file => { const f = clone(file); f.images = {}; f.modifiedAt = null; return f; };
export const syncHash = file => contentHash(stripForSync(file));

/** Decide qué hacer según qué lado cambió desde la última sincronización. */
export function decide({ localHash, last, remoteVersion }) {
  if (!last) return remoteVersion != null ? 'conflict' : 'push';
  const localChanged = localHash !== last.hash, remoteChanged = remoteVersion !== last.version;
  if (!localChanged && !remoteChanged) return 'noop';
  if (localChanged && !remoteChanged) return 'push';
  if (!localChanged && remoteChanged) return 'pull';
  return 'conflict';
}

/** Une pedidos/clientes por id (gana el más reciente) y stock del lado que cargó pedidos en la nube. */
export function mergeOps(file, ops) {
  if (!ops) return file;
  const f = clone(file);
  const byId = (a, b) => { const m = new Map((a || []).map(x => [x.id, x])); (b || []).forEach(x => { const o = m.get(x.id); if (!o || String(x.updatedAt || x.createdAt || '') >= String(o.updatedAt || o.createdAt || '')) m.set(x.id, x); }); return [...m.values()]; };
  const s = ops.sales || {};
  if (s.orders) f.sales.orders = byId(f.sales.orders, s.orders).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (s.customers) f.sales.customers = byId(f.sales.customers, s.customers);
  if (ops.stock && ops.stock.items && Object.keys(ops.stock.items).length) { f.stock.items = { ...f.stock.items, ...ops.stock.items }; if (ops.stock.movements) f.stock.movements = ops.stock.movements; }
  return f;
}

/**
 * deps = {
 *   client            createClient() de supabase.js (rpc + raw)
 *   remoteId()        id del proyecto en la nube (o null si aún no se subió)
 *   setRemoteId(id)
 *   role()            rol del usuario en este proyecto
 *   collect()         archivo .sahten de la app            apply(file)  carga un archivo en la app
 *   publicOf(file)    versión sin costos (para encargado/cajero)
 *   store             { get(k,d), set(k,v) }   estado de sincronización por proyecto (configuración de la APP)
 *   projectId()       id local del proyecto     now()  reloj     timer { set, clear }
 * }
 */
export function createSync(deps) {
  const now = deps.now || (() => Date.now());
  const timer = deps.timer || { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) };
  const key = () => 'sync:' + deps.projectId();
  let state = 'sin vincular', error = null, pending = false, attempt = 0, retry = null, debounce = null, conflict = null, lastAt = null, busy = false;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(api.info()); } catch (e) { console.error(e); } });
  const set = (s, e) => { state = s; error = e || null; emit(); };
  const last = () => deps.store.get(key(), null);
  const save = v => deps.store.set(key(), v);

  const fetchRemoteMeta = async () => {
    const rows = await deps.client.raw('/rest/v1/projects?select=id,version,updated_at,name&id=eq.' + deps.remoteId(), { token: await deps.client.auth.token() });
    return rows && rows[0] || null;
  };

  function offline(e) {
    if (!(e instanceof SupabaseError) || !e.offline) return false;
    pending = true; set('sin conexión', e.message);
    timer.clear(retry); retry = timer.set(() => api.sync().catch(() => {}), BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]);
    return true;
  }

  const api = {
    info: () => ({ state, error, pending, conflict, lastAt, linked: !!deps.remoteId(), version: (last() || {}).version || null, role: deps.role() }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Primera vez: sube el proyecto y lo vincula. */
    async link() {
      const f = deps.collect();
      const r = await deps.client.rpc('create_project', { p_name: f.project.name || 'Proyecto', p_data: stripForSync(f), p_public: deps.publicOf(f) });
      deps.setRemoteId(r); save({ version: 1, hash: syncHash(f), at: new Date(now()).toISOString() }); lastAt = new Date(now()); set('al día'); return r;
    },

    /** Sincroniza ahora: sube, baja o avisa del conflicto, según cambió cada lado. */
    async sync({ resolve } = {}) {
      if (busy) { pending = true; return { state: 'ocupado' }; }
      if (!deps.remoteId()) return { state: 'sin vincular' };
      busy = true; set('sincronizando');
      try {
        const role = deps.role();
        if (writeScope(role) !== 'project' && role !== 'lectura') return await staffSync();
        if (role === 'lectura') return await pullOnly();
        const meta = await fetchRemoteMeta();
        if (!meta) throw new SupabaseError('No encuentro el proyecto en la nube (¿te sacaron el acceso?).', { code: 'not_found' });
        const f = deps.collect(); const lh = syncHash(f);
        const act = decide({ localHash: lh, last: last(), remoteVersion: meta.version });
        if (act === 'noop') { await mergeStaffOps(); lastAt = new Date(now()); attempt = 0; pending = false; set('al día'); return { action: 'noop' }; }
        if (act === 'push') return await push(f, lh, last() ? last().version : meta.version);
        if (act === 'pull') return await pull();
        // conflicto: cambiaron los dos lados
        conflict = { remote: meta, local: { hash: lh } };
        const choice = resolve ? await resolve(conflict) : null;
        if (choice === 'theirs') return await pull();
        if (choice === 'mine') return await push(f, lh, meta.version);
        set('conflicto'); return { action: 'conflict', conflict };
      } catch (e) {
        if (offline(e)) return { action: 'offline' };
        set('error', e.message); throw e;
      } finally { busy = false; }
    },

    /** Resolver un conflicto pendiente: 'mine' (mi versión pisa la de la nube) o 'theirs' (descargo la de la nube). */
    async resolve(choice) {
      if (!conflict) return null;
      busy = true; set('sincronizando');
      try {
        if (choice === 'theirs') return await pull();
        const f = deps.collect(); return await push(f, syncHash(f), conflict.remote.version);
      } catch (e) { if (offline(e)) return { action: 'offline' }; set('error', e.message); throw e; } finally { busy = false; }
    },

    /** Programar una sincronización (se llama en cada guardado local): espera 5 s y junta los cambios. */
    schedule() { if (!deps.remoteId() || writeScope(deps.role()) === 'none') return; pending = true; timer.clear(debounce); debounce = timer.set(() => api.sync().catch(() => {}), 5000); },
    cancel() { timer.clear(debounce); timer.clear(retry); },
  };

  async function push(f, lh, baseVersion) {
    const r = await deps.client.rpc('save_project', { pid: deps.remoteId(), p_data: stripForSync(f), p_public: deps.publicOf(f), base_version: baseVersion });
    if (r.conflict) { conflict = { remote: r, local: { hash: lh } }; set('conflicto'); return { action: 'conflict', conflict }; }
    save({ version: r.version, hash: lh, at: r.updated_at }); conflict = null; pending = false; attempt = 0; lastAt = new Date(now()); set('al día');
    await mergeStaffOps();
    return { action: 'push', version: r.version };
  }

  async function pull() {
    const r = await deps.client.rpc('get_project_data', { pid: deps.remoteId() });
    let incoming = r.data; const local = deps.collect();
    incoming = { ...incoming, images: local.images };                            // las imágenes no viajan: se conservan las de este equipo
    await deps.apply(incoming);
    save({ version: r.version, hash: syncHash(incoming), at: r.updated_at }); conflict = null; pending = false; attempt = 0; lastAt = new Date(now()); set('al día');
    return { action: 'pull', version: r.version };
  }

  // administrador/dueño: trae los pedidos y el stock que cargaron encargado y cajero
  async function mergeStaffOps() {
    try {
      const ops = await deps.client.rpc('get_ops', { pid: deps.remoteId() });
      const f = deps.collect(); const merged = mergeOps(f, ops);
      if (syncHash(merged) !== syncHash(f)) { await deps.apply(merged); const l = last(); if (l) save({ ...l, hash: syncHash(merged) }); }
    } catch (e) { if (!(e instanceof SupabaseError)) throw e; }
  }

  // lectura: solo baja
  async function pullOnly() {
    const meta = await fetchRemoteMeta(); const l = last();
    if (!l || l.version !== meta.version) await pull(); else { lastAt = new Date(now()); set('al día'); }
    return { action: 'readonly' };
  }

  // encargado / cajero: suben pedidos (y stock el encargado) y bajan precios y pedidos de los demás
  async function staffSync() {
    const role = deps.role(); const f = deps.collect();
    await deps.client.rpc('save_ops', { pid: deps.remoteId(), p_sales: { orders: f.sales.orders, customers: f.sales.customers }, p_stock: role === 'encargado' ? { items: f.stock.items, movements: f.stock.movements } : null });
    const meta = await fetchRemoteMeta(); const l = last();
    if (!l || l.version !== meta.version) {
      const r = await deps.client.rpc('get_project_public', { pid: deps.remoteId() });
      await deps.apply(applyPublicToFile(deps.collect(), r.public)); save({ version: r.version, hash: '' });
    }
    const ops = await deps.client.rpc('get_ops', { pid: deps.remoteId() });
    const merged = mergeOps(deps.collect(), ops); await deps.apply(merged);
    pending = false; attempt = 0; lastAt = new Date(now()); set('al día'); return { action: 'ops' };
  }

  return api;
}
