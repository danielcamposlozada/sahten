// ═══════════════════════════════════════════════════════════
// Integración con el sistema (solo en la app de escritorio):
//  · descargas (CSV, JSON, ZIP) → diálogo «Guardar como»
//  · enlaces externos y WhatsApp → navegador del sistema
//  · doble clic en un .sahten → abre el proyecto
//  · actualizaciones (Tauri updater + GitHub Releases)
//  · carpeta del menú publicado y vista previa
// ═══════════════════════════════════════════════════════════
import { basename } from './paths.js';

const HOUR = 3600 * 1000;

export function installDesktop({ apis, project, config, w = window, now = () => Date.now() }) {
  const { dialog, fs, opener, updater, process: proc, event, core, path } = apis;
  const toast = m => (typeof w._posToast === 'function' ? w._posToast(m) : null);
  let pending = null;   // versión nueva encontrada
  const api = {
    apis,

    /** Guarda un archivo que la app «descargaba» (data: o blob:). */
    async saveDownload(name, bytes) {
      const p = await dialog.save({ defaultPath: name });
      if (!p) return false;
      await fs.writeFile(p, bytes); toast('Guardado: ' + basename(p)); return true;
    },

    async openExternal(url) { await opener.openUrl(url); },
    /** Muestra el archivo en el Finder / Explorador. */
    async reveal(path) { await opener.revealItemInDir(path); },

    /** Abre un .sahten por ruta (doble clic). */
    async openPath(path) {
      try {
        const r = await project.adapter.openPath(path);
        await project.session.openText(r.text, r.ref, r.name);
        w.document.getElementById('proj-welcome')?.remove();
      } catch (e) { w.alert('No se pudo abrir el archivo: ' + (e && e.message || e)); }
    },

    /** Busca una versión nueva. En silencio (al abrir la app) deja un aviso en las notificaciones; a pedido, pregunta en el momento. */
    async checkForUpdates({ silent = false } = {}) {
      try {
        const update = await updater.check();
        config.set('last-update-check', now());
        if (!update) { pending = null; try { w.dropNotifications && w.dropNotifications('update:'); } catch (e) { /* */ } if (!silent) toast('Estás usando la última versión.'); return null; }
        pending = update;
        if (silent) {
          if (w.pushNotification) w.pushNotification({ type: 'update', scope: 'app', key: 'update:' + update.version, source: 'sistema', title: 'Nueva versión ' + update.version + ' disponible',
            body: 'Instalala cuando quieras: la app se reinicia y tus proyectos no se tocan.', action: { label: 'Actualizar ahora', call: 'update' } });
          return update;
        }
        w.showConfirm('Nueva versión ' + update.version, 'Hay una versión nueva de Sahten. ¿Instalarla ahora? La app se reinicia y tus proyectos no se tocan.' + (update.body ? '\n\n' + update.body : ''), () => api.installUpdate(), null, 'Actualizar', 'Más tarde');
        return update;
      } catch (e) { if (!silent) w.alert('No se pudo buscar actualizaciones (¿hay internet?).'); return null; }
    },
    /** Descarga e instala la versión encontrada (la guarda antes) y reinicia la app. */
    async installUpdate() {
      try {
        const update = pending || await updater.check(); if (!update) { toast('Estás usando la última versión.'); return null; }
        try { if (project.session && project.session.isOpen) await project.session.saveNow({ force: true }); } catch (e) { /* se guarda solo igual */ }
        toast('Descargando la actualización…'); await update.downloadAndInstall(); await proc.relaunch(); return update;
      } catch (e) { w.alert('No se pudo actualizar: ' + (e && e.message || e)); return null; }
    },

    /** Carpeta del menú publicado: elegir carpeta y escribir index.html, menu.json e img/. */
    async writeFolder(files) {
      const dir = await dialog.open({ directory: true, multiple: false });
      if (!dir) return null;
      const base = typeof dir === 'string' ? dir : dir.path;
      const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/';
      try { await fs.mkdir(base + sep + 'img', { recursive: true }); } catch (e) { /* ya existe */ }
      for (const f of files) {
        const target = base + sep + f.path.split('/').join(sep);
        if (typeof f.data === 'string') await fs.writeTextFile(target, f.data); else await fs.writeFile(target, f.data);
      }
      return { dir: base, files: files.length };
    },

    /** Vista previa del menú: archivo temporal abierto en el navegador del sistema. */
    async openPreview(html) {
      const tmp = await path.tempDir();
      const file = tmp.replace(/[\\/]$/, '') + (tmp.includes('\\') ? '\\' : '/') + 'sahten-menu-preview.html';
      await fs.writeTextFile(file, html); await opener.openPath(file);
    },
  };

  // 1) descargas de la app → «Guardar como»
  const nativeClick = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function () {
    const href = this.getAttribute('href') || '';
    if (this.hasAttribute('download') && /^(data:|blob:)/.test(href)) {
      const name = this.getAttribute('download') || 'archivo';
      w.fetch(href).then(r => r.arrayBuffer()).then(b => api.saveDownload(name, new Uint8Array(b))).catch(e => w.alert('No se pudo guardar el archivo: ' + e.message));
      return;
    }
    return nativeClick.apply(this, arguments);
  };

  // 2) enlaces externos
  const nativeOpen = w.open;
  w.open = function (url, ...rest) {
    if (typeof url === 'string' && /^https?:|^mailto:|^tel:/i.test(url)) { api.openExternal(url).catch(() => {}); return null; }
    return nativeOpen ? nativeOpen.call(w, url, ...rest) : null;
  };
  w.document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^https?:/i.test(href) && !a.hasAttribute('download')) { e.preventDefault(); api.openExternal(href).catch(() => {}); }
  });

  // 3) doble clic en un .sahten: el pedido pendiente del arranque y los siguientes
  (async () => {
    try { const pending = await core.invoke('take_pending_file'); if (pending) await api.openPath(pending); } catch (e) { /* sin archivo */ }
    try { await event.listen('open-file', ev => api.openPath(ev.payload)); } catch (e) { /* sin eventos */ }
  })();

  // 4) buscar actualizaciones, como mucho una vez por día y sin molestar si no hay internet
  if (now() - (config.get('last-update-check', 0) || 0) > 24 * HOUR) setTimeout(() => api.checkForUpdates({ silent: true }), 8000);

  return api;
}
