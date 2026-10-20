// Cola de publicación opcional: junta cambios, conserva pendientes y reintenta al volver internet.
export function createPhotoPublisher({ publish, enabled, context, timer = { set: setTimeout, clear: clearTimeout } }) {
  let state = 'sin cambios', error = null, handle = null, busy = false, pending = false, generation = 0, attempt = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn(api.info()));
  const schedule = ms => { timer.clear(handle); handle = timer.set(() => api.flush().catch(() => {}), ms); };
  const api = {
    info: () => ({ state, error, pending }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    schedule() { if (!enabled()) return; pending = true; state = 'pendiente'; error = null; schedule(2000); emit(); },
    cancel() { generation++; timer.clear(handle); pending = false; state = 'sin cambios'; error = null; emit(); },
    async flush() {
      if (!enabled()) return;
      if (busy) { pending = true; schedule(2000); return; }
      timer.clear(handle); busy = true; pending = false; state = 'subiendo'; error = null; emit();
      const gen = generation, ctx = context();
      try {
        await publish();
        if (gen !== generation || ctx !== context()) return;
        attempt = 0; state = pending ? 'pendiente' : 'al día';
      } catch (e) {
        if (gen !== generation || ctx !== context()) return;
        pending = true; state = e.offline ? 'sin conexión' : 'error'; error = e.message;
        // Los errores de permisos/configuración y la protección de menú requieren una acción explícita.
        if (e.offline || e.status >= 500 || e.code === 'menu_busy') schedule([30000, 60000, 120000, 300000][Math.min(attempt++, 3)]);
        throw e;
      } finally {
        busy = false;
        if (gen === generation && ctx === context()) { if (pending && state === 'pendiente') schedule(2000); emit(); }
      }
    },
  };
  return api;
}
