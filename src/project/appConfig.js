// Configuración de la APP (no del negocio): proyectos recientes, preferencias. En la web va a localStorage;
// la versión de escritorio (Fase D) la reemplaza por el store de Tauri con la misma interfaz.
const PREFIX = 'sahten-app:';
export function createAppConfig(storage) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  return {
    get(key, dflt) { try { const s = st.getItem(PREFIX + key); return s == null ? dflt : JSON.parse(s); } catch (e) { return dflt; } },
    set(key, value) { try { st.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* bloqueado o sin espacio */ } },
  };
}
export function createMemoryConfig() {
  const m = {};
  return { get: (k, d) => k in m ? JSON.parse(m[k]) : d, set: (k, v) => { m[k] = JSON.stringify(v); } };
}
