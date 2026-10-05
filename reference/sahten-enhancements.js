// ═══════════════════════════════════════════════════════
// SAHTEN ENHANCEMENTS — Dark Mode, Tutorial, Animations
// ═══════════════════════════════════════════════════════

// ── WORKSPACES ────────────────────────────────────────
// Each workspace is an isolated data namespace. The user can run
// 2+ projects (e.g. different locales/branches) from the same HTML
// file without their data mixing.
const WS_META_KEY = 'sahten_workspaces';
const WS_CURRENT_KEY = 'sahten_current_workspace';
// Keys that should be namespaced per workspace (data + customization)
// v3: todo lo que es del negocio va por proyecto (pedidos, clientes, menú online, tienda, reportes, etc.)
const WS_NAMESPACED_PREFIXES = ['sahten_v4_data', 'sahten_proj_snapshots', 'sahten_active_proj', 'sahten-customization',
  'sahten_menu_config', 'sahten_tienda_', 'sahten_orders', 'sahten_customers', 'sahten_mostrador_discounts', 'sahten_mostrador_payments',
  'sahten_report_data', 'sahten_gf_pages', 'sahten_notifications', 'sahten_gfm_toast_', 'sahten_tab_state'];
// Keys that stay global (preferences shared across workspaces)
const WS_GLOBAL_KEYS = new Set([WS_META_KEY, WS_CURRENT_KEY, 'sahten-theme']);

function wsList() {
  try {
    const raw = localStorage.getItem(WS_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e){}
  return null;
}
function wsCurrentId() {
  return localStorage.getItem(WS_CURRENT_KEY) || 'default';
}
function wsGetCurrent() {
  const list = wsList() || [];
  const id = wsCurrentId();
  return list.find(w => w.id === id) || list[0] || { id: 'default', name: 'Proyecto principal' };
}
function wsSaveList(list) {
  localStorage.setItem(WS_META_KEY, JSON.stringify(list));
}
function wsKey(originalKey) {
  // No-op for global keys and already-namespaced
  if (WS_GLOBAL_KEYS.has(originalKey)) return originalKey;
  if (originalKey.startsWith('sahten_ws_')) return originalKey;
  if (!WS_NAMESPACED_PREFIXES.some(p => originalKey === p || originalKey.startsWith(p))) return originalKey;
  const id = wsCurrentId();
  if (id === 'default') return originalKey; // default = original keys (back-compat)
  return `sahten_ws_${id}_${originalKey}`;
}

// Monkey-patch Storage prototype so the rest of the app transparently
// reads/writes within the current workspace.
(function patchStorage() {
  const proto = Storage.prototype;
  const origGet = proto.getItem;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  proto.getItem = function(key) {
    if (this === localStorage && typeof key === 'string' && key.startsWith('sahten')) {
      return origGet.call(this, wsKey(key));
    }
    return origGet.call(this, key);
  };
  proto.setItem = function(key, value) {
    if (this === localStorage && typeof key === 'string' && key.startsWith('sahten')) {
      return origSet.call(this, wsKey(key), value);
    }
    return origSet.call(this, key, value);
  };
  proto.removeItem = function(key) {
    if (this === localStorage && typeof key === 'string' && key.startsWith('sahten')) {
      return origRemove.call(this, wsKey(key));
    }
    return origRemove.call(this, key);
  };
  // v3 · migración única: los proyectos secundarios heredan la CONFIGURACIÓN que antes era compartida
  // (menú online, tienda, descuentos, medios de pago). Pedidos, clientes y reportes quedan en el proyecto principal.
  try {
    if (!origGet.call(localStorage, 'sahten_ws_migr_v3')) {
      const list = JSON.parse(origGet.call(localStorage, WS_META_KEY) || '[]');
      const cfgKeys = ['sahten_menu_config', 'sahten_tienda_sahten_v4_data', 'sahten_mostrador_discounts', 'sahten_mostrador_payments'];
      list.filter(w => w.id && w.id !== 'default').forEach(w => cfgKeys.forEach(k => {
        const nk = 'sahten_ws_' + w.id + '_' + k; const v = origGet.call(localStorage, k);
        if (v != null && origGet.call(localStorage, nk) == null) origSet.call(localStorage, nk, v);
      }));
      origSet.call(localStorage, 'sahten_ws_migr_v3', '1');
    }
  } catch (e) {}
})();

function wsInit() {
  let list = wsList();
  if (!list) {
    // First run: create default workspace using whatever data already exists
    list = [{ id: 'default', name: 'Proyecto principal', createdAt: Date.now() }];
    wsSaveList(list);
    localStorage.setItem(WS_CURRENT_KEY, 'default');
  }
  // Ensure current workspace exists
  const curId = wsCurrentId();
  if (!list.find(w => w.id === curId)) {
    localStorage.setItem(WS_CURRENT_KEY, list[0].id);
  }
}

function wsCreate(name) {
  const id = 'ws_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const list = wsList() || [];
  list.push({ id, name: name || `Proyecto ${list.length + 1}`, createdAt: Date.now() });
  wsSaveList(list);
  return id;
}

function wsRename(id, newName) {
  const list = wsList() || [];
  const w = list.find(x => x.id === id);
  if (w) {
    w.name = newName;
    wsSaveList(list);
  }
}

function wsDelete(id) {
  if (id === 'default') {
    alert('No se puede eliminar el proyecto principal.');
    return false;
  }
  const list = wsList() || [];
  if (list.length <= 1) {
    alert('Debe haber al menos un proyecto.');
    return false;
  }
  // Delete all namespaced keys for this workspace
  const prefix = `sahten_ws_${id}_`;
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toDelete.push(k);
  }
  // Use the unpatched removeItem to avoid double-namespacing
  toDelete.forEach(k => Storage.prototype.removeItem.call(localStorage, k));
  // Update list
  const newList = list.filter(w => w.id !== id);
  wsSaveList(newList);
  // If current was deleted, switch to first
  if (wsCurrentId() === id) {
    localStorage.setItem(WS_CURRENT_KEY, newList[0].id);
  }
  return true;
}

function wsSwitch(id) {
  const list = wsList() || [];
  if (!list.find(w => w.id === id)) return;
  localStorage.setItem(WS_CURRENT_KEY, id);
  // Hard reload — the page must restart with the new namespace
  location.reload();
}

// ── DARK MODE ─────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('sahten-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (!saved) localStorage.setItem('sahten-theme', 'light');
  }

  // Inject toggle into sidebar footer
  const sidebarFooter = document.querySelector('.sidebar-footer');
  if (sidebarFooter) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.id = 'theme-toggle-desktop';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>Modo oscuro</span>`;
    btn.onclick = toggleDarkMode;
    sidebarFooter.insertBefore(btn, sidebarFooter.firstChild);
  }

  // Inject toggle into app drawer
  const drawerUsd = document.querySelector('.app-drawer-usd');
  if (drawerUsd) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.id = 'theme-toggle-drawer';
    btn.style.cssText = 'margin:0 16px 8px;width:calc(100% - 32px)';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>Modo oscuro</span>`;
    btn.onclick = toggleDarkMode;
    drawerUsd.parentNode.insertBefore(btn, drawerUsd);
  }
  updateDarkModeButtons();
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sahten-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('sahten-theme', 'dark');
  }
  updateDarkModeButtons();
  // Re-render charts with new colors
  updateChartTheme();
  if (typeof renderDashboard === 'function') {
    try { renderDashboard(); } catch(e) {}
  }
  // Re-render current panel so charts/colors refresh
  if (typeof currentPanel !== 'undefined' && typeof showPanel === 'function') {
    try { showPanel(currentPanel); } catch(e) {}
  }
}

function updateDarkModeButtons() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const sunIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = isDark
      ? `${sunIcon}<span>Modo claro</span>`
      : `${moonIcon}<span>Modo oscuro</span>`;
  });
}

// ── TUTORIAL SYSTEM ───────────────────────────────────
const TUTORIAL_STEPS = {
  dashboard: [
    { sel: '#dash-kpis', title: 'Indicadores clave', text: 'Resumen rápido: cantidad de productos, margen promedio, gastos fijos por producto, tipo de cambio USD y más.' },
    { sel: '.chart-card.full-chart', title: 'Gráfico de precios', text: 'Compará el precio final de cada producto en todos los canales activos. Hacé clic en la leyenda para activar/desactivar canales.' },
    { sel: '#chart-margins', title: 'Márgenes por producto', text: 'Visualizá la ganancia bruta de cada producto. Verde = bueno (≥45%), amarillo = aceptable (≥30%), rojo = bajo (<30%).' },
    { sel: '#chart-gf', title: 'Gastos fijos', text: 'Distribución de gastos fijos entre operativos y sueldos. Este total se divide entre los productos.' },
  ],
  productos: [
    { sel: '.panel-toolbar', title: 'Barra de herramientas', text: 'Buscá productos, cambiá la vista (tabla/grilla), ordená y filtrá. Usá "Columnas" para elegir qué datos mostrar.' },
    { sel: '.ptb-actions', title: 'Acciones', text: '"Columnas" te permite personalizar las columnas visibles. "+ Agregar" crea un nuevo producto.' },
    { sel: '#prod-tbody', title: 'Tabla de productos', text: 'Cada fila es un producto. Hacé clic en el nombre para ver el detalle completo con receta, costos y precios por canal.' },
  ],
  proyeccion: [
    { sel: '.info-banner', title: '¿Qué es la Proyección?', text: 'Estimá tus ingresos mensuales. Podés usar las unidades de Ventas+GF o ingresar valores manuales por producto.' },
    { sel: '.proj-controls', title: 'Controles', text: 'Configurá el total de gastos fijos y la fuente de unidades (Ventas+GF o Manual).' },
    { sel: '#proj-channel-dist', title: 'Distribución por canal', text: 'Ajustá qué porcentaje de ventas va por cada canal. Los sliders se distribuyen automáticamente al 100%.' },
  ],
  ventas: [
    { sel: '.info-banner', title: 'Ventas + Gastos Fijos', text: 'El GF por producto se calcula como GF Total ÷ unidades mensuales. Los productos ⭐ definen la base de cálculo.' },
    { sel: '#ventas-gf-summary', title: 'Resumen GF', text: 'Muestra el total de gastos fijos, el costo promedio por producto y el estado de asignación.' },
    { sel: '.view-btns', title: 'Vista', text: 'Alterná entre vista de grilla (tarjetas) o lista para editar las unidades mensuales de cada producto.' },
  ],
  stock: [
    { sel: '.s2-topbar', title: 'Control de stock', text: 'Buscá ingredientes, filtrá por estado y registrá ingresos o retiros de stock.' },
    { sel: '.s2-kpi-strip', title: 'Indicadores', text: 'Resumen rápido: total de ingredientes, stock OK, stock bajo y sin stock.' },
    { sel: '.s2-btn-ingreso', title: 'Registrar ingreso', text: 'Registrá la compra o ingreso de ingredientes al stock.' },
    { sel: '.s2-btn-retirar', title: 'Retirar stock', text: 'Registrá el uso interno, merma o devolución de ingredientes.' },
  ],
  ingredientes: [
    { sel: '.info-banner', title: 'Base de ingredientes', text: 'Acá editás los precios de todos los ingredientes. Los cambios se reflejan automáticamente en los costos de receta.' },
    { sel: '.panel-toolbar', title: 'Herramientas', text: 'Buscá ingredientes, cambiá la vista (grilla/tabla) y agregá nuevos ingredientes con "+ Nuevo".' },
  ],
  envases: [
    { sel: '.info-banner', title: 'Envases y papelería', text: 'Editá nombre, precio de paquete y cantidad. El precio unitario se calcula automáticamente.' },
    { sel: '.panel-toolbar', title: 'Herramientas', text: 'Buscá, cambiá la vista y agregá nuevos envases.' },
  ],
  costreceta: [
    { sel: '.info-banner', title: 'Costo de Receta', text: 'Espacio de trabajo interno. Las recetas creadas acá no aparecen en el Menú salvo que actives "Mostrar en Menú".' },
    { sel: '#dash-cr-kpis', title: 'Indicadores', text: 'Productos totales, costo promedio, el más costoso y tipo de cambio actual.' },
    { sel: '#cr-list', title: 'Lista de recetas', text: 'Hacé clic en cualquier producto para expandir su receta completa con ingredientes y envases.' },
  ],
  canales: [
    { sel: '.info-banner', title: 'Canales de venta', text: 'El Mostrador define el precio base. Los demás canales aplican un sobrecargo para cubrir la comisión de plataforma.' },
    { sel: '#channel-grid', title: 'Configuración de canales', text: 'Cada tarjeta es un canal. Activá/desactivá, ajustá el sobrecargo y la comisión de cada plataforma.' },
  ],
  gastos: [
    { sel: '.commission-panel', title: 'Comisión global', text: 'Porcentaje que se suma al precio final de todos los canales. Útil para comisiones de personal o ajustes de temporada.' },
    { sel: '#gf-operativos', title: 'Gastos operativos', text: 'Alquiler, servicios, insumos... todos los gastos mensuales fijos del local.' },
    { sel: '#gf-sueldos', title: 'Sueldos', text: 'Sueldos del personal. Se suman al total de gastos fijos que se divide entre productos.' },
  ],
  ajustes: [
    { sel: '.info-banner', title: 'Ajustes de ganancia', text: 'Factor 1.30 = 30% de ganancia sobre el costo. Se aplica después de sumar los gastos fijos.' },
    { sel: '#tier-grid', title: 'Tiers de ajuste', text: 'Cada tier aplica un factor de ganancia diferente. Asigná cada producto al tier que corresponda.' },
  ],
  wiki: [
    { sel: '.wk-hero', title: 'Guía de uso', text: 'Tutorial completo de Sahten. Navegá las secciones para entender cada parte del sistema.' },
  ],
};

let tutActive = false;
let tutSteps = [];
let tutIndex = 0;
let tutOverlay = null;

function initTutorial() {
  // Add tutorial "?" button next to page title
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    const btn = document.createElement('button');
    btn.className = 'tutorial-btn';
    btn.id = 'tutorial-trigger';
    btn.innerHTML = '?';
    btn.title = 'Tutorial de esta sección';
    btn.onclick = startTutorial;
    pageTitle.insertAdjacentElement('afterend', btn);
  }
}

function startTutorial() {
  const panelName = typeof currentPanel !== 'undefined' ? currentPanel : 'dashboard';
  tutSteps = (TUTORIAL_STEPS[panelName] || []).filter(step => {
    const el = document.querySelector(step.sel);
    return el && el.offsetParent !== null;
  });
  if (tutSteps.length === 0) {
    // Fallback: show a message
    alert('No hay tutorial disponible para esta sección.');
    return;
  }
  tutIndex = 0;
  tutActive = true;
  createTutOverlay();
  showTutStep();
}

function createTutOverlay() {
  if (tutOverlay) tutOverlay.remove();
  tutOverlay = document.createElement('div');
  tutOverlay.className = 'tut-overlay';
  tutOverlay.innerHTML = `
    <div class="tut-spotlight" id="tut-spotlight"></div>
    <div class="tut-tooltip" id="tut-tooltip">
      <div class="tut-tooltip-title" id="tut-title"></div>
      <div class="tut-tooltip-text" id="tut-text"></div>
      <div class="tut-tooltip-actions">
        <div class="tut-tooltip-step" id="tut-step-counter"></div>
        <div class="tut-tooltip-btns">
          <button class="tut-btn tut-btn-skip" id="tut-btn-skip" onclick="endTutorial()">Salir</button>
          <button class="tut-btn tut-btn-prev" id="tut-btn-prev" onclick="tutPrev()">← Anterior</button>
          <button class="tut-btn tut-btn-next" id="tut-btn-next" onclick="tutNext()">Siguiente →</button>
        </div>
      </div>
    </div>`;
  // Click backdrop to close
  tutOverlay.addEventListener('click', (e) => {
    if (e.target === tutOverlay) endTutorial();
  });
  document.body.appendChild(tutOverlay);
}

function showTutStep() {
  if (!tutActive || !tutOverlay) return;
  const step = tutSteps[tutIndex];
  const el = document.querySelector(step.sel);
  if (!el) { tutNext(); return; }

  // Scroll element into view
  const mainEl = document.querySelector('.main');
  const rect = el.getBoundingClientRect();
  const mainRect = mainEl ? mainEl.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  
  if (rect.top < mainRect.top + 60 || rect.bottom > mainRect.bottom - 20) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => positionTutElements(step, el), 450);
  } else {
    positionTutElements(step, el);
  }
}

function positionTutElements(step, el) {
  const rect = el.getBoundingClientRect();
  const pad = 8;
  const spotlight = document.getElementById('tut-spotlight');
  const tooltip = document.getElementById('tut-tooltip');
  
  // Position spotlight
  spotlight.style.top = (rect.top - pad) + 'px';
  spotlight.style.left = (rect.left - pad) + 'px';
  spotlight.style.width = (rect.width + pad * 2) + 'px';
  spotlight.style.height = (rect.height + pad * 2) + 'px';
  
  // Update content
  document.getElementById('tut-title').textContent = step.title;
  document.getElementById('tut-text').textContent = step.text;
  document.getElementById('tut-step-counter').textContent = `${tutIndex + 1} / ${tutSteps.length}`;
  
  // Show/hide prev button
  document.getElementById('tut-btn-prev').style.display = tutIndex === 0 ? 'none' : 'inline-flex';
  const nextBtn = document.getElementById('tut-btn-next');
  nextBtn.textContent = tutIndex === tutSteps.length - 1 ? 'Finalizar ✓' : 'Siguiente →';
  
  // Position tooltip
  const tooltipW = 340;
  const tooltipH = tooltip.offsetHeight || 180;
  let tTop, tLeft;
  
  // Try below the element
  if (rect.bottom + pad + tooltipH + 20 < window.innerHeight) {
    tTop = rect.bottom + pad + 12;
    tLeft = Math.max(12, Math.min(rect.left, window.innerWidth - tooltipW - 12));
  }
  // Try above
  else if (rect.top - pad - tooltipH - 12 > 0) {
    tTop = rect.top - pad - tooltipH - 12;
    tLeft = Math.max(12, Math.min(rect.left, window.innerWidth - tooltipW - 12));
  }
  // Default: center bottom
  else {
    tTop = window.innerHeight - tooltipH - 20;
    tLeft = Math.max(12, (window.innerWidth - tooltipW) / 2);
  }
  
  tooltip.style.top = tTop + 'px';
  tooltip.style.left = tLeft + 'px';
  tooltip.style.maxWidth = Math.min(tooltipW, window.innerWidth - 24) + 'px';
  tooltip.style.animation = 'none';
  tooltip.offsetHeight; // reflow
  tooltip.style.animation = 'tutTooltipIn 0.3s cubic-bezier(0.25,0.46,0.45,0.94) both';
}

function tutNext() {
  if (tutIndex >= tutSteps.length - 1) { endTutorial(); return; }
  tutIndex++;
  showTutStep();
}

function tutPrev() {
  if (tutIndex <= 0) return;
  tutIndex--;
  showTutStep();
}

function endTutorial() {
  tutActive = false;
  if (tutOverlay) {
    tutOverlay.style.opacity = '0';
    tutOverlay.style.transition = 'opacity 0.25s';
    setTimeout(() => { if (tutOverlay) { tutOverlay.remove(); tutOverlay = null; } }, 250);
  }
}

// Keyboard navigation for tutorial
document.addEventListener('keydown', (e) => {
  if (!tutActive) return;
  if (e.key === 'Escape') endTutorial();
  if (e.key === 'ArrowRight' || e.key === 'Enter') tutNext();
  if (e.key === 'ArrowLeft') tutPrev();
});

// ── MOBILE: HIDE DESKTOP-ONLY FEATURES ────────────────
function initMobileHides() {
  // Mark desktop-only elements
  const colBtn = document.getElementById('col-toggle-btn');
  if (colBtn) colBtn.closest('.ptb-col-btn')?.classList.add('hide-mobile');
}

// ── PERSONALIZATION ───────────────────────────────────
const PALETTES = [
  { id: 'sahten',   name: 'Sahten',    sub: 'Por defecto',  primary: '#235328', primaryDark: '#1a3e1f', primaryLight: '#2e6b35', accent: '#F28C00', accentLight: '#ffa733' },
  { id: 'midnight', name: 'Medianoche',sub: 'Azul y coral', primary: '#0d2a4a', primaryDark: '#091e36', primaryLight: '#163b66', accent: '#FF6B6B', accentLight: '#ff8585' },
  { id: 'forest',   name: 'Bosque',    sub: 'Verde y miel', primary: '#1f4636', primaryDark: '#15302a', primaryLight: '#2a5e48', accent: '#E8A53D', accentLight: '#f4b955' },
  { id: 'wine',     name: 'Vino',      sub: 'Burdeos y crema', primary: '#5C1D2E', primaryDark: '#421422', primaryLight: '#76263b', accent: '#D4A574', accentLight: '#e0b88c' },
  { id: 'lavender', name: 'Lavanda',   sub: 'Violeta y menta', primary: '#4A3B6B', primaryDark: '#332953', primaryLight: '#605082', accent: '#4ECDC4', accentLight: '#65d6cf' },
  { id: 'cafe',     name: 'Café',      sub: 'Tierra y caramelo', primary: '#3E2723', primaryDark: '#2a1a18', primaryLight: '#5d4037', accent: '#D49960', accentLight: '#dfac7a' },
  { id: 'slate',    name: 'Pizarra',   sub: 'Gris y esmeralda', primary: '#2C3E50', primaryDark: '#1a2530', primaryLight: '#3d556e', accent: '#10B981', accentLight: '#34c89a' },
  { id: 'cherry',   name: 'Cereza',    sub: 'Rojo y rosa',  primary: '#8B1A2B', primaryDark: '#6a1421', primaryLight: '#a82838', accent: '#FF9EC4', accentLight: '#ffb1d0' },
];

const DEFAULT_CUST = {
  brandName: '',
  brandSub: 'Sistema de Gestión · Beta v0.8',
  logoStyle: 'default', // default | text | upload
  logoData: null,        // base64 if upload
  paletteId: 'sahten',
  customPrimary: null,
  customAccent: null,
  themeMode: 'light',    // 'light' | 'dark' | 'auto' — default is light
};

function custLoad() {
  try {
    const raw = localStorage.getItem('sahten-customization');
    return raw ? { ...DEFAULT_CUST, ...JSON.parse(raw) } : { ...DEFAULT_CUST };
  } catch(e) { return { ...DEFAULT_CUST }; }
}

function custSave(cust) {
  localStorage.setItem('sahten-customization', JSON.stringify(cust));
}

let _cust = custLoad();

function custApply() {
  // 1. Brand name + sub
  applyBrandIdentity(_cust);
  // 2. Palette colors
  applyPaletteColors(_cust);
  // 3. Theme mode
  applyThemeMode(_cust);
}

function applyBrandIdentity(c) {
  const slot = document.getElementById('brand-logo-slot');
  if (!slot) return;
  const sub = c.brandSub || 'Sistema de Gestión · Beta v0.8';

  if (c.logoStyle === 'upload' && c.logoData) {
    slot.innerHTML = `<img class="brand-logo-img" src="${c.logoData}" alt="Logo">
      <div class="logo-sub" id="brand-name-sub">${escapeHtml(sub)}</div>`;
  } else if (c.logoStyle === 'text') {
    const name = c.brandName || 'Sahten';
    slot.innerHTML = `<div class="brand-text-logo">${escapeHtml(name)}</div>
      <div class="logo-sub" id="brand-name-sub">${escapeHtml(sub)}</div>`;
  } else {
    // default Sahten SVG — keep original, just update sub
    if (!slot.querySelector('svg')) {
      // Restore the original logo by reload
      slot.innerHTML = window._originalLogoHTML || slot.innerHTML;
    }
    const subEl = slot.querySelector('#brand-name-sub');
    if (subEl) subEl.textContent = sub;
  }

  // Update preview sidebar logo too
  const prevLogo = document.getElementById('preview-sidebar-logo');
  if (prevLogo) prevLogo.textContent = (c.brandName || 'SAHTEN').toUpperCase();
}

function applyPaletteColors(c) {
  const root = document.documentElement;
  let primary, primaryDark, primaryLight, accent, accentLight;
  if (c.customPrimary || c.customAccent) {
    const base = PALETTES.find(p => p.id === c.paletteId) || PALETTES[0];
    primary = c.customPrimary || base.primary;
    accent = c.customAccent || base.accent;
    primaryDark = shadeColor(primary, -20);
    primaryLight = shadeColor(primary, 20);
    accentLight = shadeColor(accent, 15);
  } else {
    const palette = PALETTES.find(p => p.id === c.paletteId) || PALETTES[0];
    primary = palette.primary;
    primaryDark = palette.primaryDark;
    primaryLight = palette.primaryLight;
    accent = palette.accent;
    accentLight = palette.accentLight;
  }
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-dark', primaryDark);
  root.style.setProperty('--primary-light', primaryLight);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-light', accentLight);
  // RGB triplets for rgba() chaining in CSS rules
  const primaryRgb = hexToRgb(primary);
  if (primaryRgb) {
    root.style.setProperty('--primary-rgb', `${primaryRgb.r},${primaryRgb.g},${primaryRgb.b}`);
  }
  // Sidebar gradient — tinted variants of primary so it tracks palette changes
  root.style.setProperty('--sidebar-start', primaryDark);
  root.style.setProperty('--sidebar-end', shadeColor(primary, -10));

  // ── Dark-mode surface colors derived from primary ──
  // We extract the hue from primary and build a low-saturation, very-dark
  // palette so the dark-mode surfaces visually match the chosen color theme.
  const hsl = hexToHsl(primary);
  if (hsl) {
    const h = hsl.h;
    // Keep saturation low so surfaces stay neutral-ish
    const s = Math.min(hsl.s * 0.35, 25);
    root.style.setProperty('--dark-bg',       hslToHex(h, s, 6));   // body / main bg
    root.style.setProperty('--dark-surface',  hslToHex(h, s, 9));   // cards
    root.style.setProperty('--dark-surface2', hslToHex(h, s, 13));  // input/inner
    root.style.setProperty('--dark-surface3', hslToHex(h, s, 18));  // input focus/hover
    root.style.setProperty('--dark-border',   `hsla(${h}, ${Math.min(s*2, 50)}%, 35%, 0.15)`);
    root.style.setProperty('--dark-border-strong', `hsla(${h}, ${Math.min(s*2, 50)}%, 35%, 0.22)`);
    root.style.setProperty('--dark-border-soft',   `hsla(${h}, ${Math.min(s*2, 50)}%, 35%, 0.08)`);
    root.style.setProperty('--dark-muted',    hslToHex(h, Math.min(s*0.3, 10), 72));
    root.style.setProperty('--dark-text',     hslToHex(h, Math.max(s*0.4, 5), 92));
    root.style.setProperty('--dark-text-soft',hslToHex(h, Math.max(s*0.5, 8), 80));
    root.style.setProperty('--dark-success',  hslToHex(h, Math.min(s*1.5, 50), 65));
    // Sidebar dark — slightly tinted, more visible than -60 shade clipped to black
    const sSidebar = Math.min(hsl.s * 0.6, 45);
    root.style.setProperty('--sidebar-start-dark', hslToHex(h, sSidebar, 7));
    root.style.setProperty('--sidebar-end-dark',   hslToHex(h, sSidebar, 12));
    // Light-mode surface tinting — subtle hue-shift on sand/sand2
    const lightS = Math.min(hsl.s * 0.18, 18);
    root.style.setProperty('--light-tint',  hslToHex(h, lightS, 96));
    root.style.setProperty('--light-tint2', hslToHex(h, lightS, 92));
  } else {
    root.style.setProperty('--sidebar-start-dark', shadeColor(primary, -45));
    root.style.setProperty('--sidebar-end-dark',   shadeColor(primary, -30));
  }

  // Update related computed colors
  const accentRgb = hexToRgb(accent);
  if (accentRgb) {
    root.style.setProperty('--accent-rgb', `${accentRgb.r},${accentRgb.g},${accentRgb.b}`);
  }
  // Update chart colors and re-render charts that are visible
  updateChartTheme();
}

function applyThemeMode(c) {
  if (c.themeMode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('sahten-theme', 'dark');
  } else if (c.themeMode === 'light') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sahten-theme', 'light');
  } else if (c.themeMode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  if (typeof updateDarkModeButtons === 'function') updateDarkModeButtons();
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + Math.round(255 * percent / 100);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100);
  let b = (num & 0x0000FF) + Math.round(255 * percent / 100);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1],16), g: parseInt(result[2],16), b: parseInt(result[3],16) } : null;
}
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let r = rgb.r/255, g = rgb.g/255, b = rgb.b/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = (g-b)/d + (g<b?6:0); break;
      case g: h = (b-r)/d + 2; break;
      case b: h = (r-g)/d + 4; break;
    }
    h /= 6;
  }
  return { h: h*360, s: s*100, l: l*100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const c = l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function escapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ── CHART THEME PATCHING ──────────────────────────────
// Charts use hardcoded `borderColor: 'white'` and default text colors.
// We patch mkChart so charts pick up the current theme automatically,
// and re-render them when the theme changes.
function updateChartTheme() {
  if (typeof Chart === 'undefined') return;
  const root = getComputedStyle(document.documentElement);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  Chart.defaults.color = isDark ? (root.getPropertyValue('--dark-text-soft').trim() || '#d0dbd2') : '#1c1c1e';
  Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  // Re-render all open charts
  if (typeof charts !== 'undefined') {
    Object.values(charts).forEach(ch => {
      try {
        // Patch doughnut border colors
        ch.data.datasets.forEach(ds => {
          if (ds.borderColor === 'white' || ds.borderColor === '#fff' || ds.borderColor === '#ffffff') {
            ds._origBorder = ds._origBorder || ds.borderColor;
            ds.borderColor = isDark ? (root.getPropertyValue('--dark-surface').trim() || '#162019') : 'white';
          }
        });
        ch.update('none');
      } catch(e){}
    });
  }
}

// Patch mkChart to inject theme-aware defaults
(function patchMkChart() {
  if (typeof window.mkChart !== 'function') {
    // mkChart not defined yet — wait and try again
    setTimeout(patchMkChart, 100);
    return;
  }
  const _orig = window.mkChart;
  window.mkChart = function(id, cfg) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const root = getComputedStyle(document.documentElement);
    if (cfg.data && cfg.data.datasets) {
      cfg.data.datasets.forEach(ds => {
        if (ds.borderColor === 'white' || ds.borderColor === '#fff' || ds.borderColor === '#ffffff') {
          ds.borderColor = isDark ? (root.getPropertyValue('--dark-surface').trim() || '#162019') : 'white';
        }
      });
    }
    return _orig(id, cfg);
  };
})();

// ── Personalization UI ──
function renderCustPanel() {
  // Brand inputs
  const nameInput = document.getElementById('cust-brand-name');
  const subInput = document.getElementById('cust-brand-sub');
  if (nameInput) nameInput.value = _cust.brandName || '';
  if (subInput) subInput.value = _cust.brandSub || '';

  // Text preview
  const txtPreview = document.getElementById('cust-text-preview');
  if (txtPreview) {
    const n = (_cust.brandName || 'Aa').trim();
    txtPreview.textContent = n.substring(0, 2);
  }

  // Logo style active
  document.querySelectorAll('.logo-style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === _cust.logoStyle);
  });

  // B&W logo preview
  const bwPreview = document.getElementById('cust-bw-logo-preview');
  const bwRemoveBtn = document.getElementById('cust-bw-logo-remove');
  if (bwPreview) {
    if (_cust.bwLogoData) {
      bwPreview.innerHTML = '<img src="' + _cust.bwLogoData + '" alt="Logo B&N">';
      if (bwRemoveBtn) bwRemoveBtn.style.display = 'inline-flex';
    } else {
      // Show auto-generated B&W preview from current logo
      const slot = document.getElementById('brand-logo-slot');
      let autoPreview = '<span class="bw-logo-empty">Sin logo</span>';
      if (slot) {
        const img = slot.querySelector('img.brand-logo-img');
        const textLogo = slot.querySelector('.brand-text-logo');
        const svg = slot.querySelector('svg');
        if (img) {
          autoPreview = '<img src="' + img.src + '" alt="Logo" style="filter:grayscale(1) contrast(1.3)">';
        } else if (textLogo) {
          autoPreview = '<span style="font-size:16px;font-weight:800;color:#000;letter-spacing:-0.5px">' + escapeHtml(textLogo.textContent) + '</span>';
        } else if (svg) {
          const clone = svg.cloneNode(true);
          clone.style.cssText = 'width:90%;height:auto;max-height:48px;display:block;margin:auto';
          clone.querySelectorAll('path').forEach(el => {
            el.setAttribute('fill', '#000000');
            el.removeAttribute('opacity');
            el.setAttribute('stroke', '#ffffff');
            el.setAttribute('stroke-width', '8');
            el.setAttribute('paint-order', 'stroke');
          });
          autoPreview = clone.outerHTML;
        }
      }
      bwPreview.innerHTML = autoPreview + '<div style="position:absolute;bottom:2px;right:4px;font-size:8px;color:#999;font-weight:600">AUTO</div>';
      bwPreview.style.position = 'relative';
      if (bwRemoveBtn) bwRemoveBtn.style.display = 'none';
    }
  }

  // Palette grid
  const pGrid = document.getElementById('palette-grid');
  if (pGrid) {
    pGrid.innerHTML = PALETTES.map(p => `
      <button class="palette-btn ${p.id === _cust.paletteId && !_cust.customPrimary && !_cust.customAccent ? 'active' : ''}" onclick="custSetPalette('${p.id}')">
        <div class="palette-swatches">
          <div class="palette-swatch" style="background:${p.primary}"></div>
          <div class="palette-swatch" style="background:${p.primaryLight}"></div>
          <div class="palette-swatch" style="background:${p.accent}"></div>
        </div>
        <div>
          <div class="palette-name">${p.name}</div>
          <div class="palette-sub">${p.sub}</div>
        </div>
      </button>`).join('');
  }

  // Color picker values
  const palette = PALETTES.find(p => p.id === _cust.paletteId) || PALETTES[0];
  const curPrimary = _cust.customPrimary || palette.primary;
  const curAccent = _cust.customAccent || palette.accent;
  const cp = document.getElementById('cust-primary');
  const cph = document.getElementById('cust-primary-hex');
  const ca = document.getElementById('cust-accent');
  const cah = document.getElementById('cust-accent-hex');
  if (cp) cp.value = curPrimary;
  if (cph) cph.value = curPrimary.toUpperCase();
  if (ca) ca.value = curAccent;
  if (cah) cah.value = curAccent.toUpperCase();

  // Theme mode active
  const currentMode = _cust.themeMode || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  ['light','dark','auto'].forEach(m => {
    const btn = document.getElementById('cust-mode-' + m);
    if (btn) btn.classList.toggle('active', m === currentMode);
  });
}

function custUpdateName(v) {
  _cust.brandName = v;
  custSave(_cust);
  applyBrandIdentity(_cust);
  // Update text-preview live
  const txtPreview = document.getElementById('cust-text-preview');
  if (txtPreview) txtPreview.textContent = (v || 'Aa').substring(0, 2);
}
function custUpdateSub(v) {
  _cust.brandSub = v;
  custSave(_cust);
  applyBrandIdentity(_cust);
}
function custSetLogoStyle(style) {
  _cust.logoStyle = style;
  if (style !== 'upload') _cust.logoData = null;
  custSave(_cust);
  applyBrandIdentity(_cust);
  document.querySelectorAll('.logo-style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === style);
  });
}
function custHandleLogoUpload(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  if (file.size > 300 * 1024) {
    alert('La imagen es muy grande. Máx 300KB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    _cust.logoData = e.target.result;
    _cust.logoStyle = 'upload';
    custSave(_cust);
    applyBrandIdentity(_cust);
    document.querySelectorAll('.logo-style-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.style === 'upload');
    });
  };
  reader.readAsDataURL(file);
}

// B&W logo for comanda printing
function custHandleBwLogoUpload(ev) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  if (file.size > 300 * 1024) {
    alert('La imagen es muy grande. Máx 300KB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    _cust.bwLogoData = e.target.result;
    custSave(_cust);
    renderCustPanel();
  };
  reader.readAsDataURL(file);
}
function custRemoveBwLogo() {
  _cust.bwLogoData = null;
  custSave(_cust);
  renderCustPanel();
}
function custSetPalette(id) {
  _cust.paletteId = id;
  _cust.customPrimary = null;
  _cust.customAccent = null;
  custSave(_cust);
  applyPaletteColors(_cust);
  renderCustPanel();
}
function custSetCustomColor(which, val) {
  const v = val.trim();
  if (!/^#?[0-9a-f]{6}$/i.test(v.replace('#',''))) return;
  const hex = v.startsWith('#') ? v : '#' + v;
  if (which === 'primary') _cust.customPrimary = hex;
  else _cust.customAccent = hex;
  custSave(_cust);
  applyPaletteColors(_cust);
  // Sync the other input (color vs hex)
  const cp = document.getElementById('cust-primary');
  const cph = document.getElementById('cust-primary-hex');
  const ca = document.getElementById('cust-accent');
  const cah = document.getElementById('cust-accent-hex');
  if (which === 'primary') {
    if (cp) cp.value = hex;
    if (cph) cph.value = hex.toUpperCase();
  } else {
    if (ca) ca.value = hex;
    if (cah) cah.value = hex.toUpperCase();
  }
  // Deactivate palette buttons
  document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
}
function custSetMode(mode) {
  _cust.themeMode = mode;
  custSave(_cust);
  applyThemeMode(_cust);
  renderCustPanel();
}
function custReset() {
  // Also clear B&W logo
  _cust.bwLogoData = null;
  if (!confirm('¿Restablecer toda la personalización? Volverás al tema Sahten original.')) return;
  _cust = { ...DEFAULT_CUST };
  custSave(_cust);
  custApply();
  renderCustPanel();
}
function custExport() {
  const data = JSON.stringify(_cust, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sahten-personalizacion.json';
  a.click();
  URL.revokeObjectURL(url);
}
function custImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      _cust = { ...DEFAULT_CUST, ...data };
      custSave(_cust);
      custApply();
      renderCustPanel();
      alert('Personalización importada correctamente.');
    } catch(err) {
      alert('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Hook into showPanel — when navigating to personalizacion, render the panel
(function() {
  const _origShow = window.showPanel;
  if (!_origShow) return;
  window.showPanel = function(name) {
    _origShow(name);
    if (name === 'personalizacion') {
      setTimeout(renderCustPanel, 150);
    }
    const panel = document.getElementById('panel-' + name);
    if (panel) {
      panel.classList.remove('anim-in');
      void panel.offsetHeight;
      panel.classList.add('anim-in');
      setTimeout(() => panel.classList.remove('anim-in'), 600);
    }
  };
})();

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize workspace system FIRST so all later localStorage calls
  // land in the correct namespace.
  wsInit();

  // Save original logo HTML so we can restore "default" style
  const slot = document.getElementById('brand-logo-slot');
  if (slot) window._originalLogoHTML = slot.innerHTML;

  initDarkMode();
  initTutorial();
  initMobileHides();
  initWorkspaceSwitcher();
  custApply();
  // Apply chart theme after initial paint and palette apply
  setTimeout(updateChartTheme, 200);
});

// ── WORKSPACE SWITCHER UI ─────────────────────────────
function initWorkspaceSwitcher() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  // Don't add if it already exists
  if (document.getElementById('ws-switcher-wrap')) return;
  
  const wrap = document.createElement('div');
  wrap.id = 'ws-switcher-wrap';
  wrap.style.cssText = 'position: relative; display: inline-flex; align-items: center;';
  
  const btn = document.createElement('button');
  btn.className = 'workspace-switcher';
  btn.id = 'workspace-switcher-btn';
  btn.onclick = (e) => { e.stopPropagation(); toggleWorkspaceMenu(); };
  
  const menu = document.createElement('div');
  menu.className = 'workspace-menu';
  menu.id = 'workspace-menu';
  menu.onclick = (e) => e.stopPropagation();
  
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  
  // Insert after tutorial button
  const tutorBtn = document.getElementById('tutorial-trigger');
  if (tutorBtn) {
    tutorBtn.insertAdjacentElement('afterend', wrap);
  } else {
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.insertAdjacentElement('afterend', wrap);
  }
  
  // Click-outside to close
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('workspace-menu');
    if (menu && menu.classList.contains('open') && !wrap.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
  
  renderWorkspaceSwitcher();
}

function renderWorkspaceSwitcher() {
  const btn = document.getElementById('workspace-switcher-btn');
  const menu = document.getElementById('workspace-menu');
  if (!btn || !menu) return;
  
  const current = wsGetCurrent();
  const list = wsList() || [];
  
  btn.innerHTML = `
    <span class="workspace-switcher-dot"></span>
    <span class="ws-name">${escapeHtml(current.name)}</span>
    <svg class="workspace-switcher-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;
  
  menu.innerHTML = `
    <div class="workspace-menu-header">Proyectos · ${list.length}</div>
    <div class="workspace-list">
      ${list.map(w => `
        <div class="workspace-item ${w.id === current.id ? 'active' : ''}" data-id="${w.id}">
          <div class="workspace-switcher-dot" style="background: ${w.id === current.id ? 'var(--accent)' : 'var(--muted)'}; box-shadow: none"></div>
          <div class="workspace-item-name" onclick="${w.id === current.id ? '' : `wsSwitch('${w.id}')`}" style="${w.id === current.id ? 'cursor: default' : 'cursor: pointer'}">
            ${escapeHtml(w.name)}
            <div class="workspace-item-meta">${w.id === 'default' ? 'Principal' : 'Proyecto separado'}</div>
          </div>
          ${w.id === current.id ? `
            <svg class="workspace-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ` : `
            <button class="workspace-item-delete" onclick="wsHandleDelete('${w.id}', event)" title="Eliminar proyecto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          `}
        </div>
      `).join('')}
    </div>
    <div class="workspace-actions">
      <button class="workspace-action-btn" onclick="wsHandleCreate()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo proyecto…
      </button>
      <button class="workspace-action-btn" onclick="wsHandleRename()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Renombrar proyecto actual
      </button>
    </div>
  `;
}

function toggleWorkspaceMenu() {
  const menu = document.getElementById('workspace-menu');
  if (menu) menu.classList.toggle('open');
}

function wsHandleCreate() {
  const name = prompt('Nombre del nuevo proyecto:', `Proyecto ${(wsList() || []).length + 1}`);
  if (!name || !name.trim()) return;
  const id = wsCreate(name.trim());
  if (confirm('Proyecto creado. ¿Cambiar a este proyecto ahora?\n\nLa página se recargará y los datos del proyecto actual se preservarán.')) {
    wsSwitch(id);
  } else {
    renderWorkspaceSwitcher();
  }
}

function wsHandleRename() {
  const cur = wsGetCurrent();
  const name = prompt('Renombrar proyecto:', cur.name);
  if (!name || !name.trim()) return;
  wsRename(cur.id, name.trim());
  renderWorkspaceSwitcher();
}

function wsHandleDelete(id, ev) {
  if (ev) ev.stopPropagation();
  const list = wsList() || [];
  const w = list.find(x => x.id === id);
  if (!w) return;
  if (!confirm(`¿Eliminar el proyecto "${w.name}" y TODOS sus datos?\n\nEsta acción no se puede deshacer.`)) return;
  if (wsDelete(id)) {
    renderWorkspaceSwitcher();
  }
}

// ── RECIPE RENAME (Costo de Receta) ───────────────────
function crRenameRecipe(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  if (typeof showNameModal === 'function') {
    showNameModal('Renombrar receta', 'Nuevo nombre:', p.name, (newName) => {
      if (!newName) return;
      p.name = newName;
      try { if (typeof renderCostReceta === 'function') renderCostReceta(); } catch(e){}
      try { if (typeof renderProductos === 'function') renderProductos(); } catch(e){}
      try { if (typeof renderDashboard === 'function') renderDashboard(); } catch(e){}
      try { if (typeof scheduleSave === 'function') scheduleSave(); } catch(e){}
    });
  } else {
    const newName = prompt('Nuevo nombre de la receta:', p.name);
    if (newName && newName.trim()) {
      p.name = newName.trim();
      if (typeof renderCostReceta === 'function') renderCostReceta();
      if (typeof renderProductos === 'function') renderProductos();
      if (typeof scheduleSave === 'function') scheduleSave();
    }
  }
}

// ── GRID CARD MENU (productos grid view) ──────────────
function openGridCardMenu(idx, btnEl) {
  const portal = document.getElementById('grid-menu-portal');
  if (!portal) return;
  const p = PRODUCTS[idx];
  if (!p) return;
  // Same menu open → close
  if (portal.classList.contains('open') && portal.dataset.idx === String(idx)) {
    closeGridCardMenu();
    return;
  }
  portal.dataset.idx = String(idx);
  const tiers = (typeof TIERS !== 'undefined' ? TIERS : []);
  const isStarred = !!p.star;
  portal.innerHTML = `
    <div class="gm-section">Tier de ganancia</div>
    <div class="gm-tiers">
      ${tiers.map(t => `
        <button class="gm-tier-btn ${p.tier === t.id ? 'active' : ''}"
          onclick="gridCardSetTier(${idx}, '${t.id}')"
          style="${p.tier === t.id ? 'border-color:' + t.color : ''}">
          <span class="gm-tier-id" style="color:${t.color}">${t.id} · ×${t.factor}</span>
          <span class="gm-tier-name">${escapeHtmlSafe(t.name)}</span>
        </button>
      `).join('')}
    </div>
    <div class="gm-divider"></div>
    <button class="gm-item" onclick="gridCardToggleStar(${idx})">
      <svg viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      ${isStarred ? 'Quitar estrella' : 'Marcar estrella'}
      ${isStarred ? '<svg class="gm-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </button>
    <button class="gm-item" onclick="gridCardRename(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Renombrar producto
    </button>
    <button class="gm-item" onclick="gridCardOpenRecipe(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      Editar receta
    </button>
    <button class="gm-item" onclick="gridCardOpenDetail(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Ver detalle
    </button>
    <button class="gm-item" onclick="gridCardDuplicate(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Duplicar producto
    </button>
    <div class="gm-divider"></div>
    <button class="gm-item danger" onclick="gridCardDelete(${idx})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Eliminar producto
    </button>
  `;
  const rect = btnEl.getBoundingClientRect();
  portal.classList.add('open');
  requestAnimationFrame(() => {
    const portalW = portal.offsetWidth;
    const portalH = portal.offsetHeight;
    let left = rect.right - portalW;
    let top = rect.bottom + 6;
    if (top + portalH > window.innerHeight - 8) top = rect.top - portalH - 6;
    if (left < 8) left = 8;
    if (left + portalW > window.innerWidth - 8) left = window.innerWidth - portalW - 8;
    portal.style.top = top + 'px';
    portal.style.left = left + 'px';
  });
}
function closeGridCardMenu() {
  const portal = document.getElementById('grid-menu-portal');
  if (portal) {
    portal.classList.remove('open');
    portal.dataset.idx = '';
  }
}
document.addEventListener('click', (e) => {
  const portal = document.getElementById('grid-menu-portal');
  if (!portal || !portal.classList.contains('open')) return;
  if (portal.contains(e.target)) return;
  if (e.target.closest('.prod-card-menu-btn')) return;
  closeGridCardMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeGridCardMenu();
});

function gridCardSetTier(idx, tierId) {
  if (!PRODUCTS[idx]) return;
  PRODUCTS[idx].tier = tierId;
  closeGridCardMenu();
  if (typeof renderProductos === 'function') renderProductos();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof scheduleSave === 'function') scheduleSave();
}
function gridCardToggleStar(idx) {
  if (!PRODUCTS[idx]) return;
  PRODUCTS[idx].star = !PRODUCTS[idx].star;
  closeGridCardMenu();
  if (typeof renderProductos === 'function') renderProductos();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof scheduleSave === 'function') scheduleSave();
}
function gridCardRename(idx) {
  const p = PRODUCTS[idx];
  if (!p) return;
  closeGridCardMenu();
  if (typeof showNameModal === 'function') {
    showNameModal('Renombrar producto', 'Nuevo nombre:', p.name, (newName) => {
      if (!newName) return;
      p.name = newName;
      if (typeof renderProductos === 'function') renderProductos();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof scheduleSave === 'function') scheduleSave();
    });
  } else {
    const n = prompt('Nuevo nombre:', p.name);
    if (n && n.trim()) { p.name = n.trim(); renderProductos(); scheduleSave(); }
  }
}
function gridCardOpenRecipe(idx) {
  closeGridCardMenu();
  if (typeof openRecipe === 'function') openRecipe(idx);
}
function gridCardOpenDetail(idx) {
  closeGridCardMenu();
  if (typeof openModal === 'function') openModal(idx);
}
function gridCardDuplicate(idx) {
  closeGridCardMenu();
  if (typeof duplicateProduct === 'function') duplicateProduct(idx);
  else if (typeof cloneProduct === 'function') cloneProduct(idx);
  else {
    const src = PRODUCTS[idx];
    if (!src) return;
    const clone = JSON.parse(JSON.stringify(src));
    clone.id = (src.id || 'p') + '_copy_' + Date.now().toString(36);
    clone.name = src.name + ' (copia)';
    PRODUCTS.push(clone);
    if (typeof renderProductos === 'function') renderProductos();
    if (typeof scheduleSave === 'function') scheduleSave();
  }
}
function gridCardDelete(idx) {
  closeGridCardMenu();
  const p = PRODUCTS[idx];
  if (!p) return;
  if (typeof showConfirm === 'function') {
    showConfirm(
      `¿Eliminar "${p.name}"?`,
      'Esta acción no se puede deshacer.',
      () => {
        PRODUCTS.splice(idx, 1);
        if (typeof renderProductos === 'function') renderProductos();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof scheduleSave === 'function') scheduleSave();
      }
    );
  } else if (confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) {
    PRODUCTS.splice(idx, 1);
    if (typeof renderProductos === 'function') renderProductos();
    if (typeof scheduleSave === 'function') scheduleSave();
  }
}

function escapeHtmlSafe(s) {
  return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ── BACKUP / RESTORE ──────────────────────────────────

// Build a consistent backup filename: Sahten_<ProjectOrGlobal>_<YYYY-MM-DD>_<HH-MM>.<ext>
function _backupFilename(opts) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const ext = opts?.ext || 'json';
  const prefix = opts?.prefix || 'Sahten';
  let middle;
  if (opts?.isGlobal) {
    middle = 'Backup_Global';
  } else {
    const name = String(opts?.projectName || 'Proyecto')
      .replace(/[^\w\u00C0-\u017F-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Proyecto';
    middle = name;
  }
  return `${prefix}_${middle}_${date}_${time}.${ext}`;
}
// Expose so legacy Sahten v2.html code can use the same naming convention
window._backupFilename = _backupFilename;

// Read a localStorage value bypassing the workspace-namespace patch
function _rawGet(key) { return Storage.prototype.getItem.call(localStorage, key); }
function _rawSet(key, val) { return Storage.prototype.setItem.call(localStorage, key, val); }
function _rawRemove(key) { return Storage.prototype.removeItem.call(localStorage, key); }

// All sahten-related keys currently in storage, with their raw values
function _collectAllSahtenStorage() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sahten')) {
      out[k] = _rawGet(k);
    }
  }
  return out;
}

// Build the per-workspace data slot from the in-memory state. This is the
// authoritative snapshot for the currently-loaded workspace; we use the
// existing collectState() if present.
function _currentWorkspaceSnapshot() {
  try {
    if (typeof collectState === 'function') return collectState();
  } catch(e) { console.warn('collectState failed', e); }
  return null;
}

// Export ONLY the current project (as JSON) — same shape collectState produces,
// wrapped with a small envelope so we can recognise it on import.
function exportCurrentBackup() {
  try {
    const cur = wsGetCurrent();
    const snap = _currentWorkspaceSnapshot();
    const payload = {
      __sahten_backup__: true,
      type: 'single',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: { id: cur.id, name: cur.name, data: snap }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _backupFilename({ projectName: cur.name });
    a.click();
    URL.revokeObjectURL(a.href);
    _backupToast('Proyecto actual exportado.');
  } catch(e) {
    alert('Error al exportar: ' + e.message);
  }
}

// Export EVERYTHING — every workspace's data + metadata, plus customization.
function exportFullBackup() {
  try {
    const meta = wsList() || [];
    const currentId = wsCurrentId();

    // Make sure the currently-loaded workspace's in-memory state is flushed
    // to its localStorage slot before we read raw values back out.
    if (typeof scheduleSave === 'function') {
      try { scheduleSave(true); } catch(e) {}
    }
    if (typeof saveNow === 'function') {
      try { saveNow(); } catch(e) {}
    }

    // Read raw storage for everything
    const rawStorage = _collectAllSahtenStorage();

    // Also embed the in-memory snapshot of the current workspace as a
    // belt-and-braces redundancy (in case scheduleSave is debounced).
    const liveSnap = _currentWorkspaceSnapshot();

    const payload = {
      __sahten_backup__: true,
      type: 'full',
      version: 1,
      exportedAt: new Date().toISOString(),
      currentWorkspaceId: currentId,
      workspaces: meta,
      storage: rawStorage,
      liveCurrentSnapshot: { id: currentId, data: liveSnap }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _backupFilename({ isGlobal: true });
    a.click();
    URL.revokeObjectURL(a.href);
    _backupToast(`Backup completo descargado (${meta.length} proyecto${meta.length===1?'':'s'}).`);
  } catch(e) {
    alert('Error al exportar backup: ' + e.message);
    console.error(e);
  }
}

// Import either a single-project or full backup file.
function importBackup(ev) {
  const file = ev.target.files && ev.target.files[0];
  // Reset input so the same file can be picked again later
  ev.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || data.__sahten_backup__ !== true) {
        // Maybe it's an old-style raw collectState payload (no envelope).
        if (data && (Array.isArray(data.PRODUCTS) || Array.isArray(data.products))) {
          _importSingleRaw(data);
          return;
        }
        throw new Error('El archivo no parece ser un backup de Sahten.');
      }
      if (data.type === 'full') return _importFullBackup(data);
      if (data.type === 'single') return _importSingleBackup(data);
      throw new Error('Tipo de backup desconocido: ' + data.type);
    } catch (err) {
      alert('No se pudo leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function _importFullBackup(data) {
  const projectCount = (data.workspaces || []).length;
  if (!confirm(
    `¿Restaurar backup completo?\n\n` +
    `Vas a sobreescribir TODOS los proyectos actuales (${(wsList()||[]).length}) ` +
    `con los proyectos del backup (${projectCount}).\n\n` +
    `Esta acción no se puede deshacer.`
  )) return;

  // 1. Remove every existing sahten* key from storage (raw, bypass patch)
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sahten')) toRemove.push(k);
  }
  toRemove.forEach(k => _rawRemove(k));

  // 2. Re-create storage from the backup
  Object.entries(data.storage || {}).forEach(([k, v]) => {
    _rawSet(k, v);
  });

  // 3. Make sure the workspace meta is set
  if (data.workspaces) _rawSet('sahten_workspaces', JSON.stringify(data.workspaces));
  if (data.currentWorkspaceId) _rawSet('sahten_current_workspace', data.currentWorkspaceId);

  _backupToast('Backup restaurado. Recargando…');
  setTimeout(() => location.reload(), 700);
}

function _importSingleBackup(data) {
  const proj = data.project || {};
  const cur = wsGetCurrent();
  if (!confirm(
    `¿Restaurar el proyecto "${proj.name || 'sin nombre'}" en el proyecto activo "${cur.name}"?\n\n` +
    `Los datos actuales de "${cur.name}" se reemplazarán por los del backup.\n\n` +
    `Esta acción no se puede deshacer.`
  )) return;
  _applySingleSnapshot(proj.data);
}

function _importSingleRaw(data) {
  const cur = wsGetCurrent();
  if (!confirm(
    `¿Importar este archivo en el proyecto activo "${cur.name}"?\n\n` +
    `Los datos actuales se reemplazarán.`
  )) return;
  _applySingleSnapshot(data);
}

function _applySingleSnapshot(snap) {
  if (!snap || typeof snap !== 'object') {
    alert('El backup no contiene datos válidos.');
    return;
  }
  try {
    if (typeof applyState === 'function') {
      applyState(snap);
      if (typeof scheduleSave === 'function') scheduleSave(true);
      // Refresh UI
      ['renderDashboard','renderProductos','renderIngredientes','renderEnvases',
       'renderGastos','renderTiers','renderCostReceta','renderProyeccion',
       'renderVentas','renderStock'].forEach(fn => {
        if (typeof window[fn] === 'function') { try { window[fn](); } catch(e){} }
      });
      _backupToast('Proyecto restaurado.');
    } else {
      // Fallback: stash and reload (less ideal — relies on snapshot script)
      _rawSet('sahten_v4_data', JSON.stringify(snap));
      _backupToast('Datos cargados. Recargando…');
      setTimeout(() => location.reload(), 500);
    }
  } catch(e) {
    alert('Error al aplicar el backup: ' + e.message);
  }
}

function _backupToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: var(--primary); color: white;
    padding: 12px 22px; border-radius: 12px;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    z-index: 10000; opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    display: flex; align-items: center; gap: 10px;
  `;
  toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ${msg}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// ── WIPE ALL DATA (double confirmation) ───────────────
function wipeAllData() {
  const overlay = document.createElement('div');
  overlay.className = 'wipe-overlay';
  overlay.innerHTML = `
    <div class="wipe-modal" onclick="event.stopPropagation()">
      <div class="wipe-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="wipe-title">¿Eliminar toda la información?</div>
      <div class="wipe-text">
        Esta acción borrará permanentemente todos los datos del sistema. La aplicación quedará vacía y lista desde cero.
      </div>
      <div class="wipe-summary">
        Se eliminarán:<br>
        • <strong>Todos los productos del menú y sus recetas</strong><br>
        • <strong>Todos los envases y papelería</strong><br>
        • <strong>Gastos fijos y descuentos</strong><br>
        • <strong>Proyecciones guardadas</strong><br>
        • <strong>Unidades manuales y datos de ventas</strong><br>
        <span style="color:var(--muted);font-size:12px">Se conservan: canales, tiers, personalización y modo oscuro.</span>
      </div>
      <div class="wipe-text" style="margin-bottom:8px"><strong>Confirmación de seguridad:</strong> Escribí <code style="background:var(--sand2);padding:2px 8px;border-radius:6px;font-family:'DM Mono',monospace;font-size:13px">ELIMINAR</code> para habilitar el botón.</div>
      <input type="text" class="wipe-confirm-input" id="wipe-confirm-input" placeholder="ELIMINAR" autocomplete="off" oninput="wipeUpdateBtn()">
      <div class="wipe-actions">
        <button class="wipe-btn wipe-btn-cancel" onclick="wipeClose()">Cancelar</button>
        <button class="wipe-btn wipe-btn-confirm" id="wipe-btn-confirm" disabled onclick="wipeExecute()">Borrar todo</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) wipeClose(); });
  document.body.appendChild(overlay);
  window._wipeOverlay = overlay;
  setTimeout(() => document.getElementById('wipe-confirm-input').focus(), 50);
}

function wipeUpdateBtn() {
  const inp = document.getElementById('wipe-confirm-input');
  const btn = document.getElementById('wipe-btn-confirm');
  if (!inp || !btn) return;
  btn.disabled = inp.value.trim().toUpperCase() !== 'ELIMINAR';
}

function wipeClose() {
  if (window._wipeOverlay) {
    window._wipeOverlay.style.opacity = '0';
    window._wipeOverlay.style.transition = 'opacity 0.2s';
    setTimeout(() => { window._wipeOverlay?.remove(); window._wipeOverlay = null; }, 200);
  }
}

function wipeExecute() {
  // Step 2: final confirmation
  const inp = document.getElementById('wipe-confirm-input');
  if (!inp || inp.value.trim().toUpperCase() !== 'ELIMINAR') return;
  
  // Show second confirmation
  const modal = window._wipeOverlay?.querySelector('.wipe-modal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="wipe-icon" style="background:rgba(192,57,43,0.18)">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </div>
    <div class="wipe-title">Última confirmación</div>
    <div class="wipe-text">
      Estás a punto de borrar <strong style="color:var(--red)">TODO</strong> el contenido. Esta acción es <strong>irreversible</strong>.
      Tu información NO se puede recuperar después.
    </div>
    <div class="wipe-summary" style="text-align:center;font-weight:600">
      ¿Continuar y eliminar todo?
    </div>
    <div class="wipe-actions">
      <button class="wipe-btn wipe-btn-cancel" onclick="wipeClose()">No, cancelar</button>
      <button class="wipe-btn wipe-btn-confirm" onclick="wipeFinal()">Sí, eliminar todo</button>
    </div>`;
}

function wipeFinal() {
  try {
    // 1. Empty all data arrays in-place (PRODUCTS is const)
    if (typeof PRODUCTS !== 'undefined') PRODUCTS.length = 0;
    if (typeof ENVASES !== 'undefined') ENVASES.length = 0;
    if (typeof GASTOS_OP !== 'undefined') GASTOS_OP.length = 0;
    if (typeof GASTOS_S !== 'undefined') GASTOS_S.length = 0;
    if (typeof GF_DISC_HISTORY !== 'undefined') GF_DISC_HISTORY.length = 0;
    if (typeof projWeeks !== 'undefined') projWeeks.length = 0;
    if (typeof projManualUnits !== 'undefined') {
      Object.keys(projManualUnits).forEach(k => delete projManualUnits[k]);
    }
    if (typeof STOCK_MOVS !== 'undefined') STOCK_MOVS.length = 0;
    if (typeof window.activeProjSnapshotId !== 'undefined') window.activeProjSnapshotId = null;
    if (typeof activeProjSnapshotId !== 'undefined') {
      try { window.activeProjSnapshotId = null; } catch(e){}
    }
    
    // 2. Clear data-related localStorage keys (preserve personalization + theme)
    const keysToRemove = [
      'sahten_v4_data',
      'sahten_proj_snapshots_v1',
      'sahten_active_proj'
    ];
    keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
    
    // 3. Close modal
    wipeClose();
    
    // 4. Re-render everything
    setTimeout(() => {
      try {
        if (typeof renderProductos === 'function') renderProductos();
        if (typeof renderIngredientes === 'function') renderIngredientes();
        if (typeof renderEnvases === 'function') renderEnvases();
        if (typeof renderGastos === 'function') renderGastos();
        if (typeof renderTiers === 'function') renderTiers();
        if (typeof renderCostReceta === 'function') renderCostReceta();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderProyeccion === 'function') renderProyeccion();
        if (typeof renderVentas === 'function') renderVentas();
        if (typeof renderStock === 'function') renderStock();
        // Show success toast
        showWipeSuccess();
      } catch(e) {
        console.warn('Re-render error:', e);
      }
    }, 250);
    
  } catch(e) {
    alert('Error al borrar datos: ' + e.message);
  }
}

function showWipeSuccess() {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: var(--primary); color: white;
    padding: 14px 22px; border-radius: 14px;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 30px rgba(35,83,40,0.3);
    z-index: 9999;
    display: flex; align-items: center; gap: 10px;
    animation: wipeSlideIn 0.3s ease;
  `;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    Toda la información fue eliminada
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
