import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildPublishFiles, buildIndexHtml } from '../src/online/publish.js';
import { storefrontHref, publishedMenuWithLiveCatalog } from '../src/online/storefront.js';
import { normalizeSite, buildSite, exportSiteContent, parseSiteContent, applySiteContent } from '../src/online/site.js';

const fixture = () => ({
  store: { name: 'Local de prueba', address: 'Calle 123' },
  config: { categories: ['Árabe / entradas'] }, payments: { methods: { efectivo: true } }, delivery: {},
  products: [{ id: 'p', name: 'Fatay', category: 'Árabe / entradas', price: 100, star: true, image: 'img/p.jpg' }],
  site: { enabled: true, orderPage: true, seo: { url: 'https://local.example/tienda' }, images: {}, order: ['hero', 'favoritos', 'menu'], hero: { title: 'Nuestra cocina', cta: 'Pedir online', highlights: [] }, favoritos: { title: 'Favoritos' } },
});
async function render(menu, options = {}, url = 'https://local.example/tienda/') {
  const dom = new JSDOM(buildIndexHtml(menu, options), { url, runScripts: 'dangerously', beforeParse(w) {
    w.scrollTo = () => {}; w.fetch = async () => ({ ok: false });
  } });
  await new Promise(r => setTimeout(r, 50)); return dom;
}
it('la opción se conserva al exportar e importar, sin encender el sitio ni cambiar proyectos anteriores', () => {
  const s = normalizeSite({ enabled: true, orderPage: true });
  const parsed = parseSiteContent(exportSiteContent(s));
  expect(applySiteContent({}, parsed)).toMatchObject({ enabled: false, orderPage: true });
  expect(buildSite(s).orderPage).toBe(true);
  expect(buildSite({ enabled: true }).orderPage).toBeUndefined();
  expect(normalizeSite({}).orderPage).toBe(false);
  expect(applySiteContent(s, parseSiteContent('{"format":"sahten-sitio","site":{}}')).orderPage).toBe(true);
});
it('genera tienda con base de recursos correcta, canonical propio y sin duplicar la carta SEO en el sitemap', async () => {
  const files = await buildPublishFiles(fixture());
  const doc = new JSDOM(files.find(f => f.path === 'pedir/index.html').data, { url: 'https://local.example/tienda/pedir/' }).window.document;
  expect(doc.body.hasAttribute('data-storefront')).toBe(true);
  expect(new URL('menu.json', doc.baseURI).href).toBe('https://local.example/tienda/menu.json');
  expect(new URL('img/p.jpg', doc.baseURI).href).toBe('https://local.example/tienda/img/p.jpg');
  expect(doc.querySelector('link[rel=canonical]').href).toBe('https://local.example/tienda/pedir/');
  expect(doc.querySelector('meta[name=robots]').content).toBe('noindex,follow');
  expect(doc.querySelector('#faq-schema')).toBeNull();
  const info = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(info.querySelector('a.cta').getAttribute('href')).toBe('../pedir/');
  expect(files.find(f => f.path === 'sitemap.xml').data).not.toContain('/pedir/');
  const old = fixture(); old.site.orderPage = false;
  expect((await buildPublishFiles(old)).some(f => f.path === 'pedir/index.html')).toBe(false);
});
it('mantiene parámetros de retorno de pago, modo de pruebas, negocio y categoría codificada', () => {
  const href = storefrontHref(fixture(), 'https://local.example/tienda/', '?store=local&mp_test=1&mp_checkout=abc&payment_id=123', 'Árabe / entradas');
  const url = new URL(href);
  expect(url.pathname).toBe('/tienda/pedir/');
  expect(url.searchParams.get('mp_checkout')).toBe('abc');
  expect(url.searchParams.get('payment_id')).toBe('123');
  expect(url.searchParams.get('mp_test')).toBe('1');
  expect(url.searchParams.get('store')).toBe('local');
  expect(decodeURIComponent(url.hash)).toBe('#pedido/Árabe / entradas');
});
it('actualiza precios y productos desde la nube conservando diseño y datos de identidad publicados', () => {
  const base = fixture(), live = { ...fixture(), products: [{ id: 'nuevo', price: 200 }], site: { enabled: false }, store: { name: 'Anterior', address: 'Anterior', whatsapp: '123' } };
  const merged = publishedMenuWithLiveCatalog(base, live);
  expect(merged.products).toEqual(live.products);
  expect(merged.site).toEqual(base.site);
  expect(merged.store).toEqual({ ...base.store, whatsapp: '123' });
  expect(live.site.enabled).toBe(false);
  base.site.orderPage = false;
  expect(publishedMenuWithLiveCatalog(base, live)).toBe(live);
});
it('la portada enlaza a la tienda desde hero, favoritos, categorías y navegación, sin carrito separado', async () => {
  const dom = await render(fixture(), {}, 'https://local.example/tienda/?mp_test=1');
  const d = dom.window.document;
  for (const selector of ['#s-hero .btn1', '#s-fav .add', '#s-menuhd .ctile', '#s-menuhd .pedir-cta', '#snav .pedido']) {
    const link = d.querySelector(selector);
    expect(new URL(link.href).pathname).toBe('/tienda/pedir/');
    expect(new URL(link.href).searchParams.get('mp_test')).toBe('1');
  }
  expect(d.querySelector('#s-fav [data-inc]')).toBeNull();
  dom.window.close();
});
it('la tienda abre la categoría elegida y conserva el carrito y las opciones retiro/delivery', async () => {
  const dom = await render(fixture(), { storefront: true }, 'https://local.example/tienda/pedir/#pedido/' + encodeURIComponent('Árabe / entradas'));
  const d = dom.window.document;
  expect(d.querySelector('#s-hero')).toBeNull();
  expect(d.querySelector('.cat.on').textContent).toBe('Árabe / entradas');
  expect(d.querySelector('#oback a').href).toBe('https://local.example/tienda/');
  d.querySelector('#grid [data-inc]').click();
  expect(d.querySelector('#bar-n').textContent).toBe('1 producto');
  d.querySelector('#bar button').click();
  expect(d.querySelector('#sheet').textContent).toContain('Retiro');
  expect(d.querySelector('#sheet').textContent).toContain('Delivery');
  dom.window.close();
});
it('la vista previa mantiene el recorrido dentro del editor, sin salir al hosting', async () => {
  const dom = await render(fixture(), { preview: true });
  expect(dom.window.document.querySelector('#s-hero .btn1').getAttribute('href')).toBe('#pedido');
  expect(dom.window.document.querySelector('#s-fav [data-inc]')).not.toBeNull();
  dom.window.close();
});
