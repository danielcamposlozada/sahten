import { scheduleMatches, localDateParts, expiryLabel } from './promotions.js';
import { ticketCampaignDetails } from './live-promotion-catalog.js';

// El anuncio se refiere a UNA campaña publicada: no genera beneficios,
// códigos ni derechos adicionales para el cliente que recibe el ticket.
function upcomingDate(c, now, maxDays) {
  for (let d = 1; d <= maxDays; d++) {
    const check = new Date(new Date(now).getTime() + d * 86400000);
    if (scheduleMatches(c.schedule, check)) return localDateParts(check).iso;
  }
  return null;
}
const clean = (s, max = 150) => String(s || '').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function selectTicketAdvertisement(config, {
  now = new Date(), channel = 'mostrador', coupon = null,
  excludedPromotionIds = [], appliedPromotionIds = null, rotationKey = null,
  recentAdvertisements = [], avoidCampaignIds = []
} = {}) {
  if (config?.enabled !== true || config.ticket?.enabled !== true) return null;
  // Nunca anunciamos la misma oferta varias veces dentro del período
  // de enfriamiento del cliente. El cobro original no cuenta como anuncio.
  const previous=Array.isArray(recentAdvertisements)?recentAdvertisements:[];
  const alreadyShownCoupon=!!coupon?.id&&previous.some(x=>x?.kind==='coupon'&&x.couponId===coupon.id);
  const alreadyShownCampaigns=new Set(previous.filter(x=>x?.kind==='campaign').map(x=>x.campaignId).filter(Boolean));
  const avoid=new Set(Array.isArray(avoidCampaignIds)?avoidCampaignIds:[]);
  // Un cupón es personal y sólo puede imprimirse si ya fue emitido por
  // el backend: nunca fabricamos códigos durante la impresión.
  if (!alreadyShownCoupon && coupon?.code && coupon?.expiresOn && coupon?.status === 'available') {
    return { kind: 'coupon', couponId: clean(coupon.id, 90), code: clean(coupon.code, 64),
      expiresOn: coupon.expiresOn, headline: clean(coupon.headline || 'Tu próxima compra online'),
      label: expiryLabel(coupon.expiresOn) };
  }
  if (config.ticket?.advertise === false) return null;
  // La compra ya realizada nunca excluye una campaña de su propia publicidad.
  // Seguimos aceptando excludedPromotionIds como alias legado del historial aplicado.
  const applied = new Set(Array.isArray(appliedPromotionIds) ? appliedPromotionIds :
    Array.isArray(excludedPromotionIds) ? excludedPromotionIds : []);
  const listed = Array.isArray(config.campaigns) ? config.campaigns.filter(c =>
    c?.kind === 'public' && c.enabled === true &&
    c.advertising?.enabled === true && c.advertising?.placement?.includes('ticket') &&
    (!c.channels || channel === 'any' || c.channels.includes(channel))) : [];

  // Ticket de cliente = 2 espacios independientes:
  // (1) desglose del descuento YA COBRADO en el comprobante;
  // (2) anuncio de la misma campaña u otra para una compra POSTERIOR.
  // Haberla aprovechado no la descalifica, incluso en campañas permanentes.
  const eligible = listed.map(c => {
    const active = scheduleMatches(c.schedule, now);
    const days = c.advertising.advanceDays == null ? 4 :
      Math.max(0, Math.min(14, Number(c.advertising.advanceDays) || 0));
    const next = active ? null : upcomingDate(c, now, days);
    if ((!active && !next) || alreadyShownCampaigns.has(c.id) || avoid.has(c.id)) return null;
    const wasApplied = applied.has(c.id);
    return { c, next, repeatEdition: wasApplied && !!next, repeatPurchase: wasApplied };
  }).filter(Boolean).sort((a, b) =>
    Number(!a.next) - Number(!b.next) ||
    (a.next || '').localeCompare(b.next || '') ||
    (Number(b.c.priority) || 0) - (Number(a.c.priority) || 0) ||
    String(a.c.id).localeCompare(String(b.c.id)));

  if (!eligible.length) return null;
  // Sin clave: conservamos una preferencia útil por la próxima campaña.
  // Con número de pedido: rotamos por todas, incluidas las programadas.
  const position = rotationKey === null ? 0 :
    Math.abs(Math.trunc(Number(rotationKey) || 0)) % eligible.length;
  const choice = eligible[position];
  const details=ticketCampaignDetails(choice.c);
  // Los cuatro formatos aprobados son A (general), B (rebaja),
  // C (cupón REAL emitido) y D (especial). C nunca se asigna a campañas.
  const preference=choice.c.advertising?.ticketFormat || choice.c.advertising?.layout;
  const layout=['A','B','D'].includes(preference) ? preference :
    choice.c.schedule?.type==='central_weekends' ? 'D' :
    choice.c.schedule?.type==='weekly' ? 'A' : 'B';
  return { kind: 'campaign', audience: 'general', layout,
    campaignId: clean(choice.c.id, 90),
    headline: clean((choice.c.advertising?.message || choice.c.name)
      .replace(/^En tu próxima compra online:\s*/i,''),115),
    ...(details.terms.length?{terms:clean(details.terms.join(' · '),130)}:{}),
    ...(details.expiry?{expiry:details.expiry}:{}),
    ...(choice.next ? { startsOn: choice.next } : {}),
    ...(choice.repeatEdition ? { repeatEdition: true } : {}),
    ...(choice.repeatPurchase ? { repeatPurchase: true } : {}),
    selectedAt: new Date(now).toISOString() };
}
