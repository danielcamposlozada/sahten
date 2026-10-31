import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
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
  expect(homepage.querySelector('style').textContent).toContain('terra-2026');
  const files = await buildPublishFiles(menu);
  const index = new JSDOM(files.find(f => f.path === 'index.html').data).window.document;
  const pedir = new JSDOM(files.find(f => f.path === 'pedir/index.html').data).window.document;
  expect(index.body.getAttribute('data-visual-style')).toBe('terra-2026');
  expect(pedir.body.hasAttribute('data-storefront')).toBe(true);
  expect(pedir.querySelector('meta[name="robots"]').content).toBe('noindex,follow');
  expect(index.querySelector('meta[name="robots"]')?.content).not.toContain('noindex');
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
