// ═══════════════════════════════════════════════════════════
// Integración online con la app: publicar el menú (sin backend). Supabase y roles se suman en src/online/*.
// ═══════════════════════════════════════════════════════════
import { buildMenuJson } from './menuJson.js';
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
  const sb = w.SAHTEN_SUPABASE || {};
  const m = buildMenuJson(S, {
    menuConfig: w.MENU_CONFIG || {}, tienda: w._getTiendaConfig ? w._getTiendaConfig() : {}, images: w.SAHTEN_IMAGES || {},
    supabase: sb, store: { name: S.project.name || (w.SAHTEN_PROJECT && w.SAHTEN_PROJECT.name), slug: sb.slug || '' },
  });
  m.theme = currentTheme();
  return m;
}

export function publishProblems(menu) {
  const out = [];
  if (!menu.products.length) out.push('No hay productos para publicar. Revisá cuáles están visibles en Productos y Categorías.');
  if (!menu.store.whatsapp) out.push('Falta el número de WhatsApp: sin eso los clientes no pueden mandar el pedido (Configuración).');
  if (!menu.delivery.zones.length) out.push('No hay zonas de delivery cargadas: el menú solo va a permitir retiro en el local (Ajustes › Negocio › Tienda online y delivery).');
  return out;
}

const toast = m => (typeof w._posToast === 'function' ? w._posToast(m) : null);

export const onlinePublish = {
  currentMenu, publishProblems,
  /** HTML de la página tal como se publicaría, con las fotos incrustadas (sirve para la vista previa y para el editor). */
  previewHtml() {
    const m = currentMenu(); const imgs = w.SAHTEN_IMAGES || {};
    m.products.forEach(p => { if (p.image && imgs[p.id]) p.image = imgs[p.id]; });
    if (m.site && m.site.images) ['hero', 'historia'].forEach(k => { if (m.site.images[k] && imgs['site_' + k]) m.site.images[k] = imgs['site_' + k]; });
    return buildIndexHtml(m);
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
    if (w.SAHTEN.desktop) { const r = await w.SAHTEN.desktop.writeFolder(files); if (r) toast('Menú publicado en ' + r.dir + ': ' + r.files + ' archivos'); return r && { files: r.files, mode: 'folder' }; }
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
