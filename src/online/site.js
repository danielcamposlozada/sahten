// ═══════════════════════════════════════════════════════════
// Sitio web del negocio: módulos (secciones) con su orden y su on/off. Puro (sin DOM).
// El editor de la app (Menú Online › Sitio web) escribe esto; menu.json lleva la versión recortada y limpia (buildSite).
// ═══════════════════════════════════════════════════════════

/** Secciones disponibles. `menu` es el listado de productos: siempre está (solo se mueve de lugar). */
export const SITE_MODULES = [
  { id: 'hero', name: 'Portada', icon: '🏠', desc: 'Lo primero que ve el cliente: título, bajada y destacados.' },
  { id: 'favoritos', name: 'Favoritos', icon: '⭐', desc: 'Tus productos con ⭐, con foto y descripción.' },
  { id: 'menu', name: 'Menú y pedido', icon: '🍽', desc: 'La carta con categorías y el carrito. Siempre visible.', fixed: true },
  { id: 'como', name: 'Cómo funciona', icon: '🧭', desc: 'Los pasos para pedir.' },
  { id: 'historia', name: 'Nuestra historia', icon: '📖', desc: 'Quiénes son, con foto y un destacado opcional.' },
  { id: 'banda', name: 'Cinta de texto', icon: '🎞', desc: 'Una franja con tu lema que se desplaza.' },
  { id: 'resenas', name: 'Reseñas', icon: '💬', desc: 'Lo que dicen tus clientes.' },
  { id: 'catering', name: 'Catering y eventos', icon: '🎉', desc: 'Para eventos, con datos de cobertura.' },
  { id: 'delivery', name: 'Delivery y retiro', icon: '🛵', desc: 'Zonas, horarios, mínimo y envío gratis (salen de Tienda Online).' },
  { id: 'faq', name: 'Preguntas frecuentes', icon: '❓', desc: 'Respuestas a lo que más te preguntan.' },
  { id: 'contacto', name: 'Contacto y pie', icon: '📍', desc: 'Dirección, WhatsApp, Instagram y horarios.' },
];
export const SITE_ORDER = SITE_MODULES.map(m => m.id);

export const SITE_LIMITS = { highlights: 4, steps: 4, reviews: 9, info: 4, faq: 12 };

export function siteDefaults() {
  return {
    enabled: false,
    order: SITE_ORDER.slice(),
    hero: { on: true, title: '', subtitle: '', cta: 'Armá tu pedido', highlights: [] },
    favoritos: { on: true, title: 'Nuestros favoritos', text: '' },
    menu: { title: 'Nuestro menú' },
    como: { on: true, title: '¿Cómo funciona?', lead: 'En 3 pasos tenés tu pedido.', steps: [
      { title: 'Elegí', text: 'Armá tu pedido desde el menú o escribinos por WhatsApp.' },
      { title: 'Confirmamos', text: 'Te contactamos para confirmar el pedido y coordinar.' },
      { title: 'Disfrutalo', text: 'Lo preparamos al momento y te lo llevamos o lo retirás en el local.' }] },
    historia: { on: false, eyebrow: 'Nuestra historia', title: '', text: '', badgeWord: '', badgeMeaning: '', badgeQuote: '' },
    banda: { on: false, text: '' },
    resenas: { on: false, title: 'Lo que dicen nuestros clientes', lead: '', items: [] },
    catering: { on: false, eyebrow: 'Catering y eventos', title: '', text: '', cta: 'Consultar por WhatsApp', info: [] },
    delivery: { on: true, title: 'Delivery y retiro', hours: '', extra: '' },
    faq: { on: false, title: 'Preguntas frecuentes', items: [] },
    contacto: { on: true, instagram: '', note: '' },
  };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/** Completa lo que falte con los valores de fábrica y deja el orden válido (todas las secciones, sin repetidas). */
export function normalizeSite(raw) {
  const d = siteDefaults(); const r = isObj(raw) ? raw : {};
  const out = { enabled: !!r.enabled };
  for (const m of SITE_MODULES) out[m.id] = { ...d[m.id], ...(isObj(r[m.id]) ? r[m.id] : {}) };
  for (const [mod, key] of [['hero', 'highlights'], ['como', 'steps'], ['resenas', 'items'], ['catering', 'info'], ['faq', 'items']]) if (!Array.isArray(out[mod][key])) out[mod][key] = d[mod][key].slice();
  const seen = new Set(); const order = (Array.isArray(r.order) ? r.order : []).filter(id => SITE_ORDER.includes(id) && !seen.has(id) && seen.add(id));
  out.order = [...order, ...SITE_ORDER.filter(id => !seen.has(id))];
  return out;
}

const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const list = (v, max, fn) => (Array.isArray(v) ? v : []).map(fn).filter(Boolean).slice(0, max);

/**
 * Versión pública para menu.json: solo las secciones encendidas, con todo el texto recortado (lo escribe el dueño).
 * `images`: { hero, historia } → true si hay foto cargada (el archivo se publica como img/site_<clave>.jpg).
 */
export function buildSite(raw, images = {}) {
  if (!raw || !raw.enabled) return null;
  const s = normalizeSite(raw);
  const on = id => id === 'menu' || !!s[id].on;
  const img = k => (images[k] ? 'img/site_' + k + '.jpg' : null);
  const out = { enabled: true, order: s.order.filter(on), images: { hero: img('hero'), historia: img('historia') }, menuTitle: txt(s.menu.title, 60) || 'Nuestro menú' };
  if (on('hero')) out.hero = { title: txt(s.hero.title, 80), subtitle: txt(s.hero.subtitle, 220), cta: txt(s.hero.cta, 30) || 'Armá tu pedido',
    highlights: list(s.hero.highlights, SITE_LIMITS.highlights, h => { const title = txt(h && h.title, 40); return title ? { icon: txt(h.icon, 4), title, text: txt(h.text, 90) } : null; }) };
  if (on('favoritos')) out.favoritos = { title: txt(s.favoritos.title, 60) || 'Nuestros favoritos', text: txt(s.favoritos.text, 400) };
  if (on('como')) out.como = { title: txt(s.como.title, 60) || '¿Cómo funciona?', lead: txt(s.como.lead, 160),
    steps: list(s.como.steps, SITE_LIMITS.steps, p => { const title = txt(p && p.title, 40); return title ? { title, text: txt(p.text, 160) } : null; }) };
  if (on('historia')) out.historia = { eyebrow: txt(s.historia.eyebrow, 40), title: txt(s.historia.title, 90), text: txt(s.historia.text, 1500),
    badgeWord: txt(s.historia.badgeWord, 30), badgeMeaning: txt(s.historia.badgeMeaning, 60), badgeQuote: txt(s.historia.badgeQuote, 200) };
  if (on('banda')) out.banda = { text: txt(s.banda.text, 120) };
  if (on('resenas')) out.resenas = { title: txt(s.resenas.title, 70) || 'Lo que dicen nuestros clientes', lead: txt(s.resenas.lead, 80),
    items: list(s.resenas.items, SITE_LIMITS.reviews, r => { const text = txt(r && r.text, 300); return text ? { text, author: txt(r.author, 50), source: txt(r.source, 40) } : null; }) };
  if (on('catering')) out.catering = { eyebrow: txt(s.catering.eyebrow, 40), title: txt(s.catering.title, 90) || 'Catering y eventos', text: txt(s.catering.text, 800), cta: txt(s.catering.cta, 40) || 'Consultar por WhatsApp',
    info: list(s.catering.info, SITE_LIMITS.info, i => { const label = txt(i && i.label, 30), value = txt(i && i.value, 120); return label && value ? { label, value } : null; }) };
  if (on('delivery')) out.delivery = { title: txt(s.delivery.title, 60) || 'Delivery y retiro', hours: txt(s.delivery.hours, 300), extra: txt(s.delivery.extra, 200) };
  if (on('faq')) out.faq = { title: txt(s.faq.title, 60) || 'Preguntas frecuentes',
    items: list(s.faq.items, SITE_LIMITS.faq, f => { const q = txt(f && f.q, 140), a = txt(f && f.a, 500); return q && a ? { q, a } : null; }) };
  if (on('contacto')) out.contacto = { instagram: txt(s.contacto.instagram, 40).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, ''), note: txt(s.contacto.note, 200) };
  return out;
}
