const seoEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const seoText = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
export function publicWebUrl(value) {
  try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) return ''; u.hash = ''; u.search = ''; return u.href; } catch { return ''; }
}
export function buildSeo(menu) {
  const s = menu.site || {}, options = s.seo || {}, store = menu.store || {};
  const title = seoText(options.title || store.name || 'Menú online', 100);
  const description = seoText(options.description || s.hero?.subtitle || [store.name, menu.config?.subtitle, store.address].filter(Boolean).join(' · '), 180);
  const canonical = publicWebUrl(options.url);
  const image = publicWebUrl(s.images?.hero || menu.products?.find(p => p.image?.startsWith('https://'))?.image);
  const schema = { '@context': 'https://schema.org', '@type': 'Restaurant', name: store.name || title };
  if (canonical) { schema['@id'] = canonical + '#restaurant'; schema.url = canonical; schema.hasMenu = canonical + '#pedido'; }
  if (store.address) schema.address = { '@type': 'PostalAddress', streetAddress: options.streetAddress || store.address, ...(options.locality ? { addressLocality: options.locality } : {}), ...(options.region ? { addressRegion: options.region } : {}), ...(options.country ? { addressCountry: options.country } : {}) };
  if (store.whatsapp) schema.telephone = '+' + String(store.whatsapp).replace(/\D/g, '');
  if (options.cuisine) schema.servesCuisine = options.cuisine;
  if (image) schema.image = image;
  if (s.contacto?.instagram) schema.sameAs = ['https://www.instagram.com/' + String(s.contacto.instagram).replace(/[^A-Za-z0-9._]/g, '') + '/'];
  const lat = menu.delivery?.lat, lng = menu.delivery?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  if (options.openingHours) schema.openingHours = options.openingHours.split(',').map(x => x.trim()).filter(Boolean);
  return { title, description, canonical, image, schema };
}
export function renderSeoHead(menu) {
  const s = buildSeo(menu), meta = (name, content, property = false) => content ? `<meta ${property ? 'property' : 'name'}="${name}" content="${seoEscape(content)}">` : '';
  return [meta('description', s.description), s.canonical ? `<link rel="canonical" href="${seoEscape(s.canonical)}">` : '', meta('og:type', 'website', true), meta('og:title', s.title, true), meta('og:description', s.description, true), meta('og:url', s.canonical, true), meta('og:image', s.image, true), meta('twitter:card', s.image ? 'summary_large_image' : 'summary'), meta('twitter:title', s.title), meta('twitter:description', s.description), `<script type="application/ld+json" id="restaurant-schema">${JSON.stringify(s.schema).replace(/</g, '\\u003c')}</script>`].join('\n');
}
/** Contenido útil sin JavaScript y mientras llegan los datos en vivo. */
export function renderSearchContent(menu) {
  if (menu.config?.enabled === false) return '';
  const s = menu.site || {}, e = seoEscape;
  return `<section id="search-content" style="max-width:980px;margin:auto;padding:24px"><h2>${e(menu.store?.name || 'Menú')}</h2><p>${e(s.hero?.subtitle || menu.config?.subtitle || '')}</p><p>${e(menu.store?.address || '')}</p>${s.historia?.text ? `<h2>${e(s.historia.title || 'Nuestra historia')}</h2><p>${e(s.historia.text)}</p>` : ''}<h2>${e(s.menuTitle || 'Nuestro menú')}</h2><ul>${(menu.products || []).map(p => `<li>${e(p.name)}${p.description ? ' — ' + e(p.description) : ''}${menu.config?.showPrices !== false ? ' · ' + e(menu.store?.currency?.symbol || '$') + e(p.price) : ''}</li>`).join('')}</ul>${s.delivery?.hours ? `<h2>Horarios</h2><p>${e(s.delivery.hours)}</p>` : ''}${s.delivery?.extra ? `<p>${e(s.delivery.extra)}</p>` : ''}${s.catering ? `<h2>${e(s.catering.title || 'Catering')}</h2><p>${e(s.catering.text)}</p>` : ''}${s.faq?.items?.length ? '<h2>Preguntas frecuentes</h2>' + s.faq.items.map(f => `<h3>${e(f.q)}</h3><p>${e(f.a)}</p>`).join('') : ''}${menu.store?.whatsapp ? `<p><a href="https://wa.me/${e(String(menu.store.whatsapp).replace(/\D/g, ''))}">Consultas por WhatsApp</a></p>` : ''}</section>`;
}
export function discoveryFiles(menu) {
  const canonical = buildSeo(menu).canonical;
  if (!canonical) return [];
  return [{ path: 'robots.txt', data: 'User-agent: *\nAllow: /\nSitemap: ' + new URL('sitemap.xml', canonical).href + '\n' }, { path: 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + seoEscape(canonical) + '</loc></url></urlset>' }];
}
