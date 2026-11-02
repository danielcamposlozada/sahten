// ═══════════════════════════════════════════════════════════
// menu.json: lo que ve el menú publicado. Puro (sin DOM). Nunca incluye costos, márgenes ni datos de clientes.
// ═══════════════════════════════════════════════════════════
import { deliveryHoursText } from '../core/delivery.js';
import { channelPriceWithDisc } from '../core/pricing.js';
import { buildSite } from './site.js';
import { paymentBenefitPolicy } from '../core/payment-benefit.js';

export const MENU_VERSION = 1;

const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);

/** Categorías con el orden elegido; las nuevas van al final (alfabético). */
export function orderedCategories(products, config = {}) {
  const all = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const order = (config.categoryOrder || []).filter(c => all.includes(c));
  return [...order, ...all.filter(c => !order.includes(c))].filter(c => !(config.hiddenCategories || []).includes(c));
}

/** Productos que se publican: no solo-receta, con nombre, no ocultos (ni ellos ni su categoría) y con precio. */
export function publishableProducts(s, config = {}) {
  const hiddenP = config.hiddenProducts || [], hiddenC = config.hiddenCategories || [];
  const upgradeOnly=new Set(config.upsellOnlyProducts||[]);
  return s.products.filter(p=>!p.recetaOnly&&p.name&&(!hiddenP.includes(p.id)||upgradeOnly.has(p.id))&&(!(p.category&&hiddenC.includes(p.category))||upgradeOnly.has(p.id)));
}

/**
 * s = estado del núcleo; menuConfig / tienda = secciones online del proyecto; images = { productId: dataURL }.
 * Las imágenes no van adentro: cada una se publica como archivo en img/<id>.jpg y acá solo se referencia.
 */
export function buildMenuJson(s, { menuConfig = {}, tienda = {}, images = {}, supabase = null, store = {}, quoteIds = {}, promotions = null, now = new Date() } = {}) {
  const hiddenFour='p1779570052552';
  const activeUpgrade=promotions?.productUpgrades?.some(p=>p.id==='fatay-cuarta'&&p.enabled===true&&p.triggerProductId==='p1779467294622'&&p.replacementProductId===hiddenFour);
  const products=publishableProducts(s,activeUpgrade?{...menuConfig,upsellOnlyProducts:[hiddenFour]}:menuConfig);
  const showPrices = menuConfig.showPrices !== false, showImages = menuConfig.showImages !== false;
  const items = products.map(p => ({
    id: p.id, name: p.name, category: p.category || '', star: !!p.star,
    ...(activeUpgrade&&p.id===hiddenFour?{upsellOnly:true,upgradeFrom:'p1779467294622'}:{}),
    ...(p.salesAvailability ? { salesAvailability: { paused: !!p.salesAvailability.paused, resumeAt: p.salesAvailability.resumeAt || null } } : {}),
    price: showPrices ? channelPriceWithDisc(s, p, 'mostrador') : 0,
    ...(quoteIds[p.id] ? { priceRevision: quoteIds[p.id] } : {}),
    image: showImages && images[p.id] ? 'img/' + imageFileName(p.id) : null,
    tags: (p.tags || []).map(t => (typeof t === 'string' ? t : t.label || t.name || '')).filter(Boolean),
    description: txt(p.description, 220),
  })).filter(p => !showPrices || p.price > 0);
  const cats = orderedCategories(items.filter(p=>!p.upsellOnly),menuConfig);
  const categoryImages = {};   // { categoría: 'img/cat_x.jpg' } — la foto de cada categoría, si la cargaron
  if (showImages) for (const c of cats) { const k = categoryPhotoKey(c); if (k && images[k]) categoryImages[c] = 'img/' + k + '.jpg'; }
  const sb = supabase && supabase.url && supabase.anonKey && supabase.storeId ? { url: supabase.url, anonKey: supabase.anonKey, storeId: supabase.storeId, slug: supabase.slug || '' } : null;
  const site=buildSite(menuConfig.site, { hero: !!images.site_hero, historia: !!images.site_historia, familia: !!images.site_familia });
  const deliveryCalendar=tienda.deliveryHours??tienda.deliveryV2?.hours;
  if(site&&deliveryCalendar)site.delivery={...site.delivery,hours:deliveryHoursText(deliveryCalendar)};
  return {
    version: MENU_VERSION, generatedAt: now.toISOString(),
    store: {
      name: store.name || s.project.name || 'Menú', slug: store.slug || '', whatsapp: menuConfig.whatsappNumber || menuConfig.whatsapp || '',
      address: tienda.address || '', lat: tienda.lat ?? null, lng: tienda.lng ?? null,
      ...(tienda.openingHours ? {openingHours: JSON.parse(JSON.stringify(tienda.openingHours))} : {}),
      currency: { symbol: s.project.currencySymbol || '$', locale: s.project.locale || 'es-AR' },
    },
    config: {
      enabled: menuConfig.enabled !== false, title: menuConfig.title || 'Nuestro Menú', subtitle: menuConfig.subtitle || '',
      showPrices, showImages, deliveryNote: menuConfig.deliveryNote || '',
      categories: cats, categoryImages,
      productVisibility: Object.fromEntries(s.products.filter(p => !p.recetaOnly && p.name).map(p => [p.id, items.some(item => item.id === p.id && !item.upsellOnly)])),
    },
    products: items,
    // Las recomendaciones no son promociones de precio. Solo IDs publicados,
    // nombres y contexto; nunca costos, clientes ni validaciones financieras.
    cartRecommendations: promotions?.cartRecommendationPolicy?.enabled === true
      ? {
        enabled:true,
        // Recomendaciones contextuales a precio normal: tener un importe de
        // compra cargado NO equivale a marcar la factura como auditada.
        // No condicionar sugerencias de precio completo a costVerified.
        // Ningún descuento se habilita aquí: sigue requiriendo auditoría Edge.
        beverageContexts:(promotions.beverageUpsellPolicy?.enabled===true?promotions.beverageUpsellPolicy.contexts||[]:[]).map(g=>({
          id:txt(g.id,80),name:txt(g.name,90),priority:Number(g.priority)||0,
          triggerProductIds:(g.triggerProductIds||[]).filter(id=>items.some(p=>p.id===id)),
          options:(g.options||[]).filter(id=>items.some(p=>
            p.id===id&&p.category==='Bebidas'&&p.price>0&&
            p.salesAvailability?.paused!==true&&p.salesAvailability?.retired!==true)),
          ...(g.minEligibleSubtotal!=null?{minEligibleSubtotal:Number(g.minEligibleSubtotal)}:{}),
          ...(g.maxEligibleSubtotal!=null?{maxEligibleSubtotal:Number(g.maxEligibleSubtotal)}:{})
        })).filter(g=>g.triggerProductIds.length>0&&g.options.length>0),
        complements:(promotions.cartRecommendationPolicy.complements||[]).filter(g=>g.enabled!==false)
          .map(g=>({
            id:txt(g.id,80),name:txt(g.name,90),priority:Number(g.priority)||0,
            productId:g.productId,
            triggerProductIds:(g.triggerProductIds||[]).filter(id=>items.some(p=>p.id===id)),
            suppressIfPresent:(g.suppressIfPresent||[]).filter(id=>items.some(p=>p.id===id))
          }))
          .filter(g=>items.some(p=>p.id===g.productId&&p.category!=='Bebidas')&&g.triggerProductIds.length>0)
      } : {enabled:false},
    // No se publican costos, identificadores de clientes ni cupones privados.
    promotions: promotions?.enabled === true ? {enabled:true,version:1,
      // El backend nunca debe aplicar upsells solo por ver el ítem en el carrito.
      // Requiere token HMAC, canje de nonce y revisión de costos privados.
      upsellGuardRequired:true,
      checkoutProFeePercent: promotions.checkoutProFeePercent!=null&&promotions.checkoutProFeePercent!==''&&Number.isFinite(Number(promotions.checkoutProFeePercent))?Math.min(30,Math.max(0,Number(promotions.checkoutProFeePercent))):null,
      paymentPercent: Math.min(100,Math.max(0,Number(promotions.paymentPercent)||10)),
      campaigns:(promotions.campaigns||[]).filter(c=>c.enabled).map(c=>({id:c.id,name:c.name,kind:c.kind,enabled:true,extraPercent:c.extraPercent,priority:c.priority,channels:c.channels,productIds:c.productIds,schedule:c.schedule,
        advertising:c.advertising?.enabled?{enabled:true,placement:c.advertising.placement,message:String(c.advertising.message||'').slice(0,180),advanceDays:c.advertising.advanceDays||4}:undefined})),
      ticket:{enabled:promotions.ticket?.enabled===true,advertise:promotions.ticket?.advertise===true},
      upsells:(promotions.upsells||[]).filter(c=>c.enabled).map(c=>({id:c.id,name:c.name,kind:c.kind,enabled:true,extraPercent:c.extraPercent,priority:c.priority,productIds:c.productIds,maxUnits:c.maxUnits,triggerProductIds:c.triggerProductIds,suppressIfPresent:c.suppressIfPresent,
        ...(Array.isArray(c.discountTiers)?{discountTiers:c.discountTiers.filter(t=>
          Number.isFinite(Number(t.minEligibleNetSubtotal))&&Number(t.minEligibleNetSubtotal)>=0&&
          Number.isFinite(Number(t.totalDiscountPercent))&&Number(t.totalDiscountPercent)>0&&
          Number(t.totalDiscountPercent)<=100).map(t=>({
            minEligibleNetSubtotal:Number(t.minEligibleNetSubtotal),
            totalDiscountPercent:Number(t.totalDiscountPercent)
          }))}:{}),
      })),
      // No se expone el umbral de rentabilidad: la validación de costos ocurre en la administración.
    } : {enabled:false},
    site,
    delivery: {
      enabled: tienda.deliveryEnabled !== false,
      ...(tienda.deliveryHours ? {hours: JSON.parse(JSON.stringify(tienda.deliveryHours))} : {}),
      ...(tienda.deliveryV2 ? {deliveryV2: JSON.parse(JSON.stringify(tienda.deliveryV2))} : {}),
      lat: tienda.lat ?? null, lng: tienda.lng ?? null, zones: (tienda.zones || []).map(z => ({ id: z.id, name: z.name, type: z.type || 'circle', radiusKm: z.radiusKm || 0, points: z.points || [], baseCost: z.baseCost || 0 })),
      freeShippingMin: tienda.freeShippingMin || 0, deliveryMinOrder: tienda.deliveryMinOrder || 0, costPerKm: tienda.costPerKm || 0,
    },
    payments: { methods: tienda.paymentMethods || { efectivo: true }, bank: tienda.paymentMethods && tienda.paymentMethods.transferencia ? (tienda.bankDetails || {}) : {}, benefit: paymentBenefitPolicy(tienda.paymentBenefit) },
    supabase: sb,
  };
}

/** Clave de la foto de una categoría (la misma en la app y al publicar): sin tildes ni símbolos. */
export function categoryPhotoKey(name) {
  const s = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s ? 'cat_' + s : '';
}
export const imageFileName = id => String(id).replace(/[^a-z0-9_-]+/gi, '_') + '.jpg';
