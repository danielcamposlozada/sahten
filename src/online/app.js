// ═══════════════════════════════════════════════════════════
// Integración online con la app: publicar el menú (sin backend). Supabase y roles se suman en src/online/*.
// ═══════════════════════════════════════════════════════════
import { buildMenuJson, categoryPhotoKey } from './menuJson.js';
import { buildPublishFiles, buildPublishZip, writeToDirectory, optimizeImage, buildIndexHtml } from './publish.js';

const w = window;

/** Colores de marca del proyecto (los que eligió en Personalización) para el menú publicado. */
export function currentTheme() {
  try {
    const c = w.custLoad(); const base = (w.PALETTES || []).find(p => p.id === c.paletteId) || (w.PALETTES || [])[0] || {};
    return { primary: c.customPrimary || base.primary || '#235328', accent: c.customAccent || base.accent || '#F28C00' };
  } catch (e) { return {}; }
}

/** menu.json del proyecto abierto. */
export function currentMenu(opts = {}) {
  const S = w.SAHTEN.state;
  if (w.SAHTEN.pricing?.prepare()) { w.SAHTEN.project.markDirty(); }
  const sb = w.SAHTEN_SUPABASE || {};
  const m = buildMenuJson(S, {
    menuConfig: opts.forceSite && w.MENU_CONFIG && w.MENU_CONFIG.site ? { ...w.MENU_CONFIG, site: { ...w.MENU_CONFIG.site, enabled: true } } : (w.MENU_CONFIG || {}), tienda: w._getTiendaConfig ? w._getTiendaConfig() : {}, images: w.SAHTEN_IMAGES || {},
    supabase: sb, store: { name: S.project.name || (w.SAHTEN_PROJECT && w.SAHTEN_PROJECT.name), slug: sb.slug || '' },
    quoteIds: Object.fromEntries(S.products.map(p => [p.id, w.SAHTEN.pricing?.quoteIds(p).mostrador])),
  });
  m.theme = currentTheme();
  return m;
}

export function publishProblems(menu) {
  const out = [];
  if (!menu.products.length) out.push('No hay productos para publicar. Revisá cuáles están visibles en Productos y Categorías.');
  if (!menu.store.whatsapp) out.push('Falta el número de WhatsApp: sin eso los clientes no pueden mandar el pedido (Configuración).');
  if (!menu.delivery.zones.length) out.push('No hay zonas de delivery cargadas: el menú solo va a permitir retiro en el local (Ajustes › Negocio › Horarios y delivery).');
  return out;
}

const toast = m => (typeof w._posToast === 'function' ? w._posToast(m) : null);

export const onlinePublish = {
  currentMenu, publishProblems,
  /** HTML de la página tal como se publicaría, con las fotos incrustadas (sirve para la vista previa y para el editor).
   * `forceSite`: muestra el sitio completo aunque esté apagado (el editor lo usa para que se vea lo que se escribe). */
  previewHtml(opts = {}) {
    const m = currentMenu({ forceSite: !!opts.forceSite }); const imgs = w.SAHTEN_IMAGES || {};
    m.products.forEach(p => { if (p.image && imgs[p.id]) p.image = imgs[p.id]; });
    const ci = m.config && m.config.categoryImages; if (ci) Object.keys(ci).forEach(c => { const k = categoryPhotoKey(c); if (imgs[k]) ci[c] = imgs[k]; });   // en la vista previa las fotos de categoría van incrustadas
    if (m.site && m.site.images) ['hero', 'historia'].forEach(k => { if (m.site.images[k] && imgs['site_' + k]) m.site.images[k] = imgs['site_' + k]; });
    // La vista previa muestra lo que tenés en la app, no lo publicado: sin conexión a la nube la página no baja el menú en vivo (lo pisaría) ni puede enviar pedidos de verdad.
    m.supabase = null;
    return buildIndexHtml(m, { preview: true });
  },
  /** Vista previa en otra pestaña (imágenes incrustadas, sin publicar nada). */
  preview() {
    const html = onlinePublish.previewHtml();
    if (w.SAHTEN.desktop) return w.SAHTEN.desktop.openPreview(html);
    const win = w.open('', '_blank'); if (!win) return alert('El navegador bloqueó la ventana. Permitila para ver la vista previa.');
    win.document.open(); win.document.write(html); win.document.close();
  },
  /** Archivos de la carpeta publicada, sin escribirlos (para probar y para el escritorio). */
  async buildFiles() { return buildPublishFiles(currentMenu(), w.SAHTEN_IMAGES || {}, optimizeImage); },
  /** Genera la carpeta: la guarda donde elijas (Chrome/Edge) o descarga un .zip. */
  async publish() {
    const menu = currentMenu();
    const problems = publishProblems(menu);
    if (!menu.products.length) return alert(problems[0]);
    const files = await buildPublishFiles(menu, w.SAHTEN_IMAGES || {}, optimizeImage);
    if (w.SAHTEN.desktop) { const r = await w.SAHTEN.desktop.writeFolder(files); if (r) toast('Archivos de la web guardados en ' + r.dir + ': ' + r.files + ' archivos'); return r && { files: r.files, mode: 'folder' }; }
    if (w.showDirectoryPicker) {
      try { const dir = await w.showDirectoryPicker({ mode: 'readwrite' }); await writeToDirectory(dir, files); toast('Menú publicado en la carpeta: ' + files.length + ' archivos'); return { files: files.length, mode: 'folder' }; }
      catch (e) { if (e.name === 'AbortError') return null; throw e; }
    }
    const zip = buildPublishZip(files);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    a.download = ((menu.store.name || 'menu').replace(/[^\w-]+/g, '_') || 'menu') + '-menu.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Menú listo: subí el contenido del .zip a tu hosting'); return { files: files.length, mode: 'zip' };
  },
};
