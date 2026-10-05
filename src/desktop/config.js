// Configuración de la APP en el store de Tauri, con la misma interfaz síncrona que appConfig.js:
// se carga entera al arrancar y las escrituras se guardan por detrás.
export async function createDesktopConfig(storePlugin, file = 'settings.json') {
  const store = await storePlugin.load(file, { defaults: {}, autoSave: false });
  const cache = {};
  for (const [k, v] of await store.entries()) cache[k] = v;
  let timer = null;
  const flush = () => { clearTimeout(timer); timer = setTimeout(() => { store.save().catch(() => {}); }, 300); };
  return {
    get: (key, dflt) => (key in cache ? cache[key] : dflt),
    set(key, value) { cache[key] = value; store.set(key, value).then(flush).catch(() => {}); },
    flush: async () => { clearTimeout(timer); await store.save(); },
  };
}
