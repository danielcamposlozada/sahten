const seoEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const seoText = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const seoList = value => String(value || '').split(',').map(x => x.trim()).filter(Boolean);
export function publicWebUrl(value) {
  try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) return ''; u.hash = ''; u.search = ''; return u.href; } catch { return ''; }
}
/** Kits de imágenes de marca incluidos en la app (ver src/online/brand.js y docs/brand/). Se activan con SEO › Kit de marca. */
export const BRAND_KIT_IDS = ['sahten'];
const BRAND_KIT_ALT = { sahten: 'SAHTEN Gastronomía Árabe: logo con la caligrafía árabe en naranja sobre fondo verde' };
const seoAsset = (canonical, path) => new URL(path, canonical.endsWith('/') ? canonical : canonical + '/').href;
/** Direcciones públicas de las imágenes del kit de marca ({} si no hay kit, o no hay web pública para armarlas). */
export function brandKit(menu) {
  const o = (menu.site && menu.site.seo) || {}, id = String(o.brandKit || '').trim().toLowerCase(), canonical = publicWebUrl(o.url);
  if (!BRAND_KIT_IDS.includes(id) || !canonical) return null;
  const at = path => seoAsset(canonical, path);
  return { id, og: at('brand/' + id + '-comida-arabe-og-1200x630.png'), ogAlt: BRAND_KIT_ALT[id], logo: at('brand/' + id + '-icon-512.png'), icon: at('favicon.ico'), svg: at('favicon.svg'), apple: at('apple-touch-icon.png'), manifest: at('site.webmanifest') };
}
const SEO_CURRENCY_BY_REGION = { AR: 'ARS', UY: 'UYU', CL: 'CLP', MX: 'MXN', CO: 'COP', PE: 'PEN', BR: 'BRL', ES: 'EUR', US: 'USD' };
/** Código ISO de moneda a partir del idioma-región del negocio (es-AR → ARS). '' si no se puede saber. */
export function seoCurrency(menu) {
  const m = /-([A-Za-z]{2})$/.exec((menu.store && menu.store.currency && menu.store.currency.locale) || '');
  return m ? SEO_CURRENCY_BY_REGION[m[1].toUpperCase()] || '' : '';
}
/** Páginas propias que se publican además de la portada (menú completo, delivery, catering, historia). Solo con web pública y sitio encendido. */
export function sitePageList(menu) {
  const s = menu.site;
  if (!s || menu.config?.enabled === false || !publicWebUrl(s.seo?.url)) return [];
  const pages = [];
  if ((menu.products || []).length) pages.push({ slug: 'menu', label: 'Menú completo' });
  if (s.delivery) pages.push({ slug: 'delivery-y-retiro', label: 'Delivery y retiro' });
  if (s.catering?.text) pages.push({ slug: 'catering', label: 'Catering y eventos' });
  if (s.historia?.text) pages.push({ slug: 'nuestra-historia', label: 'Nuestra historia' });
  return pages;
}
/** Productos agrupados por categoría, en el orden del menú; lo que no tiene categoría va al final como «Otros». */
export function menuSections(menu) {
  const products = menu.products || [], known = menu.config?.categories || [], groups = new Map();
  for (const name of known) groups.set(name, []);
  for (const p of products) { const name = p.category || 'Otros'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(p); }
  return [...groups].filter(([, items]) => items.length).map(([name, items]) => ({ name, items }));
}
export function buildSeo(menu) {
  const s = menu.site || {}, options = s.seo || {}, store = menu.store || {};
  const title = seoText(options.title || store.name || 'Menú online', 100);
  const description = seoText(options.description || s.hero?.subtitle || [store.name, menu.config?.subtitle, store.address].filter(Boolean).join(' · '), 180);
  const canonical = publicWebUrl(options.url);
  const kit = brandKit(menu);
  const heroImage = publicWebUrl(s.images?.hero || menu.products?.find(p => p.image?.startsWith('https://'))?.image);
  const image = kit ? kit.og : heroImage;   // al compartir el link se ve la imagen de marca; la foto va en los datos estructurados
  const schema = { '@context': 'https://schema.org', '@type': 'Restaurant', name: store.name || title };
  const hasMenuPage = sitePageList(menu).some(p => p.slug === 'menu');
  if (canonical) { schema['@id'] = canonical + '#restaurant'; schema.url = canonical; schema.hasMenu = hasMenuPage ? seoAsset(canonical, 'menu/') : canonical + '#pedido'; }
  if (store.address) schema.address = { '@type': 'PostalAddress', streetAddress: options.streetAddress || store.address, ...(options.locality ? { addressLocality: options.locality } : {}), ...(options.region ? { addressRegion: options.region } : {}), ...(options.country ? { addressCountry: options.country } : {}) };
  if (store.whatsapp) schema.telephone = '+' + String(store.whatsapp).replace(/\D/g, '');
  const cuisine = seoList(options.cuisine);
  if (cuisine.length) schema.servesCuisine = cuisine.length === 1 ? cuisine[0] : cuisine;
  const areas = seoList(options.areaServed);
  if (areas.length) schema.areaServed = areas.map(name => ({ '@type': 'Place', name }));
  if (heroImage || image) schema.image = heroImage || image;
  if (kit) schema.logo = kit.logo;
  const sameAs = [];
  if (s.contacto?.instagram) sameAs.push('https://www.instagram.com/' + String(s.contacto.instagram).replace(/[^A-Za-z0-9._]/g, '') + '/');
  for (const link of seoList(options.sameAs)) { try { const u = new URL(link); if (u.protocol === 'https:' && !u.username && !u.password && !sameAs.includes(u.href)) sameAs.push(u.href); } catch { /* enlace inválido: se ignora */ } }
  if (sameAs.length) schema.sameAs = sameAs;
  const lat = menu.delivery?.lat, lng = menu.delivery?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  if (options.openingHours) schema.openingHours = options.openingHours.split(',').map(x => x.trim()).filter(Boolean);
  return { title, description, canonical, image, imageAlt: kit ? kit.ogAlt : '', schema };
}
/** Preguntas frecuentes como datos estructurados: son las mismas que se ven en la página. */
export function faqSchema(menu) {
  const items = menu.site?.faq?.items || [];
  if (!items.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}
/** Carta como datos estructurados (Menu › MenuSection › MenuItem), para la página del menú completo. */
export function menuSchema(menu) {
  const canonical = buildSeo(menu).canonical, currency = seoCurrency(menu), showPrices = menu.config?.showPrices !== false;
  if (!canonical) return null;
  return { '@context': 'https://schema.org', '@type': 'Menu', name: 'Menú de ' + (menu.store?.name || 'la carta'), url: seoAsset(canonical, 'menu/'), inLanguage: 'es',
    hasMenuSection: menuSections(menu).map(sec => ({ '@type': 'MenuSection', name: sec.name,
      hasMenuItem: sec.items.map(p => ({ '@type': 'MenuItem', name: p.name, ...(p.description ? { description: p.description } : {}),
        ...(showPrices && currency && Number.isFinite(Number(p.price)) ? { offers: { '@type': 'Offer', price: String(p.price), priceCurrency: currency } } : {}) })) })) };
}
const ldScript = (id, data) => `<script type="application/ld+json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
/** Íconos, color del navegador, manifiesto y medidas de la imagen al compartir: solo con kit de marca (si no, no hay archivos a los que apuntar). */
export function brandHeadTags(menu) {
  const kit = brandKit(menu); if (!kit) return '';
  const primary = /^#[0-9a-fA-F]{6}$/.test(menu.theme?.primary || '') ? menu.theme.primary : '#235328', e = seoEscape;
  return [`<meta name="theme-color" content="${e(primary)}">`, `<link rel="icon" href="${e(kit.icon)}" sizes="48x48">`, `<link rel="icon" href="${e(kit.svg)}" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${e(kit.apple)}">`, `<link rel="manifest" href="${e(kit.manifest)}">`,
    `<meta property="og:image:type" content="image/png">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${e(kit.ogAlt)}">`, `<meta name="twitter:image" content="${e(kit.og)}">`, `<meta name="twitter:image:alt" content="${e(kit.ogAlt)}">`].join('\n');
}
export function renderSeoHead(menu) {
  const s = buildSeo(menu), faq = faqSchema(menu), meta = (name, content, property = false) => content ? `<meta ${property ? 'property' : 'name'}="${name}" content="${seoEscape(content)}">` : '';
  return [meta('description', s.description), s.canonical ? `<link rel="canonical" href="${seoEscape(s.canonical)}">` : '', meta('og:type', 'website', true), meta('og:title', s.title, true), meta('og:description', s.description, true), meta('og:url', s.canonical, true), meta('og:image', s.image, true), meta('twitter:card', s.image ? 'summary_large_image' : 'summary'), meta('twitter:title', s.title), meta('twitter:description', s.description), brandHeadTags(menu), ldScript('restaurant-schema', s.schema), faq ? ldScript('faq-schema', faq) : ''].filter(Boolean).join('\n');
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
  const base = canonical.endsWith('/') ? canonical : canonical + '/', day = /^\d{4}-\d{2}-\d{2}/.exec(menu.generatedAt || '');
  const lastmod = day ? '<lastmod>' + day[0] + '</lastmod>' : '';
  const urls = [canonical, ...sitePageList(menu).map(p => new URL(p.slug + '/', base).href)];
  return [{ path: 'robots.txt', data: 'User-agent: *\nAllow: /\nSitemap: ' + seoAsset(canonical, 'sitemap.xml') + '\n' }, { path: 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + seoEscape(u) + '</loc>' + lastmod + '</url>').join('') + '</urlset>' }];
}
