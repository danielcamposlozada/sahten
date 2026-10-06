// ═══════════════════════════════════════════════════════════
// Sahten · punto de entrada
// 1) estilos  2) núcleo + estado + puente  3) código legado como scripts clásicos
//    (mismas variables globales que v3 para los onclick="…" del HTML)  4) módulos por panel
// ═══════════════════════════════════════════════════════════
import './styles/app.css';
import './styles/sahten-enhancements.css';
import './styles/sahten-mostrador.css';
import './styles/sahten-reportes.css';
import './styles/sahten-menuonline.css';
import './styles/sahten-projects.css';

import { initDesktop, isTauri } from './desktop/preload.js';
import { libs } from './libs.js';
import { sahtenAsk } from './ui/ask.js';
import { installTour } from './ui/tour.js';
import { installDesktop } from './desktop/integration.js';
import { state } from './core/state.js';
import './bridge/legacy-globals.js';
import { bindSettingInputs } from './bridge/legacy-globals.js';
import { instrument } from './events.js';
import { registerModules } from './modules/index.js';
import { installBusinessStore } from './project/kv.js';
import { project } from './project/app.js';
import { APP_VERSION } from './project/schema.js';
import { projectUi } from './project/ui.js';
import { onlinePublish } from './online/app.js';
import { createOnline } from './online/index.js';
import { events } from './events.js';

import appJs from './legacy/app.js?raw';
import appLateJs from './legacy/app-late.js?raw';
import notificationsJs from './legacy/sahten-notifications.js?raw';
import enhancementsJs from './legacy/sahten-enhancements.js?raw';
import mostradorJs from './legacy/sahten-mostrador.js?raw';
import tiendaJs from './legacy/sahten-tienda.js?raw';
import menuonlineJs from './legacy/sahten-menuonline.js?raw';
import categoriesJs from './legacy/sahten-categories.js?raw';
import reportesJs from './legacy/sahten-reportes.js?raw';
import setupJs from './legacy/sahten-setup.js?raw';
import estrategiaJs from './legacy/sahten-estrategia.js?raw';
import uxJs from './legacy/sahten-ux.js?raw';

/** Ejecuta un archivo legado como script clásico (queda en el ámbito global, como en v3). */
function runClassic(name, code) {
  const el = document.createElement('script');
  el.textContent = code + '\n//# sourceURL=sahten-legacy/' + name;
  document.head.appendChild(el);
  el.remove();
}

// Registro de ganchos antes de que carguen los scripts: los módulos solo declaran
// qué quieren escuchar; las funciones se envuelven una sola vez después de cargar app.js.
// Los datos del negocio de los módulos viejos pasan a memoria (van al archivo .sahten), antes de que carguen
installBusinessStore();
window.SAHTEN.project = project;
window.SAHTEN.libs = libs;
window.sahtenAsk = sahtenAsk;     // reemplaza al diálogo nativo de pregunta, que no existe en la app de escritorio
// Aviso cuando no hay internet: el mapa (OpenStreetMap) y la búsqueda de direcciones (Nominatim) lo necesitan
window.sahtenOfflineNotice = () => (navigator.onLine === false ? '<div style="font-size:11px;margin-top:6px;padding:7px 9px;border-radius:8px;background:rgba(242,140,0,.12);color:var(--ink)">Sin internet: el mapa y la búsqueda de direcciones no están disponibles. Cargá el envío a mano.</div>' : '');
window.addEventListener('online', () => { try { if (window.currentPanel === 'mostrador') window.renderMostrador(); } catch (e) { /* */ } });
window.addEventListener('offline', () => { try { if (window.currentPanel === 'mostrador') window.renderMostrador(); } catch (e) { /* */ } });
window.SAHTEN.projectUi = projectUi;
window.SAHTEN.online = { publish: onlinePublish };
Object.assign(window.SAHTEN.online, createOnline({ w: window, project, events }));
window.SAHTEN.online.publish = onlinePublish;
registerModules();

const RENDERS = ['showPanel', 'recalcAll', 'applyData', 'renderDashboard', 'renderProductos', 'renderProyeccion',
  'renderMostrador', 'renderRecipeBody', 'renderCostReceta', 'renderStock', 'mkChart', 'mostSetTab', 'orderSetStatus'];

function startLegacy() {
// Cada archivo se ejecuta como script clásico; después de cada uno se envuelven (una sola vez)
// las funciones de render que ya existan, para que los módulos puedan engancharse con eventos.
installTour(window);
window.SAHTEN_VERSION = APP_VERSION;   // única fuente de la versión que se muestra
document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = APP_VERSION; });
[['app.js', appJs], ['app-late.js', appLateJs]].forEach(([n, c]) => { runClassic(n, c); instrument(RENDERS); });
bindSettingInputs();

[['sahten-notifications.js', notificationsJs], ['sahten-enhancements.js', enhancementsJs], ['sahten-mostrador.js', mostradorJs],
  ['sahten-tienda.js', tiendaJs], ['sahten-menuonline.js', menuonlineJs], ['sahten-categories.js', categoriesJs],
  ['sahten-reportes.js', reportesJs], ['sahten-setup.js', setupJs], ['sahten-estrategia.js', estrategiaJs], ['sahten-ux.js', uxJs]]
  .forEach(([n, c]) => { runClassic(n, c); instrument(RENDERS); });

window.SAHTEN_READY = true;
}

// En el navegador arranca enseguida (antes de DOMContentLoaded); en escritorio espera a que carguen los archivos y la configuración.
initDesktop().then(() => {
  if (window.__SAHTEN_DESKTOP) window.SAHTEN.desktop = installDesktop({ apis: window.__SAHTEN_DESKTOP.apis, project, config: window.__SAHTEN_DESKTOP.config });
  startLegacy();
  if (isTauri()) {                       // los scripts viejos esperan DOMContentLoaded / load: si ya pasaron, se repiten una vez
    document.dispatchEvent(new Event('DOMContentLoaded'));
    if (document.readyState === 'complete') window.dispatchEvent(new Event('load'));
  }
}).catch(e => { console.error('No se pudo iniciar Sahten', e); });

// PWA: en la versión web (no en la app de escritorio) la app queda disponible sin internet
if ('serviceWorker' in navigator && import.meta.env.PROD && !isTauri() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

export { state };
