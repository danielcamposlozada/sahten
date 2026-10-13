// Usuario en la barra superior: estado de la tienda, login en dos pasos y marca por tienda.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestBundle, openApp } from './app-harness.js';
import { createMemoryAdapter } from '../src/project/adapters/memory.js';
import { encodeConnection, decodeConnection } from '../src/online/supabase.js';
import { initials } from '../src/online/userMenu.js';
import { sahtenDialog, sahtenConfirm } from '../src/ui/dialog.js';

beforeAll(async () => { await buildTestBundle(); }, 180000);
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const ANON = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.x`;
const URL_OK = 'https://abcd1234.supabase.co';
const wait = ms => new Promise(r => setTimeout(r, ms));
class FakeWS { constructor() { this.sent = []; } send(s) { this.sent.push(JSON.parse(s)); } close() {} }
async function app() {
  const a = await openApp(); const w = a.window;
  Object.assign(w.SAHTEN.project.adapter, createMemoryAdapter({ files: {} }));
  a.ev = c => w.eval(c); a.p = w.SAHTEN.project; a.on = w.SAHTEN.online; a.d = w.document;
  const calls = [];
  w.fetch = async (url, o = {}) => { calls.push({ url, method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : undefined });
    const routes = { '/auth/v1/token': { body: { access_token: 'T', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: 'dani@x.com' } } },
      '/auth/v1/recover': { body: {} }, '/rest/v1/stores?select': { body: [{ id: 'st-1', slug: 'casapan' }] }, '/rest/v1/orders': { body: [] } };
    const k = Object.keys(routes).find(x => url.includes(x)); const r = k ? routes[k] : { status: 404, body: { message: 'no route ' + url } };
    return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.body }; };
  w.WebSocket = FakeWS; a.calls = calls;
  return a;
}
const btn = a => a.d.querySelector('.topbar-desktop .um-btn, .um-btn');

describe('códigos y helpers', () => {
  it('el código de conexión va y vuelve; JSON y basura se manejan', () => {
    const c = encodeConnection({ url: URL_OK, anonKey: 'sb_publishable_abc', slug: 'casapan' });
    expect(c).toMatch(/^sahten:[A-Za-z0-9_-]+$/); expect(c).not.toMatch(/pass/i);
    expect(decodeConnection(c)).toEqual({ url: URL_OK, anonKey: 'sb_publishable_abc', slug: 'casapan' });
    expect(decodeConnection('{"url":"u","anonKey":"k","slug":"s"}')).toEqual({ url: 'u', anonKey: 'k', slug: 's' });
    expect(decodeConnection('hola')).toBeNull(); expect(decodeConnection('')).toBeNull();
  });
  it('iniciales de la marca', () => { expect(initials('Casapan')).toBe('C'); expect(initials('Sahten Store')).toBe('SS'); expect(initials('')).toBe('?'); });
});

describe('diálogo propio', () => {
  it('enfoca, devuelve la acción elegida, Esc cancela y devuelve el foco', async () => {
    const a = await app(); const w = a.window; const opener = a.d.createElement('button'); a.d.body.appendChild(opener); opener.focus();
    const p = sahtenConfirm('¿Borrar?', { okLabel: 'Borrar', danger: true, w }); await wait(10);
    const box = a.d.querySelector('.sd-box'); expect(box.getAttribute('role')).toBe('dialog'); expect(box.getAttribute('aria-modal')).toBe('true');
    expect(a.d.activeElement.textContent).toBe('Borrar');
    a.d.querySelector('.sd-btn.primary').click(); expect(await p).toBe(true);
    const q = sahtenDialog({ title: 'x', body: '<input>', w }); await wait(10);
    a.d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(await q).toBeNull();
    expect(a.d.querySelector('.sd-overlay')).toBeNull(); expect(a.d.activeElement).toBe(opener);
    w.close();
  }, 60000);
  it('alert() ahora usa el aviso propio y no bloquea', async () => {
    const a = await app(); a.window.alert('Algo salió mal'); await wait(10);
    expect(a.d.querySelector('.sd-box').textContent).toMatch(/Algo salió mal/); a.window.close();
  }, 60000);
});

describe('usuario en la barra superior', () => {
  it('sin conexión: «Conectar tienda»; el diálogo acepta el código de conexión y rellena todo', async () => {
    const a = await app(); await a.p.openDemo(); await wait(30);
    expect(btn(a).textContent).toMatch(/Conectar tienda/);
    btn(a).click(); await wait(20);
    expect(a.d.querySelector('.sd-title').textContent).toBe('Conectar tienda');
    const code = a.d.getElementById('um-code'); code.value = encodeConnection({ url: URL_OK, anonKey: ANON, slug: 'casapan' }); code.dispatchEvent(new a.window.Event('input', { bubbles: true }));
    expect(a.d.getElementById('um-url').value).toBe(URL_OK); expect(a.d.getElementById('um-slug').value).toBe('casapan');
    a.d.getElementById('um-mail2').value = 'dani@x.com'; a.d.getElementById('um-pass2').value = 'secreta';
    a.d.querySelector('.sd-btn.primary').click(); await wait(80);
    expect(a.ev('SAHTEN_SUPABASE.slug')).toBe('casapan'); expect(a.ev('SAHTEN_SUPABASE.storeId')).toBe('st-1');
    expect(a.d.querySelector('.sd-overlay')).toBeNull();
    expect(btn(a).textContent).toMatch(/dani@x\.com/);
    expect(JSON.stringify(a.p.collect())).not.toMatch(/secreta/);
    a.window.close();
  }, 60000);

  it('con la tienda configurada pero sin sesión pide SOLO email y contraseña; errores en el diálogo', async () => {
    const a = await app(); await a.p.openDemo();
    Object.assign(a.window.SAHTEN_SUPABASE, { url: URL_OK, anonKey: ANON, storeId: 'st-1', slug: 'casapan' });
    a.on.controller.signOut(); await wait(20);
    expect(btn(a).textContent).toMatch(/Iniciar sesión/);
    btn(a).click(); await wait(20);
    const ids = [...a.d.querySelectorAll('.sd-box input')].map(i => i.id); expect(ids).toEqual(['um-mail', 'um-pass']);
    expect(a.d.querySelector('.sd-box').textContent).toMatch(/casapan/);
    a.d.querySelector('.sd-btn.primary').click(); await wait(20);
    expect(a.d.querySelector('.sd-error').textContent).toMatch(/Completá/);
    a.d.getElementById('um-mail').value = 'dani@x.com'; a.d.getElementById('um-pass').value = 'secreta';
    a.d.querySelector('.sd-btn.primary').click(); await wait(80);
    expect(a.d.querySelector('.sd-overlay')).toBeNull();
    expect(a.on.controller.info().signedIn).toBe(true);
    a.window.close();
  }, 60000);

  it('con sesión: menú con tienda, cuenta y «Cerrar sesión» que conserva la conexión', async () => {
    const a = await app(); await a.p.openDemo();
    await a.on.connect({ url: URL_OK, anonKey: ANON, slug: 'casapan', email: 'dani@x.com', password: 'secreta' }); await wait(20);
    btn(a).click(); await wait(10);
    const menu = a.d.querySelector('.um-menu'); expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.textContent).toMatch(/casapan/); expect(menu.textContent).toMatch(/dani@x\.com/);
    [...menu.querySelectorAll('[role=menuitem]')].find(x => /Cerrar sesión/.test(x.textContent)).click(); await wait(20);
    expect(a.on.controller.info().signedIn).toBe(false);
    expect(a.ev('SAHTEN_SUPABASE.slug')).toBe('casapan'); expect(a.ev('SAHTEN_SUPABASE.url')).toBe(URL_OK);
    expect(btn(a).textContent).toMatch(/Iniciar sesión/);
    a.window.close();
  }, 60000);

  it('cada tienda muestra su propio nombre y color en la barra superior', async () => {
    const a = await app(); await a.p.openDemo();
    await a.on.connect({ url: URL_OK, anonKey: ANON, slug: 'casapan', email: 'dani@x.com', password: 'x' });
    a.ev(`_cust.brandName='Casapan'; _cust.logoStyle='text'; _cust.paletteId='wine'; custSave(_cust); custApply();`); await wait(20);
    expect(btn(a).querySelector('.um-name').textContent).toBe('Casapan');
    expect(btn(a).querySelector('.um-av').getAttribute('style')).toMatch(/#5c1d2e/i);
    a.ev(`_cust.brandName='Sahten Store'; _cust.paletteId='forest'; custSave(_cust); custApply();`); await wait(20);
    expect(btn(a).querySelector('.um-name').textContent).toBe('Sahten Store');
    expect(btn(a).querySelector('.um-av').getAttribute('style')).toMatch(/#1f4636/i);
    a.window.close();
  }, 60000);
});
