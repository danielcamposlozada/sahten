// ═══════════════════════════════════════════════════════════
// Integración del proyecto (.sahten) con la app: toma el estado de los módulos viejos para guardar
// y vuelca un archivo abierto en ellos. Expone window.SAHTEN.project.
// ═══════════════════════════════════════════════════════════
import { kv } from './kv.js';
import { createSession } from './session.js';
import { createAppConfig } from './appConfig.js';
import { createFsAccessAdapter, fsAccessSupported } from './adapters/fsAccess.js';
import { createDownloadAdapter } from './adapters/download.js';
import { createOpfsBackupStore, createMemoryBackupStore, opfsSupported } from './adapters/backupStores.js';
import { legacyToFile, fileToLegacy, emptyFile, serialize, migrate, fileNameFor } from './schema.js';
import { summarizeDiff, describeDiff } from './diff.js';
import demoJson from './demo.sahten.json';

const w = window;
const clone = v => JSON.parse(JSON.stringify(v));

// ── Imágenes de producto (antes IndexedDB): viven en el proyecto ──
w.SAHTEN_IMAGES = w.SAHTEN_IMAGES || {};
// Conexión online del proyecto (url, anonKey, storeId, slug): va en online.supabase del archivo. Nunca una service key.
w.SAHTEN_SUPABASE = w.SAHTEN_SUPABASE || { url: '', anonKey: '', storeId: '' };

/** Estado de la app → archivo .sahten (sin modifiedAt: lo agrega la sesión). */
function collect() {
  const L = w.collectState();
  L.images = clone(w.SAHTEN_IMAGES);
  L.supabase = clone(w.SAHTEN_SUPABASE);
  L.customization = kv.json('sahten-customization', {});
  L.theme = w.localStorage.getItem('sahten-theme');
  L.notifications = kv.json('sahten_notifications', []);
  L.tabState = kv.json('sahten_v4_data_tabs', {});
  return legacyToFile(L);
}

/** Deja la app en blanco (sin tocar tiers y canales por defecto, que usa el asistente de configuración). */
function resetApp() {
  const clear = a => { if (a) a.length = 0; };
  [w.PRODUCTS, w.INGREDIENTES, w.ENVASES, w.GASTOS_OP, w.GASTOS_S, w.GF_DISC_HISTORY, w.MOVIMIENTOS].forEach(clear);
  [w.STOCK, w.GF_MONTHS, w.SAHTEN_PROJECT, w.projChannelDist, w.projChannelLocked, w.projManualUnits, w.SAHTEN_IMAGES].forEach(o => o && Object.keys(o).forEach(k => delete o[k]));
  Object.keys(w.SAHTEN_SUPABASE).forEach(k => delete w.SAHTEN_SUPABASE[k]); Object.assign(w.SAHTEN_SUPABASE, { url: '', anonKey: '', storeId: '' });
  w.projManualMode = false; w.customTC = 0;
  try { w.activeProjSnapshotId = null; } catch (e) { /* */ }
  kv.silently(() => kv.clear());
  [w.SAHTEN_ORDERS, w.SAHTEN_CUSTOMERS, w.MOSTRADOR_DISCOUNTS, w.MOSTRADOR_PAYMENTS].forEach(clear);
  [typeof w.MENU_CONFIG !== 'undefined' && w.MENU_CONFIG, typeof w.REP !== 'undefined' && w.REP].forEach(o => o && Object.keys(o).forEach(k => delete o[k]));
  if (typeof w.REP !== 'undefined' && w._repDefaults) Object.assign(w.REP, w._repDefaults());
  if (typeof w.MENU_CONFIG !== 'undefined' && w._menuConfigDefaults) Object.assign(w.MENU_CONFIG, w._menuConfigDefaults());   // el menú online vuelve a sus valores de fábrica
}

/** Vuelca un archivo .sahten (ya migrado) en la app. */
async function apply(file, { fresh } = {}) {
  resetApp();
  const demo = w.SAHTEN_DEMO_DATA || {};
  if (fresh) { // proyecto nuevo: tiers y canales de arranque, todo lo demás vacío
    file = clone(file);
    if (!file.catalog.tiers.length && demo.TIERS) file.catalog.tiers = clone(demo.TIERS);
    if (!file.channels.length && demo.CHANNELS) file.channels = clone(demo.CHANNELS);
  }
  const L = fileToLegacy(file);
  kv.silently(() => {
    Object.entries(L.images || {}).forEach(([k, v]) => { w.SAHTEN_IMAGES[k] = v; });
    Object.assign(w.SAHTEN_SUPABASE, L.supabase || {});
    kv.set('sahten-customization', JSON.stringify(L.customization || {}));
    kv.set('sahten_notifications', JSON.stringify(L.notifications || []));
    kv.set('sahten_v4_data_tabs', JSON.stringify(L.tabState || {}));
    w.applyData(L);
  });
  if (L.theme && w.localStorage.getItem('sahten-theme') !== L.theme) { w.localStorage.setItem('sahten-theme', L.theme); try { w.initDarkMode(); } catch (e) { /* */ } }
  try { w.custApply(); } catch (e) { /* */ }
  w.initStock(); w.projWeeks = w.PRODUCTS.map(p => [...(p.weeks || [0, 0, 0, 0])]);
  w._recetasApplied = true;        // las recetas del Excel de v3 no se vuelven a aplicar sobre un proyecto abierto
  w.SAHTEN.state.projection.manualMode = !!w.projManualMode;
  try { w.recalcAll(); } catch (e) { console.warn(e); }
  try { w.showPanel(w.currentPanel || 'dashboard'); } catch (e) { /* */ }
}

function importProjection(file) {
  const snaps = file.projections.snapshots.map(s => ({ ...s, id: Date.now() + Math.floor(Math.random() * 1000), name: (s.name || 'Proyección importada') + ' (importada)' }));
  const cur = kv.json('sahten_proj_snapshots_v1', []);
  kv.set('sahten_proj_snapshots_v1', JSON.stringify([...snaps, ...cur]));
  try { w.renderSavedProjectionsList(); } catch (e) { /* */ }
}

// Navegador (File System Access o descarga) o escritorio (Tauri: archivos reales, respaldos junto al proyecto).
// El entorno de escritorio termina de prepararse después de cargar los módulos, así que se resuelve en cada uso.
const web = {
  adapter: fsAccessSupported(w) ? createFsAccessAdapter(w) : createDownloadAdapter(w),
  backupStore: opfsSupported(w) ? createOpfsBackupStore(w) : createMemoryBackupStore(),
  config: createAppConfig(),
};
const env = () => w.__SAHTEN_DESKTOP || web;
const lazy = key => new Proxy({}, {
  get: (_, k) => { const t = env()[key]; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; },
  set: (_, k, v) => { env()[key][k] = v; return true; },
  has: (_, k) => k in env()[key],
});
const adapter = lazy('adapter'), backupStore = lazy('backupStore'), config = lazy('config');

// Al abrir un proyecto: cierra los meses pasados de gastos fijos, crea el mes en curso y recuerda revisarlo
function onOpened() { try { w.gfmEnsureMonths(); w.gfmRemindToast(); } catch (e) { console.warn(e); } try { w.SAHTEN.online && w.SAHTEN.online.onProjectOpened && w.SAHTEN.online.onProjectOpened(); } catch (e) { console.warn(e); } }

export const session = createSession({ adapter, backupStore, config, collect, apply, importProjection, onOpened });

/** Pizzería de ejemplo (generado con `npm run demo`: punto fijo de guardar → cargar, ver scripts/make-demo.mjs). */
function demoFile() {
  const f = clone(demoJson);
  f.project = { ...f.project }; delete f.project.id;   // cada vez que se abre es un proyecto nuevo
  return f;
}

const toast = msg => (typeof w._posToast === 'function' ? w._posToast(msg) : console.log(msg));
const fail = e => { console.error(e); w.alert(e && e.message ? e.message : String(e)); };

export const project = {
  session, adapter, backupStore, config, collect, apply, demoFile, summarizeDiff, describeDiff,
  /** Los módulos viejos llaman a esto (vía scheduleSave / saveData) cuando algo cambia. */
  markDirty: () => session.markDirty(),
  /** Abrir: un .sahten se abre donde está. Un .json de versiones anteriores se CONVIERTE en un proyecto nuevo y se pide ya dónde guardarlo. */
  async open() {
    try {
      const r = await session.openFromPicker();
      if (r && r.converted) await project.saveConverted();
      return r;
    } catch (e) { fail(e); }
  },
  /** Tras convertir un .json: elegir carpeta y nombre del .sahten (si se cancela, queda «sin guardar» y se puede hacer después). */
  async saveConverted() {
    toast('Copia de seguridad convertida al formato .sahten. Elegí dónde guardarla.');
    const ok = await session.saveAs(fileNameFor(session.name || 'Proyecto'));
    if (ok) toast('Proyecto guardado: ' + (session.info().fileName || ''));
    return ok;
  },
  /** Importar una copia de seguridad (.json de v2/v3) como proyecto NUEVO. */
  async importJson() { return project.open(); },
  /** Reemplazar los datos del proyecto abierto con los de otro archivo (con respaldo previo). */
  async replaceFromFile() {
    try {
      const r = await adapter.open(); if (!r) return null;
      const { migrate } = await import('./schema.js');
      const other = migrate(r.text);
      if (other.kind !== 'project') { w.alert('Ese archivo es una proyección: se agrega desde Proyección › Importar.'); return null; }
      const lines = describeDiff(summarizeDiff(collect(), other.file));
      const el = w.document.getElementById('confirm-text'); if (el) el.style.whiteSpace = 'pre-line';
      return await new Promise(resolve => w.showConfirm('Reemplazar los datos de este proyecto',
        'Se reemplaza TODO el contenido de «' + session.name + '» por el de «' + r.name + '». Antes se guarda un respaldo para deshacerlo (Ajustes › Archivo y respaldo).\n\nCambios:\n' + lines.join('\n'),
        async () => { try { await session.replaceWith(r.text); toast('Datos reemplazados · podés deshacerlo desde Ajustes › Archivo y respaldo'); resolve(true); } catch (e) { fail(e); resolve(false); } },
        () => resolve(false), 'Reemplazar', 'Cancelar'));
    } catch (e) { fail(e); }
  },
  /** Dónde está el archivo y cómo cambiarlo. */
  location: () => ({ ...session.info(), desktop: !!w.SAHTEN.desktop, projectsDir: adapter.projectsDir ? adapter.projectsDir() : '' }),
  async reveal() { const p = session.info().path; if (p && w.SAHTEN.desktop) await w.SAHTEN.desktop.reveal(p); },
  /** Guardar en otra carpeta o con otro nombre (el proyecto pasa a vivir ahí; el archivo anterior no se borra). */
  async changeLocation() { try { const ok = await session.saveAs(); if (ok) toast('Ahora el proyecto se guarda en: ' + (session.info().path || session.info().fileName)); return ok; } catch (e) { fail(e); } },
  async chooseProjectsDir() { try { if (!adapter.pickFolder) return null; const dir = await adapter.pickFolder(); if (dir) { adapter.setProjectsDir(dir); toast('Los proyectos nuevos se proponen en: ' + dir); } return dir; } catch (e) { fail(e); } },
  async openRecent(id) { try { return await session.openRecent(id); } catch (e) { fail(e); } },
  async newProject(name) {
    try {
      await session.newProject(name || 'Proyecto nuevo');
      if (typeof w.sahtenOpenSetup === 'function') w.sahtenOpenSetup();
    } catch (e) { fail(e); }
  },
  async openDemo() { try { await session.openText(serialize(demoFile()), null, 'Pizzería de ejemplo.sahten'); if (w.sahtenTour) setTimeout(() => w.sahtenTour.start(), 400); } catch (e) { fail(e); } },
  async save() { try { const r = await session.saveNow({ force: true }); if (r) toast('Proyecto guardado'); } catch (e) { fail(e); } },
  async saveAs() { try { await session.saveAs(); } catch (e) { fail(e); } },
  async duplicate() { const n = await w.sahtenAsk('Nombre de la copia:', (session.name || 'Proyecto') + ' (copia)'); if (!n) return; try { await session.duplicate(n); toast('Copia creada: ' + n); } catch (e) { fail(e); } },
  async exportCopy() { try { if (await session.exportCopy()) toast('Copia exportada'); } catch (e) { fail(e); } },
  async rename() { const n = await w.sahtenAsk('Renombrar proyecto:', session.name); if (!n || !n.trim()) return; w.SAHTEN_PROJECT.name = n.trim(); session.rename(n.trim()); },
  resetApp,
  backupBeforeImport: () => session.isOpen ? session.backupBeforeStrategy().catch(e => console.warn('Respaldo previo falló', e)) : null,
};
export { migrate, emptyFile };

// Compatibilidad: los módulos viejos preguntan por «el proyecto actual» con estos nombres
w.wsGetCurrent = () => ({ id: session.id || 'proyecto', name: (w.SAHTEN_PROJECT && w.SAHTEN_PROJECT.name) || session.name || 'Proyecto' });
w.wsCurrentId = () => session.id || 'proyecto';
w.wsRename = (id, name) => { if (name) session.rename(name); };
