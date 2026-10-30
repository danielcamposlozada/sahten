import { deliveryHours, deliveryHoursText } from './delivery.js';

/** Horarios independientes por servicio. Un horario ausente conserva la compatibilidad. */
export function serviceHoursConfig(menu, kind) {
  return kind === 'opening' ? menu?.store?.openingHours ?? null : menu?.delivery?.hours ?? menu?.delivery?.deliveryV2?.hours ?? null;
}
export function serviceHoursStatus(menu, source, now = Date.now()) {
  const kind = source === 'delivery' ? 'delivery' : 'opening';
  return { ...deliveryHours(serviceHoursConfig(menu, kind), now), kind };
}
export function serviceHoursMessage(status) {
  if (status.open) return '';
  const subject = status.kind === 'delivery' ? 'El delivery' : 'El retiro en local';
  if (!status.valid) return subject + ' no está disponible: el local debe revisar su horario.';
  return subject + ' está fuera de horario.' + (status.nextLabel ? ' Volvemos el ' + status.nextLabel + '.' : ' Consultá el horario del local.');
}
export function serviceHoursText(menu, kind) { return deliveryHoursText(serviceHoursConfig(menu, kind)); }

export function emptyServiceHours() {
  return { enabled: false, timeZone: 'America/Argentina/Buenos_Aires', weekly: Array.from({ length: 7 }, () => []), exceptions: [] };
}
