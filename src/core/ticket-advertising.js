import { scheduleMatches, localDateParts, expiryLabel } from './promotions.js';

// El anuncio se refiere a UNA campaña publicada: no genera beneficios,
// códigos ni derechos adicionales para el cliente que recibe el ticket.
function upcomingDate(c, now, maxDays, { nextEdition = false } = {}) {
  // Si el cliente ya usó una campaña recurrente, evitamos volver a
  // destacar la misma edición. Sólo anunciamos la edición DESPUÉS
  // de una interrupción real en el calendario (ej. lunes siguiente).
  let separated = !nextEdition || !scheduleMatches(c.schedule, now);
  for (let d = 1; d <= maxDays; d++) {
    const check = new Date(new Date(now).getTime() + d * 86400000);
    if (!scheduleMatches(c.schedule, check)) {
      if (nextEdition) separated = true;
      continue;
    }
    if (separated) return localDateParts(check).iso;
  }
  return null;
}
const clean = (s, max = 150) => String(s || '').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const generalRecurring = c => c?.kind === 'public' &&
  ['weekly', 'central_weekends'].includes(c?.schedule?.type);

export function selectTicketAdvertisement(config, {
  now = new Date(), channel = 'mostrador', coupon = null,
  excludedPromotionIds = [], rotationKey = null
} = {}) {
  if (config?.enabled !== true || config.ticket?.enabled !== true) return null;
  // Un cupón es personal y sólo puede imprimirse si ya fue emitido por
  // el backend: nunca fabricamos códigos durante la impresión.
  if (coupon?.code && coupon?.expiresOn && coupon?.status === 'available') {
    return { kind: 'coupon', couponId: clean(coupon.id, 90), code: clean(coupon.code, 64),
      expiresOn: coupon.expiresOn, headline: clean(coupon.headline || 'Tu próxima compra online'),
      label: expiryLabel(coupon.expiresOn) };
  }
  if (config.ticket?.advertise === false) return null;
  const applied = new Set(Array.isArray(excludedPromotionIds) ? excludedPromotionIds : []);
  const listed = Array.isArray(config.campaigns) ? config.campaigns.filter(c =>
    c?.kind === 'public' && c.enabled === true &&
    c.advertising?.enabled === true && c.advertising?.placement?.includes('ticket') &&
    (!c.channels || c.channels.includes(channel))) : [];

  // Diferenciar un descuento ya consumido de una campaña pública:
  // - Perpetua/única aplicada en esta compra: no se vuelve a anunciar.
  // - Semanal o fines de semana centrales aplicada: sólo puede anunciarse
  //   como PRÓXIMA EDICIÓN, con fecha futura, nunca como nuevo premio.
  // - Las campañas de calendario próximas compiten en la misma rotación
  //   que las vigentes; no quedan invisibles detrás de promociones permanentes.
  const eligible = listed.map(c => {
    const wasApplied = applied.has(c.id);
    if (wasApplied && !generalRecurring(c)) return null;
    const active = scheduleMatches(c.schedule, now);
    const next = wasApplied
      ? upcomingDate(c, now, 14, { nextEdition: true })
      : active ? null : upcomingDate(c, now,
        Math.max(0, Math.min(14, Number(c.advertising.advanceDays) || 4)));
    if (wasApplied && !next || !active && !next) return null;
    return { c, next, repeatEdition: wasApplied };
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
  // Los cuatro formatos aprobados son A (general), B (rebaja),
  // C (cupón REAL emitido) y D (especial). C nunca se asigna a campañas.
  const preference=choice.c.advertising?.ticketFormat || choice.c.advertising?.layout;
  const layout=['A','B','D'].includes(preference) ? preference :
    choice.c.schedule?.type==='central_weekends' ? 'D' :
    choice.c.schedule?.type==='weekly' ? 'A' : 'B';
  return { kind: 'campaign', audience: 'general', layout,
    campaignId: clean(choice.c.id, 90),
    headline: clean(choice.c.advertising?.message || choice.c.name),
    ...(choice.next ? { startsOn: choice.next } : {}),
    ...(choice.repeatEdition ? { repeatEdition: true } : {}),
    selectedAt: new Date(now).toISOString() };
}
