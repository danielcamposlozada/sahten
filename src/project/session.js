// ═══════════════════════════════════════════════════════════
// Sesión de proyecto: qué archivo está abierto, guardado automático y acciones de archivo.
// No sabe nada del DOM ni de los módulos viejos: recibe `collect()` y `apply()` por inyección.
// ═══════════════════════════════════════════════════════════
import { migrate, serialize, contentHash, fileNameFor, mergeUnknown, emptyFile, APP_VERSION } from './schema.js';
import { dailyBackup, preStrategyBackup, preRestoreBackup, listBackups, listDailies, dailyName } from './backups.js';

export const AUTOSAVE_MS = 2000;
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * deps:
 *  adapter      abrir/guardar (fsAccess | download | memory)
 *  backupStore  respaldos
 *  config       appConfig (recientes)
 *  collect()    → archivo .sahten con el estado actual de la app (sin modifiedAt)
 *  apply(file, {fresh})  carga un archivo en la app
 *  importProjection(file)  agrega las proyecciones de un archivo de tipo 'projection'
 *  now()        reloj (tests)
 *  timers       { set, clear } (tests)
 */
export function createSession(deps) {
  const now = deps.now || (() => new Date());
  const timers = deps.timers || { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) };
  const listeners = new Set();
  const s = {
    status: 'closed',      // closed | saved | dirty | saving | error | unsaved (sin archivo todavía)
    name: '', ref: null, id: null, savedAt: null, error: null,
    lastHash: null, lastText: null, modifiedAt: null, prevFile: null, timer: null, saving: false, pending: false,
  };
  const emit = () => { const snap = session.info(); listeners.forEach(fn => { try { fn(snap); } catch (e) { console.error(e); } }); };
  const setStatus = (st, err) => { s.status = st; s.error = err || null; emit(); };

  const buildFile = () => {
    let f = deps.collect();
    if (s.prevFile) f = mergeUnknown(s.prevFile, f);
    f.appVersion = APP_VERSION;
    if (f.project && f.project.name) s.name = f.project.name;
    f.project = { ...f.project, id: s.id || f.project.id || (s.id = uid()) };
    s.id = f.project.id;
    const h = contentHash(f);
    f.modifiedAt = h === s.lastHash ? s.modifiedAt : now().toISOString();
    return { file: f, hash: h };
  };

  // los respaldos se llaman como el archivo (.<nombre>.backup-…): si el proyecto se renombra por dentro, no cambia nada
  const bname = () => (s.ref && s.ref.name ? s.ref.name.replace(/\.sahten$/i, '') : s.name);
  const bind = () => { if (deps.backupStore && deps.backupStore.bind) deps.backupStore.bind(s.id, s.ref); };
  const recents = () => deps.config.get('recents', []);
  const touchRecent = async () => {
    if (!s.id || !s.ref) return;
    const list = recents().filter(r => r.id !== s.id);
    list.unshift({ id: s.id, name: s.name, openedAt: now().toISOString() });
    deps.config.set('recents', list.slice(0, 10));
    try { await deps.adapter.remember(s.id, s.ref); } catch (e) { /* opcional */ }
  };

  const session = {
    info: () => ({ readOnly: !!s.readOnly, status: s.status, name: s.name, hasFile: !!s.ref, path: (s.ref && s.ref.path) || null, fileName: (s.ref && s.ref.name) || null, savedAt: s.savedAt, error: s.error, canAutosave: deps.adapter.canAutosave, id: s.id }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    recents,
    get id() { return s.id; },
    get name() { return s.name; },
    get isOpen() { return s.status !== 'closed'; },

    /** Un cambio en el proyecto: guarda solo, 2 s después del último. */
    markDirty() {
      if (s.status === 'closed' || s.loading || s.readOnly) return;
      if (s.status !== 'saving') setStatus(s.ref ? 'dirty' : 'unsaved');
      if (!s.ref || !deps.adapter.canAutosave) return;
      timers.clear(s.timer);
      s.timer = timers.set(() => session.saveNow().catch(e => console.warn('Autoguardado falló', e)), AUTOSAVE_MS);
    },

    /** Guarda ya. `force` escribe aunque el contenido no haya cambiado. */
    async saveNow({ force = false } = {}) {
      if (s.status === 'closed' || s.readOnly) return false;
      timers.clear(s.timer);
      if (!s.ref) return session.saveAs();
      if (s.saving) { s.pending = true; return false; }
      const { file, hash } = buildFile();
      if (hash === s.lastHash && !force) { setStatus('saved'); return false; }
      s.saving = true; setStatus('saving');
      try {
        const text = serialize(file);
        await deps.adapter.write(s.ref, text);
        s.lastText = text; s.lastHash = hash; s.modifiedAt = file.modifiedAt; s.prevFile = file; s.savedAt = now();
        s.saving = false; setStatus('saved');
      } catch (e) {
        s.saving = false; setStatus('error', e && e.message || String(e)); throw e;
      }
      if (s.pending) { s.pending = false; return session.saveNow(); }
      return true;
    },

    /** Elegir dónde guardar (o descargar en navegadores sin acceso a archivos). */
    async saveAs(suggested) {
      if (s.status === 'closed') return false;
      const { file, hash } = buildFile();
      const text = serialize(file);
      const r = await deps.adapter.create(suggested || fileNameFor(s.name || file.project.name), text);
      if (!r) return false;
      // cambio de ubicación: el historial de respaldos viaja con el proyecto a la carpeta nueva
      let history = [];
      if (s.ref && deps.backupStore) { try { for (const d of await listDailies(deps.backupStore, s.id)) history.push([d.name, await deps.backupStore.get(s.id, d.name)]); } catch (e) { history = []; } }
      s.ref = r.ref; s.lastText = text; s.lastHash = hash; s.modifiedAt = file.modifiedAt; s.prevFile = file; s.savedAt = now();
      if (!s.name) s.name = file.project.name || r.name.replace(/\.sahten$/i, '');
      bind();
      for (const [n, t] of history) { try { if (t != null) await deps.backupStore.put(s.id, n, t); } catch (e) { console.warn('No se pudo copiar el respaldo', n, e); } }
      await touchRecent(); setStatus('saved');
      return true;
    },

    /** Carga el texto de un archivo (el contenido ya fue leído). */
    async openText(text, ref, fileName, { keepId } = {}) {
      const { kind, file, notes } = migrate(text);
      if (kind === 'projection') {
        if (s.status === 'closed') throw new Error('Abrí un proyecto primero para agregarle esta proyección.');
        deps.importProjection(file); session.markDirty(); return { kind, notes };
      }
      // un .json de versiones anteriores se convierte: queda sin archivo hasta «Guardar como…» (.sahten)
      const converted = !/\.sahten$/i.test(fileName || '') && !(ref && /\.sahten$/i.test(ref.name || ''));
      if (converted) ref = null;
      const f = file; f.project = { ...f.project };
      const idWasMissing = !f.project.id && !keepId;
      if (keepId) f.project.id = keepId; else if (!f.project.id) f.project.id = uid();
      s.id = f.project.id; s.name = f.project.name || (fileName || '').replace(/\.sahten$/i, '').replace(/\.json$/i, '') || 'Proyecto';
      s.ref = ref || null; s.prevFile = f; s.modifiedAt = f.modifiedAt; s.error = null;
      s.loading = true; try { await deps.apply(f, { fresh: false }); } finally { s.loading = false; }
      s.lastHash = contentHash(f); s.lastText = text; s.savedAt = ref ? now() : null;
      if (deps.onOpened) deps.onOpened({ id: s.id, name: s.name });
      bind();
      if (ref && deps.backupStore) { try { await dailyBackup(deps.backupStore, s.id, bname(), text, now()); } catch (e) { console.warn('Respaldo diario falló', e); } }
      await touchRecent();
      setStatus(ref ? 'saved' : 'unsaved');
      if (idWasMissing && ref) { s.lastHash = null; session.markDirty(); } // se escribe una vez para dejar el id del proyecto en el archivo
      return { kind: 'project', notes, converted };
    },

    async openFromPicker() {
      const r = await deps.adapter.open(); if (!r) return null;
      return session.openText(r.text, r.ref, r.name);
    },
    async openRecent(id) {
      const ref = await deps.adapter.recall(id); if (!ref) throw new Error('No encuentro ese archivo. Usá «Abrir» para buscarlo.');
      const text = await deps.adapter.read(ref);
      return session.openText(text, ref, ref.name || '');
    },

    /** Cierra el proyecto abierto (la app vuelve a quedar en blanco; el archivo no se toca). */
    close() {
      timers.clear(s.timer);
      Object.assign(s, { status: 'closed', name: '', ref: null, id: null, savedAt: null, error: null, lastHash: null, lastText: null, modifiedAt: null, prevFile: null, timer: null, saving: false, pending: false, readOnly: false });
      emit(); if (deps.onClosed) deps.onClosed();
    },

    /** ¿Se puede borrar el archivo del disco desde acá? (solo la app de escritorio) */
    get canDeleteFiles() { return typeof deps.adapter.remove === 'function'; },

    /** Quita un proyecto de la lista. Con deleteFile también borra el .sahten y sus respaldos de la carpeta. */
    async removeProject(id, { deleteFile = false } = {}) {
      const ref = await deps.adapter.recall(id);
      if (deleteFile) {
        if (!ref || typeof deps.adapter.remove !== 'function') throw new Error('Este navegador no puede borrar archivos. Quitá el proyecto de la lista y borralo desde tu carpeta.');
        if (deps.backupStore && deps.backupStore.bind) {
          deps.backupStore.bind(id, ref);
          for (const n of await deps.backupStore.list(id)) await deps.backupStore.remove(id, n);
        }
        await deps.adapter.remove(ref);
      }
      deps.config.set('recents', recents().filter(r => r.id !== id));
      try { await deps.adapter.forget(id); } catch (e) { /* opcional */ }
      if (s.id === id) session.close();
      return true;
    },

    /** Proyecto nuevo y vacío. Con `pickFile` pide dónde guardarlo (gesto del usuario). */
    async newProject(name = 'Proyecto nuevo', { pickFile = true } = {}) {
      const f = emptyFile(name); f.project.id = uid();
      s.id = f.project.id; s.name = name; s.ref = null; s.prevFile = null; s.lastHash = null; s.modifiedAt = null; s.savedAt = null;
      s.loading = true; try { await deps.apply(f, { fresh: true }); } finally { s.loading = false; }
      setStatus('unsaved');
      if (pickFile) await session.saveAs(fileNameFor(name));
      return true;
    },

    /** Duplicar: copia con otro nombre y id; pasa a ser el proyecto abierto. */
    async duplicate(newName) {
      if (s.status === 'closed') return false;
      const { file } = buildFile();
      file.project = { ...file.project, id: uid(), name: newName || (s.name + ' (copia)') };
      file.modifiedAt = now().toISOString();
      const text = serialize(file);
      const r = await deps.adapter.create(fileNameFor(file.project.name), text);
      if (!r) return false;
      s.id = file.project.id; s.name = file.project.name; s.ref = r.ref; bind(); s.prevFile = file; s.lastText = text; s.lastHash = contentHash(file); s.modifiedAt = file.modifiedAt; s.savedAt = now();
      s.loading = true; try { await deps.apply(file, { fresh: false }); } finally { s.loading = false; }
      await touchRecent(); setStatus('saved'); return true;
    },

    /** Exportar copia: archivo aparte, el proyecto abierto no cambia. */
    async exportCopy(suggested) {
      if (s.status === 'closed') return false;
      const { file } = buildFile();
      const text = serialize(file);
      const r = await deps.adapter.create(suggested || fileNameFor(s.name + ' (copia)'), text);
      return !!r;
    },

    // ── respaldos ────────────────────────────────────────
    async backupBeforeStrategy() {
      const { file } = buildFile();
      return preStrategyBackup(deps.backupStore, s.id, bname(), serialize(file), now());
    },
    backups: () => listBackups(deps.backupStore, s.id, s.name, now()),
    async readBackup(kind) {
      const b = await listBackups(deps.backupStore, s.id, s.name, now());
      const name = kind === 'daily' ? (b.daily && b.daily.name) : kind === 'preStrategy' ? b.preStrategy : kind === 'preRestore' ? b.preRestore : null;
      return name ? deps.backupStore.get(s.id, name) : null;
    },
    /** Restaura un respaldo: guarda lo de hoy en «pre-restauración», escribe el respaldo tal cual y lo carga. */
    async restoreBackup(kind) {
      const text = await session.readBackup(kind); if (!text) throw new Error('No hay respaldo para restaurar.');
      const { file: cur } = buildFile();
      await preRestoreBackup(deps.backupStore, s.id, bname(), serialize(cur));
      timers.clear(s.timer);
      if (s.ref && deps.adapter.canAutosave) await deps.adapter.write(s.ref, text);
      const keepRef = s.ref;
      await session.openText(text, keepRef, keepRef ? (keepRef.name || s.name + '.sahten') : s.name + '.sahten', { keepId: s.id });
      if (!keepRef) { s.ref = null; setStatus('unsaved'); }
      return true;
    },
    /** Renombrar el proyecto abierto (el archivo conserva su nombre en disco). */
    rename(name) { s.name = name; session.markDirty(); emit(); },
    /** Reemplaza TODO el contenido del proyecto abierto por el de otro archivo (importar un .json / otro .sahten).
     *  Conserva el archivo, el id y el nombre del archivo; guarda antes lo de hoy en «pre-estrategia». */
    async replaceWith(text) {
      if (s.status === 'closed') throw new Error('Abrí un proyecto primero.');
      const { kind, file } = migrate(text);
      if (kind !== 'project') throw new Error('Ese archivo es una proyección, no un proyecto completo.');
      await session.backupBeforeStrategy();
      file.project = { ...file.project, id: s.id }; if (s.name && !file.project.name) file.project.name = s.name;
      s.prevFile = null; s.lastHash = null;
      s.loading = true; try { await deps.apply(file, { fresh: false }); } finally { s.loading = false; }
      if (file.project.name) s.name = file.project.name;
      setStatus(s.ref ? 'dirty' : 'unsaved'); session.markDirty();
      return true;
    },
    /** Solo lectura (rol «lectura» o vista remota): no se guarda nada. */
    setReadOnly(on) { s.readOnly = !!on; if (on) timers.clear(s.timer); emit(); },
    get readOnly() { return !!s.readOnly; },
    /** Mientras se carga un proyecto, los cambios de la propia carga no cuentan como ediciones. */
    suspend(on) { s.loading = !!on; },
    /** Escribe lo que haya (útil antes de cerrar la pestaña). */
    isDirty: () => s.status === 'dirty' || s.status === 'unsaved' || s.status === 'saving',
    dailyName: d => dailyName(s.name, d),
  };
  return session;
}
