// ═══════════════════════════════════════════════════════════
// Roles (puro): qué secciones ve cada uno, si ve costos y si puede editar.
//   owner      todo
//   admin      todo menos usuarios
//   encargado  Mostrador, Stock y Pedidos; sin costos ni márgenes
//   cajero     solo Mostrador
//   lectura    Reportes, Gastos y Proyección (solo mirar)
// La seguridad real está en Supabase (RLS + funciones: ver supabase/schema.sql); esto ordena la pantalla.
// ═══════════════════════════════════════════════════════════
export const ROLES = ['owner', 'admin', 'encargado', 'cajero', 'lectura'];
export const ROLE_LABEL = { owner: 'Dueño', admin: 'Administrador', encargado: 'Encargado', cajero: 'Cajero', lectura: 'Solo lectura' };
export const ROLE_DESC = {
  owner: 'Todo, incluido gestionar usuarios.', admin: 'Todo menos usuarios.', encargado: 'Mostrador, Stock y Pedidos. No ve costos ni márgenes.',
  cajero: 'Solo el Mostrador.', lectura: 'Reportes, Gastos y Proyección, sin poder cambiar nada.',
};
export const INVITABLE = ['admin', 'encargado', 'cajero', 'lectura'];

const ALL = null; // null = sin restricción
export const PANELS = { owner: ALL, admin: ALL, encargado: ['mostrador', 'stock'], cajero: ['mostrador'], lectura: ['reportes', 'gastos', 'proyeccion'] };
const USERS_PANEL = 'usuarios';

export const canSeePanel = (role, panel) => !role || (PANELS[role] === ALL ? (panel !== USERS_PANEL || role === 'owner') : PANELS[role].includes(panel));
export const firstPanel = role => (!role || PANELS[role] === ALL ? 'dashboard' : PANELS[role][0]);
export const canSeeCosts = role => !role || ['owner', 'admin', 'lectura'].includes(role);
export const canEdit = role => !role || role !== 'lectura';
export const canManageUsers = role => !role || role === 'owner';
/** Qué parte del proyecto escribe cada rol en la nube: todo / solo pedidos y stock / solo pedidos / nada. */
export const writeScope = role => ({ owner: 'project', admin: 'project', encargado: 'ops', cajero: 'sales', lectura: 'none' }[role] || 'project');
/** ¿Recibe el proyecto completo (con costos) o la versión pública? */
export const receivesFullProject = role => ['owner', 'admin', 'lectura'].includes(role);

/** CSS que oculta costos y márgenes para los roles sin acceso (la data ya viaja sin costos; esto limpia columnas y tarjetas). */
export const NO_COSTS_CSS = `
body.role-no-costs [data-sec="costs"], body.role-no-costs [data-col="margen"], body.role-no-costs [data-col="costo"], body.role-no-costs .kpi-costs,
body.role-no-costs #nav-gastos, body.role-no-costs #nav-ingredientes, body.role-no-costs #nav-envases, body.role-no-costs #nav-costreceta { display: none !important; }
body.role-readonly .panel input, body.role-readonly .panel select, body.role-readonly .panel textarea, body.role-readonly .panel button:not(.rep-tab):not(.rep-subtab):not(.nav-keep) { pointer-events: none; opacity: .72; }
.role-banner { position: sticky; top: 0; z-index: 30; background: var(--accent, #F28C00); color: #fff; font-size: 12px; font-weight: 700; padding: 6px 14px; text-align: center; }
`;

/** Productos públicos: sin costos, con los precios ya calculados por canal. */
export function toPublicProject(file, priceOf) {
  const prods = file.catalog.productos.filter(p => !p.recetaOnly).map(p => ({
    id: p.id, name: p.name, category: p.category || '', star: !!p.star, avgMes: undefined, tier: undefined,
    fixedPrices: priceOf(p), porciones: 1, ingredients: [], packaging: [], combos: [],
  }));
  return {
    project: { name: file.project.name, currencySymbol: file.project.currencySymbol, roundTo: file.project.roundTo, locale: file.project.locale, id: file.project.id },
    products: prods,
    channels: file.channels.map(c => ({ id: c.id, name: c.name, enabled: c.enabled, surcharge: 0, commission: 0 })),   // sin comisiones ni recargos
    sales: { discounts: file.sales.discounts, payments: file.sales.payments, customers: file.sales.customers },
    online: { menuConfig: file.online.menuConfig, tiendaConfig: file.online.tiendaConfig },
  };
}

/** Versión pública (sin costos) → archivo local de un encargado / cajero: conserva sus pedidos y stock. */
export function applyPublicToFile(local, pub) {
  const f = JSON.parse(JSON.stringify(local));
  f.project = { ...f.project, ...pub.project };
  f.catalog = { ...f.catalog, productos: pub.products, ingredientes: [], envases: [], tiers: f.catalog.tiers || [], categorias: [...new Set(pub.products.map(p => p.category).filter(Boolean))] };
  f.channels = pub.channels;
  f.costs = { ...f.costs, gastosOp: [], gastosS: [], gfMonths: {} };
  f.sales = { ...f.sales, discounts: pub.sales.discounts || [], payments: pub.sales.payments || [], customers: f.sales.customers.length ? f.sales.customers : (pub.sales.customers || []) };
  f.online = { ...f.online, menuConfig: pub.online.menuConfig || {}, tiendaConfig: pub.online.tiendaConfig || {} };
  return f;
}
