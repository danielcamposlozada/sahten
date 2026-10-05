// Si corre dentro de Tauri, prepara adaptador, respaldos y configuración ANTES de que arranque el proyecto.
// En el navegador no hace nada (queda File System Access / descarga).
import { createTauriAdapter } from './adapter.js';
import { createSiblingBackupStore } from './backupStore.js';
import { createDesktopConfig } from './config.js';
import { createMemoryBackupStore } from '../project/adapters/backupStores.js';

export const isTauri = (w = typeof window !== 'undefined' ? window : {}) => !!(w.__TAURI_INTERNALS__ || w.__TAURI__);

export async function loadTauriApis() {
  const [dialog, fs, store, opener, updater, proc, event, core, path] = await Promise.all([
    import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs'), import('@tauri-apps/plugin-store'), import('@tauri-apps/plugin-opener'),
    import('@tauri-apps/plugin-updater'), import('@tauri-apps/plugin-process'), import('@tauri-apps/api/event'), import('@tauri-apps/api/core'), import('@tauri-apps/api/path'),
  ]);
  return { dialog, fs, store, opener, updater, process: proc, event, core, path };
}

export async function prepareDesktop(apis) {
  const config = await createDesktopConfig(apis.store);
  const adapter = createTauriAdapter(apis, config);
  if (!config.get('projectsDir', '')) {                     // primera vez: Documentos/Sahten
    try { const docs = await apis.path.documentDir(); const dir = docs.replace(/[\\/]$/, '') + (docs.includes('\\') ? '\\' : '/') + 'Sahten'; await apis.fs.mkdir(dir, { recursive: true }); config.set('projectsDir', dir); } catch (e) { /* sin carpeta por defecto */ }
  }
  const backupStore = createSiblingBackupStore(apis, createMemoryBackupStore());
  return { apis, config, adapter, backupStore };
}

/** En Tauri: deja listo window.__SAHTEN_DESKTOP. En el navegador no hace nada. */
export async function initDesktop() {
  if (!isTauri()) return null;
  const apis = await loadTauriApis();
  window.__SAHTEN_DESKTOP = await prepareDesktop(apis);
  return window.__SAHTEN_DESKTOP;
}
