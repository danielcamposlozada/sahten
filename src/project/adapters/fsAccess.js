// Adaptador web con File System Access API (Chrome / Edge): abre y guarda el .sahten en su lugar.
// createWritable() escribe a un archivo temporal y lo reemplaza al cerrar, así que el guardado es atómico.
const PICKER = { types: [{ description: 'Proyecto de Sahten', accept: { 'application/json': ['.sahten'] } }] };
const DB = 'sahten-app', STORE = 'handles';

const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const rq = fn(t.objectStore(STORE)); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };

export const fsAccessSupported = (w = typeof window !== 'undefined' ? window : null) => !!(w && w.showOpenFilePicker && w.showSaveFilePicker);

export function createFsAccessAdapter(w = window) {
  const verify = async (handle, write) => {
    const opts = { mode: write ? 'readwrite' : 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return (await handle.requestPermission(opts)) === 'granted';
  };
  return {
    id: 'fs-access', canAutosave: true,
    async open() {
      let handles; try { handles = await w.showOpenFilePicker({ ...PICKER, multiple: false }); } catch (e) { if (e.name === 'AbortError') return null; throw e; }
      const handle = handles[0]; const file = await handle.getFile();
      return { ref: handle, name: handle.name, text: await file.text() };
    },
    async read(handle) { if (!(await verify(handle, true))) throw new Error('Sin permiso para abrir el archivo'); return (await handle.getFile()).text(); },
    async create(suggested, text) {
      let handle; try { handle = await w.showSaveFilePicker({ ...PICKER, suggestedName: suggested }); } catch (e) { if (e.name === 'AbortError') return null; throw e; }
      await this.write(handle, text); return { ref: handle, name: handle.name };
    },
    async write(handle, text) { const ws = await handle.createWritable(); try { await ws.write(text); } finally { await ws.close(); } },
    async remember(id, handle) { await tx('readwrite', s => s.put(handle, id)); },
    async recall(id) { return tx('readonly', s => s.get(id)); },
    async forget(id) { await tx('readwrite', s => s.delete(id)); },
  };
}
