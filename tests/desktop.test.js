// App de escritorio (Tauri): lo que se puede probar sin compilar Rust: adaptador, respaldos junto al proyecto, integración y configuración.
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createTauriAdapter } from '../src/desktop/adapter.js';
import { prepareDesktop } from '../src/desktop/preload.js';
import { createSiblingBackupStore } from '../src/desktop/backupStore.js';
import { createDesktopConfig } from '../src/desktop/config.js';
import { installDesktop } from '../src/desktop/integration.js';
import { basename, dirname, joinPath, stripExt } from '../src/desktop/paths.js';
import { createSession } from '../src/project/session.js';
import { createMemoryBackupStore } from '../src/project/adapters/backupStores.js';
import { createMemoryConfig } from '../src/project/appConfig.js';
import { emptyFile, serialize, legacyToFile } from '../src/project/schema.js';

/** Disco falso con las operaciones de @tauri-apps/plugin-fs que usa la app. */
function fakeFs(files = {}) {
  const log = [];
  const fs = {
    files, log,
    async readTextFile(p) { log.push(['read', p]); if (!(p in files)) throw new Error('No existe ' + p); return files[p]; },
    async writeTextFile(p, t) { log.push(['write', p]); if (fs.failWriteOn && p.includes(fs.failWriteOn)) throw new Error('Disco lleno'); files[p] = t; },
    async writeFile(p, b) { log.push(['writeFile', p]); files[p] = b; },
    async rename(a, b) { log.push(['rename', a, b]); if (fs.failRename) throw new Error('Sin permiso'); files[b] = files[a]; delete files[a]; },
    async remove(p) { log.push(['remove', p]); delete files[p]; },
    async mkdir(p) { log.push(['mkdir', p]); },
    async readDir(d) { return Object.keys(files).filter(p => dirname(p) === d).map(p => ({ name: basename(p) })); },
  };
  return fs;
}
const fakeDialog = (o = {}) => ({ calls: [], async open(opts) { this.calls.push(['open', opts]); return o.open ?? null; }, async save(opts) { this.calls.push(['save', opts]); return o.save ?? null; } });

describe('rutas', () => {
  it('macOS/Linux y Windows', () => {
    expect(basename('/Users/a/Mi local.sahten')).toBe('Mi local.sahten'); expect(basename('C:\\Datos\\Mi local.sahten')).toBe('Mi local.sahten');
    expect(dirname('/Users/a/x.sahten')).toBe('/Users/a'); expect(dirname('C:\\Datos\\x.sahten')).toBe('C:\\Datos');
    expect(joinPath('/Users/a', '.x.sahten')).toBe('/Users/a/.x.sahten'); expect(joinPath('C:\\Datos', '.x.sahten')).toBe('C:\\Datos\\.x.sahten');
    expect(stripExt('Mi local.SAHTEN')).toBe('Mi local');
  });
});

describe('adaptador de escritorio', () => {
  it('abrir: diálogo del sistema + lectura; cancelar devuelve null', async () => {
    const fs = fakeFs({ '/p/a.sahten': '{"x":1}' });
    const a = createTauriAdapter({ dialog: fakeDialog({ open: '/p/a.sahten' }), fs }, createMemoryConfig());
    expect(await a.open()).toEqual({ ref: { path: '/p/a.sahten', name: 'a.sahten' }, name: 'a.sahten', text: '{"x":1}' });
    expect(await createTauriAdapter({ dialog: fakeDialog(), fs }, createMemoryConfig()).open()).toBeNull();
  });
  it('el diálogo filtra .sahten y .json (copias de versiones anteriores)', async () => {
    const d = fakeDialog({ open: '/p/a.sahten' }); await createTauriAdapter({ dialog: d, fs: fakeFs({ '/p/a.sahten': '' }) }, createMemoryConfig()).open();
    expect(d.calls[0][1].filters[0].extensions).toEqual(['sahten', 'json']);
  });
  it('guardar como: agrega la extensión .sahten y escribe', async () => {
    const fs = fakeFs(); const a = createTauriAdapter({ dialog: fakeDialog({ save: '/p/Mi local' }), fs }, createMemoryConfig());
    const r = await a.create('Mi local.sahten', 'TEXTO');
    expect(r.ref.path).toBe('/p/Mi local.sahten'); expect(fs.files['/p/Mi local.sahten']).toBe('TEXTO');
  });
  it('escritura atómica: temporal junto al archivo y renombrado encima; no queda temporal', async () => {
    const fs = fakeFs({ '/p/a.sahten': 'VIEJO' });
    await createTauriAdapter({ dialog: fakeDialog(), fs }, createMemoryConfig(), () => 'abc123').write({ path: '/p/a.sahten' }, 'NUEVO');
    expect(fs.log.map(l => l[0])).toEqual(['write', 'rename']);
    expect(fs.log[0][1]).toBe('/p/a.sahten.abc123.tmp'); expect(fs.log[1].slice(1)).toEqual(['/p/a.sahten.abc123.tmp', '/p/a.sahten']);
    expect(fs.files).toEqual({ '/p/a.sahten': 'NUEVO' });
  });
  it('si falla la escritura o el renombrado, el archivo original queda intacto y se limpia el temporal', async () => {
    for (const mode of ['failWriteOn', 'failRename']) {
      const fs = fakeFs({ '/p/a.sahten': 'VIEJO' }); if (mode === 'failWriteOn') fs.failWriteOn = '.tmp'; else fs.failRename = true;
      await expect(createTauriAdapter({ dialog: fakeDialog(), fs }, createMemoryConfig()).write({ path: '/p/a.sahten' }, 'NUEVO')).rejects.toThrow();
      expect(fs.files).toEqual({ '/p/a.sahten': 'VIEJO' });
    }
  });
  it('recientes: guarda la ruta (no hay handles) y la recuerda', async () => {
    const cfg = createMemoryConfig(); const a = createTauriAdapter({ dialog: fakeDialog(), fs: fakeFs() }, cfg);
    await a.remember('p1', { path: '/p/a.sahten', name: 'a.sahten' });
    expect(await a.recall('p1')).toEqual({ path: '/p/a.sahten', name: 'a.sahten' });
    await a.forget('p1'); expect(await a.recall('p1')).toBeNull();
  });
});

describe('carpeta de proyectos y ubicación del archivo', () => {
  it('«Guardar como» propone la carpeta de proyectos configurada', async () => {
    const d = fakeDialog({ save: '/Users/a/Sahten/Mi local.sahten' }); const cfg = createMemoryConfig(); cfg.set('projectsDir', '/Users/a/Sahten');
    const a = createTauriAdapter({ dialog: d, fs: fakeFs() }, cfg);
    await a.create('Mi local.sahten', 'T');
    expect(d.calls[0][1].defaultPath).toBe('/Users/a/Sahten/Mi local.sahten');
  });
  it('se puede cambiar la carpeta por defecto: elige carpeta y la recuerda', async () => {
    const d = fakeDialog({ open: '/Volumes/Disco/Negocio' }); const cfg = createMemoryConfig();
    const a = createTauriAdapter({ dialog: d, fs: fakeFs() }, cfg);
    expect(await a.pickFolder()).toBe('/Volumes/Disco/Negocio'); expect(d.calls[0][1].directory).toBe(true);
    a.setProjectsDir('/Volumes/Disco/Negocio'); expect(a.projectsDir()).toBe('/Volumes/Disco/Negocio');
    expect(await createTauriAdapter({ dialog: fakeDialog(), fs: fakeFs() }, createMemoryConfig()).pickFolder()).toBeNull();
  });
  it('la primera vez crea y usa Documentos/Sahten; si ya hay una elegida, la respeta', async () => {
    const fs = fakeFs(); const made = []; fs.mkdir = async p => { made.push(p); };
    const store = { entries: async () => [], set: async () => {}, save: async () => {} };
    const a1 = { dialog: fakeDialog(), fs, store: { load: async () => store }, path: { documentDir: async () => '/Users/a/Documents/' } };
    const d1 = await prepareDesktop(a1);
    expect(d1.adapter.projectsDir()).toBe('/Users/a/Documents/Sahten'); expect(made).toEqual(['/Users/a/Documents/Sahten']);
    const store2 = { entries: async () => [['projectsDir', '/otra']], set: async () => {}, save: async () => {} };
    const d2 = await prepareDesktop({ ...a1, store: { load: async () => store2 } }); expect(d2.adapter.projectsDir()).toBe('/otra');
  });
  it('«Mostrar en carpeta» abre el Finder / Explorador', async () => {
    const { w } = page(); const a = apis(); a.opener.revealItemInDir = async p => { a.opener.opened.push('reveal:' + p); };
    await installDesktop({ apis: a, project: {}, config: createMemoryConfig(), w }).reveal('/Users/a/Sahten/Mi local.sahten');
    expect(a.opener.opened).toContain('reveal:/Users/a/Sahten/Mi local.sahten');
  });
});

describe('respaldos junto al proyecto', () => {
  it('escribe .<nombre>.backup-…sahten en la carpeta del proyecto y lista solo los de ESTE proyecto', async () => {
    const fs = fakeFs({ '/p/Otro.sahten': 'x', '/p/.Otro.backup-2026-10-04.sahten': 'otro' });
    const st = createSiblingBackupStore({ fs }, createMemoryBackupStore());
    st.bind('k1', { path: '/p/Mi local.sahten', name: 'Mi local.sahten' });
    await st.put('k1', '.Mi local.backup-2026-10-05.sahten', 'B1'); await st.put('k1', '.Mi local.pre-estrategia.sahten', 'B2');
    expect(await st.list('k1')).toEqual(['.Mi local.backup-2026-10-05.sahten', '.Mi local.pre-estrategia.sahten']);
    expect(fs.files['/p/.Mi local.backup-2026-10-05.sahten']).toBe('B1');
    expect(await st.get('k1', '.Mi local.pre-estrategia.sahten')).toBe('B2'); expect(await st.get('k1', 'no-existe')).toBeNull();
    await st.remove('k1', '.Mi local.pre-estrategia.sahten'); expect(await st.list('k1')).toEqual(['.Mi local.backup-2026-10-05.sahten']);
  });
  it('sin archivo todavía (proyecto sin guardar) usa el almacén de respaldo en memoria', async () => {
    const st = createSiblingBackupStore({ fs: fakeFs() }, createMemoryBackupStore());
    await st.put('k', 'a', 'x'); expect(await st.get('k', 'a')).toBe('x'); expect(await st.list('k')).toEqual(['a']);
  });
  it('sesión completa en escritorio: respaldo diario, estrategia → deshacer idéntico, y otro proyecto en la misma carpeta no se mezcla', async () => {
    const fs = fakeFs(); const cfg = createMemoryConfig();
    const adapter = createTauriAdapter({ dialog: fakeDialog({ open: '/p/Mi local.sahten' }), fs }, cfg);
    const backupStore = createSiblingBackupStore({ fs }, createMemoryBackupStore());
    const f = emptyFile('Mi local'); f.project.id = 'pA'; f.catalog.productos = [{ id: 'a', name: 'A', priceAdj: 1 }];
    fs.files['/p/Mi local.sahten'] = serialize(f);
    fs.files['/p/.Otro.backup-2026-10-05.sahten'] = 'de otro proyecto';
    let app = null; const now = new Date(2026, 9, 5, 10);
    const session = createSession({ adapter, backupStore, config: cfg, now: () => now, timers: { set: () => 1, clear: () => {} },
      collect: () => JSON.parse(JSON.stringify(app)), apply: async x => { app = JSON.parse(JSON.stringify(x)); }, importProjection: () => {} });
    await session.openFromPicker();
    expect(Object.keys(fs.files).filter(p => p.includes('.backup-')).sort()).toEqual(['/p/.Mi local.backup-2026-10-05.sahten', '/p/.Otro.backup-2026-10-05.sahten']);
    const before = fs.files['/p/Mi local.sahten'];
    await session.backupBeforeStrategy();
    expect(fs.files['/p/.Mi local.pre-estrategia.sahten']).toBe(before);
    app.catalog.productos[0].priceAdj = 1.2; await session.saveNow();
    expect(fs.files['/p/Mi local.sahten']).not.toBe(before);
    expect(Object.keys(fs.files).some(p => p.endsWith('.tmp'))).toBe(false);
    await session.restoreBackup('preStrategy');
    expect(fs.files['/p/Mi local.sahten']).toBe(before);
    expect(fs.files['/p/.Otro.backup-2026-10-05.sahten']).toBe('de otro proyecto');
    expect((await session.backups()).daily.name).toBe('.Mi local.backup-2026-10-05.sahten');
  });
});

describe('configuración de la app (store de Tauri)', () => {
  it('se carga entera al arrancar y se lee en forma síncrona; las escrituras se guardan por detrás', async () => {
    const data = { recents: [{ id: 'p' }] }; let saved = 0;
    const store = { entries: async () => Object.entries(data), set: async (k, v) => { data[k] = v; }, save: async () => { saved++; } };
    const cfg = await createDesktopConfig({ load: async () => store });
    expect(cfg.get('recents')).toEqual([{ id: 'p' }]); expect(cfg.get('nada', 7)).toBe(7);
    cfg.set('theme', 'dark'); expect(cfg.get('theme')).toBe('dark');
    await cfg.flush(); expect(data.theme).toBe('dark'); expect(saved).toBe(1);
  });
});

function page() {
  const dom = new JSDOM('<body></body>', { url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.fetch = async () => ({ arrayBuffer: async () => new TextEncoder().encode('a,b\n1,2').buffer });
  const opened = []; w.open = u => { opened.push(u); return 'nativo'; };
  w.alert = m => { w.__alerts = (w.__alerts || []).concat(m); }; w._posToast = m => { w.__toasts = (w.__toasts || []).concat(m); };
  w.showConfirm = (t, text, ok) => { w.__confirm = { t, text, ok }; };
  return { w, opened };
}
const apis = (over = {}) => ({
  dialog: fakeDialog(over.dialog), fs: fakeFs(), opener: { opened: [], async openUrl(u) { this.opened.push(u); }, async openPath(p) { this.opened.push('path:' + p); } },
  updater: { async check() { return over.update || null; } }, process: { relaunched: 0, async relaunch() { this.relaunched++; } },
  event: { handlers: {}, async listen(n, fn) { this.handlers[n] = fn; } }, core: { async invoke(cmd) { return cmd === 'take_pending_file' ? (over.pending || null) : null; } },
  path: { async tempDir() { return '/tmp/'; } },
});

describe('integración con el sistema', () => {
  it('las «descargas» (CSV, ZIP, JSON) abren «Guardar como» y escriben el archivo', async () => {
    const { w } = page(); const a = apis({ dialog: { save: '/Users/a/Descargas/reporte.csv' } });
    installDesktop({ apis: a, project: {}, config: createMemoryConfig(), w });
    const link = w.document.createElement('a'); link.href = 'data:text/csv;charset=utf-8,a,b'; link.download = 'reporte.csv'; link.click();
    await new Promise(r => setTimeout(r, 20));
    expect(a.dialog.calls[0][1].defaultPath).toBe('reporte.csv');
    expect(new TextDecoder().decode(a.fs.files['/Users/a/Descargas/reporte.csv'])).toBe('a,b\n1,2');
    expect(w.__toasts[0]).toMatch(/reporte.csv/);
  });
  it('enlaces externos y WhatsApp salen al navegador del sistema; lo demás sigue igual', async () => {
    const { w, opened } = page(); const a = apis();
    installDesktop({ apis: a, project: {}, config: createMemoryConfig(), w });
    expect(w.open('https://wa.me/5491155550123?text=hola')).toBeNull();
    expect(a.opener.opened).toEqual(['https://wa.me/5491155550123?text=hola']);
    expect(w.open('', '_blank')).toBe('nativo'); expect(opened).toEqual(['']);
    const link = w.document.createElement('a'); link.href = 'https://example.com'; w.document.body.appendChild(link); link.click();
    expect(a.opener.opened).toContain('https://example.com');
  });
  it('doble clic en un .sahten: lo pendiente del arranque y los siguientes abren el proyecto', async () => {
    const { w } = page(); const a = apis({ pending: '/p/Mi local.sahten' }); a.fs.files['/p/Mi local.sahten'] = 'TEXTO'; a.fs.files['/p/Otro.sahten'] = 'TEXTO2';
    const opened = []; const project = { adapter: { openPath: async p => ({ text: a.fs.files[p], ref: { path: p, name: basename(p) }, name: basename(p) }) }, session: { openText: async (t, r, n) => { opened.push([t, n]); } } };
    installDesktop({ apis: a, project, config: createMemoryConfig(), w });
    await new Promise(r => setTimeout(r, 20));
    expect(opened).toEqual([['TEXTO', 'Mi local.sahten']]);
    await a.event.handlers['open-file']({ payload: '/p/Otro.sahten' });
    expect(opened.at(-1)).toEqual(['TEXTO2', 'Otro.sahten']);
  });
  it('un archivo que no se puede abrir avisa y no rompe', async () => {
    const { w } = page(); const a = apis(); const project = { adapter: { openPath: async () => { throw new Error('No existe'); } }, session: {} };
    const d = installDesktop({ apis: a, project, config: createMemoryConfig(), w }); await d.openPath('/x.sahten');
    expect(w.__alerts[0]).toMatch(/No se pudo abrir.*No existe/);
  });
  it('actualizaciones: avisa, pide confirmar, descarga e instala y reinicia; sin novedades o sin internet no molesta', async () => {
    const { w } = page(); const installs = [];
    const a = apis({ update: { version: '4.1.0', body: 'Mejoras', downloadAndInstall: async () => { installs.push(1); } } });
    const d = installDesktop({ apis: a, project: {}, config: createMemoryConfig(), w, now: () => 1e12 });
    await d.checkForUpdates();
    expect(w.__confirm.t).toMatch(/4\.1\.0/); await w.__confirm.ok();
    expect(installs).toEqual([1]); expect(a.process.relaunched).toBe(1);
    const b = apis(); const d2 = installDesktop({ apis: b, project: {}, config: createMemoryConfig(), w: page().w });
    expect(await d2.checkForUpdates({ silent: true })).toBeNull();
    const c = apis(); c.updater.check = async () => { throw new Error('offline'); }; const pg = page();
    expect(await installDesktop({ apis: c, project: {}, config: createMemoryConfig(), w: pg.w }).checkForUpdates({ silent: true })).toBeNull(); expect(pg.w.__alerts).toBeUndefined();
  });
  it('carpeta del menú publicado y vista previa', async () => {
    const { w } = page(); const a = apis({ dialog: { open: 'C:\\Menu' } });
    const d = installDesktop({ apis: a, project: {}, config: createMemoryConfig(), w });
    const r = await d.writeFolder([{ path: 'index.html', data: '<html>' }, { path: 'img/a.jpg', data: Uint8Array.from([1, 2]) }]);
    expect(r).toEqual({ dir: 'C:\\Menu', files: 2 });
    expect(a.fs.files['C:\\Menu\\index.html']).toBe('<html>'); expect(a.fs.files['C:\\Menu\\img\\a.jpg']).toBeInstanceOf(Uint8Array);
    await d.openPreview('<p>hola</p>');
    expect(a.fs.files['/tmp/sahten-menu-preview.html']).toBe('<p>hola</p>'); expect(a.opener.opened.at(-1)).toBe('path:/tmp/sahten-menu-preview.html');
  });
});
