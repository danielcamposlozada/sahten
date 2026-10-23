// ═══════════════════════════════════════════════════════════
// Páginas propias del sitio publicado: /menu/, /delivery-y-retiro/, /catering/, /nuestra-historia/.
// HTML estático (sin JavaScript) armado con el mismo contenido que el dueño edita en Menú Online › Sitio web.
// Se publican junto a index.html cuando hay una dirección pública (SEO › Dirección pública de la web) y el sitio está encendido.
// ═══════════════════════════════════════════════════════════
import { buildSeo, sitePageList, menuSections, menuSchema, brandHeadTags } from './seo.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const paragraphs = text => String(text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
const colour = (value, fallback) => /^#[0-9a-fA-F]{3,8}$/.test(value || '') ? value : fallback;
const ld = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function layout(menu, page, { title, description, h1, body, extraLd = [] }) {
  const seo = buildSeo(menu), store = menu.store || {}, name = store.name || seo.title, base = seo.canonical.endsWith('/') ? seo.canonical : seo.canonical + '/';
  const url = new URL(page.slug + '/', base).href, primary = colour(menu.theme?.primary, '#235328'), accent = colour(menu.theme?.accent, '#F28C00');
  const wa = store.whatsapp ? 'https://wa.me/' + String(store.whatsapp).replace(/\D/g, '') : '';
  const nav = sitePageList(menu).map(p => p.slug === page.slug ? `<a href="./" aria-current="page">${esc(p.label)}</a>` : `<a href="../${esc(p.slug)}/">${esc(p.label)}</a>`).join('');
  const hours = menu.site?.delivery?.hours ? `<div><h2>Horarios</h2><p>${esc(menu.site.delivery.hours).replace(/\n/g, '<br>')}</p></div>` : '';
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: seo.canonical }, { '@type': 'ListItem', position: 2, name: page.label, item: url }] };
  const meta = (key, content, property) => content ? `<meta ${property ? 'property' : 'name'}="${key}" content="${esc(content)}">` : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${meta('description', description)}
<link rel="canonical" href="${esc(url)}">
${meta('og:type', 'website', true)}${meta('og:title', title, true)}${meta('og:description', description, true)}${meta('og:url', url, true)}${meta('og:image', seo.image, true)}
${meta('twitter:card', seo.image ? 'summary_large_image' : 'summary')}
${brandHeadTags(menu)}
${ld(breadcrumb)}${extraLd.map(ld).join('')}
<style>
:root{--primary:${primary};--accent:${accent};--ink:#1e2c1f;--muted:#5d6b5f;--bg:#faf8f5;--border:#e2ddd5}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}
header{background:var(--primary);color:#fff;padding:14px 16px}header .in{max-width:980px;margin:auto;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between}
header a{color:#fff;text-decoration:none}header .brand{font-weight:800;font-size:18px}header nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}header nav a[aria-current]{text-decoration:underline}
main{max-width:980px;margin:auto;padding:20px 16px 40px}.crumbs{font-size:13px;color:var(--muted)}.crumbs a{color:var(--primary)}
h1{font-size:clamp(26px,4vw,36px);line-height:1.15;margin:.5em 0 .6em}h2{font-size:21px;margin:1.6em 0 .4em;color:var(--primary)}
ul.items{list-style:none;padding:0;margin:0}ul.items li{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)}
ul.items .n{font-weight:700}ul.items .d{display:block;font-weight:400;color:var(--muted);font-size:14px}ul.items .p{font-weight:800;white-space:nowrap}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px}dt{font-weight:700}dd{margin:0}
.cta{display:inline-block;margin:10px 10px 0 0;background:var(--accent);color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px}.cta.alt{background:var(--primary)}
.quote{border-left:4px solid var(--accent);padding:4px 14px;color:var(--muted);font-style:italic}
footer{border-top:1px solid var(--border);padding:22px 16px;color:var(--muted);font-size:14px}footer .in{max-width:980px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}footer h2{font-size:15px;margin:0 0 4px;color:var(--ink)}footer p{margin:0}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
</style>
</head>
<body>
<header><div class="in"><a class="brand" href="../">${esc(name)}</a><nav aria-label="Secciones">${nav}</nav></div></header>
<main>
<p class="crumbs"><a href="../">Inicio</a> › ${esc(page.label)}</p>
<h1>${esc(h1)}</h1>
${body}
<p><a class="cta" href="../#pedido">Pedir online</a>${wa ? `<a class="cta alt" href="${esc(wa)}">Consultar por WhatsApp</a>` : ''}</p>
</main>
<footer><div class="in"><div><h2>${esc(name)}</h2>${store.address ? `<p>${esc(store.address)}</p>` : ''}</div>${hours}${wa ? `<div><h2>Contacto</h2><p><a href="${esc(wa)}">WhatsApp ${esc(store.whatsapp)}</a></p></div>` : ''}</div></footer>
</body>
</html>
`;
}

const mapsLink = address => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
const formatPrice = (menu, price) => {
  const n = Number(price); if (!Number.isFinite(n)) return esc(price);
  let shown = String(n); try { shown = n.toLocaleString(menu.store?.currency?.locale || 'es-AR'); } catch { /* idioma no soportado: se muestra el número simple */ }
  return esc((menu.store?.currency?.symbol || '$') + shown);
};

const builders = {
  menu(menu, page) {
    const s = menu.site || {}, name = menu.store?.name || '', where = s.seo?.locality ? ' en ' + s.seo.locality : '', showPrices = menu.config?.showPrices !== false;
    const names = (menu.products || []).slice(0, 4).map(p => p.name).join(', ');
    const body = menuSections(menu).map(sec => `<section><h2>${esc(sec.name)}</h2><ul class="items">${sec.items.map(p => `<li><span class="n">${esc(p.name)}${p.description ? `<span class="d">${esc(p.description)}</span>` : ''}</span>${showPrices ? `<span class="p">${formatPrice(menu, p.price)}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
    return { title: clip(`Menú${showPrices ? ' y precios' : ''} | ${name}`, 70), description: clip(`Carta completa de ${name}${where}: ${names} y más.`, 160), h1: `${s.menuTitle || 'Nuestro menú'} de ${name}`,
      body: (menu.config?.subtitle ? `<p>${esc(menu.config.subtitle)}.</p>` : '') + body, extraLd: [menuSchema(menu)].filter(Boolean) };
  },
  'delivery-y-retiro'(menu) {
    const d = menu.site.delivery, store = menu.store || {}, where = menu.site.seo?.locality ? ' en ' + menu.site.seo.locality : '';
    const body = (d.hours ? `<h2>Horarios</h2><p>${esc(d.hours).replace(/\n/g, '<br>')}</p>` : '') + (d.extra ? `<h2>Zona de reparto y envío</h2>${paragraphs(d.extra)}` : '')
      + (store.address ? `<h2>Dónde estamos</h2><p>${esc(store.address)}. <a href="${esc(mapsLink(store.address))}">Cómo llegar</a></p>` : '');
    return { title: clip(`${d.title || 'Delivery y retiro'}${where} | ${store.name || ''}`, 70), description: clip([d.hours ? 'Horarios: ' + d.hours.replace(/\s*\n\s*/g, ' · ') + '.' : '', d.extra || ''].filter(Boolean).join(' '), 160), h1: `${d.title || 'Delivery y retiro'}${where}`, body };
  },
  catering(menu) {
    const c = menu.site.catering, name = menu.store?.name || '';
    const info = (c.info || []).length ? `<h2>Datos del servicio</h2><dl>${c.info.map(i => `<dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd>`).join('')}</dl>` : '';
    return { title: clip(`${c.title || 'Catering y eventos'} | ${name}`, 70), description: clip((c.text || '').split(/\n\s*\n/)[0], 160), h1: c.title || 'Catering y eventos', body: paragraphs(c.text) + info };
  },
  'nuestra-historia'(menu) {
    const h = menu.site.historia, name = menu.store?.name || '';
    const badge = h.badgeWord ? `<h2>${esc(h.badgeWord)}${h.badgeMeaning ? ` · ${esc(h.badgeMeaning)}` : ''}</h2>${h.badgeQuote ? `<p class="quote">${esc(h.badgeQuote)}</p>` : ''}` : '';
    return { title: clip(`${h.eyebrow || 'Nuestra historia'} | ${name}`, 70), description: clip(h.text, 160), h1: h.title || h.eyebrow || 'Nuestra historia', body: paragraphs(h.text) + badge };
  },
};

/** → [{ path, data }] con una carpeta por página (menu/index.html, …). Vacío si no hay web pública o el sitio está apagado. */
export function buildSitePages(menu) {
  return sitePageList(menu).map(page => ({ path: page.slug + '/index.html', data: layout(menu, page, builders[page.slug](menu, page)) }));
}
