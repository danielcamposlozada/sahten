import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildIndexHtml, buildPublishFiles } from '../src/online/publish.js';

const menu = { store: { name: 'Local de prueba', address: 'Calle 123', whatsapp: '5491112345678' }, products: [{ id: 'p', name: 'Shawarma', description: 'Pan y carne', price: 100 }], config: {}, site: { enabled: true, seo: { url: 'https://local.example/?x=1#pedido', title: 'Cocina de prueba', description: 'Cocina casera', cuisine: 'Árabe' }, faq: { items: [{ q: '¿Dónde estamos?', a: 'Calle 123' }] } } };
it('publica metadatos, Restaurant y contenido legible sin ejecutar JavaScript, sin inventar estrellas', async () => {
  const doc = new JSDOM(buildIndexHtml(menu)).window.document;
  expect(doc.title).toBe('Cocina de prueba');
  expect(doc.querySelector('link[rel=canonical]').href).toBe('https://local.example/');
  const schema = JSON.parse(doc.querySelector('#restaurant-schema').textContent);
  expect(schema).toMatchObject({ '@type': 'Restaurant', name: 'Local de prueba', telephone: '+5491112345678' });
  expect(schema.aggregateRating).toBeUndefined();
  expect(doc.querySelector('#search-content').textContent).toContain('Shawarma');
  expect(doc.querySelector('#search-content').textContent).toContain('¿Dónde estamos?');
  const files = await buildPublishFiles(menu);
  expect(files.find(f => f.path === 'robots.txt').data).toContain('Sitemap: https://local.example/sitemap.xml');
  expect(files.find(f => f.path === 'sitemap.xml').data).not.toContain('#pedido');
});
it('escapa contenido de negocio en HTML y JSON-LD', () => {
  const hostile = structuredClone(menu); hostile.store.name = '</script><script>alert(1)</script>'; hostile.site.seo.description = '" onload="alert(2)';
  const doc = new JSDOM(buildIndexHtml(hostile)).window.document;
  expect(doc.querySelector('meta[name=description]').content).toBe(hostile.site.seo.description);
  expect(JSON.parse(doc.querySelector('#restaurant-schema').textContent).name).toBe(hostile.store.name);
  expect([...doc.scripts].some(s => s.textContent === 'alert(1)')).toBe(false);
});
it('muestra la carta sin esperar a la configuración de pagos', async () => {
  const m = structuredClone(menu); m.site.enabled = false; m.payments = { methods: {} }; m.delivery = {}; m.supabase = { url: 'https://test.supabase.co', anonKey: 'public', storeId: 'store' };
  let complete;
  const dom = new JSDOM(buildIndexHtml(m), { url: 'https://local.example/#pedido', runScripts: 'dangerously', beforeParse(w) {
    w.scrollTo = () => {};
    w.fetch = async url => String(url).includes('/config?') ? new Promise(r => { complete = () => r({ ok: true, json: async () => ({ enabled: false }) }); }) : { ok: true, json: async () => String(url).endsWith('menu.json') ? m : [] };
  } });
  await new Promise(r => setTimeout(r, 30));
  expect(dom.window.document.querySelector('#grid').textContent).toContain('Shawarma');
  complete(); dom.window.close();
});
