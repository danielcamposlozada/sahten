// ═══════════════════════════════════════════════════════════
// Kit de imágenes de marca que viaja en «Publicar menú»: favicon, apple-touch-icon, íconos del manifiesto e imagen para compartir el link.
// Se activa con SEO › Kit de marca (hoy: «sahten») y solo si hay dirección pública. Las etiquetas del <head> salen de seo.js (brandHeadTags).
// Los archivos se generan con scripts/build-brand-kit.py a partir de docs/brand/<kit>/source/ (no se editan a mano).
// ═══════════════════════════════════════════════════════════
import { brandKit } from './seo.js';
import { SAHTEN_BRAND_FILES, SAHTEN_CALLIGRAPHY } from './brand/sahten.js';

const KITS = { sahten: SAHTEN_BRAND_FILES };
const MARKS = { sahten: SAHTEN_CALLIGRAPHY };
const fromBase64 = b64 => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

/** → [{ path, data }] (vacío si el sitio no tiene kit de marca o no hay web pública). */
export function brandFiles(menu) {
  const kit = brandKit(menu), files = kit && KITS[kit.id];
  if (!files) return [];
  return Object.entries(files).map(([path, b64]) => ({ path, data: fromBase64(b64) }));
}

/** Caligrafía sola para el encabezado de la web: { viewBox, d } o null si no hay kit. Va incrustada en index.html (sin archivo aparte). */
export function brandInline(menu) {
  const kit = brandKit(menu);
  return (kit && MARKS[kit.id]) || null;
}
