import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import publishedContent from '../docs/brand/sahten/sitio-terra-borrador-2026-10-31.json';
import { normalizeSite, buildSite, exportSiteContent, parseSiteContent, applySiteContent } from '../src/online/site.js';
import { buildIndexHtml, buildPublishFiles } from '../src/online/publish.js';

/*
 * Contrato de migración desde las maquetas Terra:
 * el estilo es opt-in; la web REAL conserva el catálogo y su contenido
 * completo. Este archivo deliberadamente NO importa menu-3.js del prototipo.
 */
const sampleMenu = () => ({
  store: {
    name: 'SAHTEN Gastronomía Árabe',
    address: 'General Julio Argentino Roca 1489, Vicente López, Buenos Aires',
    whatsapp: '5491123937295',
    currency: { locale: 'es-AR', symbol: '$' },
  },
  products: [{ id: 'live-product', name: 'Producto vigente', category: 'Entradas', price: 13000, description: 'Del catálogo real' }],
  config: { enabled: true, showPrices: true, categories: ['Entradas'] },
  delivery: {},
  site: { ...normalizeSite(publishedContent.site), enabled: true, orderPage: true, visualStyle: 'terra-2026' },
});

it('activa Terra únicamente por opción explícita; el default histórico continúa clásico', () => {
  expect(normalizeSite({}).visualStyle).toBe('classic');
  expect(buildSite({ enabled: true }).visualStyle).toBeUndefined();
  expect(normalizeSite({ visualStyle: 'cualquier-valor' }).visualStyle).toBe('classic');
  const site = normalizeSite({ enabled: true, visualStyle: 'terra-2026' });
  expect(buildSite(site).visualStyle).toBe('terra-2026');
  const restored = applySiteContent({}, parseSiteContent(exportSiteContent(site)));
  expect(restored.visualStyle).toBe('terra-2026');
});

it('prepara el diseño Terra para home y carta sin alterar el checkout integrado', async () => {
  const menu = sampleMenu();
  const homepage = new JSDOM(buildIndexHtml(menu)).window.document;
  const storefront = new JSDOM(buildIndexHtml(menu, { storefront: true })).window.document;
  const unchanged = new JSDOM(buildIndexHtml({ ...menu, site: { ...menu.site, visualStyle: 'classic' } })).window.document;
  expect(homepage.body.getAttribute('data-visual-style')).toBe('terra-2026');
  expect(storefront.body.getAttribute('data-visual-style')).toBe('terra-2026');
  expect(storefront.body.hasAttribute('data-storefront')).toBe(true);
  expect(unchanged.body.hasAttribute('data-visual-style')).toBe(false);
  const rawHtml = buildIndexHtml(menu);
  expect(rawHtml).toContain('id="terra-styles"');
  // Vitest simula las importaciones CSS ?raw como cadenas vacías. La hoja
  // real se comprueba desde el archivo y Vite la incorpora al hacer build.
  expect(readFileSync(new URL('../src/online/web/terra.css', import.meta.url), 'utf8')).toContain('body[data-visual-style="terra-2026"]');
  expect(homepage.getElementById('terra-styles')).not.toBeNull();
  const files = await buildPublishFiles(menu);
  const index = new JSDOM(files.find(f => f.path === 'index.html').data).window.document;
  const pedir = new JSDOM(files.find(f => f.path === 'pedir/index.html').data).window.document;
  expect(index.body.getAttribute('data-visual-style')).toBe('terra-2026');
  expect(pedir.body.hasAttribute('data-storefront')).toBe(true);
  expect(pedir.querySelector('meta[name="robots"]').content).toBe('noindex,follow');
  expect(index.querySelector('meta[name="robots"]')?.content || '').not.toContain('noindex');
});

it('mantiene las 11 preguntas aprobadas en el HTML y en FAQPage sin tomar dos FAQ de ejemplo', () => {
  const menu = sampleMenu();
  const items = publishedContent.site.faq.items;
  expect(items).toHaveLength(11);
  const home = new JSDOM(buildIndexHtml(menu)).window.document;
  const searchText = home.querySelector('#search-content').textContent;
  const schema = JSON.parse(home.querySelector('#faq-schema').textContent);
  expect(schema['@type']).toBe('FAQPage');
  expect(schema.mainEntity).toHaveLength(11);
  for (const [i, item] of items.entries()) {
    expect(searchText).toContain(item.q);
    expect(searchText).toContain(item.a);
    expect(schema.mainEntity[i].name).toBe(item.q);
    expect(schema.mainEntity[i].acceptedAnswer.text).toBe(item.a);
  }
});

it('conserva las páginas informativas, el canonical y los productos vivos sin usar el catálogo del prototipo', async () => {
  const menu = sampleMenu();
  const files = await buildPublishFiles(menu);
  for (const path of ['menu/index.html', 'delivery-y-retiro/index.html', 'catering/index.html', 'nuestra-historia/index.html', 'sitemap.xml']) {
    expect(files.some(f => f.path === path)).toBe(true);
  }
  const catalog = new JSDOM(files.find(f => f.path === 'menu/index.html').data).window.document;
  expect(catalog.querySelector('link[rel="canonical"]').href).toBe('https://sahten.online/menu/');
  expect(catalog.querySelector('main').textContent).toContain('Producto vigente');
  expect(catalog.querySelector('main').textContent).toContain('$13.000');
  expect(catalog.querySelector('main').textContent).not.toContain('Shawarma de Carne');
});

it('descarta los importes y horarios archivados que no provienen de la configuración en vivo', () => {
  const text = JSON.stringify(publishedContent.site);
  expect(text).not.toMatch(/\\$45\\.000|unos 6 km|18:00 a 23:00|18:00-23:00/);
  expect(publishedContent.site.seo.openingHours).toBe('');
  expect(publishedContent.site.faq.items).toHaveLength(11);
});


it('usa el carrito y el flujo de compra reales bajo la presentación Terra, sin enviar pedidos ni cobros', async () => {
  const menu = sampleMenu();
  menu.payments = { methods: { efectivo: true } };
  const dom = new JSDOM(buildIndexHtml(menu, { storefront: true }), {
    url: 'https://sahten.online/pedir/',
    runScripts: 'dangerously',
    beforeParse(w) {
      w.scrollTo = () => {};
      w.fetch = async () => ({ ok: false });
    },
  });
  await new Promise(resolve => setTimeout(resolve, 65));
  const d = dom.window.document;
  expect(d.querySelector('#grid')).not.toBeNull();
  expect(d.querySelector('#grid').textContent).toContain('Producto vigente');
  expect(d.querySelector('#grid [data-inc]')).not.toBeNull();
  d.querySelector('#grid [data-inc]').click();
  expect(d.querySelector('#bar-n').textContent).toContain('1 producto');
  d.querySelector('#bar button').click();
  expect(d.querySelector('#ov').classList.contains('on')).toBe(true);
  d.querySelector('#cart-next').click();
  expect(d.querySelector('#sheet').textContent).toContain('Retiro');
  expect(d.querySelector('#sheet').textContent).toContain('Delivery');
  expect(d.querySelector('#sheet').textContent).toContain('Entrega y pago');
  dom.window.close();
});

it('conserva las preferencias para ocultar fotos sin borrar productos o categorías', async () => {
  const menu = sampleMenu();
  menu.config.showImages = false;
  const doc = new JSDOM(buildIndexHtml(menu)).window.document;
  expect(doc.body.dataset.visualStyle).toBe('terra-2026');
  const dom = new JSDOM(buildIndexHtml(menu), {
    url: 'https://sahten.online/',
    runScripts: 'dangerously',
    beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => ({ ok: false }); },
  });
  await new Promise(resolve => setTimeout(resolve, 65));
  expect(dom.window.document.querySelector('#s-menuhd').textContent).toContain('Entradas');
  expect(dom.window.document.querySelector('#s-menuhd').textContent).toContain('Producto vigente');
  expect(dom.window.document.querySelector('#s-menuhd .terra-food-image img')).toBeNull();
  dom.window.close();
});


it('mantiene el editor anterior y permite seleccionar Terra sin publicar ni alterar pedidos', () => {
  const source = readFileSync(new URL('../src/legacy/sahten-siteeditor.js', import.meta.url), 'utf8');
  expect(() => new Script(source)).not.toThrow();
  expect(source).toContain('data-sb-visual-style');
  expect(source).toContain("S.visualStyle = t.value === 'terra-2026'");
  expect(source).toContain('data-sb-order-page');
  expect(source).toContain('data-sb-import');
  expect(source).toContain('data-sb-enabled');
});


it('la sección de videos es opcional y solo se publica con Terra, sin cambiar pedidos', () => {
  expect(normalizeSite({}).videos.on).toBe(false);
  const site=normalizeSite({enabled:true,visualStyle:'terra-2026',videos:{on:true,title:'Momentos',lead:'Reels',tutorialEnabled:false}});
  expect(buildSite(site).videos).toMatchObject({title:'Momentos',lead:'Reels',tutorialEnabled:false});
  expect(buildSite({...site,visualStyle:'classic'}).videos).toBeUndefined();
  const restored=applySiteContent({},parseSiteContent(exportSiteContent(site)));
  expect(restored.videos.on).toBe(true);
  expect(restored.videos.tutorialEnabled).toBe(false);
});
it('la home incorpora tres videos reales con poster y no los descarga automáticamente', async () => {
  const menu=sampleMenu();
  expect(menu.site.videos.on).toBe(true);
  const dom=new JSDOM(buildIndexHtml(menu),{
    url:'https://sahten.online/',
    runScripts:'dangerously',
    beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>({ok:false});}
  });
  await new Promise(r=>setTimeout(r,100));
  const d=dom.window.document;
  const videos=[...d.querySelectorAll('#s-videos video')];
  expect(videos).toHaveLength(3);
  expect(videos.map(v=>v.querySelector('source').getAttribute('src'))).toEqual([
    'media/terra/tabla-celebrar.mp4',
    'media/terra/tabla-compartir.mp4',
    'media/terra/supermix.mp4'
  ]);
  for(const video of videos){
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.getAttribute('poster')).toMatch(/^media\/terra\/posters\/[a-z-]+\.webp$/);
  }
  expect(d.querySelector('#s-how video')).toBeNull();
  expect(d.querySelector('#s-videos a[href$="pedir/"]')).not.toBeNull();
  dom.window.close();
});
it('el tutorial antiguo permanece oculto hasta aprobación explícita', async () => {
  const m=sampleMenu();m.site.videos.tutorialEnabled=true;
  const dom=new JSDOM(buildIndexHtml(m),{
    url:'https://sahten.online/',
    runScripts:'dangerously',
    beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>({ok:false});}
  });
  await new Promise(r=>setTimeout(r,100));
  expect(dom.window.document.querySelector('#s-how .terra-tutorial video source')?.getAttribute('src')).toBe('media/terra/como-comprar.mp4');
  expect(dom.window.document.querySelector('.terra-tutorial-notice').textContent).toContain('versión anterior');
  dom.window.close();
});
