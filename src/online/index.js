// ═══════════════════════════════════════════════════════════
// Online opcional: une el controlador (pedidos en vivo), la sincronización y los roles con la app.
// Con SAHTEN_ONLINE=false (build) todo esto queda deshabilitado y el panel dice «No disponible en esta versión».
// ═══════════════════════════════════════════════════════════
import { createController } from './controller.js';
import { createSync } from './sync.js';
import { SupabaseError } from './supabase.js';
import { toPublicProject, applyPublicToFile, canSeePanel, receivesFullProject, writeScope } from './roles.js';
import { applyRole, installRoleGuard } from './roleView.js';
import { createOnlineUi } from './ui.js';
import { stateFromSahten } from '../core/projectFile.js';
import { channelPrice } from '../core/index.js';
import { emptyFile, serialize } from '../project/schema.js';
import { onlinePublish } from './app.js';

export const ONLINE_ENABLED = typeof __SAHTEN_ONLINE__ === 'undefined' ? true : !!__SAHTEN_ONLINE__;
const clone = v => JSON.parse(JSON.stringify(v));

export function createOnline({ w = window, project, events }) {
  const session = project.session, config = project.config;
  const conn = () => w.SAHTEN_SUPABASE;
  const roleKey = () => 'online-role:' + (session.id || 'x');
  let sync = null, viewTimer = null, remoteViewing = false;

  const host = {
    conn: new Proxy({}, { get: (_, k) => conn()[k], set: (_, k, v) => { conn()[k] = v; return true; }, ownKeys: () => Reflect.ownKeys(conn()), getOwnPropertyDescriptor: (_, k) => Object.getOwnPropertyDescriptor(conn(), k), deleteProperty: (_, k) => delete conn()[k] }),
    projectId: () => session.id, markDirty: () => project.markDirty(), menuJson: () => onlinePublish.currentMenu(),
    orders: { list: () => w.sahtenOrders(), add: o => { w.sahtenOrders().unshift(o); if (typeof w._saveOrders === 'function') w._saveOrders(); } },
    notify: n => { try { w.pushNotification({ type: 'delivery', source: 'delivery', title: n.title, body: n.body }); } catch (e) { /* sin notificaciones */ } },
    refresh: () => { try { if (w.currentPanel === 'mostrador') w.renderMostrador(); } catch (e) { /* */ } },
    storage: config,
  };
  const controller = createController(host);

  const role = () => config.get(roleKey(), null);
  const setRole = r => { config.set(roleKey(), r); applyRole(r, w); };

  const priceMap = S => p => Object.fromEntries(S.channels.filter(c => c.enabled).map(c => [c.id, channelPrice(S, p, c.id)]));
  const publicOf = file => { const S = stateFromSahten(file); return toPublicProject(file, priceMap(S)); };

  function ensureSync() {
    const cl = controller.client; if (!cl) { sync = null; return null; }
    if (sync && sync.__client === cl) return sync;
    if (sync) sync.cancel();
    sync = createSync({
      client: cl, remoteId: () => conn().projectId || null, setRemoteId: id => { conn().projectId = id; project.markDirty(); }, role: () => role() || 'owner', projectId: () => session.id,
      collect: () => project.collect(), publicOf,
      apply: async f => { await project.apply(f); session.markDirty(); }, store: config,
    });
    sync.__client = cl; sync.onChange(() => ui.render && ui.render()); return sync;
  }

  // cada guardado local programa una sincronización (local primero, nube por detrás)
  session.onChange(i => { if (i.status === 'saved' && sync && !session.readOnly) sync.schedule(); });
  w.addEventListener && w.addEventListener('online', () => { if (sync) sync.sync().catch(() => {}); });

  const need = () => { if (!controller.client || !controller.info().signedIn) throw new SupabaseError('Iniciá sesión en la conexión con Supabase primero.', { code: 'no_session' }); return controller.client; };
  const rid = () => { const id = conn().projectId; if (!id) throw new SupabaseError('El proyecto todavía no está en la nube.'); return id; };

  const api = {
    enabled: ONLINE_ENABLED, controller, role, setRole, conn,
    syncInfo: () => (sync ? sync.info() : { state: 'sin vincular', linked: !!conn().projectId, pending: false, conflict: null, version: null, role: role() }),

    async connect(opts) { const r = await controller.connect({ ...opts, projectId: conn().projectId || null }); ensureSync(); return r; },

    /** Subir el proyecto: lo crea en la nube y lo vincula con la tienda (para que el personal vea sus pedidos). */
    async linkProject() {
      const cl = need(); const s = ensureSync();
      const id = await s.link();
      if (conn().storeId) await cl.raw('/rest/v1/stores?id=eq.' + conn().storeId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { project_id: id }, token: await cl.auth.token() });
      setRole('owner'); return id;
    },
    async syncNow() { need(); return ensureSync().sync(); },
    async resolve(choice) { return ensureSync().resolve(choice); },

    async listRemote() {
      const cl = need(); const tok = await cl.auth.token();
      const [ps, ms] = await Promise.all([cl.raw('/rest/v1/projects?select=id,name,version&order=updated_at.desc', { token: tok }), cl.raw('/rest/v1/project_members?select=project_id,role&user_id=eq.' + cl.auth.user.id, { token: tok })]);
      const roles = Object.fromEntries((ms || []).map(m => [m.project_id, m.role]));
      return (ps || []).map(p => ({ ...p, role: roles[p.id] }));
    },

    /** Abrir un proyecto de la nube según el rol: completo (dueño, admin, lectura) o sin costos (encargado, cajero). */
    async openRemote(id, roleName) {
      const cl = need(); stopView();
      let file, images = {};
      if (receivesFullProject(roleName)) { const r = await cl.rpc('get_project_data', { pid: id }); file = clone(r.data); }
      else { const r = await cl.rpc('get_project_public', { pid: id }); file = applyPublicToFile(emptyFile(r.name || 'Proyecto'), r.public); file.project.name = r.name || file.project.name; file.project.id = (r.public.project && r.public.project.id) || undefined; }
      file.images = images; file.online = { ...file.online, supabase: { ...conn(), projectId: id } };
      remoteViewing = true;
      await session.openText(serialize(file), null, (file.project.name || 'Proyecto') + '.sahten');
      remoteViewing = false;
      Object.assign(conn(), file.online.supabase);
      setRole(roleName); session.setReadOnly(roleName === 'lectura');
      await controller.resume(); ensureSync();
      if (writeScope(roleName) !== 'none') { try { await sync.sync(); } catch (e) { /* queda en cola */ } }
      return true;
    },

    async listMembers() { return need().rpc('list_members', { pid: rid() }); },
    async invite(email, r) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SupabaseError('Escribí un email válido.'); return need().rpc('invite_member', { pid: rid(), p_email: email, p_role: r }); },
    async setMemberRole(uid, r) { return need().rpc('set_member_role', { pid: rid(), uid, p_role: r }); },
    async removeMember(uid) { return need().rpc('remove_member', { pid: rid(), uid }); },
    async audit(n = 50) { return need().rpc('list_audit', { pid: rid(), lim: n }); },

    /** Vista remota (dueño): una copia de solo lectura que se refresca sola cuando cambia la versión en la nube. */
    async remoteView() {
      const cl = need(); const id = rid(); let version = -1;
      const load = async () => {
        const r = await cl.rpc('get_project_data', { pid: id }); if (r.version === version) return; version = r.version;
        const file = clone(r.data); file.online = { ...file.online, supabase: { ...conn(), projectId: id } }; file.images = {};
        remoteViewing = true; await session.openText(serialize(file), null, (file.project.name || 'Proyecto') + ' (remoto).sahten'); remoteViewing = false;
        session.setReadOnly(true);
      };
      await load(); stopView();
      viewTimer = setInterval(() => load().catch(() => {}), 10000);
    },
    stopRemoteView() { stopView(); session.setReadOnly(false); },

    /** Al abrir un proyecto: retoma la conexión y el rol que tenía. */
    async onProjectOpened() {
      if (!ONLINE_ENABLED || remoteViewing) return;
      stopView(); applyRole(role(), w);
      try { await controller.resume(); if (controller.info().signedIn && conn().projectId) { ensureSync(); sync.sync().catch(() => {}); } } catch (e) { /* sin conexión: sigue local */ }
    },
  };
  function stopView() { if (viewTimer) { clearInterval(viewTimer); viewTimer = null; } }

  const ui = createOnlineUi({ online: api, w });
  api.ui = ui;
  installRoleGuard(role, events);
  controller.onChange(() => ui.render());

  // el estado de un pedido importado se avisa a la nube
  events.afterRender('orderSetStatus', id => { const o = (w.sahtenOrders() || []).find(x => x.id === id); if (o && o.remoteId) controller.pushStatus(o); });
  return api;
}
