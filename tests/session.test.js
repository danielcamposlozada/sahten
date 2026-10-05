import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, AUTOSAVE_MS } from '../src/project/session.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';
import { createMemoryBackupStore } from '../src/project/adapters/backupStores.js';
import { createMemoryConfig } from '../src/project/appConfig.js';
import { legacyToFile, serialize, emptyFile, migrate } from '../src/project/schema.js';
import { readJSON } from './helpers.js';
import { summarizeDiff, describeDiff } from '../src/project/diff.js';

// «App» de mentira: guarda el último archivo aplicado y deja editarlo; collect() lo devuelve.
function makeEnv({ adapter } = {}) {
  const env = { clock: new Date(2026, 9, 5, 10, 0, 0), app: null, timers: [], applied: 0 };
  env.adapter = adapter || createMemoryAdapter();
  env.backups = createMemoryBackupStore();
  env.writes = 0;
  const w = env.adapter.write.bind(env.adapter); env.adapter.write = async (r, t) => { env.writes++; return w(r, t); };
  env.session = createSession({
    adapter: env.adapter, backupStore: env.backups, config: createMemoryConfig(),
    collect: () => JSON.parse(JSON.stringify(env.app)),
    apply: async f => { env.app = JSON.parse(JSON.stringify(f)); env.applied++; },
    importProjection: f => { env.app.projections.snapshots.push(...f.projections.snapshots); },
    now: () => env.clock,
    timers: { set: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; }, clear: id => { if (env.timers[id - 1]) env.timers[id - 1].fn = null; } },
  });
  env.flush = async () => { const t = env.timers.filter(x => x.fn); env.timers = []; for (const x of t) await x.fn(); };
  return env;
}
const sampleFile = () => ({ ...migrate(readJSON('tests/fixtures/demo-raw-v3.sahten')).file, project: { name: 'Demo', id: 'pDemo' }, modifiedAt: '2026-10-01T00:00:00.000Z' });
const sampleText = () => serialize(sampleFile());
const open = async (env, name = 'Demo.sahten', text = sampleText()) => { env.adapter.queueOpen(name, text); return env.session.openFromPicker(); };

describe('abrir y guardar', () => {
  let env; beforeEach(() => { env = makeEnv(); });

  it('abrir carga el proyecto y NO escribe el archivo si no hubo cambios', async () => {
    await open(env);
    expect(env.session.info()).toMatchObject({ status: 'saved', name: 'Demo' });
    await env.session.saveNow();
    expect(env.writes).toBe(0);
  });
  it('guardado automático: se agenda 2 s después del cambio y pasa dirty → saving → saved', async () => {
    await open(env);
    const seen = []; env.session.onChange(i => seen.push(i.status));
    env.app.project.name = 'Otro nombre';
    env.session.markDirty();
    expect(env.timers.at(-1).ms).toBe(AUTOSAVE_MS);
    expect(env.session.info().status).toBe('dirty');
    await env.flush();
    expect(seen).toEqual(['dirty', 'saving', 'saved']);
    expect(env.writes).toBe(1);
    expect(JSON.parse(env.adapter.store['Demo.sahten']).project.name).toBe('Otro nombre');
    expect(env.session.info().savedAt).toEqual(env.clock);
  });
  it('varios cambios seguidos reinician el temporizador (un solo guardado)', async () => {
    await open(env);
    env.app.project.name = 'a'; env.session.markDirty();
    env.app.project.name = 'b'; env.session.markDirty();
    await env.flush();
    expect(env.writes).toBe(1);
  });
  it('modifiedAt cambia solo cuando cambia el contenido', async () => {
    await open(env);
    env.clock = new Date(2026, 9, 5, 11, 0, 0);
    await env.session.saveNow({ force: true });
    expect(JSON.parse(env.adapter.store['Demo.sahten']).modifiedAt).toBe('2026-10-01T00:00:00.000Z');
    env.app.catalog.productos[0].priceAdj = 1.1;
    await env.session.saveNow();
    expect(JSON.parse(env.adapter.store['Demo.sahten']).modifiedAt).toBe(env.clock.toISOString());
  });
  it('error de escritura: estado «error», el mensaje queda visible y se puede reintentar', async () => {
    await open(env);
    env.adapter.write = async () => { throw new Error('Disco lleno'); };
    env.app.project.name = 'x';
    await expect(env.session.saveNow()).rejects.toThrow('Disco lleno');
    expect(env.session.info()).toMatchObject({ status: 'error', error: 'Disco lleno' });
  });
  it('un archivo sin id de proyecto lo recibe y se escribe una sola vez', async () => {
    const f = sampleFile(); delete f.project.id;
    await open(env, 'SinId.sahten', serialize(f));
    await env.flush();
    expect(env.writes).toBe(1);
    expect(JSON.parse(env.adapter.store['SinId.sahten']).project.id).toBeTruthy();
  });
  it('un navegador sin acceso a archivos no guarda solo: queda «dirty» y avisa', async () => {
    const e = makeEnv({ adapter: createMemoryAdapter({ canAutosave: false }) });
    await open(e);
    e.app.project.name = 'x'; e.session.markDirty();
    expect(e.timers.filter(t => t.fn)).toHaveLength(0);
    expect(e.session.info()).toMatchObject({ status: 'dirty', canAutosave: false });
  });
  it('conserva online.supabase y claves desconocidas aunque esta instalación no las use', async () => {
    const f = migrate(sampleText()).file; f.online.supabase = { url: 'https://x.supabase.co', anonKey: 'k', storeId: 's' }; f.futuro = { v: 1 };
    await open(env, 'Online.sahten', serialize(f));
    env.app.online.supabase = { url: '', anonKey: '', storeId: '' }; delete env.app.futuro; // el estado de una instalación sin online no los trae
    env.app.catalog.productos[0].priceAdj = 1.2;
    await env.session.saveNow();
    const saved = JSON.parse(env.adapter.store['Online.sahten']);
    expect(saved.online.supabase.url).toBe('https://x.supabase.co');
    expect(saved.futuro).toEqual({ v: 1 });
  });
});

describe('abrir / nuevo / duplicar / exportar', () => {
  it('un .json de versiones anteriores se convierte y queda «sin guardar» hasta guardar como .sahten', async () => {
    const env = makeEnv();
    const legacy = readJSON('tests/fixtures/legacy/v3-pizzeria.json');
    env.adapter.queueOpen('viejo.json', JSON.stringify(legacy));
    const r = await env.session.openFromPicker();
    expect(r.converted).toBe(true);
    expect(env.session.info()).toMatchObject({ status: 'unsaved', hasFile: false });
    env.adapter.queueSaveAs('Convertido.sahten');
    await env.session.saveNow();
    expect(JSON.parse(env.adapter.store['Convertido.sahten']).format).toBe('sahten');
    expect(env.session.info().status).toBe('saved');
  });
  it('nuevo proyecto: vacío, con asistente (fresh) y archivo elegido', async () => {
    const env = makeEnv(); env.adapter.queueSaveAs('Mi local.sahten');
    await env.session.newProject('Mi local');
    expect(env.session.info()).toMatchObject({ status: 'saved', name: 'Mi local' });
    expect(Object.keys(env.adapter.store)).toContain('Mi local.sahten');
    expect(env.app.catalog.productos).toEqual([]);
  });
  it('duplicar crea otro archivo con id y nombre nuevos y pasa a ser el abierto', async () => {
    const env = makeEnv(); await open(env);
    const id = env.session.id;
    env.adapter.queueSaveAs('Demo (copia).sahten');
    await env.session.duplicate();
    expect(env.session.id).not.toBe(id);
    expect(env.session.name).toBe('Demo (copia)');
    expect(JSON.parse(env.adapter.store['Demo (copia).sahten']).catalog.productos.length).toBe(JSON.parse(env.adapter.store['Demo.sahten']).catalog.productos.length);
  });
  it('exportar copia no cambia el proyecto abierto', async () => {
    const env = makeEnv(); await open(env); const id = env.session.id;
    env.adapter.queueSaveAs('Copia.sahten');
    await env.session.exportCopy();
    expect(env.session.id).toBe(id);
    expect(env.adapter.store['Copia.sahten']).toBeTruthy();
    expect(env.session.info().name).toBe('Demo');
  });
  it('una proyección exportada se agrega al proyecto abierto', async () => {
    const env = makeEnv(); await open(env);
    env.adapter.queueOpen('Proyeccion.json', JSON.stringify(readJSON('tests/fixtures/legacy/Proyeccion_Mostrador_60.json')));
    const r = await env.session.openFromPicker();
    expect(r.kind).toBe('projection');
    expect(env.app.projections.snapshots).toHaveLength(1);
  });
  it('proyectos recientes', async () => {
    const env = makeEnv(); await open(env);
    expect(env.session.recents()[0]).toMatchObject({ name: 'Demo' });
    const id = env.session.id;
    await env.session.openRecent(id);
    expect(env.session.recents()).toHaveLength(1);
  });
});

describe('respaldos', () => {
  let env; beforeEach(() => { env = makeEnv(); });
  const names = () => env.backups.list(env.session.id);

  it('diario: al abrir por primera vez en el día, y se acumula el historial', async () => {
    await open(env);
    expect(await names()).toEqual(['.Demo.backup-2026-10-05.sahten']);
    await open(env);                                    // mismo día: no duplica
    expect(await names()).toEqual(['.Demo.backup-2026-10-05.sahten']);
    env.clock = new Date(2026, 9, 6, 9, 0, 0);
    env.adapter.store['Demo.sahten'] = env.adapter.store['Demo.sahten'];
    await open(env, 'Demo.sahten', env.adapter.store['Demo.sahten']);
    expect((await names()).sort()).toEqual(['.Demo.backup-2026-10-05.sahten', '.Demo.backup-2026-10-06.sahten']);
  });
  it('el respaldo diario guarda el archivo tal como estaba al abrir', async () => {
    const text = sampleText(); await open(env, 'Demo.sahten', text);
    expect(await env.backups.get(env.session.id, '.Demo.backup-2026-10-05.sahten')).toBe(text);
  });
  it('estrategia: aplicar → deshacer deja el archivo IDÉNTICO byte a byte', async () => {
    await open(env);
    await env.session.saveNow({ force: true });
    const before = env.adapter.store['Demo.sahten'];
    await env.session.backupBeforeStrategy();
    // «aplicar estrategia»: cambia precios y se guarda
    env.app.catalog.productos.forEach(p => { p.priceAdj = 1.1; });
    env.clock = new Date(2026, 9, 5, 12, 0, 0);
    await env.session.saveNow();
    expect(env.adapter.store['Demo.sahten']).not.toBe(before);
    // «deshacer»
    await env.session.restoreBackup('preStrategy');
    expect(env.adapter.store['Demo.sahten']).toBe(before);
    expect(env.app.catalog.productos.some(p => p.priceAdj === 1.1)).toBe(false);
    // y si la app vuelve a guardar sin cambios, el archivo no se toca
    await env.session.saveNow();
    expect(env.adapter.store['Demo.sahten']).toBe(before);
  });
  it('restaurar el respaldo de ayer guarda antes lo de hoy (pre-restauración) y se puede volver', async () => {
    await open(env);
    const yesterday = env.adapter.store['Demo.sahten'];
    env.app.catalog.productos[0].priceAdj = 1.5;
    await env.session.saveNow();
    const today = env.adapter.store['Demo.sahten'];
    await env.session.restoreBackup('daily');
    expect(env.adapter.store['Demo.sahten']).toBe(yesterday);
    expect(await env.session.readBackup('preRestore')).toBe(today);
    await env.session.restoreBackup('preRestore');
    expect(env.adapter.store['Demo.sahten']).toBe(today);
  });
  it('listBackups indica qué hay disponible', async () => {
    await open(env);
    expect(await env.session.backups()).toMatchObject({ daily: { date: '2026-10-05' }, preStrategy: null, preRestore: null });
    await env.session.backupBeforeStrategy();
    expect((await env.session.backups()).preStrategy).toBe('.Demo.pre-estrategia.sahten');
  });
  it('resumen de diferencias: precios, costos y GF', async () => {
    await open(env);
    const a = migrate(env.adapter.store['Demo.sahten']).file;
    const b = JSON.parse(JSON.stringify(a));
    b.catalog.productos[0].priceAdj = 1.2;
    b.costs.gastosOp[0] = { id: 'x', name: 'Alquiler', amount: 5000 };
    const d = summarizeDiff(a, b);
    expect(d.same).toBe(false);
    expect(d.gf.to).toBeGreaterThanOrEqual(0);
    expect(summarizeDiff(a, a).same).toBe(true);
    expect(describeDiff(summarizeDiff(a, a))).toEqual(['No hay diferencias en precios, costos ni gastos fijos.']);
  });
});

describe('reemplazar el contenido del proyecto (importar)', () => {
  it('conserva archivo, id y lugar; guarda antes lo anterior y se puede deshacer', async () => {
    const env = makeEnv(); await open(env); const id = env.session.id;
    const antes = env.adapter.store['Demo.sahten'];
    const otro = sampleFile(); otro.project = { name: 'Otro negocio' }; otro.catalog.productos = otro.catalog.productos.slice(0, 3);
    await env.session.replaceWith(serialize(otro));
    expect(env.session.id).toBe(id);
    expect(env.app.catalog.productos).toHaveLength(3);
    expect(env.session.info().status).toBe('dirty');
    await env.flush();
    const guardado = JSON.parse(env.adapter.store['Demo.sahten']);
    expect(guardado.catalog.productos).toHaveLength(3); expect(guardado.project.id).toBe(id);
    expect((await env.session.backups()).preStrategy).toBeTruthy();
    await env.session.restoreBackup('preStrategy');
    expect(JSON.parse(env.adapter.store['Demo.sahten']).catalog.productos).toHaveLength(JSON.parse(antes).catalog.productos.length);
  });
  it('no acepta una proyección suelta ni funciona sin proyecto abierto', async () => {
    const env = makeEnv();
    await expect(env.session.replaceWith('{}')).rejects.toThrow(/Abrí un proyecto/);
    await open(env);
    await expect(env.session.replaceWith(JSON.stringify(readJSON('tests/fixtures/legacy/Proyeccion_Mostrador_60.json')))).rejects.toThrow(/proyección/);
  });
  it('info() trae la ruta del archivo (escritorio) y su nombre', async () => {
    const env = makeEnv(); await open(env, 'Demo.sahten');
    expect(env.session.info()).toMatchObject({ fileName: 'Demo.sahten', hasFile: true });
    env.session.info().path === null || expect(env.session.info().path).toBeTruthy();
  });
});

describe('historial de respaldos: 14 días y viaja con el proyecto', () => {
  it('conserva los últimos 14 días y borra lo más viejo', async () => {
    const { createMemoryBackupStore } = await import('../src/project/adapters/backupStores.js');
    const { dailyBackup, listDailies } = await import('../src/project/backups.js');
    const st = createMemoryBackupStore();
    for (let i = 20; i >= 0; i--) await dailyBackup(st, 'k', 'P', 'x', new Date(2026, 5, 30 - i));
    const l = await listDailies(st, 'k');
    expect(l).toHaveLength(14); expect(l[0].date).toBe('2026-06-30'); expect(l[13].date).toBe('2026-06-17');
    expect((await dailyBackup(st, 'k', 'P', 'x', new Date(2026, 5, 30, 18))).written).toBe(false);
  });
});
