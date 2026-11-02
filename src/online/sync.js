// ═══════════════════════════════════════════════════════════
// Sincronización del proyecto con la nube (opcional). LOCAL PRIMERO: el .sahten siempre se guarda; la nube es una copia
// que se actualiza por detrás. Conflictos por versión: si cambiaron los dos lados, se avisa y se elige.
// ═══════════════════════════════════════════════════════════
import { contentHash } from '../project/schema.js';
import { SupabaseError } from './supabase.js';
import { writeScope, applyPublicToFile } from './roles.js';
import { mergeCloudPromotions } from './promotion-sync.js';
import { mergeOrderHistory, preserveLocalSales } from './order-preservation.js';

const clone = v => JSON.parse(JSON.stringify(v));
export const BACKOFF_MS = [30000, 60000, 120000, 300000];

/** Lo que viaja a la nube: el proyecto con referencias remotas; los binarios se suben antes a Storage. */
export const stripForSync = file => { const f = clone(file); f.images = Object.fromEntries(Object.entries(f.images || {}).filter(([, v]) => /^https?:\/\//.test(v))); f.modifiedAt = null; return f; };
export const syncHash = file => { const f = stripForSync(file); delete f.cloudImagesVersion; f.images = file.images || {}; if(f.online)delete f.online.supabase; return contentHash(f); };

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
  if (s.orders) f.sales.orders = mergeOrderHistory(f.sales.orders, s.orders);
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
  let generation = 0;
  let transfer = null;
  const report = p => transfer?.update(p);
  const guard = () => {
    const id = deps.projectId(), rid = deps.remoteId(), gen = generation;
    return () => { if (gen !== generation || id !== deps.projectId() || rid !== deps.remoteId()) throw new SupabaseError('Cambió el proyecto o se canceló la sincronización.', { code: 'project_changed' }); };
  };
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
      if (busy) throw new SupabaseError('Ya hay una sincronización en curso.');
      busy = true; transfer = deps.progress?.start('Subiendo proyecto a la nube');
      try {
      const check = guard(), f = deps.collect();
      const prepared = deps.prepareFile ? await deps.prepareFile(f, report) : f;
      check();
      report({ detail: 'Guardando base de datos en la nube…' });
      const r = await deps.client.rpc('create_project', { p_name: f.project.name || 'Proyecto', p_data: stripForSync(prepared), p_public: deps.publicOf(prepared) });
      check(); deps.setRemoteId(r); save({ version: 1, hash: syncHash(f), at: new Date(now()).toISOString() }); lastAt = new Date(now()); set('al día'); transfer?.finish(); return r;
      } catch (e) { transfer?.fail(e); throw e; } finally { busy = false; transfer = null; }
    },

    /** Sincroniza ahora: sube, baja o avisa del conflicto, según cambió cada lado. */
    async sync({ resolve } = {}) {
      if (busy) { pending = true; return { state: 'ocupado' }; }
      if (!deps.remoteId()) return { state: 'sin vincular' };
      busy = true; transfer = deps.progress?.start('Sincronizando proyecto'); const check = guard(); set('sincronizando');
      try {
        report({ detail: 'Consultando cambios de la base de datos…' });
        const role = deps.role();
        if (writeScope(role) !== 'project' && role !== 'lectura') return await staffSync(check);
        if (role === 'lectura') return await pullOnly(check);
        const meta = await fetchRemoteMeta(); check();
        if (!meta) throw new SupabaseError('No encuentro el proyecto en la nube (¿te sacaron el acceso?).', { code: 'not_found' });
        const f = deps.collect(); const lh = syncHash(f);
        const act = decide({ localHash: lh, last: last(), remoteVersion: meta.version });
        if (act === 'noop') { await mergeStaffOps(check); lastAt = new Date(now()); attempt = 0; pending = false; set('al día'); return { action: 'noop' }; }
        if (act === 'push') return await push(f, lh, last() ? last().version : meta.version, check);
        if (act === 'pull') return await pull(check);
        // conflicto: cambiaron los dos lados
        conflict = { remote: meta, local: { hash: lh } };
        const choice = resolve ? await resolve(conflict) : null;
        if (choice === 'theirs') return await pull(check);
        if (choice === 'mine') return await push(f, lh, meta.version, check);
        set('conflicto'); return { action: 'conflict', conflict };
      } catch (e) {
        transfer?.fail(e);
        if (offline(e)) return { action: 'offline' };
        set('error', e.message); throw e;
      } finally { if (state === 'al día') transfer?.finish(); else transfer?.fail(error || 'La sincronización está pendiente. Revisá el estado del proyecto.'); transfer = null; busy = false; }
    },

    /** Resolver un conflicto pendiente: 'mine' (mi versión pisa la de la nube) o 'theirs' (descargo la de la nube). */
    async resolve(choice) {
      if (!conflict) return null;
      if (busy) return { state: 'ocupado' };
      busy = true; transfer = deps.progress?.start('Sincronizando la versión elegida'); const check = guard(); set('sincronizando');
      try {
        if (choice === 'theirs') return await pull(check);
        const f = deps.collect(); return await push(f, syncHash(f), conflict.remote.version, check);
      } catch (e) { transfer?.fail(e); if (offline(e)) return { action: 'offline' }; set('error', e.message); throw e; } finally { if (state === 'al día') transfer?.finish(); else transfer?.fail(error || 'Sincronización pendiente.'); transfer = null; busy = false; }
    },

    /** Copia SOLO promociones desde el proyecto remoto, respaldando y guardando el .sahten.
     * No altera la versión base de sync: si hay ediciones independientes aparece conflicto,
     * en lugar de sobrescribir ciegamente pedidos, catálogo u otros cambios remotos. */
    async pullPromotionsFromCloud(){
      if(busy)throw new SupabaseError('Ya se está sincronizando el proyecto.');
      if(!deps.remoteId()||!['owner','admin'].includes(deps.role()))
        throw new SupabaseError('Necesitás un proyecto vinculado y permisos de dueño o administrador.');
      if(deps.hasLocalFile&&!deps.hasLocalFile())
        throw new SupabaseError('Guardá primero una copia .sahten en este equipo para conservar los cambios.');
      busy=true;transfer=deps.progress?.start('Actualizando promociones del proyecto');
      const check=guard();
      timer.clear(debounce);
      try{
        const original=deps.collect(),before=syncHash(original);
        const remote=await deps.client.rpc('get_project_data',{pid:deps.remoteId()});
        check();
        if(!remote||!remote.data||!Number.isInteger(Number(remote.version)))
          throw new SupabaseError('La nube no devolvió un proyecto válido.');
        if(remote.data.project?.id&&original.project?.id&&remote.data.project.id!==original.project.id)
          throw new SupabaseError('El proyecto local y el remoto no coinciden. No se aplicaron cambios.');
        const merged=mergeCloudPromotions(original,remote.data);
        if(syncHash(deps.collect())!==before)
          throw new SupabaseError('El proyecto local cambió durante la descarga. Volvé a intentar.');
        if(JSON.stringify(original.promotions||{})===JSON.stringify(merged.promotions))
          return {action:'unchanged',version:remote.version};
        if(!deps.backupBefore||!deps.saveLocal)
          throw new SupabaseError('No hay respaldo o guardado local disponible.');
        report({detail:'Respaldando proyecto antes de importar…'});
        await deps.backupBefore();
        check();
        if(syncHash(deps.collect())!==before)
          throw new SupabaseError('El proyecto local cambió al crear el respaldo. No se aplicaron cambios.');
        report({detail:'Importando promociones sin reemplazar ventas ni catálogo…'});
        await deps.apply(merged);
        check();
        if(await deps.saveLocal()===false)
          throw new SupabaseError('No se pudo guardar el archivo .sahten. Revisá la ubicación del proyecto.');
        check();
        // Queda pendiente la sincronización integral: CAS/conflictos originales intactos.
        pending=true;conflict=null;set('promociones locales actualizadas');
        return {action:'promotions_pull',version:remote.version};
      }catch(e){
        transfer?.fail(e);set('error',e?.message||String(e));throw e;
      }finally{transfer=null;busy=false;}
    },

    /** Programar una sincronización (se llama en cada guardado local): espera 5 s y junta los cambios. */
    schedule() { if (!deps.remoteId() || writeScope(deps.role()) === 'none') return; pending = true; timer.clear(debounce); debounce = timer.set(() => api.sync().catch(() => {}), 5000); },
    cancel() { generation++; timer.clear(debounce); timer.clear(retry); },
  };

  async function push(f, lh, baseVersion, check = guard()) {
    // No pisar pedidos que ya existen en la nube pero aún no están en
    // este equipo. Incluso "usar mi versión" conserva el historial remoto.
    const remote=await deps.client.rpc('get_project_data',{pid:deps.remoteId()});check();
    if(Number(remote.version)!==Number(baseVersion)){
      conflict={remote,local:{hash:lh}};set('conflicto');
      return {action:'conflict',conflict};
    }
    if(syncHash(deps.collect())!==lh)throw new SupabaseError('El proyecto cambió al preparar el envío. Reintentá la sincronización.');
    const combined=preserveLocalSales(remote.data,f);
    const recovered=syncHash(combined)!==syncHash(f);
    if(recovered) {
      if(!deps.backupBeforeSync)throw new SupabaseError('No hay respaldo disponible para conciliar ventas.');
      await deps.backupBeforeSync();check();
      if(syncHash(deps.collect())!==lh)throw new SupabaseError('Los pedidos cambiaron durante el respaldo.');
      await deps.apply(combined);
      if(deps.hasLocalFile?.() && await deps.saveLocal()===false)
        throw new SupabaseError('No se pudo guardar la copia local conciliada.');
      check();
    }
    const prepared = deps.prepareFile ? await deps.prepareFile(combined, report) : combined;
    check();
    report({ detail: 'Guardando proyecto y pedidos conciliados en la nube…' });
    const r = await deps.client.rpc('save_project', { pid: deps.remoteId(), p_data: stripForSync(prepared), p_public: deps.publicOf(prepared), base_version: baseVersion });
    check();
    if (r.conflict) { conflict = { remote: r, local: { hash: syncHash(combined) } }; set('conflicto'); return { action: 'conflict', conflict }; }
    save({ version: r.version, hash: syncHash(combined), at: r.updated_at });
    conflict = null; pending = false; attempt = 0; lastAt = new Date(now()); set('al día');
    await mergeStaffOps(check);
    return { action: 'push', version: r.version };
  }

  async function pull(check = guard()) {
    report({ detail: 'Descargando base de datos…' });
    const r = await deps.client.rpc('get_project_data', { pid: deps.remoteId() });
    check();
    let incoming = r.data; const local = deps.collect(), before = syncHash(local);
    if (!incoming || typeof incoming !== 'object') throw new SupabaseError('El servidor no devolvió un proyecto válido.');
    incoming = deps.restoreFile ? await deps.restoreFile(incoming, local.images, report) : { ...incoming, images: local.images };
    check();
    // No se copia la conexión de otro equipo.
    incoming.online={...(incoming.online||{}),supabase:{
      ...(incoming.online?.supabase||{}),...(local.online?.supabase||{}),projectId:deps.remoteId()
    }};
    if (syncHash(deps.collect()) !== before) throw new SupabaseError('Hubo cambios locales durante la descarga. No se reemplazó el proyecto.', { code: 'local_changed' });
    // Conservar TODOS los pedidos y clientes locales, incluso cuando una copia
    // remota más reciente tiene menos ventas. La ausencia nunca es un borrado.
    const baseHash = syncHash(incoming);
    incoming = preserveLocalSales(local, incoming);
    const needsUpload = syncHash(incoming) !== baseHash;
    if (!deps.backupBeforeSync) throw new SupabaseError('No hay respaldo previo de sincronización. Se canceló la descarga para proteger los pedidos.', {code:'backup_unavailable'});
    report({ detail: 'Respaldando los pedidos antes de actualizar el equipo…' });
    await deps.backupBeforeSync();
    check();
    if (syncHash(deps.collect()) !== before) throw new SupabaseError('Cambios locales nuevos: no se reemplazó el proyecto.', {code:'local_changed'});
    report({ detail: 'Conciliando pedidos locales y remotos…' }); await deps.apply(incoming);
    check();
    if(deps.hasLocalFile?.()) {
      report({detail:'Guardando la copia local .sahten…'});
      if(await deps.saveLocal()===false)throw new SupabaseError('No se pudo guardar la copia local del proyecto.');
      check();
    }
    // Si el equipo recuperó pedidos ausentes en la nube, el hash de base
    // sigue siendo el remoto: el siguiente ciclo los sube automáticamente.
    save({version:r.version,hash:needsUpload?baseHash:syncHash(incoming),at:r.updated_at});
    conflict=null;pending=needsUpload;attempt=0;lastAt=new Date(now());set('al día');
    if(needsUpload)timer.set(()=>api.sync().catch(()=>{}),5000);
    return { action: 'pull', version: r.version, recovered: needsUpload };
  }

  // administrador/dueño: trae los pedidos y el stock que cargaron encargado y cajero
  async function mergeStaffOps(check = guard()) {
    try {
      const ops = await deps.client.rpc('get_ops', { pid: deps.remoteId() });
      check();
      const f = deps.collect(); const merged = mergeOps(f, ops);
      if (syncHash(merged) !== syncHash(f)) {
        if (!deps.backupBeforeSync) throw new SupabaseError('No hay respaldo disponible para conciliar pedidos.');
        await deps.backupBeforeSync();
        check();
        if(syncHash(deps.collect())!==syncHash(f))throw new SupabaseError('Los pedidos cambiaron durante la conciliación.');
        await deps.apply(merged);
        if (deps.hasLocalFile?.() && await deps.saveLocal()===false) throw new SupabaseError('No se pudo guardar la conciliación.');
        pending=true;
        timer.set(()=>api.sync().catch(()=>{}),5000);
      }
    } catch (e) { if (!(e instanceof SupabaseError)) throw e; }
  }

  // lectura: solo baja
  async function pullOnly(check = guard()) {
    const meta = await fetchRemoteMeta(); check(); const l = last();
    if (!l || l.version !== meta.version) await pull(check); else { lastAt = new Date(now()); set('al día'); }
    return { action: 'readonly' };
  }

  // encargado / cajero: suben pedidos (y stock el encargado) y bajan precios y pedidos de los demás
  async function staffSync(check = guard()) {
    const role = deps.role(); const f = deps.collect();
    await deps.client.rpc('save_ops', { pid: deps.remoteId(), p_sales: { orders: f.sales.orders, customers: f.sales.customers }, p_stock: role === 'encargado' ? { items: f.stock.items, movements: f.stock.movements } : null });
    const meta = await fetchRemoteMeta(); check(); const l = last();
    if (!l || l.version !== meta.version) {
      const r = await deps.client.rpc('get_project_public', { pid: deps.remoteId() });
      const oldLocal=deps.collect(),before=syncHash(oldLocal);
      let incoming = applyPublicToFile(oldLocal, r.public);
      if (deps.restoreFile) incoming = await deps.restoreFile(incoming, oldLocal.images, report);
      check();
      incoming=preserveLocalSales(oldLocal,incoming);
      if(syncHash(deps.collect())!==before)throw new SupabaseError('Los pedidos locales cambiaron durante la descarga.');
      if (!deps.backupBeforeSync) throw new SupabaseError('No hay respaldo antes de actualizar el proyecto.');
      await deps.backupBeforeSync();check();
      await deps.apply(incoming);
      if(deps.hasLocalFile?.() && await deps.saveLocal()===false)throw new SupabaseError('No se pudo guardar la copia local de los pedidos.');
      save({ version: r.version, hash: '' });
    }
    const ops = await deps.client.rpc('get_ops', { pid: deps.remoteId() });
    check();
    const beforeOps=deps.collect(),merged=mergeOps(beforeOps,ops);
    if(syncHash(merged)!==syncHash(beforeOps)){
      if(!deps.backupBeforeSync)throw new SupabaseError('Falta respaldo para conciliar pedidos.');
      await deps.backupBeforeSync();check();
      if(syncHash(deps.collect())!==syncHash(beforeOps))throw new SupabaseError('Cambió el proyecto durante la descarga.');
      await deps.apply(merged);
      if(deps.hasLocalFile?.() && await deps.saveLocal()===false)throw new SupabaseError('No se pudieron guardar los pedidos conciliados.');
    }
    pending = false; attempt = 0; lastAt = new Date(now()); set('al día'); return { action: 'ops' };
  }

  return api;
}
