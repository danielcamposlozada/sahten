/** Estado visible de operaciones reales; no inventa porcentajes para peticiones de duración desconocida. */
export function createTransferProgress() {
  const jobs = new Map(), listeners = new Set(); let last = null, sequence = 0;
  const info = () => [...jobs.values()].at(-1) || last;
  const emit = () => listeners.forEach(fn => fn(info()));
  return {
    info, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start(title) {
      const id = ++sequence; let state = { title, active: true, detail: 'Preparando…', completed: null, total: null };
      jobs.set(id, state); emit();
      const update = detail => { if (!jobs.has(id)) return; state = { ...state, completed: null, total: null, ...detail }; jobs.set(id, state); emit(); };
      const end = (error) => { if (!jobs.has(id)) return; jobs.delete(id); last = { ...state, active: false, error: !!error, detail: error ? String(error.message || error) : 'Completado.' }; emit(); };
      return { update, finish: () => end(), fail: e => end(e) };
    },
  };
}
