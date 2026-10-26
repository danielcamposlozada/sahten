// Puro, compartido con app, tienda y validación del servidor. Sin imports ni datos privados.
export function salesPaused(product, now = Date.now()) {
  const a = product?.salesAvailability;
  if (!a?.paused) return false;
  if (!a.resumeAt) return true;
  const end = Date.parse(a.resumeAt);
  return !Number.isFinite(end) || end > Number(now);
}
export function salesPauseLabel(product, now = Date.now(), timeZone) {
  if (!salesPaused(product, now)) return 'Disponible';
  const end = Date.parse(product.salesAvailability.resumeAt);
  return Number.isFinite(end) ? 'No disponible hasta ' + new Intl.DateTimeFormat('es-AR', { timeZone, day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(end) : 'No disponible · sin vencimiento';
}
// Interpreta una fecha del negocio, sin depender del huso del equipo. Rechaza saltos DST inexistentes.
export function businessDateTime(value, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return null;
  const fmt = new Intl.DateTimeFormat('sv-SE', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const target = Date.parse(value+'Z'); let guess = target;
  for (let n=0;n<4;n++) { const shown=fmt.format(guess).replace(' ','T'); const diff=target-Date.parse(shown+'Z'); if (!diff) return shown===value ? new Date(guess).toISOString() : null; guess+=diff; }
  return null;
}
export function endOfBusinessDay(timeZone, now = Date.now()) {
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const next = new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  return businessDateTime(next+'T00:00', timeZone);
}
