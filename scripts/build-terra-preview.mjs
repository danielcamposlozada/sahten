/**
 * Sahten Terra — vista previa autónoma en Cloudflare Pages.
 *
 * No usa datos personales, service_role, credenciales, órdenes, pagos ni API live.
 * Únicamente el catálogo público de lectura de docs/brand/sahten/preview-menu-publico.json.
 * Los compradores reales siguen en https://sahten.online/.
 * Comando: npx vite-node scripts/build-terra-preview.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildPublishFiles } from '../src/online/publish.js';
import { normalizeSite } from '../src/online/site.js';

const root = process.cwd();
const out = path.resolve(root, 'dist-terra-preview');
const content = JSON.parse(fs.readFileSync(path.join(root, 'docs/brand/sahten/sitio-terra-borrador-2026-10-31.json'), 'utf8'));
const publicMenu = JSON.parse(fs.readFileSync(path.join(root, 'docs/brand/sahten/preview-menu-publico.json'), 'utf8'));
const site = { ...normalizeSite(content.site), enabled: true, visualStyle: 'terra-2026', orderPage: true };
const menu = {
  ...publicMenu,
  site,
  // No conexión a la base de datos desde la preview: aunque se abra el checkout
  // no puede modificar el catálogo ni enviar pedidos a la tienda activa.
  supabase: null,
  delivery: { enabled: true, zones: [], deliveryMinOrder: 0, freeShippingMin: 0 },
};
if (menu.products?.length < 10 || !site.faq?.items?.length || !site.videos?.tutorialEnabled) {
  throw new Error('Preview Terra incompleta: faltan catálogo, FAQ o tutorial autorizado');
}

// Impide que un enlace WA o un botón de envío en la preview contacte al negocio.
const previewTag = `<style>
#sahten-preview-notice{position:relative;z-index:1000;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;background:#FFF4D6;color:#235328;border-bottom:2px solid #235328;padding:8px 16px;font:700 13px/1.5 system-ui,-apple-system,sans-serif;text-align:center}
#sahten-preview-notice strong{font-weight:900;letter-spacing:.05em}
#sahten-preview-notice a{color:#235328;text-decoration:underline}
</style><aside id="sahten-preview-notice" role="note"><strong>VISTA PREVIA SAHTEN</strong><span>Diseño en revisión · Datos comerciales de referencia · No se envían pedidos ni se hacen cobros</span><a href="https://github.com/danielcamposlozada/sahten/pull/40" target="_blank" rel="noopener">Cambios en GitHub</a></aside>
<script>document.addEventListener('click',function(e){var link=e.target.closest('a[href*="wa.me/"],a[href*="api.whatsapp.com/"]');if(link){e.preventDefault();e.stopImmediatePropagation();alert('Vista previa: contacto deshabilitado. Usá sahten.online para comunicarte con el local.')}},true);</script>`;

function htmlPreview(data) {
  let str = String(data);
  // Sin alteraciones de la plantilla ni de los motores comerciales: estos
  // cambios se hacen SOLO a los archivos de salida del preview.
  str = str.replace('</head>', '<meta name="robots" content="noindex,nofollow,noarchive">\n</head>');
  str = str.replace(/(<body[^>]*>)/i, '$1\n' + previewTag);
  str = str.replace('function send(){', "function send(){alert('Vista previa: no se envían pedidos ni se realizan cobros.');return;");
  return str;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const files = await buildPublishFiles(menu);
const published = [];
for (const { path: filename, data } of files) {
  if (filename === 'sitemap.xml' || filename === 'robots.txt') continue;
  const target = path.resolve(out, filename);
  if (!target.startsWith(out + path.sep)) throw new Error('Ruta inválida: ' + filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, filename.endsWith('.html') ? htmlPreview(data) : data);
  published.push(filename);
}
fs.writeFileSync(path.join(out, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
const needed = ['index.html', 'pedir/index.html', 'catering/index.html', 'media/terra/photos/banner-plato.webp', 'media/terra/photos/banner-tortas.webp', 'media/terra/photos/catering-mesa.webp', 'media/terra/como-comprar.mp4'];
for (const name of needed) if (!published.includes(name)) throw new Error('Falta un archivo de preview: ' + name);
console.log('Vista previa Terra generada:', published.length, 'archivos', 'catálogo público:', menu.products.length, 'productos');
// Despliegue dedicado: sahten-terra-revision.pages.dev (no reemplaza sahten.online).

