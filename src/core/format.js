// Formato de moneda configurable por proyecto (símbolo, redondeo y locale)
export function fmt(s, n) {
  const p = s.project || {};
  const r = +p.roundTo || 50;
  const d = r < 1 ? 2 : 0;
  const v = Number(n) || 0;
  return (p.currencySymbol || '$') + (d ? v : Math.round(v)).toLocaleString(p.locale || 'es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Redondeo de precios según la moneda del proyecto (por defecto, a $50). */
export function RND(s, v) {
  const r = +(s.project || {}).roundTo || 50;
  return Math.round(v / r) * r;
}
