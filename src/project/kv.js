// ═══════════════════════════════════════════════════════════
// Almacén en memoria de los datos del negocio que los módulos viejos guardaban en localStorage
// (pedidos, clientes, menú online, tienda, reportes, …). Se intercepta localStorage SOLO para esas claves:
// el dato vive en el proyecto (archivo .sahten), no en el navegador.
// La configuración de la app (tema, guías vistas, recientes) sigue yendo a appConfig / localStorage.
// ═══════════════════════════════════════════════════════════

const BUSINESS = [
  'sahten_v4_data', 'sahten_proj_snapshots', 'sahten_active_proj', 'sahten-customization', 'sahten_menu_config', 'sahten_tienda_',
  'sahten_orders', 'sahten_customers', 'sahten_mostrador_discounts', 'sahten_mostrador_payments', 'sahten_report_data',
  'sahten_gf_pages', 'sahten_notifications', 'sahten_tab_state',
];
export const isBusinessKey = k => typeof k === 'string' && BUSINESS.some(p => k === p || k.startsWith(p));

const mem = new Map();
const listeners = new Set();
let muted = 0;
const notify = (key, kind) => { if (!muted) listeners.forEach(fn => { try { fn(key, kind); } catch (e) { console.error(e); } }); };

export const kv = {
  get: k => mem.has(k) ? mem.get(k) : null,
  set(k, v) { const s = String(v); if (mem.get(k) === s) return; mem.set(k, s); notify(k, 'set'); },
  remove(k) { if (mem.delete(k)) notify(k, 'remove'); },
  has: k => mem.has(k),
  keys: () => [...mem.keys()],
  /** JSON de una clave (o el valor por defecto). */
  json(k, dflt) { try { const s = mem.get(k); return s == null ? dflt : JSON.parse(s); } catch (e) { return dflt; } },
  /** Cambia varias claves sin disparar «cambió» (carga de un proyecto). */
  silently(fn) { muted++; try { return fn(); } finally { muted--; } },
  clear() { mem.clear(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/** Redirige localStorage → kv para las claves del negocio. Idempotente. */
export function installBusinessStore(win = window) {
  const proto = win.Storage.prototype;
  if (proto.__sahtenKv) return;
  const get = proto.getItem, set = proto.setItem, rem = proto.removeItem;
  const mine = (self, k) => self === win.localStorage && isBusinessKey(k);
  proto.getItem = function (k) { return mine(this, k) ? kv.get(k) : get.call(this, k); };
  proto.setItem = function (k, v) { return mine(this, k) ? kv.set(k, v) : set.call(this, k, v); };
  proto.removeItem = function (k) { return mine(this, k) ? kv.remove(k) : rem.call(this, k); };
  proto.__sahtenKv = true;
}
