// Respaldos como archivos junto al proyecto: <carpeta>/.<nombre>.backup-AAAA-MM-DD.sahten, .<nombre>.pre-estrategia.sahten…
// Interfaz del almacén de respaldos + bind(key, ref): la sesión avisa dónde quedó el .sahten.
import { dirname, joinPath, basename, stripExt } from './paths.js';

export function createSiblingBackupStore({ fs }, fallback) {
  const bound = new Map();                                   // key → { dir, prefix }
  const here = key => bound.get(key);
  return {
    id: 'sibling',
    bind(key, ref) { if (ref && ref.path) bound.set(key, { dir: dirname(ref.path), prefix: '.' + stripExt(basename(ref.path)) + '.' }); else bound.delete(key); },
    async put(key, name, text) { const b = here(key); if (!b) return fallback.put(key, name, text); await fs.writeTextFile(joinPath(b.dir, name), text); },
    async get(key, name) { const b = here(key); if (!b) return fallback.get(key, name); try { return await fs.readTextFile(joinPath(b.dir, name)); } catch (e) { return null; } },
    async list(key) {
      const b = here(key); if (!b) return fallback.list(key);
      const entries = await fs.readDir(b.dir);
      return entries.map(e => e.name).filter(n => n.startsWith(b.prefix) && n.endsWith('.sahten')).sort();     // solo los de ESTE proyecto (la carpeta puede tener otros)
    },
    async remove(key, name) { const b = here(key); if (!b) return fallback.remove(key, name); try { await fs.remove(joinPath(b.dir, name)); } catch (e) { /* ya no estaba */ } },
  };
}
