// ═══════════════════════════════════════════════════════════
// Publicar menú: carpeta estática = index.html + menu.json + img/ (imágenes optimizadas)
// Hosting gratis: Cloudflare Pages, GitHub Pages o Netlify (ver docs/PUBLICAR.md).
// ═══════════════════════════════════════════════════════════
import webTemplate from './web/index.html?raw';
import deliverySrc from '../core/delivery.js?raw';
import incentiveSrc from '../delivery/incentive.js?raw';
import incentiveCss from '../delivery/incentive.css?raw';
import messageSrc from './orderMessage.js?raw';
import contrastSrc from '../ui/contrast.js?raw';
import reviewLinkSrc from '../ui/review-link.js?raw';
import storefrontSrc from './storefront.js?raw';
import paymentBenefitSrc from '../core/payment-benefit.js?raw';
import paymentChoiceSrc from '../ui/payment-choice.js?raw';
import paymentChoiceCss from '../styles/payment-choice.css?raw';
import { imageFileName, categoryPhotoKey } from './menuJson.js';
import { createZip } from './zip.js';
import seoSrc from './seo.js?raw';
import { buildSeo, renderSeoHead, renderSearchContent, discoveryFiles } from './seo.js';
import { buildSitePages } from './pages.js';
import { brandFiles, brandInline } from './brand.js';

/** El código compartido (envío por zonas y mensaje de WhatsApp) viaja adentro de la web, sin imports. */
export const sharedScript = () => [deliverySrc, incentiveSrc, messageSrc, contrastSrc, reviewLinkSrc, seoSrc, storefrontSrc, paymentBenefitSrc, paymentChoiceSrc].map(s => s.replace(/^export\s+/gm, '').replace(/<\/script/gi, '<\\/script')).join('\n');

const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028').replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');

export function buildIndexHtml(menu, { storefront = false, preview = false } = {}) {
  return webTemplate
    .replace('/*__PAYMENT_CSS__*/', () => paymentChoiceCss+'\n'+incentiveCss)
    .replace('<!--__SEO_HEAD__-->', () => (storefront ? '<base href="../">\n' : '') + renderSeoHead(menu, { storefront }))
    .replace('<body>', storefront ? '<body data-storefront>' : preview ? '<body data-preview>' : '<body>')
    .replace('<!--__SEARCH_CONTENT__-->', () => renderSearchContent(menu))
    .replace('/*__MENU_JSON__*/null', '/*__MENU_JSON__*/' + safeJson(menu))
    .replace('/*__BRAND__*/null', () => '/*__BRAND__*/' + safeJson(brandInline(menu)))
    .replace('/*__SHARED__*/', () => sharedScript())
    .replace('<title>Menú</title>', '<title>' + (storefront ? 'Pedir online | ' : '') + buildSeo(menu).title.replace(/[<>&]/g, '') + '</title>');
}

export function dataUrlToBytes(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || ''); if (!m) return null;
  if (m[2]) { const bin = atob(m[3]); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  return new TextEncoder().encode(decodeURIComponent(m[3]));
}

/** Achicar a ≤800 px y JPEG 80 % con canvas (navegador). Si no se puede, se publica la imagen original. */
export async function optimizeImage(dataUrl, { maxDim = 800, quality = 0.8 } = {}) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    const k = Math.min(1, maxDim / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) { return dataUrlToBytes(dataUrl); }
}

/** → [{ path, data }] listo para escribir en una carpeta o empaquetar. `optimize(dataUrl) → Uint8Array`. */
export async function buildPublishFiles(menu, images = {}, optimize = dataUrlToBytes) {
  const files = [
    { path: 'index.html', data: buildIndexHtml(menu) },
    { path: 'menu.json', data: JSON.stringify(menu, null, 1) },
  ];
  if (menu.site?.enabled && menu.site.orderPage) files.push({ path: 'pedir/index.html', data: buildIndexHtml(menu, { storefront: true }) });
  files.push(...discoveryFiles(menu), ...buildSitePages(menu), ...brandFiles(menu));
  for (const p of menu.products) {
    if (!p.image || !images[p.id]) continue;
    const bytes = await optimize(images[p.id]);
    if (bytes) files.push({ path: 'img/' + imageFileName(p.id), data: bytes });
  }
  for (const [cat, path] of Object.entries((menu.config && menu.config.categoryImages) || {})) {   // foto de cada categoría
    const img = images[categoryPhotoKey(cat)]; if (!img) continue;
    const bytes = await optimize(img, { maxDim: 800, quality: 0.82 });
    if (bytes) files.push({ path, data: bytes });
  }
  for (const k of ['hero', 'historia']) {
    if (!(menu.site && menu.site.images && menu.site.images[k]) || !images['site_' + k]) continue;
    const bytes = await optimize(images['site_' + k], { maxDim: 1600, quality: 0.82 });
    if (bytes) files.push({ path: 'img/site_' + k + '.jpg', data: bytes });
  }
  return files;
}

export const buildPublishZip = files => createZip(files);

/** Escribe los archivos en una carpeta elegida (File System Access API). */
export async function writeToDirectory(dirHandle, files) {
  for (const f of files) {
    const parts = f.path.split('/'); let d = dirHandle;
    for (const seg of parts.slice(0, -1)) d = await d.getDirectoryHandle(seg, { create: true });
    const fh = await d.getFileHandle(parts.at(-1), { create: true });
    const ws = await fh.createWritable(); await ws.write(f.data); await ws.close();
  }
}
