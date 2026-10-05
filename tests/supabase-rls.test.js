// El esquema de Supabase (supabase/schema.sql) probado en un Postgres real (PGlite): RLS, roles y funciones.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './helpers.js';

const schema = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const prelude = fs.readFileSync(path.join(root, 'tests/fixtures/supabase-prelude.sql'), 'utf8');
const U = { owner: '00000000-0000-0000-0000-000000000001', admin: '00000000-0000-0000-0000-000000000002', enc: '00000000-0000-0000-0000-000000000003',
  caj: '00000000-0000-0000-0000-000000000004', lec: '00000000-0000-0000-0000-000000000005', otro: '00000000-0000-0000-0000-000000000006' };
const MAIL = { owner: 'duena@x.com', admin: 'admin@x.com', enc: 'enc@x.com', caj: 'caj@x.com', lec: 'lec@x.com', otro: 'otro@x.com' };

let db;
/** Ejecuta `fn` como un rol de Supabase (anon / authenticated con un usuario / superusuario). */
async function as(who, fn) {
  if (who === 'su') { await db.exec('reset role'); return fn(); }
  if (who === 'anon') { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claims','',false); set role anon"); return fn(); }
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[who]}',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: U[who], email: MAIL[who] })}',false); set role authenticated`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const q = (sql, p) => db.query(sql, p).then(r => r.rows);
const fails = async (fn, re) => { let err = null; try { await fn(); } catch (e) { err = e; } expect(err, 'debía fallar').toBeTruthy(); if (re) expect(String(err.message)).toMatch(re); };
const j = o => JSON.stringify(o);

let PID, STORE;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(prelude);
  for (const k of Object.keys(U)) await db.query('insert into auth.users (id, email) values ($1,$2)', [U[k], MAIL[k]]);
  await db.exec(schema);
  PID = (await as('owner', () => q(`select public.create_project('La Esquina', $1::jsonb, $2::jsonb) as id`, [j({ project: { name: 'La Esquina' }, costs: { gastosOp: [{ amount: 100 }] } }), j({ products: [{ id: 'p', price: 1000 }] })])))[0].id;
  STORE = (await as('owner', () => q(`insert into public.stores (slug, name, owner, project_id) values ('la-esquina','La Esquina',$1,$2) returning id`, [U.owner, PID])))[0].id;
  await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, MAIL.admin, 'admin']));
  await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, MAIL.enc, 'encargado']));
  await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, MAIL.caj, 'cajero']));
  await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, MAIL.lec, 'lectura']));
  for (const k of ['admin', 'enc', 'caj', 'lec']) await as(k, () => db.query('select public.accept_invites()'));
}, 60000);

describe('esquema', () => {
  it('se puede correr dos veces (idempotente)', async () => { await db.exec(schema); });
  it('el creador queda como dueño y las invitaciones aceptadas como miembros con su rol', async () => {
    const m = await as('su', () => q('select user_id, role from public.project_members where project_id = $1 order by role', [PID]));
    expect(Object.fromEntries(m.map(x => [x.user_id, x.role]))).toEqual({ [U.owner]: 'owner', [U.admin]: 'admin', [U.enc]: 'encargado', [U.caj]: 'cajero', [U.lec]: 'lectura' });
  });
});

describe('visitante anónimo (el menú público y los pedidos)', () => {
  it('lee solo id, slug y nombre de las tiendas, y el menú', async () => {
    await as('owner', () => db.query('insert into public.menus (store_id, json) values ($1,$2::jsonb)', [STORE, j({ products: [{ id: 'p' }] })]));
    const rows = await as('anon', () => q('select id, slug, name from public.stores'));
    expect(rows[0].slug).toBe('la-esquina');
    expect((await as('anon', () => q('select json from public.menus')))[0].json.products).toHaveLength(1);
    await as('anon', () => fails(() => q('select owner from public.stores'), /permission denied/));
  });
  it('puede crear un pedido pendiente de una tienda que existe', async () => {
    await as('anon', () => db.query('insert into public.orders (store_id, payload) values ($1,$2::jsonb)', [STORE, j({ customerName: 'Ana', items: [] })]));
    expect((await as('su', () => q('select count(*)::int as n from public.orders')))[0].n).toBe(1);
  });
  it('no puede crear pedidos inválidos: tienda inexistente, otro estado, payload gigante o no-objeto', async () => {
    await as('anon', () => fails(() => db.query('insert into public.orders (store_id, payload) values ($1,$2::jsonb)', ['00000000-0000-0000-0000-0000000000ff', j({ a: 1 })]), /row-level security/));
    await as('anon', () => fails(() => db.query("insert into public.orders (store_id, payload, status) values ($1,$2::jsonb,'entregado')", [STORE, j({ a: 1 })]), /row-level security/));
    await as('anon', () => fails(() => db.query('insert into public.orders (store_id, payload) values ($1,$2::jsonb)', [STORE, j({ x: 'a'.repeat(30000) })]), /row-level security/));
    await as('anon', () => fails(() => db.query('insert into public.orders (store_id, payload) values ($1,$2::jsonb)', [STORE, j([1, 2])]), /row-level security/));
  });
  it('no lee pedidos, proyectos ni miembros; no escribe menús ni tiendas; no llama funciones del proyecto', async () => {
    await as('anon', () => fails(() => q('select * from public.orders'), /permission denied/));
    await as('anon', () => fails(() => q('select * from public.projects'), /permission denied/));
    await as('anon', () => fails(() => q('select * from public.project_members'), /permission denied/));
    await as('anon', () => fails(() => db.query("update public.menus set json = '{}'::jsonb"), /permission denied/));
    await as('anon', () => fails(() => db.query("insert into public.stores (slug, name, owner) values ('hack','x',$1)", [U.owner]), /permission denied/));
    await as('anon', () => fails(() => q('select public.get_project_data($1)', [PID]), /permission denied/));
  });
});

describe('proyectos: datos con control de versión', () => {
  it('nadie lee «data» con SELECT, ni siquiera el dueño; se lista el resto', async () => {
    await as('owner', () => fails(() => q('select data from public.projects'), /permission denied/));
    const r = await as('owner', () => q('select id, name, version from public.projects'));
    expect(r).toEqual([{ id: PID, name: 'La Esquina', version: 1 }]);
    expect(await as('otro', () => q('select id from public.projects'))).toEqual([]);   // otro usuario no ve el proyecto
  });
  it('dueño, administrador y lectura leen el proyecto completo; encargado y cajero no', async () => {
    for (const k of ['owner', 'admin', 'lec']) expect((await as(k, () => q('select public.get_project_data($1) as d', [PID])))[0].d.data.costs.gastosOp[0].amount).toBe(100);
    for (const k of ['enc', 'caj', 'otro']) await as(k, () => fails(() => q('select public.get_project_data($1)', [PID]), /forbidden/));
  });
  it('todos los miembros leen la versión pública (sin costos); los de afuera no', async () => {
    for (const k of ['owner', 'admin', 'enc', 'caj', 'lec']) {
      const d = (await as(k, () => q('select public.get_project_public($1) as d', [PID])))[0].d;
      expect(d.public.products[0].price).toBe(1000); expect(JSON.stringify(d)).not.toMatch(/gastosOp/);
    }
    await as('otro', () => fails(() => q('select public.get_project_public($1)', [PID]), /forbidden/));
  });
  it('guardar: suma versión; si alguien guardó antes, avisa el conflicto y NO pisa', async () => {
    const r1 = (await as('owner', () => q('select public.save_project($1,$2::jsonb,null,1) as r', [PID, j({ project: { name: 'La Esquina' }, v: 2 })])))[0].r;
    expect(r1).toMatchObject({ ok: true, version: 2 });
    const r2 = (await as('admin', () => q('select public.save_project($1,$2::jsonb,null,1) as r', [PID, j({ v: 'admin viejo' })])))[0].r;   // base_version 1: desactualizado
    expect(r2).toMatchObject({ conflict: true, version: 2 });
    expect((await as('owner', () => q('select public.get_project_data($1) as d', [PID])))[0].d.data.v).toBe(2);
    const r3 = (await as('admin', () => q('select public.save_project($1,$2::jsonb,null,2) as r', [PID, j({ project: { name: 'La Esquina' }, v: 3 })])))[0].r;
    expect(r3).toMatchObject({ ok: true, version: 3 });
  });
  it('encargado, cajero y lectura no pueden guardar el proyecto', async () => {
    for (const k of ['enc', 'caj', 'lec', 'otro']) await as(k, () => fails(() => q('select public.save_project($1,$2::jsonb,null,3)', [PID, j({ hack: 1 })]), /forbidden/));
  });
});

describe('roles', () => {
  it('encargado guarda pedidos y stock; cajero solo pedidos; lectura nada', async () => {
    await as('enc', () => db.query('select public.save_ops($1,$2::jsonb,$3::jsonb)', [PID, j({ orders: [{ id: 'o1' }] }), j({ items: { x: 1 } })]));
    await as('caj', () => db.query('select public.save_ops($1,$2::jsonb,null)', [PID, j({ orders: [{ id: 'o1' }, { id: 'o2' }] })]));
    await as('caj', () => fails(() => db.query('select public.save_ops($1,$2::jsonb,$3::jsonb)', [PID, j({}), j({ items: {} })]), /forbidden/));
    await as('lec', () => fails(() => db.query('select public.save_ops($1,$2::jsonb,null)', [PID, j({})]), /forbidden/));
    const ops = (await as('owner', () => q('select public.get_ops($1) as o', [PID])))[0].o;
    expect(ops.sales.orders).toHaveLength(2); expect(ops.stock.items.x).toBe(1);          // el cajero no pisó el stock
    await as('otro', () => fails(() => q('select public.get_ops($1)', [PID]), /forbidden/));
  });
  it('solo el dueño gestiona usuarios; el administrador no', async () => {
    await as('admin', () => fails(() => q('select public.invite_member($1,$2,$3)', [PID, 'nuevo@x.com', 'cajero']), /forbidden/));
    await as('admin', () => fails(() => q('select public.set_member_role($1,$2,$3)', [PID, U.caj, 'admin']), /forbidden/));
    await as('admin', () => fails(() => q('select public.remove_member($1,$2)', [PID, U.caj]), /forbidden/));
    await as('owner', () => fails(() => q('select public.invite_member($1,$2,$3)', [PID, 'x@x.com', 'owner']), /invalid role/));
    await as('owner', () => fails(() => q('select public.set_member_role($1,$2,$3)', [PID, U.owner, 'lectura']), /cannot change owner/));
  });
  it('el dueño lista usuarios (con email); el cajero no', async () => {
    const m = await as('owner', () => q('select * from public.list_members($1)', [PID]));
    expect(m.map(x => x.email).sort()).toEqual(Object.values(MAIL).filter(e => e !== MAIL.otro).sort());
    await as('caj', () => fails(() => q('select * from public.list_members($1)', [PID]), /forbidden/));
  });
  it('cambiar rol y quitar usuario: aplica de inmediato', async () => {
    await as('owner', () => db.query('select public.set_member_role($1,$2,$3)', [PID, U.lec, 'cajero']));
    await as('lec', () => db.query('select public.save_ops($1,$2::jsonb,null)', [PID, j({ orders: [] })]));
    await as('lec', () => fails(() => q('select public.get_project_data($1)', [PID]), /forbidden/));
    await as('owner', () => db.query('select public.remove_member($1,$2)', [PID, U.lec]));
    await as('lec', () => fails(() => q('select public.get_project_public($1)', [PID]), /forbidden/));
    await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, MAIL.lec, 'lectura']));
    await as('lec', () => db.query('select public.accept_invites()'));
  });
  it('una invitación solo la acepta el dueño del email', async () => {
    await as('owner', () => db.query('select public.invite_member($1,$2,$3)', [PID, 'otra-persona@x.com', 'cajero']));
    expect((await as('otro', () => q('select public.accept_invites() as n')))[0].n).toBe(0);
    await as('otro', () => fails(() => q('select public.get_project_public($1)', [PID]), /forbidden/));
  });
});

describe('pedidos y menú: quién puede qué', () => {
  it('el personal ve y actualiza el estado de los pedidos; lectura y ajenos no', async () => {
    for (const k of ['owner', 'admin', 'enc', 'caj']) expect((await as(k, () => q('select count(*)::int as n from public.orders')))[0].n).toBe(1);
    expect((await as('otro', () => q('select count(*)::int as n from public.orders')))[0].n).toBe(0);
    expect((await as('lec', () => q('select count(*)::int as n from public.orders')))[0].n).toBe(0);
    await as('caj', () => db.query("update public.orders set status = 'preparando'"));
    expect((await as('su', () => q('select status from public.orders')))[0].status).toBe('preparando');
    await as('caj', () => fails(() => db.query("update public.orders set payload = '{}'::jsonb"), /permission denied/));   // solo el estado
    await as('otro', () => db.query("update public.orders set status = 'listo'"));
    expect((await as('su', () => q('select status from public.orders')))[0].status).toBe('preparando');                      // no afectó nada
  });
  it('solo el dueño y el administrador publican el menú', async () => {
    await as('admin', () => db.query("update public.menus set json = $1::jsonb", [j({ products: [] })]));
    expect((await as('anon', () => q('select json from public.menus')))[0].json.products).toHaveLength(0);
    await as('enc', () => db.query("update public.menus set json = $1::jsonb", [j({ products: [{ hack: 1 }] })]));
    expect((await as('anon', () => q('select json from public.menus')))[0].json.products).toHaveLength(0);
  });
  it('el slug es único y válido; cada usuario crea tiendas solo a su nombre', async () => {
    await as('otro', () => fails(() => db.query("insert into public.stores (slug, name, owner) values ('la-esquina','x',$1)", [U.otro]), /duplicate|unique/));
    await as('otro', () => fails(() => db.query("insert into public.stores (slug, name, owner) values ('Mal Slug!','x',$1)", [U.otro]), /check/));
    await as('otro', () => fails(() => db.query("insert into public.stores (slug, name, owner) values ('suplantar','x',$1)", [U.owner]), /row-level security/));
    await as('otro', () => db.query("insert into public.stores (slug, name, owner) values ('otro-local','x',$1)", [U.otro]));
  });
});

describe('auditoría', () => {
  it('registra altas, invitaciones, accesos, cambios de rol y guardados (uno cada 15 min por usuario)', async () => {
    const log = await as('owner', () => q('select action, user_id from public.list_audit($1, 200)', [PID]));
    const acts = log.map(l => l.action);
    ['create', 'invite', 'join', 'role', 'remove', 'save'].forEach(a => expect(acts).toContain(a));
    expect(acts.filter(a => a === 'save' && true).length).toBe(2);       // owner y admin guardaron: una por usuario
  });
  it('la ve el dueño y el administrador; nadie más, y no se escribe directo', async () => {
    expect((await as('admin', () => q('select count(*)::int as n from public.list_audit($1)', [PID])))[0].n).toBeGreaterThan(3);
    await as('enc', () => fails(() => q('select * from public.list_audit($1)', [PID]), /forbidden/));
    await as('owner', () => fails(() => q('select * from public.audit_log'), /permission denied/));
    await as('owner', () => fails(() => db.query("insert into public.audit_log (project_id, action) values ($1,'x')", [PID]), /permission denied/));
    await as('owner', () => fails(() => q("select public.audit($1,'x')", [PID]), /permission denied/));
  });
});
