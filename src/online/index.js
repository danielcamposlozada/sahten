// ═══════════════════════════════════════════════════════════
// Online opcional: une el controlador (pedidos en vivo), la sincronización y los roles con la app.
// Con SAHTEN_ONLINE=false (build) todo esto queda deshabilitado y el panel dice «No disponible en esta versión».
// ═══════════════════════════════════════════════════════════
import { createAvailabilityPublisher } from './availability.js';
import { createPhotoPublisher } from './photoPublisher.js';
import { createController } from './controller.js';
import { createSync } from './sync.js';
import { SupabaseError } from './supabase.js';
import { toPublicProject, applyPublicToFile, canSeePanel, receivesFullProject, writeScope, INVITABLE } from './roles.js';
import { applyRole, installRoleGuard } from './roleView.js';
import { createOnlineUi } from './ui.js';
import { createUserMenu } from './userMenu.js';
import { stateFromSahten } from '../core/projectFile.js';
import { channelPriceWithDisc, pricingQuoteIds } from '../core/index.js';
import { emptyFile, serialize } from '../project/schema.js';
import { onlinePublish } from './app.js';
import { createPaymentUi } from '../payments/ui.js';
import { createTransferProgress } from './progress.js';

export const ONLINE_ENABLED = typeof __SAHTEN_ONLINE__ === 'undefined' ? true : !!__SAHTEN_ONLINE__;
const clone = v => JSON.parse(JSON.stringify(v));

export function createOnline({ w = window, project, events }) {
  const session = project.session, config = project.config;
  const conn = () => w.SAHTEN_SUPABASE;
  const roleKey = () => 'online-role:' + (session.id || 'x');
  let sync = null, viewTimer = null, remoteViewing = false;
  const progress = createTransferProgress();

  const host = {
    progress,
    conn: new Proxy({}, { get: (_, k) => conn()[k], set: (_, k, v) => { conn()[k] = v; return true; }, ownKeys: () => Reflect.ownKeys(conn()), getOwnPropertyDescriptor: (_, k) => Object.getOwnPropertyDescriptor(conn(), k), deleteProperty: (_, k) => delete conn()[k] }),
    images: () => w.SAHTEN_IMAGES || {},
    projectId: () => session.id, markDirty: () => project.markDirty(), menuJson: () => onlinePublish.currentMenu(),
    orders: { list: () => w.sahtenOrders(), save: () => { if (typeof w._saveOrders === 'function') w._saveOrders(); }, add: (o, { initial = false } = {}) => { w.SAHTEN.pricing?.capture(o, { basis: 'from-quote' }); w.sahtenOrders().unshift(o); if (typeof w._saveOrders === 'function') w._saveOrders(); w.SAHTEN.receipts?.enqueue(o, {origin:'online', initial}); } },
    notify: n => { try { w.pushNotification({ type: 'order', source: 'menu-online', sound: n.sound === true, title: n.title, body: n.body }); } catch (e) { /* sin notificaciones */ } },
    refresh: () => { try { if (w.currentPanel === 'mostrador') w.renderMostrador(); } catch (e) { /* */ } },
    storage: config,
  };
  const controller = createController(host);

  const role = () => config.get(roleKey(), null);
  const setRole = r => { config.set(roleKey(), r); applyRole(r, w); };

  const priceMap = S => p => Object.fromEntries(S.channels.filter(c => c.enabled).map(c => [c.id, channelPriceWithDisc(S, p, c.id)]));
  const publicOf = file => { const S = stateFromSahten(file); return toPublicProject(file, priceMap(S), p => pricingQuoteIds(S, p)); };

  function ensureSync() {
    const cl = controller.client; if (!cl) { sync = null; return null; }
    if (sync && sync.__client === cl) return sync;
    if (sync) sync.cancel();
    sync = createSync({
      progress,
      client: cl, remoteId: () => conn().projectId || null, setRemoteId: id => { conn().projectId = id; project.markDirty(); }, role: () => role() || 'owner', projectId: () => session.id,
      collect: () => project.collect(), publicOf,
      prepareFile: (f, report) => controller.prepareFile(f, report), restoreFile: (f, images, report) => controller.restoreFile(f, images, report),
      apply: async f => { await project.apply(f); session.markDirty(); }, store: config,
    });
    sync.__client = cl; sync.onChange(() => ui.render && ui.render()); return sync;
  }

  // cada guardado local programa una sincronización (local primero, nube por detrás)
  session.onChange(i => { if (i.status === 'saved' && sync && !session.readOnly) sync.schedule(); });
  w.addEventListener && w.addEventListener('online', () => { if (sync) sync.sync().catch(() => {}); if (photoPublisher.info().pending) photoPublisher.flush().catch(() => {}); });

  const need = () => { if (!controller.client || !controller.info().signedIn) throw new SupabaseError('Iniciá sesión en la conexión con Supabase primero.', { code: 'no_session' }); return controller.client; };
  const rid = () => { const id = conn().projectId; if (!id) throw new SupabaseError('El proyecto todavía no está en la nube.'); return id; };

  const photoPublisher = createPhotoPublisher({
    publish: async () => {
      const id = session.id;
      if (session.info().hasFile) await session.saveNow();
      if (id !== session.id || !w.MENU_CONFIG?.autoSyncPhotos) throw new SupabaseError('Cambió el proyecto o se desactivó la publicación automática.');
      return controller.syncMenu({ allowed: () => id === session.id && !!w.MENU_CONFIG?.autoSyncPhotos });
    },
    enabled: () => ONLINE_ENABLED && session.isOpen && !!w.MENU_CONFIG?.autoSyncPhotos && controller.info().signedIn && !session.readOnly && !remoteViewing && writeScope(role()) === 'project',
    context: () => session.id + ':' + conn().url + ':' + conn().storeId,
  });
  w.addEventListener && w.addEventListener('sahten:photo', () => photoPublisher.schedule());
  photoPublisher.onChange(() => ui.render());

  const availability = createAvailabilityPublisher({
    publish: (id, available, resumeAt) => controller.setAvailability(id, available, resumeAt),
    context: () => conn()?.storeId && session.id ? JSON.stringify([session.id, conn().url, conn().storeId]) : '',
    enabled: () => !!w.document && ONLINE_ENABLED && session.isOpen && controller.info().signedIn && !session.readOnly && !remoteViewing && writeScope(role()) === 'project',
    store: config,
  });
  const salesPublisher=createAvailabilityPublisher({
    namespace:'sales',publish:(id,available,resumeAt)=>controller.setSalesAvailability(id,available,resumeAt),
    context:()=>conn()?.storeId&&session.id?JSON.stringify([session.id,conn().url,conn().storeId]):'',
    enabled:()=>!!w.document&&ONLINE_ENABLED&&session.isOpen&&controller.info().signedIn&&!session.readOnly&&!remoteViewing&&writeScope(role())==='project',store:config,
  });
  salesPublisher.onChange(info=>{if(info.state==='publicado')readStates();if(w.document){w.SAHTEN.salesAvailability?.renderStatus();ui.renderAvailability();w._moAvailabilityStatus?.();}});
  w.addEventListener('sahten:sales-availability',e=>{if(!conn()?.storeId||session.readOnly||writeScope(role())!=='project')return;const {id,available,resumeAt}=e.detail||{};salesPublisher.set(id,available,resumeAt);});
  let readingStates=false;
  async function readStates(){
    if(readingStates||!w.document||!controller.info().signedIn||!conn()?.storeId||remoteViewing)return;
    readingStates=true;const id=session.id,storeId=conn().storeId;
    try{const remote=await controller.readAvailability();if(!w.document||id!==session.id||storeId!==conn()?.storeId)return;let changed=false;
      for(const row of remote.sales||[]){const p=w.PRODUCTS?.find(p=>p.id===row.id);if(!p||salesPublisher.info().changes[row.id])continue;if(JSON.stringify(row.salesAvailability)!==JSON.stringify(p.salesAvailability)){p.salesAvailability=row.salesAvailability;changed=true;}}
      for(const row of remote.visibility||[]){const p=w.PRODUCTS?.find(p=>p.id===row.id);if(!p||p.recetaOnly||availability.info().changes[row.id]||!w.MENU_CONFIG)continue;const hidden=w.MENU_CONFIG.hiddenProducts||[];if(hidden.includes(row.id)===row.visible){w.MENU_CONFIG.hiddenProducts=row.visible?hidden.filter(x=>x!==row.id):[...hidden,row.id];changed=true;}}
      if(changed){w._saveMenuConfig?.();if(!session.readOnly)project.markDirty();w._moAvailabilityStatus?.();if(w.currentPanel==='mostrador')w.renderMostrador();if(w.currentPanel==='menuonline')w.renderMenuOnline?.();if(w.currentPanel==='productos')w.renderProductos();}
    }catch{/* servidor anterior o desconectado: no cambia el proyecto ni publica datos */}finally{readingStates=false;}
  }
  const stateTimer=w.setInterval(()=>{if(w.document?.visibilityState!=='hidden')readStates();},30000);
  w.addEventListener('beforeunload',()=>{w.clearInterval(stateTimer);availability.cancel();salesPublisher.cancel();});
  w.addEventListener('focus',()=>readStates());
  availability.onChange(() => { if (!w.document) return; ui.renderAvailability(); w._moAvailabilityStatus?.(); });
  w.addEventListener('sahten:availability', e => {
    if (!conn().storeId || session.readOnly || writeScope(role()) !== 'project') return;
    const { id, available, resumeAt } = e.detail || {}; availability.set(id, available, resumeAt);
  });
  w.addEventListener('online', () => {availability.flush().catch(() => {});salesPublisher.flush().catch(() => {});readStates();});

  const api = {
    enabled: ONLINE_ENABLED, controller, role, setRole, conn, photoPublisher, availability, salesPublisher, readStates, progress,
    setAutoPhotos(on) { w.MENU_CONFIG.autoSyncPhotos = !!on; w._saveMenuConfig(); project.markDirty(); if (on) photoPublisher.schedule(); else photoPublisher.cancel(); },
    syncInfo: () => (sync ? sync.info() : { state: 'sin vincular', linked: !!conn().projectId, pending: false, conflict: null, version: null, role: role() }),

    /** Iniciar sesión en una tienda ya configurada (solo email y contraseña) y retomar la sincronización. */
    async signIn(email, password) {
      await controller.signIn(email, password); ensureSync(); availability.resume(); salesPublisher.resume(); readStates();
      if (conn().projectId) sync.sync().catch(() => { /* queda en cola */ });
    },
    /** Cerrar sesión: la conexión de la tienda queda guardada en el proyecto. */
    signOut() { availability.cancel(); salesPublisher.cancel(); photoPublisher.cancel(); controller.signOut(); if (sync) { sync.cancel(); sync = null; } },

    async connect(opts) { const r = await controller.connect({ ...opts, projectId: conn().projectId || null }); ensureSync(); availability.resume(); salesPublisher.resume(); readStates(); return r; },

    /** Subir el proyecto: lo crea en la nube y lo vincula con la tienda (para que el personal vea sus pedidos). */
    async linkProject() {
      const cl = need(); const s = ensureSync();
      const id = await s.link();
      if (conn().storeId) await cl.raw('/rest/v1/stores?id=eq.' + conn().storeId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { project_id: id }, token: await cl.auth.token() });
      setRole('owner'); return id;
    },
    async syncNow() { need(); const result=await ensureSync().sync();await readStates();return result; },
    async resolve(choice) { return ensureSync().resolve(choice); },

    async listRemote() {
      const cl = need(); const tok = await cl.auth.token();
      const [ps, ms] = await Promise.all([cl.raw('/rest/v1/projects?select=id,name,version&order=updated_at.desc', { token: tok }), cl.raw('/rest/v1/project_members?select=project_id,role&user_id=eq.' + cl.auth.user.id, { token: tok })]);
      const roles = Object.fromEntries((ms || []).map(m => [m.project_id, m.role]));
      return (ps || []).map(p => ({ ...p, role: roles[p.id] }));
    },

    /** Abrir un proyecto de la nube según el rol: completo (dueño, admin, lectura) o sin costos (encargado, cajero). */
    async openRemote(id, roleName) {
      const cl = need(); availability.cancel(); salesPublisher.cancel(); photoPublisher.cancel(); if (sync) sync.cancel(); stopView();
      const task = progress.start('Abriendo proyecto de la nube');
      try {
      task.update({ detail: 'Descargando base de datos…' });
      let file;
      if (receivesFullProject(roleName)) { const r = await cl.rpc('get_project_data', { pid: id }); file = clone(r.data); }
      else { const r = await cl.rpc('get_project_public', { pid: id }); file = applyPublicToFile(emptyFile(r.name || 'Proyecto'), r.public); file.project.name = r.name || file.project.name; file.project.id = (r.public.project && r.public.project.id) || undefined; }
      file = await controller.restoreFile(file, {}, task.update); file.online = { ...file.online, supabase: { ...conn(), projectId: id } };
      task.update({ detail: 'Abriendo y guardando el proyecto…' });
      remoteViewing = true;
      try { await session.openText(serialize(file), null, (file.project.name || 'Proyecto') + '.sahten'); } finally { remoteViewing = false; }
      Object.assign(conn(), file.online.supabase);
      setRole(roleName); session.setReadOnly(roleName === 'lectura');
      await controller.resume(); ensureSync();
      if (writeScope(roleName) !== 'none') { try { await sync.sync(); } catch (e) { /* queda en cola */ } }
      availability.resume(); salesPublisher.resume(); readStates(); task.finish(); return true;
      } catch (e) { task.fail(e); throw e; }
    },

    async listMembers() { return need().rpc('list_members', { pid: rid() }); },
    async invite(email, r) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SupabaseError('Escribí un email válido.'); if (!INVITABLE.includes(r)) throw new SupabaseError('Elegí un rol válido para la invitación.'); return need().rpc('invite_member', { pid: rid(), p_email: email, p_role: r }); },
    async setMemberRole(uid, r) { return need().rpc('set_member_role', { pid: rid(), uid, p_role: r }); },
    async removeMember(uid) { return need().rpc('remove_member', { pid: rid(), uid }); },
    async audit(n = 50) { return need().rpc('list_audit', { pid: rid(), lim: n }); },

    /** Vista remota (dueño): una copia de solo lectura que se refresca sola cuando cambia la versión en la nube. */
    async remoteView() {
      const cl = need(); availability.cancel(); salesPublisher.cancel(); photoPublisher.cancel(); if (sync) sync.cancel(); const id = rid(); let version = -1;
      const load = async () => {
        const r = await cl.rpc('get_project_data', { pid: id }); if (r.version === version) return;
        const file = await controller.restoreFile(clone(r.data), w.SAHTEN_IMAGES || {}); file.online = { ...file.online, supabase: { ...conn(), projectId: id } };
        remoteViewing = true;
        try { await session.openText(serialize(file), null, (file.project.name || 'Proyecto') + ' (remoto).sahten'); } finally { remoteViewing = false; }
        version = r.version;
        session.setReadOnly(true); viewBanner(true);
      };
      await load(); stopView();
      viewTimer = setInterval(() => load().catch(() => {}), 10000);
    },
    /** Sale de la vista remota: corta el refresco, cierra la copia y vuelve a la lista de proyectos. */
    exitRemoteView() {
      stopView(); remoteViewing = false; viewBanner(false);
      try { session.close(); } catch (e) { /* */ }
      try { w.SAHTEN.projectUi.showProjects(); } catch (e) { /* */ }
    },
    stopRemoteView() { api.exitRemoteView(); },

    /** Al abrir un proyecto: retoma la conexión y el rol que tenía. */
    async onProjectOpened() {
      api.payments.clear(); availability.cancel(); salesPublisher.cancel();
      if (!ONLINE_ENABLED || remoteViewing) return;
      photoPublisher.cancel(); if (sync) { sync.cancel(); sync = null; }
      stopView(); applyRole(role(), w);
      try { await controller.resume(); if (controller.info().signedIn && conn().projectId) { ensureSync(); sync.sync().catch(() => {}); } availability.resume(); salesPublisher.resume(); readStates(); } catch (e) { availability.resume(); salesPublisher.resume(); /* sin conexión: sigue local */ }
    },
  };
  function stopView() { if (viewTimer) { clearInterval(viewTimer); viewTimer = null; } }
  /** Aviso fijo arriba mientras se mira la copia remota, con la salida a mano. */
  function viewBanner(on) {
    const d = w.document; let b = d.getElementById('remote-view-banner');
    if (!on) { if (b) b.remove(); return; }
    if (b) return;
    const main = d.querySelector('.main'); if (!main) return;
    b = d.createElement('div'); b.id = 'remote-view-banner'; b.className = 'rv-banner'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Vista remota en vivo · solo lectura · se actualiza sola</span><button type="button" class="rv-exit">Salir de la vista remota</button>';
    b.querySelector('.rv-exit').addEventListener('click', () => api.exitRemoteView());
    main.insertBefore(b, main.firstChild);
  }

  const ui = createOnlineUi({ online: api, w });
  api.payments = createPaymentUi({ online: api, w });
  api.ui = ui;
  if (ONLINE_ENABLED) api.userMenu = createUserMenu({ online: api, project, w });
  installRoleGuard(role, events);
  let catalogPublishedAt = null;
  controller.onChange(() => { ui.render(); const at = controller.info().lastSync; if (at && at !== catalogPublishedAt) { catalogPublishedAt = at; availability.resume(); salesPublisher.resume(); } });
  progress.onChange(() => ui.renderProgress());

  // el estado de un pedido importado se avisa a la nube
  events.afterRender('orderSetStatus', id => { const o = (w.sahtenOrders() || []).find(x => x.id === id); if (o && o.remoteId) controller.pushStatus(o).then(ok => { if (!ok && w.document && w.sahtenOrders().includes(o)) w.sahtenToast('Estado guardado en este equipo. Falta sincronizarlo con la tienda; revisá la conexión.', {kind:'error'}); }); });
  return api;
}
