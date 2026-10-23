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

const full = {
  generatedAt: '2026-10-23T03:06:32.997Z',
  store: { name: 'SAHTEN Gastronomía Árabe', address: 'General Julio Argentino Roca 1489, Vicente López, Buenos Aires', whatsapp: '+54 9 11 2393-7295', currency: { locale: 'es-AR', symbol: '$' } },
  theme: { primary: '#235328', accent: '#F28C00' },
  config: { enabled: true, showPrices: true, categories: ['Entradas', 'Sandwich'], subtitle: 'Pedí online y te lo preparamos' },
  products: [
    { id: 'h', name: 'Hummus', price: 9750, category: 'Entradas', description: 'Crema de garbanzos' },
    { id: 's', name: 'Shawarma de Carne', price: 16000, category: 'Sandwich' },
    { id: 'x', name: 'Pan Árabe', price: 2050, category: '' },
  ],
  site: {
    enabled: true, menuTitle: 'Nuestro menú', images: {}, order: ['delivery', 'catering', 'historia', 'faq', 'contacto'],
    seo: { url: 'https://sahten.online/', title: 'Sahten | Comida árabe', description: 'Comida árabe casera', cuisine: 'Árabe, siria', locality: 'Vicente López', areaServed: 'Belgrano, Núñez, Olivos', sameAs: 'https://www.facebook.com/sahten, http://inseguro.example/x, javascript:alert(1)' },
    delivery: { title: 'Delivery y retiro', hours: 'Lun a Jue: 18:00 a 22:00\nDomingos: cerrado', extra: 'Zona: Belgrano, Núñez y Olivos. Envío gratis desde $45.000.' },
    catering: { title: 'Catering y eventos', text: 'Mesas árabes para eventos.\n\nMínimo 48 horas.', info: [{ label: 'Anticipación', value: 'Mínimo 48 horas' }] },
    historia: { eyebrow: 'Nuestra historia', title: 'De la cocina de nuestra Sitto', text: 'Recetas familiares sirias.', badgeWord: 'صَحْتَيْن', badgeMeaning: 'buen provecho', badgeQuote: 'Que la comida te dé salud.' },
    faq: { items: [{ q: '¿Abren los domingos?', a: 'No, los domingos cerramos.' }] },
    contacto: { instagram: 'sahten.ar' },
  },
};
const jsonLd = (doc, id) => JSON.parse(doc.querySelector(id).textContent);

it.each([
  ['https://local.example/tienda', 'https://local.example/tienda/'],
  ['https://local.example/tienda/', 'https://local.example/tienda/'],
  ['https://local.example/tienda?origen=prueba#pedido', 'https://local.example/tienda/'],
  ['https://local.example/negocios/tienda', 'https://local.example/negocios/tienda/'],
])('conserva la subcarpeta de %s en todos los enlaces SEO', async (url, base) => {
  const m = structuredClone(full); m.site.seo.url = url; m.site.seo.brandKit = 'sahten';
  const files = await buildPublishFiles(m);
  const home = new JSDOM(files.find(f => f.path === 'index.html').data).window.document;
  const page = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(jsonLd(home, '#restaurant-schema').hasMenu).toBe(base + 'menu/');
  expect(page.querySelector('link[rel=canonical]').href).toBe(base + 'menu/');
  const schemas = [...page.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent));
  expect(schemas.find(s => s['@type'] === 'Menu').url).toBe(base + 'menu/');
  expect(schemas.find(s => s['@type'] === 'BreadcrumbList').itemListElement[1].item).toBe(base + 'menu/');
  expect(files.find(f => f.path === 'robots.txt').data).toContain('Sitemap: ' + base + 'sitemap.xml');
  expect(files.find(f => f.path === 'sitemap.xml').data).toContain('<loc>' + base + 'menu/</loc>');
  expect(home.querySelector('link[rel=manifest]').href).toBe(base + 'site.webmanifest');
});

it('publica páginas propias con su canonical, migas de pan y datos estructurados, y las lista en el sitemap', async () => {
  const files = await buildPublishFiles(full);
  const paths = files.map(f => f.path);
  expect(paths).toEqual(expect.arrayContaining(['menu/index.html', 'delivery-y-retiro/index.html', 'catering/index.html', 'nuestra-historia/index.html']));
  const sitemap = files.find(f => f.path === 'sitemap.xml').data;
  for (const u of ['https://sahten.online/', 'https://sahten.online/menu/', 'https://sahten.online/delivery-y-retiro/', 'https://sahten.online/catering/', 'https://sahten.online/nuestra-historia/']) expect(sitemap).toContain('<loc>' + u + '</loc>');
  expect(sitemap).toContain('<lastmod>2026-10-23</lastmod>');
  const menuDoc = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(menuDoc.querySelector('link[rel=canonical]').href).toBe('https://sahten.online/menu/');
  expect(menuDoc.title).toContain('SAHTEN Gastronomía Árabe');
  expect(menuDoc.querySelector('main').textContent).toContain('Hummus');
  expect(menuDoc.querySelector('main').textContent).toContain('$9.750');
  expect(menuDoc.querySelector('main').textContent).toContain('Otros');
  const crumbs = JSON.parse(menuDoc.querySelectorAll('script[type="application/ld+json"]')[0].textContent);
  expect(crumbs['@type']).toBe('BreadcrumbList');
  const menu = JSON.parse(menuDoc.querySelectorAll('script[type="application/ld+json"]')[1].textContent);
  expect(menu).toMatchObject({ '@type': 'Menu', url: 'https://sahten.online/menu/' });
  expect(menu.hasMenuSection[0].hasMenuItem[0]).toMatchObject({ name: 'Hummus', description: 'Crema de garbanzos', offers: { price: '9750', priceCurrency: 'ARS' } });
  const cat = new JSDOM(files.find(f => f.path === 'catering/index.html').data).window.document;
  expect(cat.querySelectorAll('main p').length).toBeGreaterThanOrEqual(2);
  expect(cat.querySelector('main').textContent).toContain('Mínimo 48 horas');
});

it('la portada declara Restaurant con cocina, zona de reparto y perfiles válidos, más FAQPage con las preguntas visibles', () => {
  const doc = new JSDOM(buildIndexHtml(full)).window.document;
  const schema = jsonLd(doc, '#restaurant-schema');
  expect(schema.servesCuisine).toEqual(['Árabe', 'siria']);
  expect(schema.areaServed.map(a => a.name)).toEqual(['Belgrano', 'Núñez', 'Olivos']);
  expect(schema.sameAs).toEqual(['https://www.instagram.com/sahten.ar/', 'https://www.facebook.com/sahten']);
  expect(schema.hasMenu).toBe('https://sahten.online/menu/');
  const faq = jsonLd(doc, '#faq-schema');
  expect(faq).toMatchObject({ '@type': 'FAQPage' });
  expect(faq.mainEntity[0]).toMatchObject({ name: '¿Abren los domingos?', acceptedAnswer: { text: 'No, los domingos cerramos.' } });
});

it('el pie de la portada enlaza a las páginas nuevas', async () => {
  const html = buildIndexHtml(full);
  expect(html).toContain('sitePageList(MENU)');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://sahten.online/', beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => ({ ok: false, json: async () => ({}) }); } });
  await new Promise(r => setTimeout(r, 60));
  const links = [...dom.window.document.querySelectorAll('#s-contact a')].map(a => a.getAttribute('href'));
  expect(links).toEqual(expect.arrayContaining(['menu/', 'delivery-y-retiro/', 'catering/', 'nuestra-historia/']));
  dom.window.close();
});

it('no publica páginas propias sin dirección pública, con el sitio apagado ni para secciones vacías', async () => {
  const noUrl = structuredClone(full); noUrl.site.seo.url = '';
  expect((await buildPublishFiles(noUrl)).some(f => f.path.endsWith('/index.html'))).toBe(false);
  const off = structuredClone(full); off.site = null;
  expect((await buildPublishFiles(off)).some(f => f.path.endsWith('/index.html'))).toBe(false);
  const sparse = structuredClone(full); delete sparse.site.catering; delete sparse.site.historia;
  const paths = (await buildPublishFiles(sparse)).map(f => f.path);
  expect(paths).toContain('menu/index.html');
  expect(paths).not.toContain('catering/index.html');
  expect(paths).not.toContain('nuestra-historia/index.html');
});

it('escapa el contenido del negocio en las páginas nuevas', async () => {
  const hostile = structuredClone(full);
  hostile.store.name = '</title><script>alert(1)</script>'; hostile.products[0].name = '<img src=x onerror=alert(2)>'; hostile.site.catering.text = '<b>x</b>';
  const files = await buildPublishFiles(hostile);
  for (const f of files.filter(x => x.path.endsWith('/index.html'))) {
    const doc = new JSDOM(f.data).window.document;
    expect([...doc.scripts].some(s => s.type !== 'application/ld+json')).toBe(false);
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('main b')).toBeNull();
  }
});

it('sin precios públicos, la carta no muestra importes ni ofertas', async () => {
  const hidden = structuredClone(full); hidden.config.showPrices = false;
  const doc = new JSDOM((await buildPublishFiles(hidden)).find(f => f.path === 'menu/index.html').data).window.document;
  expect(doc.querySelector('main').textContent).not.toContain('$9.750');
  expect(doc.querySelectorAll('script[type="application/ld+json"]')[1].textContent).not.toContain('offers');
});

it('con kit de marca publica íconos, manifiesto e imagen para compartir, y las etiquetas apuntan a archivos que existen', async () => {
  const m = structuredClone(full); m.site.seo.brandKit = 'sahten'; m.site.images.hero = 'https://sahten.online/img/site_hero.jpg';
  const files = await buildPublishFiles(m), paths = files.map(f => f.path);
  for (const p of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'site.webmanifest', 'brand/sahten-icon-192.png', 'brand/sahten-icon-512.png', 'brand/sahten-icon-maskable-512.png', 'brand/sahten-comida-arabe-og-1200x630.png']) expect(paths).toContain(p);
  const png = files.find(f => f.path === 'brand/sahten-comida-arabe-og-1200x630.png').data;
  expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);                        // es un PNG de verdad
  expect(new DataView(png.buffer, png.byteOffset).getUint32(16)).toBe(1200);       // ancho
  expect(new DataView(png.buffer, png.byteOffset).getUint32(20)).toBe(630);        // alto
  const html = files.find(f => f.path === 'index.html').data, doc = new JSDOM(html).window.document;
  expect(doc.querySelector('meta[property="og:image"]').content).toBe('https://sahten.online/brand/sahten-comida-arabe-og-1200x630.png');
  expect(doc.querySelector('meta[property="og:image:width"]').content).toBe('1200');
  expect(doc.querySelector('meta[property="og:image:alt"]').content).toContain('SAHTEN');
  expect(doc.querySelector('meta[name="twitter:image:alt"]').content).toContain('SAHTEN');
  expect(doc.querySelector('meta[name="theme-color"]').content).toBe('#235328');
  expect(doc.querySelector('link[rel="apple-touch-icon"]').href).toBe('https://sahten.online/apple-touch-icon.png');
  expect(doc.querySelector('link[rel="manifest"]').href).toBe('https://sahten.online/site.webmanifest');
  const schema = jsonLd(doc, '#restaurant-schema');
  expect(schema.logo).toBe('https://sahten.online/brand/sahten-icon-512.png');
  expect(schema.image).toBe('https://sahten.online/img/site_hero.jpg');            // la foto sigue en los datos estructurados
  const manifest = JSON.parse(new TextDecoder().decode(files.find(f => f.path === 'site.webmanifest').data));
  for (const icon of manifest.icons) expect(paths).toContain(icon.src);
  const page = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(page.querySelector('link[rel="apple-touch-icon"]').href).toBe('https://sahten.online/apple-touch-icon.png');
});
it('sin kit de marca, sin dirección pública o con un kit desconocido no se publican ni se enlazan imágenes de marca', async () => {
  for (const tweak of [m => { delete m.site.seo.brandKit; }, m => { m.site.seo.brandKit = 'otro'; }, m => { m.site.seo.brandKit = 'sahten'; m.site.seo.url = ''; }]) {
    const m = structuredClone(full); tweak(m);
    const files = await buildPublishFiles(m), doc = new JSDOM(files.find(f => f.path === 'index.html').data).window.document;
    expect(files.some(f => f.path === 'favicon.ico' || f.path.startsWith('brand/'))).toBe(false);
    expect(doc.querySelector('link[rel="manifest"]')).toBeNull();
    expect(doc.querySelector('meta[property="og:image:width"]')).toBeNull();
  }
});

async function render(m) {
  const dom = new JSDOM(buildIndexHtml(m), { runScripts: 'dangerously', url: 'https://sahten.online/', beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => ({ ok: false, json: async () => ({}) }); } });
  await new Promise(r => setTimeout(r, 60)); return dom;
}
it('con kit de marca la portada muestra la caligrafía sola (vector incrustado, con nombre accesible); sin kit queda la etiqueta de texto', async () => {
  const m = structuredClone(full); m.site.order = ['hero', 'contacto']; m.site.hero = { title: 'Comida árabe casera', subtitle: '', cta: 'Pedir', highlights: [] }; m.site.seo.brandKit = 'sahten';
  const on = await render(m), mark = on.window.document.querySelector('#s-hero svg.brand-mark');
  expect(mark.getAttribute('aria-label')).toBe('SAHTEN Gastronomía Árabe');
  expect(mark.getAttribute('viewBox')).toBe('0 0 941 255');
  for (const start of ['M447.323 24.1132', 'M391.533 18.1166', 'M149.642 75.8555', 'M316.205 229.781', 'M260.545 236.429', 'M881.334 89.8006']) {
    expect(mark.querySelector('path').getAttribute('d')).toContain(start);
  }
  expect(mark.querySelector('path').getAttribute('d').length).toBeGreaterThan(500);
  expect(on.window.document.querySelector('#s-hero .tag')).toBeNull();
  expect(on.window.document.querySelector('#h-mark svg.brand-mark')).not.toBeNull();   // también en el encabezado simple
  on.window.close();
  delete m.site.seo.brandKit;
  const off = await render(m);
  expect(off.window.document.querySelector('svg.brand-mark')).toBeNull();
  expect(off.window.document.querySelector('#s-hero .tag').textContent).toBe('SAHTEN Gastronomía Árabe');
  off.window.close();
});
