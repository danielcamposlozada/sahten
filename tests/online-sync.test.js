// Sincronización y roles contra el esquema REAL de Supabase (PGlite): lo que hace la app llama a las mismas funciones SQL.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { root, readJSON } from './helpers.js';
import { createSync, decide, mergeOps, stripForSync, syncHash, BACKOFF_MS } from '../src/online/sync.js';
import { SupabaseError } from '../src/online/supabase.js';
import { migrate, emptyFile } from '../src/project/schema.js';
import { toPublicProject } from '../src/online/roles.js';
import { stateFromSahten } from '../src/core/projectFile.js';
import { mostradorFinalPrice, channelPrice } from '../src/core/index.js';

const schema = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const prelude = fs.readFileSync(path.join(root, 'tests/fixtures/supabase-prelude.sql'), 'utf8');
const ID = { owner: '00000000-0000-0000-0000-0000000000a1', enc: '00000000-0000-0000-0000-0000000000a2', caj: '00000000-0000-0000-0000-0000000000a3', lec: '00000000-0000-0000-0000-0000000000a4' };
const MAIL = { owner: 'duena@x.com', enc: 'enc@x.com', caj: 'caj@x.com', lec: 'lec@x.com' };
let db;

/** Cliente de Supabase de mentira que ejecuta las funciones SQL como ese usuario (misma interfaz que createClient). */
function pgClient(who, { offline = false } = {}) {
  const run = async fn => {
    if (offline) throw new SupabaseError('Sin conexión con Supabase. Revisá tu internet.', { offline: true });
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${ID[who]}',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: ID[who], email: MAIL[who] })}',false); set role authenticated`);
    try { return await fn(); } finally { await db.exec('reset role'); }
  };
  const cast = (k) => (k === 'p_name' ? 'text' : k.startsWith('p_') ? 'jsonb' : k === 'pid' ? 'uuid' : k === 'base_version' ? 'bigint' : 'text');
  return {
    auth: { token: async () => 'tok-' + who, user: { id: ID[who], email: MAIL[who] } },
    async rpc(name, args) {
      return run(async () => {
        const keys = Object.keys(args); const vals = keys.map(k => (cast(k) === 'jsonb' ? (args[k] === null ? null : JSON.stringify(args[k])) : args[k]));
        const sql = `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}::${cast(k)}`).join(', ')}) as r`;
        try { return (await db.query(sql, vals)).rows[0].r; } catch (e) { throw new SupabaseError(String(e.message), { status: 403, code: '42501' }); }
      });
    },
    async raw(p) {
      return run(async () => { const m = /id=eq\.([0-9a-f-]+)/.exec(p); return (await db.query('select id, version, updated_at, name from public.projects where id = $1', [m[1]])).rows; });
    },
  };
}

/** Un «equipo»: su archivo local, su carpeta de config y sus ganchos. */
function device(who, { remoteId = null, file, client } = {}) {
  const d = { file: JSON.parse(JSON.stringify(file || emptyFile('La Esquina'))), remoteId, cfg: {}, applied: [], timers: [], role: who === 'owner' ? 'owner' : who };
  const timer = { set: (fn, ms) => { d.timers.push({ fn, ms }); return d.timers.length; }, clear: id => { if (d.timers[id - 1]) d.timers[id - 1].fn = null; } };
  d.client = client || pgClient(who);
  d.sync = createSync({
    client: d.client, remoteId: () => d.remoteId, setRemoteId: id => { d.remoteId = id; }, role: () => d.role, projectId: () => 'local-1',
    collect: () => JSON.parse(JSON.stringify(d.file)), apply: async f => { d.file = JSON.parse(JSON.stringify(f)); d.applied.push(f); },
    publicOf: f => toPublicProject(f, () => ({ mostrador: 1000 })),
    store: { get: (k, dflt) => (k in d.cfg ? d.cfg[k] : dflt), set: (k, v) => { d.cfg[k] = v; } }, timer, now: () => Date.now(),
  });
  return d;
}
const withProducts = n => { const f = emptyFile('La Esquina'); f.catalog.productos = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, category: 'X' })); f.images = { p0: 'data:image/png;base64,AAAA' }; return f; };
const remote = async id => (await db.query('select version, data, public from public.projects where id = $1', [id])).rows[0];

beforeAll(async () => {
  db = new PGlite(); await db.exec(prelude);
  for (const k of Object.keys(ID)) await db.query('insert into auth.users (id, email) values ($1,$2)', [ID[k], MAIL[k]]);
  await db.exec(schema);
}, 60000);

describe('decisión', () => {
  it('push / pull / noop / conflicto según qué lado cambió', () => {
    const last = { hash: 'h1', version: 3 };
    expect(decide({ localHash: 'h1', last, remoteVersion: 3 })).toBe('noop');
    expect(decide({ localHash: 'h2', last, remoteVersion: 3 })).toBe('push');
    expect(decide({ localHash: 'h1', last, remoteVersion: 4 })).toBe('pull');
    expect(decide({ localHash: 'h2', last, remoteVersion: 4 })).toBe('conflict');
    expect(decide({ localHash: 'h1', last: null, remoteVersion: null })).toBe('push');
    expect(decide({ localHash: 'h1', last: null, remoteVersion: 2 })).toBe('conflict');
  });
  it('mergeOps: une por id, gana el más reciente', () => {
    const f = emptyFile(); f.sales.orders = [{ id: 'a', createdAt: '2026-01-01', status: 'pendiente', updatedAt: '2026-01-01' }];
    const m = mergeOps(f, { sales: { orders: [{ id: 'a', createdAt: '2026-01-01', status: 'listo', updatedAt: '2026-01-02' }, { id: 'b', createdAt: '2026-01-03' }] } });
    expect(m.sales.orders.map(o => o.id)).toEqual(['b', 'a']); expect(m.sales.orders.find(o => o.id === 'a').status).toBe('listo');
    expect(mergeOps(f, null)).toBe(f);
  });
  it('lo que viaja a la nube no lleva imágenes', () => { expect(stripForSync(withProducts(2)).images).toEqual({}); });
});

describe('dueño: local primero, nube por detrás', () => {
  let A, B, rid;
  it('vincular sube el proyecto (sin imágenes) y deja la versión 1', async () => {
    A = device('owner', { file: withProducts(2) });
    rid = await A.sync.link();
    expect(A.remoteId).toBe(rid); expect(A.sync.info()).toMatchObject({ state: 'al día', version: 1, linked: true });
    const r = await remote(rid); expect(r.version).toBe(1); expect(r.data.catalog.productos).toHaveLength(2); expect(r.data.images).toEqual({});
  });
  it('un cambio local se sube solo (versión 2); sin cambios no sube nada', async () => {
    expect((await A.sync.sync()).action).toBe('noop');
    A.file.catalog.productos[0].name = 'Renombrado';
    expect(await A.sync.sync()).toMatchObject({ action: 'push', version: 2 });
    expect((await remote(rid)).data.catalog.productos[0].name).toBe('Renombrado');
  });
  it('otro equipo del mismo dueño baja la versión nueva y conserva SUS imágenes', async () => {
    B = device('owner', { remoteId: rid, file: withProducts(2) });
    B.file.images = { p1: 'data:image/png;base64,BBBB' };
    expect((await B.sync.sync()).action).toBe('conflict');             // nunca se había sincronizado y la nube ya tiene datos: no pisa a ciegas
    expect(await B.sync.resolve('theirs')).toMatchObject({ action: 'pull', version: 2 });
    expect(B.file.catalog.productos[0].name).toBe('Renombrado'); expect(B.file.images).toEqual({ p1: 'data:image/png;base64,BBBB' });
    expect((await B.sync.sync()).action).toBe('noop');
  });
  it('cambia solo la nube → baja (pull) sin tocar lo local', async () => {
    A.file.catalog.productos[1].name = 'Desde A'; await A.sync.sync();
    expect(await B.sync.sync()).toMatchObject({ action: 'pull', version: 3 });
    expect(B.file.catalog.productos[1].name).toBe('Desde A');
  });
  it('cambian los DOS lados → conflicto con aviso; elegir «mía» o «de la nube»', async () => {
    A.file.catalog.productos[0].name = 'Versión de A'; await A.sync.sync();             // v4
    B.file.catalog.productos[0].name = 'Versión de B';
    const r = await B.sync.sync();
    expect(r.action).toBe('conflict'); expect(B.sync.info().state).toBe('conflicto'); expect(r.conflict.remote.version).toBe(4);
    expect((await remote(rid)).data.catalog.productos[0].name).toBe('Versión de A');   // no se pisó
    expect(await B.sync.resolve('mine')).toMatchObject({ action: 'push', version: 5 });
    expect((await remote(rid)).data.catalog.productos[0].name).toBe('Versión de B');
    // A elige la de la nube
    A.file.catalog.productos[0].name = 'Otro cambio de A';
    expect((await A.sync.sync()).action).toBe('conflict');
    expect(await A.sync.resolve('theirs')).toMatchObject({ action: 'pull', version: 5 });
    expect(A.file.catalog.productos[0].name).toBe('Versión de B');
  });
  it('una carrera (alguien guardó entre medio) se detecta en el servidor y no pisa', async () => {
    A.file.catalog.productos[0].name = 'Cambio de A';
    const realRaw = A.client.raw; A.client.raw = async p => { const r = await realRaw(p); await db.query("update public.projects set version = version + 1 where id = $1", [rid]); return r; };
    const r = await A.sync.sync();
    A.client.raw = realRaw;
    expect(r.action).toBe('conflict');
  });
  it('sin conexión: queda pendiente, reintenta con espera creciente y se pone al día al volver', async () => {
    const C = device('owner', { file: withProducts(1) }); const rid2 = await C.sync.link();
    C.file.catalog.productos[0].name = 'Offline';
    const on = C.client; C.sync = createSync({ ...{}, client: pgClient('owner', { offline: true }), remoteId: () => rid2, setRemoteId() {}, role: () => 'owner', projectId: () => 'local-1',
      collect: () => JSON.parse(JSON.stringify(C.file)), apply: async f => { C.file = f; }, publicOf: () => ({}), store: { get: (k, d) => (k in C.cfg ? C.cfg[k] : d), set: (k, v) => { C.cfg[k] = v; } }, timer: { set: (fn, ms) => { C.timers.push({ fn, ms }); return C.timers.length; }, clear: () => {} } });
    expect((await C.sync.sync()).action).toBe('offline');
    expect(C.sync.info()).toMatchObject({ state: 'sin conexión', pending: true });
    expect(C.timers.at(-1).ms).toBe(BACKOFF_MS[0]);
    await C.sync.sync(); expect(C.timers.at(-1).ms).toBe(BACKOFF_MS[1]);
    expect((await remote(rid2)).data.catalog.productos[0].name).toBe('P0');                   // la nube sigue igual: el local está a salvo
    // vuelve internet
    const back = createSync({ client: on, remoteId: () => rid2, setRemoteId() {}, role: () => 'owner', projectId: () => 'local-1', collect: () => JSON.parse(JSON.stringify(C.file)), apply: async f => { C.file = f; }, publicOf: () => ({}), store: { get: (k, d) => (k in C.cfg ? C.cfg[k] : d), set: (k, v) => { C.cfg[k] = v; } } });
    expect((await back.sync()).action).toBe('push');
    expect((await remote(rid2)).data.catalog.productos[0].name).toBe('Offline');
  });
  it('schedule(): junta los cambios y sincroniza 5 s después', async () => {
    const D = device('owner', { file: withProducts(1) }); await D.sync.link();
    D.sync.schedule(); D.sync.schedule();
    const live = D.timers.filter(t => t.fn); expect(live).toHaveLength(1); expect(live[0].ms).toBe(5000);
  });
});

describe('roles en la nube', () => {
  let rid, O, ENC, CAJ, LEC;
  beforeAll(async () => {
    const f = withProducts(2); f.costs.gastosOp = [{ id: 'g', name: 'Alquiler', amount: 1000 }];
    O = device('owner', { file: f }); rid = await O.sync.link();
    for (const [who, role] of [['enc', 'encargado'], ['caj', 'cajero'], ['lec', 'lectura']]) {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${ID.owner}',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: ID.owner, email: MAIL.owner })}',false); set role authenticated`);
      await db.query('select public.invite_member($1,$2,$3)', [rid, MAIL[who], role]); await db.exec('reset role');
      await pgClient(who).rpc('accept_invites', {});
    }
    ENC = device('enc', { remoteId: rid }); CAJ = device('caj', { remoteId: rid }); LEC = device('lec', { remoteId: rid });
    ENC.role = 'encargado'; CAJ.role = 'cajero'; LEC.role = 'lectura';
  });
  it('el encargado sube pedidos y stock; el dueño los recibe al sincronizar', async () => {
    ENC.file.sales.orders = [{ id: 'o-enc', createdAt: '2026-10-05T10:00:00Z', total: 5000 }]; ENC.file.stock.items = { harina: { actual: 10 } };
    expect((await ENC.sync.sync()).action).toBe('ops');
    expect((await O.sync.sync()).action).toBe('noop');
    expect(O.file.sales.orders.map(o => o.id)).toContain('o-enc'); expect(O.file.stock.items.harina.actual).toBe(10);
  });
  it('el cajero sube sus pedidos pero NO el stock', async () => {
    CAJ.file.sales.orders = [{ id: 'o-caj', createdAt: '2026-10-05T11:00:00Z', total: 100 }]; CAJ.file.stock.items = { harina: { actual: 999 } };
    expect((await CAJ.sync.sync()).action).toBe('ops');
    await O.sync.sync();
    expect(O.file.sales.orders.map(o => o.id)).toEqual(expect.arrayContaining(['o-enc', 'o-caj']));
    expect(O.file.stock.items.harina.actual).toBe(10);                                             // el cajero no pisó el stock
  });
  it('encargado y cajero reciben la versión SIN costos; el dueño y lectura, la completa', async () => {
    expect(ENC.applied.length).toBeGreaterThan(0);
    expect(JSON.stringify(ENC.applied.at(-1))).not.toMatch(/Alquiler/);
    expect(ENC.file.catalog.productos[0].fixedPrices).toEqual({ mostrador: 1000 });
    expect(JSON.stringify(ENC.file.costs.gastosOp)).toBe('[]');
    expect((await LEC.sync.sync()).action).toBe('readonly');
    expect(LEC.file.costs.gastosOp[0].name).toBe('Alquiler');
  });
  it('lectura nunca sube nada', async () => {
    LEC.sync.schedule(); expect(LEC.timers.filter(t => t.fn)).toHaveLength(0);
    await expect(pgClient('lec').rpc('save_project', { pid: rid, p_data: {}, p_public: {}, base_version: 1 })).rejects.toThrow();
  });
  it('quien no es dueño ni administrador no puede subir el proyecto completo ni ver costos por la API', async () => {
    await expect(pgClient('enc').rpc('save_project', { pid: rid, p_data: {}, p_public: {}, base_version: 1 })).rejects.toThrow();
    await expect(pgClient('caj').rpc('get_project_data', { pid: rid })).rejects.toThrow();
  });
});

describe('precios sin costos', () => {
  it('la versión pública lleva los precios ya calculados y el encargado los ve igual que el dueño', () => {
    const file = migrate(readJSON('tests/fixtures/demo-raw-v3.sahten')).file;
    const s = stateFromSahten(file);
    const pub = toPublicProject(file, p => Object.fromEntries(s.channels.filter(c => c.enabled).map(c => [c.id, channelPrice(s, p, c.id)])));
    const text = JSON.stringify(pub);
    ['receta_cost', 'precioPkg', 'gastosOp', 'ingredients":[{'].forEach(k => expect(text).not.toContain(k));
    expect(pub.channels.every(c => c.commission === 0 && c.surcharge === 0)).toBe(true);        // ni comisiones ni recargos
    // el encargado abre esos datos: el cálculo de precios usa fixedPrices
    const fileStaff = JSON.parse(JSON.stringify(file)); fileStaff.catalog.ingredientes = []; fileStaff.catalog.productos = pub.products;
    const st = stateFromSahten(fileStaff);
    for (const p of s.products.filter(p => !p.recetaOnly)) {
      const q = st.products.find(x => x.id === p.id);
      expect(mostradorFinalPrice(st, q)).toBe(mostradorFinalPrice(s, p));
      expect(channelPrice(st, q, 'rappi')).toBe(channelPrice(s, p, 'rappi'));
    }
  });
});
