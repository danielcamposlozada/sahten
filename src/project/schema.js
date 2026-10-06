// ═══════════════════════════════════════════════════════════
// Formato de archivo .sahten (JSON) · puro, sin DOM
//
//   format, schemaVersion, appVersion, modifiedAt
//   project      nombre, tipo, moneda, roundTo, estUnitsMonth, targetMargin, online, lastStrategy, strategyLog
//   settings     theme, customization
//   catalog      ingredientes, envases, productos (con absorbeGF y priceAdj), categorias, tiers
//   costs        gastosOp / gastosS (con id), gfMonths, gfDiscHistory, globalCommission, usdRate, customTC
//   channels
//   stock        items, movements
//   sales        orders, customers, discounts, payments, reportData
//   projections  snapshots, activeId, channelDist, channelLocked, manualMode, manualUnits
//   online       menuConfig, tiendaConfig, supabase { url, anonKey, storeId }
//   images       { productId: dataURL }
//   ui           pestañas, vistas y formato de inventario
//
// Mismo formato con o sin online: lo que esta versión no conoce se conserva al guardar (mergeUnknown).
// ═══════════════════════════════════════════════════════════

export const SAHTEN_FORMAT = 'sahten';
export const SCHEMA_VERSION = 2;
export const APP_VERSION = '0.4.3';

const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const arr = v => Array.isArray(v) ? v : [];
const obj = v => isObj(v) ? v : {};
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

const UI_KEYS = ['gfPages', 'gfCurrentTpl', 'gfActiveColumns', 'gfResponsable', 'gfFecha', 'gfTurno', 'gfSupervisor', 'gfSector', 'gfSucursal', 'gfObs',
  'visibleCols', 'ingView', 'ingSearch', 'ingSortVal', 'envSearch', 'envSortVal', 'ventasView', 'stockView', 'movFilter', 'currentPanel', 'tabState', 'notifications'];

export const emptySupabase = () => ({ url: '', anonKey: '', storeId: '' });

/** Archivo vacío válido (todas las secciones presentes). */
export function emptyFile(name = '') {
  return {
    format: SAHTEN_FORMAT, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, modifiedAt: null,
    project: name ? { name } : {},
    settings: { theme: null, customization: {} },
    catalog: { ingredientes: [], envases: [], productos: [], categorias: [], tiers: [] },
    costs: { gastosOp: [], gastosS: [], gfMonths: {}, gfDiscHistory: [], globalCommission: 0, usdRate: 1200, customTC: 0 },
    channels: [],
    stock: { items: {}, movements: [] },
    sales: { orders: [], customers: [], discounts: [], payments: [], reportData: {} },
    projections: { snapshots: [], activeId: null, channelDist: {}, channelLocked: {}, manualMode: false, manualUnits: {} },
    online: { menuConfig: {}, tiendaConfig: {}, supabase: emptySupabase() },
    images: {},
    ui: {},
  };
}

const categoriesOf = products => [...new Set(arr(products).map(p => (p && p.category || '').trim()).filter(Boolean))];

/**
 * Estado «legado» (lo que devuelve collectState(): v2/v3 + extras de v4) → archivo .sahten.
 * `prev` = archivo previo (para conservar secciones/claves que esta versión no conoce).
 */
export function legacyToFile(L, { modifiedAt = null, prev = null } = {}) {
  const f = emptyFile();
  f.modifiedAt = modifiedAt;
  f.project = clone(obj(L.project));
  f.settings = { theme: L.theme ?? null, customization: clone(obj(L.customization)) };
  f.catalog = {
    ingredientes: clone(arr(L.INGREDIENTES)), envases: clone(arr(L.ENVASES)), productos: clone(arr(L.PRODUCTS)),
    categorias: categoriesOf(L.PRODUCTS), tiers: clone(arr(L.TIERS)),
  };
  f.costs = {
    gastosOp: clone(arr(L.GASTOS_OP)), gastosS: clone(arr(L.GASTOS_S)), gfMonths: clone(obj(L.gfMonths)), gfDiscHistory: clone(arr(L.gfDiscHistory)),
    globalCommission: num(L.globalCommission, 0), usdRate: num(L.usdRate, 1200), customTC: num(L.customTC, 0),
  };
  if (num(L.gfDiscPct, 0) > 0) { f.costs.gfDiscPct = num(L.gfDiscPct, 0); f.costs.gfDiscNotes = L.gfDiscNotes || ''; } // descuento único de versiones viejas
  f.channels = clone(arr(L.CHANNELS));
  f.stock = { items: clone(obj(L.STOCK)), movements: clone(arr(L.MOVIMIENTOS)) };
  f.sales = {
    orders: clone(arr(L.orders)), customers: clone(arr(L.customers)), discounts: clone(arr(L.mostradorDiscounts)),
    payments: clone(arr(L.mostradorPayments)), reportData: clone(obj(L.reportData)),
  };
  f.projections = {
    snapshots: clone(arr(L.projSnapshots)), activeId: L.activeProjSnapshotId ?? null, channelDist: clone(obj(L.projChannelDist)),
    channelLocked: clone(obj(L.projChannelLocked)), manualMode: !!L.projManualMode, manualUnits: clone(obj(L.projManualUnits)),
  };
  f.online = { menuConfig: clone(obj(L.menuConfig)), tiendaConfig: clone(obj(L.tiendaConfig)), supabase: { ...emptySupabase(), ...obj(L.supabase) } };
  f.images = clone(obj(L.images));
  f.ui = {};
  UI_KEYS.forEach(k => { if (L[k] !== undefined) f.ui[k] = clone(L[k]); });
  return prev ? mergeUnknown(prev, f) : f;
}

/** Archivo .sahten → estado «legado» que entiende applyData(). */
export function fileToLegacy(file) {
  const f = migrateFile(file).file;
  const c = f.costs, cat = f.catalog, s = f.sales, p = f.projections;
  const L = {
    _version: 3,
    PRODUCTS: clone(cat.productos), INGREDIENTES: clone(cat.ingredientes), ENVASES: clone(cat.envases),
    GASTOS_OP: clone(c.gastosOp), GASTOS_S: clone(c.gastosS), STOCK: clone(f.stock.items), MOVIMIENTOS: clone(f.stock.movements),
    TIERS: clone(cat.tiers), CHANNELS: clone(f.channels),
    projChannelDist: clone(p.channelDist), projChannelLocked: clone(p.channelLocked), projManualMode: !!p.manualMode, projManualUnits: clone(p.manualUnits),
    projSnapshots: clone(p.snapshots), activeProjSnapshotId: p.activeId,
    gfDiscHistory: clone(c.gfDiscHistory), gfMonths: clone(c.gfMonths), project: clone(f.project),
    usdRate: String(c.usdRate), globalCommission: String(c.globalCommission), customTC: c.customTC,
    customers: clone(s.customers), orders: clone(s.orders), mostradorDiscounts: clone(s.discounts), mostradorPayments: clone(s.payments),
    reportData: clone(s.reportData), menuConfig: clone(f.online.menuConfig), tiendaConfig: clone(f.online.tiendaConfig),
    supabase: clone(f.online.supabase), images: clone(f.images), theme: f.settings.theme, customization: clone(f.settings.customization),
  };
  if (c.gfDiscPct) { L.gfDiscPct = c.gfDiscPct; L.gfDiscNotes = c.gfDiscNotes || ''; }
  Object.entries(f.ui || {}).forEach(([k, v]) => { L[k] = clone(v); });
  return L;
}

/** Conserva lo que esta versión no conoce del archivo previo: claves de primer nivel nuevas y online.supabase. */
export function mergeUnknown(prev, next) {
  const out = { ...next };
  Object.keys(prev || {}).forEach(k => { if (!(k in out)) out[k] = clone(prev[k]); });
  if (prev && isObj(prev.online)) {
    out.online = { ...clone(prev.online), ...out.online };
    // lo que el usuario ya configuró (URL, clave, tienda) no se pisa con los vacíos por defecto
    out.online.supabase = { ...emptySupabase(), ...obj(prev.online.supabase), ...Object.fromEntries(Object.entries(obj(next.online && next.online.supabase)).filter(([, v]) => v)) };
  }
  ['settings', 'costs', 'sales', 'projections', 'stock', 'catalog'].forEach(sec => {
    if (isObj(prev && prev[sec]) && isObj(out[sec])) {
      Object.keys(prev[sec]).forEach(k => { if (!(k in out[sec])) out[sec][k] = clone(prev[sec][k]); });
    }
  });
  return out;
}

// ── Migraciones ──────────────────────────────────────────
const MIGRATIONS = {
  // v1 (Fase A: solo catálogo, costos y canales) → v2 (todas las secciones)
  1: f => {
    const base = emptyFile();
    const out = { ...base, ...f };
    ['settings', 'catalog', 'costs', 'stock', 'sales', 'projections', 'online'].forEach(k => { out[k] = { ...base[k], ...obj(f[k]) }; });
    out.online.supabase = { ...emptySupabase(), ...obj(out.online.supabase) };
    out.catalog.categorias = out.catalog.categorias.length ? out.catalog.categorias : categoriesOf(out.catalog.productos);
    out.images = obj(f.images); out.ui = obj(f.ui);
    return out;
  },
};

function migrateFile(file) {
  let f = clone(file); const notes = [];
  let v = Number.isInteger(f.schemaVersion) ? f.schemaVersion : 1;
  if (v > SCHEMA_VERSION) notes.push(`El archivo se guardó con una versión más nueva de Sahten (esquema ${v}). Se abre igual y se conserva lo que esta versión no conoce.`);
  while (v < SCHEMA_VERSION) { if (MIGRATIONS[v]) f = MIGRATIONS[v](f); v++; notes.push(`Esquema ${v - 1} → ${v}`); }
  f.format = SAHTEN_FORMAT; f.schemaVersion = Math.max(f.schemaVersion || 0, SCHEMA_VERSION);
  return { file: f, notes };
}

const isLegacyState = d => isObj(d) && (Array.isArray(d.PRODUCTS) || Array.isArray(d.INGREDIENTES));
const isSnapshot = d => isObj(d) && typeof d.resultado === 'number' && typeof d.tI === 'number';

/**
 * Acepta: .sahten (cualquier esquema), collectState() de v2/v3 y Proyeccion_*.json.
 * → { kind: 'project'|'projection', file, notes }.  Si no se reconoce, lanza Error con un mensaje para el usuario.
 */
export function migrate(data) {
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { throw new Error('El archivo no es un JSON válido.'); } }
  if (!isObj(data) && !Array.isArray(data)) throw new Error('El archivo no tiene datos de Sahten.');
  if (isObj(data) && data.format === SAHTEN_FORMAT) { const r = migrateFile(data); return { kind: 'project', ...r }; }
  if (isLegacyState(data)) {
    const notes = [`Proyecto de Sahten v${data._version || 2} convertido al formato .sahten`];
    const f = legacyToFile(data, { modifiedAt: null });
    f.project = { ...f.project }; delete f.project.demo;
    return { kind: 'project', file: f, notes };
  }
  const snaps = Array.isArray(data) ? data.filter(isSnapshot) : isSnapshot(data) ? [data] : isObj(data) && Array.isArray(data.snapshots) ? data.snapshots.filter(isSnapshot) : [];
  if (snaps.length) {
    const f = emptyFile(); f.projections.snapshots = clone(snaps);
    return { kind: 'projection', file: f, notes: [`${snaps.length} proyección(es) para agregar al proyecto abierto`] };
  }
  throw new Error('No reconozco este archivo. Sahten abre proyectos .sahten, copias de seguridad de versiones anteriores (.json) y proyecciones exportadas.');
}

// ── Serialización estable ────────────────────────────────
export function serialize(file) { return JSON.stringify(file, null, 1) + '\n'; }

/** Hash del contenido del negocio: ignora modifiedAt, appVersion y la sección ui (vistas/pestañas), que no justifican un guardado. */
export function contentHash(file) {
  const { modifiedAt, appVersion, ui, ...rest } = file; // eslint-disable-line no-unused-vars
  const s = JSON.stringify(rest);
  let h1 = 0x811c9dc5, h2 = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = ((h2 << 5) + h2 + c) | 0; }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + ':' + s.length;
}

/** Nombre de archivo seguro a partir del nombre del proyecto. */
export function fileNameFor(name, ext = 'sahten') {
  const base = String(name || 'Proyecto').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Proyecto';
  return base + '.' + ext;
}
