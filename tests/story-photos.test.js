import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildSite } from '../src/online/site.js';
import { buildPublishFiles, buildIndexHtml } from '../src/online/publish.js';
import { storyPhotosHtml } from '../src/online/story.js';

const site = buildSite({ enabled: true, historia: { on: true, title: 'Nuestra historia', text: 'Recetas familiares.', teamText: 'Equipo de prueba <seguro>', imageAlt: 'En el local', familyAlt: 'Foto familiar', familyCaption: 'La Sitto de Marcel' }, seo: { url: 'https://local.example/tienda/' } }, { historia: true, familia: true });
const menu = { store: { name: 'Local' }, config: {}, products: [], site };

it('publica ambas fotos y mantiene las rutas correctas en una web dentro de una carpeta', async () => {
  const images = { site_historia: 'data:image/jpeg;base64,AQ==', site_familia: 'data:image/jpeg;base64,Ag==' };
  const files = await buildPublishFiles(menu, images);
  expect([...files.find(f => f.path === 'img/site_historia.jpg').data]).toEqual([1]);
  expect([...files.find(f => f.path === 'img/site_familia.jpg').data]).toEqual([2]);
  const doc = new JSDOM(files.find(f => f.path === 'nuestra-historia/index.html').data, { url: 'https://local.example/tienda/nuestra-historia/' }).window.document;
  expect([...doc.querySelectorAll('.story-photo img')].map(img => img.src)).toEqual(['https://local.example/tienda/img/site_historia.jpg', 'https://local.example/tienda/img/site_familia.jpg']);
  expect(doc.querySelector('figcaption').textContent).toBe('La Sitto de Marcel');
  expect(doc.querySelector('img').getAttribute('loading')).toBe('lazy');
  expect(doc.body.textContent).toContain('Equipo de prueba <seguro>');
  expect(doc.querySelector('seguro')).toBeNull();
});

it('escapa descripciones y no acepta imágenes ejecutables o rutas ascendentes', () => {
  const hostile = structuredClone(site); hostile.historia.familyAlt = '" onerror="alert(1)'; hostile.historia.familyCaption = '<script>bad</script>';
  let doc = new JSDOM(storyPhotosHtml(hostile)).window.document;
  expect(doc.querySelector('.story-photo-familia img').getAttribute('onerror')).toBeNull();
  expect(doc.querySelector('figcaption').textContent).toBe('<script>bad</script>');
  hostile.images = { historia: 'javascript:alert(1)', familia: 'img/../secret' };
  expect(storyPhotosHtml(hostile)).toBe('');
});

it('conserva sitios sin fotos y permite una sola foto', () => {
  expect(storyPhotosHtml({})).toBe('');
  const one = structuredClone(site); delete one.images.historia;
  expect(new JSDOM(storyPhotosHtml(one)).window.document.querySelectorAll('.story-photo')).toHaveLength(1);
});

it('la portada usa la misma galería y el lema queda legible una sola vez', async () => {
  const m = structuredClone(menu); m.site.order = ['historia', 'banda']; m.site.banda = { text: 'Cocina en familia' };
  const dom = new JSDOM(buildIndexHtml(m), { url: 'https://local.example/tienda/', runScripts: 'dangerously', beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => ({ ok: true, json: async () => m }); } });
  await new Promise(r => setTimeout(r, 30));
  expect(dom.window.document.querySelectorAll('#s-about .story-photo')).toHaveLength(2);
  expect(dom.window.document.querySelector('#s-about').textContent).not.toContain('Equipo de prueba');
  expect(dom.window.document.querySelector('.band').textContent).toBe('Cocina en familia');
  expect(dom.window.document.querySelector('.band').hasAttribute('aria-hidden')).toBe(false);
  dom.window.close();
});
