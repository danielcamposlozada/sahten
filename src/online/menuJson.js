// ═══════════════════════════════════════════════════════════
// menu.json: lo que ve el menú publicado. Puro (sin DOM). Nunca incluye costos, márgenes ni datos de clientes.
// ═══════════════════════════════════════════════════════════
import { mostradorFinalPrice } from '../core/pricing.js';

export const MENU_VERSION = 1;

const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const list = (v, max, fn) => (Array.isArray(v) ? v : []).map(fn).filter(Boolean).slice(0, max);

/** Portada y secciones del sitio (opcional). Devuelve null si está apagado. Todo texto se recorta: es contenido que escribe el dueño. */
export function buildSite(site) {
  if (!site || !site.enabled) return null;
  const cat = site.catering || {};
  return {
    enabled: true,
    heroTitle: txt(site.heroTitle, 80), heroSubtitle: txt(site.heroSubtitle, 220), ctaLabel: txt(site.ctaLabel, 30) || 'Armá tu pedido',
    highlights: list(site.highlights, 4, h => { const title = txt(h && h.title, 40); return title ? { icon: txt(h.icon, 4), title, text: txt(h.text, 90) } : null; }),
    favoritesTitle: txt(site.favoritesTitle, 60) || 'Nuestros favoritos',
    aboutTitle: txt(site.aboutTitle, 80), aboutText: txt(site.aboutText, 1500),
    reviews: list(site.reviews, 9, r => { const text = txt(r && r.text, 300); return text ? { text, author: txt(r.author, 50), source: txt(r.source, 40) } : null; }),
    catering: cat.enabled ? { title: txt(cat.title, 80) || 'Catering y eventos', text: txt(cat.text, 600), zone: txt(cat.zone, 120), notice: txt(cat.notice, 120) } : null,
    hours: txt(site.hours, 300),
    instagram: txt(site.instagram, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, ''),
    faq: list(site.faq, 12, f => { const q = txt(f && f.q, 140), a = txt(f && f.a, 500); return q && a ? { q, a } : null; }),
  };
}

/** Categorías con el orden elegido; las nuevas van al final (alfabético). */
export function orderedCategories(products, config = {}) {
  const all = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const order = (config.categoryOrder || []).filter(c => all.includes(c));
  return [...order, ...all.filter(c => !order.includes(c))].filter(c => !(config.hiddenCategories || []).includes(c));
}

/** Productos que se publican: no solo-receta, con nombre, no ocultos (ni ellos ni su categoría) y con precio. */
export function publishableProducts(s, config = {}) {
  const hiddenP = config.hiddenProducts || [], hiddenC = config.hiddenCategories || [];
  return s.products.filter(p => !p.recetaOnly && p.name && !hiddenP.includes(p.id) && !(p.category && hiddenC.includes(p.category)));
}

/**
 * s = estado del núcleo; menuConfig / tienda = secciones online del proyecto; images = { productId: dataURL }.
 * Las imágenes no van adentro: cada una se publica como archivo en img/<id>.jpg y acá solo se referencia.
 */
export function buildMenuJson(s, { menuConfig = {}, tienda = {}, images = {}, supabase = null, store = {}, now = new Date() } = {}) {
  const products = publishableProducts(s, menuConfig);
  const showPrices = menuConfig.showPrices !== false, showImages = menuConfig.showImages !== false;
  const items = products.map(p => ({
    id: p.id, name: p.name, category: p.category || '', star: !!p.star,
    price: showPrices ? mostradorFinalPrice(s, p) : 0,
    image: showImages && images[p.id] ? 'img/' + imageFileName(p.id) : null,
    tags: (p.tags || []).map(t => (typeof t === 'string' ? t : t.label || t.name || '')).filter(Boolean),
    description: txt(p.description, 220),
  })).filter(p => !showPrices || p.price > 0);
  const sb = supabase && supabase.url && supabase.anonKey && supabase.storeId ? { url: supabase.url, anonKey: supabase.anonKey, storeId: supabase.storeId, slug: supabase.slug || '' } : null;
  return {
    version: MENU_VERSION, generatedAt: now.toISOString(),
    store: {
      name: store.name || s.project.name || 'Menú', slug: store.slug || '', whatsapp: menuConfig.whatsappNumber || menuConfig.whatsapp || '',
      address: tienda.address || '', lat: tienda.lat ?? null, lng: tienda.lng ?? null,
      currency: { symbol: s.project.currencySymbol || '$', locale: s.project.locale || 'es-AR' },
    },
    config: {
      enabled: menuConfig.enabled !== false, title: menuConfig.title || 'Nuestro Menú', subtitle: menuConfig.subtitle || '',
      showPrices, showImages, deliveryNote: menuConfig.deliveryNote || '',
      categories: orderedCategories(items, menuConfig),
    },
    products: items,
    site: buildSite(menuConfig.site),
    delivery: {
      lat: tienda.lat ?? null, lng: tienda.lng ?? null, zones: (tienda.zones || []).map(z => ({ id: z.id, name: z.name, type: z.type || 'circle', radiusKm: z.radiusKm || 0, points: z.points || [], baseCost: z.baseCost || 0 })),
      freeShippingMin: tienda.freeShippingMin || 0, deliveryMinOrder: tienda.deliveryMinOrder || 0, costPerKm: tienda.costPerKm || 0,
    },
    payments: { methods: tienda.paymentMethods || { efectivo: true }, bank: tienda.paymentMethods && tienda.paymentMethods.transferencia ? (tienda.bankDetails || {}) : {} },
    supabase: sb,
  };
}

export const imageFileName = id => String(id).replace(/[^a-z0-9_-]+/gi, '_') + '.jpg';
