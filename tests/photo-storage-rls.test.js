import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const USERS = { owner: '00000000-0000-0000-0000-000000000001', admin: '00000000-0000-0000-0000-000000000002', staff: '00000000-0000-0000-0000-000000000003', other: '00000000-0000-0000-0000-000000000004', read: '00000000-0000-0000-0000-000000000005' };
let db, storeId, otherStoreId;
const migration = read('supabase/photos.sql');
async function as(who, fn) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [USERS[who] || '']);
  await db.exec('set role ' + (who === 'anon' ? 'anon' : 'authenticated'));
  try { return await fn(); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite(); await db.exec(read('tests/fixtures/supabase-prelude.sql')); await db.exec(read('supabase/schema.sql'));
  // Storage lo provee Supabase; acá se prueba el SQL real de políticas en Postgres.
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, unique(bucket_id,name));
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  for (const [name, id] of Object.entries(USERS)) await db.query('insert into auth.users(id,email) values ($1,$2)', [id, name + '@test.com']);
  const projectId = (await as('owner', () => db.query("select public.create_project('Local','{}','{}') id"))).rows[0].id;
  storeId = (await as('owner', () => db.query("insert into public.stores(slug,name,owner,project_id) values ('local','Local',$1,$2) returning id", [USERS.owner, projectId]))).rows[0].id;
  otherStoreId = (await as('other', () => db.query("insert into public.stores(slug,name,owner) values ('other','Otro',$1) returning id", [USERS.other]))).rows[0].id;
  for (const [user, role] of [['admin', 'admin'], ['staff', 'encargado'], ['read', 'lectura']]) await db.query('insert into public.project_members(project_id,user_id,role) values ($1,$2,$3)', [projectId, USERS[user], role]);
  await db.exec(migration);
}, 60000);

describe('permisos de fotos por tienda', () => {
  it('es idempotente y limita el bucket a imágenes de hasta 5 MB', async () => {
    await db.exec(migration);
    expect((await db.query("select * from storage.buckets where id='sahten-photos'")).rows[0]).toMatchObject({ public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] });
  });
  it('dueño y administrador suben y reemplazan fotos en su tienda', async () => {
    await as('owner', () => db.query("insert into storage.objects(bucket_id,name) values ('sahten-photos',$1)", [storeId + '/a.jpg']));
    expect((await as('admin', () => db.query("update storage.objects set name=$1 where name=$2 returning name", [storeId + '/b.jpg', storeId + '/a.jpg']))).rows).toHaveLength(1);
  });
  it('anónimos, personal, lectura y otros dueños no pueden escribir ni mover fotos entre tiendas', async () => {
    for (const who of ['anon', 'staff', 'read', 'other']) {
      await expect(as(who, () => db.query("insert into storage.objects(bucket_id,name) values ('sahten-photos',$1)", [storeId + '/' + who + '.jpg']))).rejects.toThrow(/row-level security/);
      expect((await as(who, () => db.query('update storage.objects set name=name returning id'))).rows).toHaveLength(0);
    }
    await expect(as('owner', () => db.query('update storage.objects set name=$1', [otherStoreId + '/stolen.jpg']))).rejects.toThrow(/row-level security/);
    await expect(as('owner', () => db.query("insert into storage.objects(bucket_id,name) values ('private',$1)", [storeId + '/a.jpg']))).rejects.toThrow(/row-level security/);
    await expect(as('owner', () => db.query("insert into storage.objects(bucket_id,name) values ('sahten-photos','invalid/a.jpg')"))).rejects.toThrow(/row-level security/);
  });
  it('no elimina versiones que podrían estar usadas por un menú anterior', async () => {
    expect((await as('owner', () => db.query('delete from storage.objects returning id'))).rows).toHaveLength(0);
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1);
  });
});

describe('compatibilidad de fotos entre instalaciones', () => {
  it('un cliente sin protocolo de fotos conserva las referencias y sí actualiza los otros datos', async () => {
    const images = { plato: 'https://example.test/foto.jpg' };
    const file = { project: { name: 'Tienda' }, images, cloudImagesVersion: 1 };
    const pub = { products: [{ id: 'plato', price: 100 }], images, cloudImagesVersion: 1 };
    const pid = (await as('owner', () => db.query('select public.create_project($1,$2,$3) id', ['Tienda', file, pub]))).rows[0].id;
    await as('owner', () => db.query('select public.save_project($1,$2,$3,1)', [pid, { project: { name: 'Nombre nuevo' }, images: {}, costs: { total: 42 } }, { products: [{ id: 'plato', price: 120 }] }]));
    const saved = (await db.query('select data,public,version from public.projects where id=$1', [pid])).rows[0];
    expect(saved.data).toMatchObject({ project: { name: 'Nombre nuevo' }, costs: { total: 42 }, images, cloudImagesVersion: 1 });
    expect(saved.public).toMatchObject({ products: [{ id: 'plato', price: 120 }], images, cloudImagesVersion: 1 });
    expect(Number(saved.version)).toBe(2);
    const empty = { images: {}, cloudImagesVersion: 1 };
    await as('owner', () => db.query('select public.save_project($1,$2,$3,2)', [pid, empty, empty]));
    const cleared = (await db.query('select data,public from public.projects where id=$1', [pid])).rows[0];
    expect(cleared.data.images).toEqual({});
    expect(cleared.public.images).toEqual({});
  });
});
