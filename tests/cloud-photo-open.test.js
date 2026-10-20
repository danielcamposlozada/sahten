import { webcrypto } from 'node:crypto';
import { beforeAll, it, expect } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';

beforeAll(() => buildTestBundle(), 180000);
it('abrir el proyecto de la nube descarga la foto y la muestra en Menú Online', async () => {
  const a = await openApp(); const w = a.window;
  Object.assign(w.SAHTEN.project.adapter, createMemoryAdapter({ files: {} }));
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
  w.sahtenConfirm = async () => true;
  await w.SAHTEN.project.openDemo(); w.sahtenTour?.close();
  const data = w.SAHTEN.project.collect();
  const pid = data.catalog.productos.find(p => !p.recetaOnly).id;
  const bytes = new Uint8Array([1, 2, 3]);
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');
  const url = 'https://abcd1234.supabase.co';
  data.images = { [pid]: `${url}/storage/v1/object/public/sahten-photos/st-1/${hash}.png` };
  data.cloudImagesVersion = 1;
  const download = `/storage/v1/object/public/sahten-photos/st-1/${hash}.png`;
  w.WebSocket = class { send() {} close() {} };
  w.fetch = async (u, opts) => {
    if (u.includes(download)) return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer };
    const routes = {
      '/auth/v1/token': { access_token: 'T', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: 'owner@example.test' } },
      '/rest/v1/stores?select': [{ id: 'st-1', slug: 'mi-local', owner: 'u1', project_id: 'pr-1' }],
      '/rest/v1/orders': [],
      '/rest/v1/projects': [{ id: 'pr-1', name: 'Local', version: 2 }],
      '/rest/v1/project_members': [{ project_id: 'pr-1', role: 'owner' }],
      '/rest/v1/rpc/get_project_data': { data, version: 2 },
      '/rest/v1/rpc/get_ops': null,
    };
    const route = Object.keys(routes).find(p => u.includes(p));
    return { ok: !!route, status: route ? 200 : 404, json: async () => route ? routes[route] : {} };
  };
  await w.SAHTEN.online.connect({ url, anonKey: 'sb_publishable_test', slug: 'mi-local', email: 'owner@example.test', password: 'test-only' });
  await w.SAHTEN.online.openRemote('pr-1', 'owner');
  const expected = 'data:image/png;base64,AQID';
  expect(w.SAHTEN.project.collect().images[pid]).toBe(expected);
  w.eval("showPanel('menuonline'); renderMenuOnline()");
  expect(w.document.querySelector(`[data-photo="${pid}"] img`).getAttribute('src')).toBe(expected);
  w.close();
}, 60000);
