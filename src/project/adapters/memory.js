// Adaptador en memoria (tests y modo sin archivos): simula «abrir / guardar como / escribir» sin disco.
export function createMemoryAdapter({ files = {}, canAutosave = true } = {}) {
  const store = files; let n = 0; const next = { open: null, saveAs: null };
  return {
    id: 'memory', canAutosave, store,
    queueOpen(name, text) { next.open = { name, text }; },
    queueSaveAs(name) { next.saveAs = name; },
    async open() { const o = next.open; next.open = null; if (!o) return null; store[o.name] = o.text; return { ref: { name: o.name }, name: o.name, text: o.text }; },
    async read(ref) { if (!(ref.name in store)) throw new Error('No se encuentra el archivo'); return store[ref.name]; },
    async create(suggested, text) { const name = next.saveAs || suggested; next.saveAs = null; store[name] = text; return { ref: { name }, name }; },
    async write(ref, text) { store[ref.name] = text; },
    async remember(id, ref) { store['__ref:' + id] = JSON.stringify(ref); },
    async recall(id) { const r = store['__ref:' + id]; return r ? JSON.parse(r) : null; },
    async forget(id) { delete store['__ref:' + id]; },
    n: () => ++n,
  };
}
