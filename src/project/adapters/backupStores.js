// Almacenes de respaldos. Interfaz: put(key, name, text) · get(key, name) · list(key) · remove(key, name)
// En escritorio (Fase D) el almacén escribe archivos junto al proyecto; en la web usa el sistema de archivos privado
// del navegador (OPFS) con los mismos nombres de archivo.
export function createMemoryBackupStore() {
  const m = new Map();
  return {
    id: 'memory',
    async put(key, name, text) { m.set(key + '/' + name, text); },
    async get(key, name) { return m.has(key + '/' + name) ? m.get(key + '/' + name) : null; },
    async list(key) { return [...m.keys()].filter(k => k.startsWith(key + '/')).map(k => k.slice(key.length + 1)).sort(); },
    async remove(key, name) { m.delete(key + '/' + name); },
  };
}

export function opfsSupported(w = typeof window !== 'undefined' ? window : null) { return !!(w && w.navigator && w.navigator.storage && w.navigator.storage.getDirectory); }

export function createOpfsBackupStore(w = window) {
  const dir = async key => { const root = await w.navigator.storage.getDirectory(); const b = await root.getDirectoryHandle('sahten-backups', { create: true }); return b.getDirectoryHandle(key, { create: true }); };
  return {
    id: 'opfs',
    async put(key, name, text) { const d = await dir(key); const fh = await d.getFileHandle(name, { create: true }); const ws = await fh.createWritable(); await ws.write(text); await ws.close(); },
    async get(key, name) { try { const d = await dir(key); const fh = await d.getFileHandle(name); return (await fh.getFile()).text(); } catch (e) { return null; } },
    async list(key) { const d = await dir(key); const out = []; for await (const n of d.keys()) out.push(n); return out.sort(); },
    async remove(key, name) { try { const d = await dir(key); await d.removeEntry(name); } catch (e) { /* ya no estaba */ } },
  };
}
