// ═══════════════════════════════════════════════════════════
// Adaptador de escritorio (Tauri): abrir / guardar el .sahten con los diálogos del sistema.
// Guardado ATÓMICO: se escribe un archivo temporal junto al proyecto y se renombra encima (reemplaza el anterior de una vez).
// `apis` = { dialog, fs } de los plugins de Tauri (inyectables para probar).
// ═══════════════════════════════════════════════════════════
import { basename, joinPath } from './paths.js';

const OPEN_FILTERS = [{ name: 'Proyecto de Sahten', extensions: ['sahten', 'json'] }];
const SAVE_FILTERS = [{ name: 'Proyecto de Sahten', extensions: ['sahten'] }];

export function createTauriAdapter({ dialog, fs }, config, rand = () => Math.random().toString(36).slice(2, 8)) {
  const paths = () => config.get('paths', {});
  const adapter = {
    id: 'tauri', canAutosave: true,

    async open() {
      const p = await dialog.open({ multiple: false, directory: false, filters: OPEN_FILTERS });
      if (!p) return null;
      const path = typeof p === 'string' ? p : p.path;
      return { ref: { path, name: basename(path) }, name: basename(path), text: await fs.readTextFile(path) };
    },
    /** Carpeta donde se proponen los proyectos nuevos (configurable). */
    projectsDir: () => config.get('projectsDir', ''),
    setProjectsDir(dir) { config.set('projectsDir', dir); },
    async pickFolder() { const p = await dialog.open({ directory: true, multiple: false, defaultPath: config.get('projectsDir', '') || undefined }); return p ? (typeof p === 'string' ? p : p.path) : null; },
    /** Abrir una ruta conocida (doble clic en un .sahten, recientes). */
    async openPath(path) { return { ref: { path, name: basename(path) }, name: basename(path), text: await fs.readTextFile(path) }; },
    async read(ref) { return fs.readTextFile(ref.path); },

    async create(suggested, text) {
      const dir = config.get('projectsDir', '');
      let p = await dialog.save({ defaultPath: dir ? joinPath(dir, suggested) : suggested, filters: SAVE_FILTERS });
      if (!p) return null;
      if (!/\.sahten$/i.test(p)) p += '.sahten';
      await adapter.write({ path: p }, text);
      return { ref: { path: p, name: basename(p) }, name: basename(p) };
    },

    async write(ref, text) {
      const tmp = ref.path + '.' + rand() + '.tmp';
      try { await fs.writeTextFile(tmp, text); await fs.rename(tmp, ref.path); }
      catch (e) { try { await fs.remove(tmp); } catch (e2) { /* no quedó temporal */ } throw e; }
    },

    // En escritorio no hay «handles»: se guarda la ruta
    async remember(id, ref) { config.set('paths', { ...paths(), [id]: { path: ref.path, name: ref.name } }); },
    async recall(id) { return paths()[id] || null; },
    async forget(id) { const p = { ...paths() }; delete p[id]; config.set('paths', p); },
    async remove(ref) { await fs.remove(ref.path); },
  };
  return adapter;
}
