// El logo se guarda con el contenido del sitio y viaja incrustado: no depende de archivos locales.
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export function normalizeStoreLogo(value) {
  const s = typeof value === 'string' ? value : '';
  return s.length <= Math.ceil(LOGO_MAX_BYTES * 4 / 3) + 64 && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(s) ? s : '';
}

export function validateLogoSvg(source, Parser = globalThis.DOMParser) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('El SVG debe contener solamente el logo, sin enlaces ni scripts.');
  const doc = new Parser().parseFromString(source, 'image/svg+xml');
  const allowed = new Set(['svg', 'path', 'g', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc']);
  if (doc.documentElement.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('El archivo SVG no es válido.');
  for (const el of doc.querySelectorAll('*')) {
    if (!allowed.has(el.localName)) throw new Error('El SVG debe contener solamente trazos del logo, sin scripts, imágenes ni texto externo.');
    for (const a of el.attributes) {
      if (/^on|href|style/i.test(a.name) || /url\(\s*[^#]|javascript:|https?:/i.test(a.value) && a.name !== 'xmlns') throw new Error('El SVG contiene enlaces o estilos externos. Exportalo como trazos o cargá un PNG.');
    }
  }
  return source;
}

export async function readStoreLogo(file) {
  if (!file || file.size > LOGO_MAX_BYTES) throw new Error('Elegí un logo SVG, PNG, JPG o WebP de hasta 2 MB.');
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    const source = validateLogoSvg(await file.text());
    const bytes = new TextEncoder().encode(source); let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return 'data:image/svg+xml;base64,' + btoa(bin);
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Elegí un logo SVG, PNG, JPG o WebP.');
  const data = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No pudimos leer ese logo.')); img.src = data; });
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png'); // conservar la transparencia y las proporciones
}
