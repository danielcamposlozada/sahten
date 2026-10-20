import { describe, it, expect, vi } from 'vitest';
import { createImageStore, menuWithCloudImages, decodePhoto } from '../src/online/images.js';
import { createPhotoPublisher } from '../src/online/photoPublisher.js';
import { createClient, SupabaseError } from '../src/online/supabase.js';
import { createSync, syncHash } from '../src/online/sync.js';
import { emptyFile } from '../src/project/schema.js';

const URL = 'https://photos.supabase.co';
const PHOTO = 'data:image/png;base64,AQID';
function storage() {
  const files = new Map();
  const client = { url: URL, storage: {
    upload: vi.fn(async (path, bytes) => { files.set(path, bytes); }),
    download: vi.fn(async path => files.get(path)),
  } };
  return { client, files, images: createImageStore(client) };
}

describe('fotos en Storage', () => {
  it('sube bytes con token renovado y devuelve bytes al descargar (no JSON/base64)', async () => {
    const calls = [];
    const client = createClient({ url: URL, anonKey: 'sb_publishable_test', now: () => 100000,
      session: { access_token: 'old', refresh_token: 'refresh', expires_at: 110, user: { id: 'owner' } },
      fetchImpl: async (url, opts) => {
        calls.push({ url, ...opts });
        if (url.includes('/auth/')) return { ok: true, status: 200, json: async () => ({ access_token: 'new', refresh_token: 'r', expires_in: 3600 }) };
        return { ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      },
    });
    await client.storage.upload('store/a.png', new Uint8Array([1, 2, 3]), 'image/png');
    expect(calls[1].body).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[1].headers).toMatchObject({ Authorization: 'Bearer new', 'Content-Type': 'image/png', 'x-upsert': 'true' });
    expect(await client.storage.download('store/a.png')).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('versiona el contenido, deduplica dentro de una tienda y separa tiendas', async () => {
    const s = storage();
    const a = await s.images.upload({ p: PHOTO, cat_bebidas: PHOTO }, 'store1');
    expect(a.p).toBe(a.cat_bebidas); expect(s.client.storage.upload).toHaveBeenCalledTimes(1);
    expect(a.p).toMatch(/store1\/[a-f0-9]{64}\.png$/);
    expect((await s.images.upload({ p: 'data:image/png;base64,BAUG' }, 'store1')).p).not.toBe(a.p);
    expect((await s.images.upload({ p: PHOTO }, 'store2')).p).not.toBe(a.p);
  });
  it('publica productos, categorías y secciones, sin subir fotos ocultas ni tocar el original', async () => {
    const s = storage();
    const menu = { products: [{ id: 'p', image: 'img/p.jpg' }], config: { categoryImages: { Bebidas: 'img/cat_bebidas.jpg' } }, site: { images: { hero: 'img/site_hero.jpg', historia: null } } };
    const result = await menuWithCloudImages(menu, { p: PHOTO, cat_bebidas: PHOTO, site_hero: PHOTO, hidden: 'invalid' }, s.images, 'store1');
    expect(result.products[0].image).toMatch(/^https:/);
    expect(result.config.categoryImages.Bebidas).toBe(result.products[0].image);
    expect(result.site.images.hero).toBe(result.products[0].image);
    expect(menu.products[0].image).toBe('img/p.jpg');
  });
  it('descarga fotos dentro del .sahten para usar sin red, y reutiliza las copias locales iguales', async () => {
    const s = storage(); const file = { ...emptyFile(), images: { p: PHOTO } };
    const remote = await s.images.prepare(file, 'store1');
    expect(remote.images.p).toMatch(/^https:/); expect(file.images.p).toBe(PHOTO);
    expect((await s.images.restore(remote)).images.p).toBe(PHOTO);
    expect((await s.images.restore(remote, file.images)).images.p).toBe(PHOTO);
    expect(s.client.storage.download).toHaveBeenCalledTimes(1);
    expect((await s.images.restore({ ...remote, images: {} }, file.images)).images).toEqual({}); // quitar también sincroniza
    expect((await s.images.restore(emptyFile(), file.images)).images).toEqual(file.images); // nube antigua
  });
  it('no descarga direcciones ajenas ni acepta SVG o archivos grandes; verifica integridad', async () => {
    const s = storage();
    await expect(s.images.restore({ cloudImagesVersion: 1, images: { p: 'https://otro.com/a.png' } })).rejects.toThrow(/dirección/);
    expect(s.client.storage.download).not.toHaveBeenCalled();
    expect(() => decodePhoto('data:image/svg+xml;base64,AAAA')).toThrow(/formato/);
    expect(() => decodePhoto('data:image/png;base64,' + 'AAAA'.repeat(1800000))).toThrow(/5 MB/);
    const f = await s.images.prepare({ images: { p: PHOTO } }, 'store1');
    s.client.storage.download.mockResolvedValue(new Uint8Array([9]));
    await expect(s.images.restore(f)).rejects.toThrow(/verificar/);
  });
  it('una subida fallida se puede reintentar y conserva la foto local', async () => {
    const s = storage(); s.client.storage.upload.mockRejectedValueOnce(new SupabaseError('Sin red', { offline: true }));
    const local = { images: { p: PHOTO } };
    await expect(s.images.prepare(local, 'store1')).rejects.toMatchObject({ offline: true });
    expect(local.images.p).toBe(PHOTO);
    await expect(s.images.prepare(local, 'store1')).resolves.toMatchObject({ cloudImagesVersion: 1 });
  });
});

describe('proyecto con fotos en dos equipos', () => {
  it('solo cambiar o quitar la foto dispara un push; el otro equipo la recupera sin perder la copia local', async () => {
    const s = storage(); let remote, version = 1;
    const client = { auth: { token: async () => 't' }, raw: async () => [{ version }], rpc: async (name, args) => {
      if (name === 'create_project' || name === 'save_project') { remote = structuredClone(args.p_data); if (name === 'create_project') return 'rid'; return { version: ++version }; }
      if (name === 'get_project_data') return { data: structuredClone(remote), version };
      return null;
    } };
    const device = () => {
      let file = { ...emptyFile('Local'), images: { p: PHOTO } }, id = null, last = null;
      const sync = createSync({ client, remoteId: () => id, setRemoteId: v => { id = v; }, role: () => 'owner', projectId: () => 'local',
        collect: () => structuredClone(file), apply: async f => { file = f; }, publicOf: () => ({}),
        prepareFile: f => s.images.prepare(f, 'store1'), restoreFile: (f, images) => s.images.restore(f, images),
        store: { get: () => last, set: (k, v) => { last = v; } },
      });
      return { sync, file: () => file, connect: () => { id = 'rid'; } };
    };
    const a = device(), b = device(); await a.sync.link(); b.connect();
    expect(remote.images.p).toMatch(/^https:/);
    expect((await a.sync.sync()).action).toBe('noop');
    a.file().images.p = 'data:image/png;base64,BAUG';
    expect((await a.sync.sync()).action).toBe('push');
    await b.sync.sync(); await b.sync.resolve('theirs');
    expect(b.file().images.p).toBe('data:image/png;base64,BAUG');
    expect((await b.sync.sync()).action).toBe('noop');
    delete a.file().images.p; await a.sync.sync(); await b.sync.sync();
    expect(b.file().images).toEqual({});
    expect(syncHash(a.file())).toBe(syncHash(b.file()));
  });
});

describe('publicación automática', () => {
  function queue() {
    const jobs = [], publish = vi.fn(async () => {}); let enabled = true, ctx = 'a';
    const q = createPhotoPublisher({ publish, enabled: () => enabled, context: () => ctx, timer: { set: (fn, ms) => { jobs.push({ fn, ms }); return jobs.length; }, clear: id => { if (jobs[id - 1]) jobs[id - 1].fn = null; } } });
    return { q, publish, jobs, enable: x => { enabled = x; }, context: x => { ctx = x; } };
  }
  it('es optativa; junta cambios, queda pendiente sin red y reintenta', async () => {
    const s = queue(); s.enable(false); s.q.schedule(); expect(s.jobs).toHaveLength(0);
    s.enable(true); s.q.schedule(); s.q.schedule(); expect(s.jobs.filter(j => j.fn)).toHaveLength(1);
    s.publish.mockRejectedValueOnce(new SupabaseError('Sin red', { offline: true }));
    await expect(s.q.flush()).rejects.toMatchObject({ offline: true });
    expect(s.q.info()).toMatchObject({ state: 'sin conexión', pending: true }); expect(s.jobs.at(-1).ms).toBe(30000);
    await s.q.flush(); expect(s.q.info()).toMatchObject({ state: 'al día', pending: false });
  });
  it('no reintenta automáticamente un menú que requiere confirmar ni continúa después de cerrar sesión', async () => {
    const s = queue(); s.publish.mockRejectedValueOnce(new SupabaseError('Menú pequeño', { code: 'menu_shrinks' }));
    await expect(s.q.flush()).rejects.toThrow(/pequeño/); expect(s.q.info().pending).toBe(true);
    expect(s.jobs).toHaveLength(0);
    let finish; s.publish.mockImplementationOnce(() => new Promise(r => { finish = r; }));
    const busy = s.q.flush(); s.q.cancel(); s.context('b'); finish(); await busy;
    expect(s.q.info()).toMatchObject({ pending: false, state: 'sin cambios' });
  });
});
