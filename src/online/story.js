/** Galería compartida por la portada y la página estática de historia. Sin recortar fotos. */
export function storyPhotosHtml(site, fallbackAlt = 'Nuestro local', prefix = '') {
  const storyEscape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const photos = [
    ['historia', 'imageAlt', 'imageCaption', 1024, 768],
    ['familia', 'familyAlt', 'familyCaption', 1065, 1600],
  ].map(([key, alt, caption, width, height]) => {
    const source = site?.images?.[key];
    // Solo archivos propios o imágenes públicas. Nunca esquemas ejecutables ni rutas ascendentes.
    if (typeof source !== 'string' || !(/^(https?:\/\/|img\/)/i.test(source)) || source.split('/').includes('..')) return '';
    const src = /^https?:\/\//i.test(source) ? source : prefix + source;
    const text = site.historia?.[caption];
    return `<figure class="story-photo story-photo-${key}"><img src="${storyEscape(src)}" alt="${storyEscape(site.historia?.[alt] || fallbackAlt)}" width="${width}" height="${height}" loading="lazy" decoding="async">${text ? `<figcaption>${storyEscape(text)}</figcaption>` : ''}</figure>`;
  }).filter(Boolean);
  return photos.length ? `<div class="story-photos${photos.length === 1 ? ' story-photos-single' : ''}">${photos.join('')}</div>` : '';
}
