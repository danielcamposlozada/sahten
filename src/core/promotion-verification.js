// Normaliza evidencia, no concede permisos ni sustituye la cotización del servidor.
export const VERIFICATION_LABELS = Object.freeze({
  approved: 'Aprobada', rejected: 'Rechazada', pending: 'Pendiente',
  not_applicable: 'No aplicable', unverified: 'No comprobada'
});
const statuses = new Set(Object.keys(VERIFICATION_LABELS));
export function verificationCheck(check = {}, { source = 'local' } = {}) {
  const status = statuses.has(check.status) ? check.status
    : check.ok === true ? 'approved' : check.ok === false ? 'rejected' : 'unverified';
  return { ...check, source, status, ok: status === 'approved' || status === 'not_applicable' };
}
export function summarizeVerification(checks = []) {
  const counts = Object.fromEntries([...statuses].map(s => [s, 0]));
  const normalized = checks.map(c => verificationCheck(c, { source: c.source }));
  for (const c of normalized) counts[c.status]++;
  const status = counts.rejected ? 'rejected' : counts.pending ? 'pending'
    : counts.unverified || !normalized.length ? 'unverified' : 'approved';
  return { status, counts, checks: normalized,
    missing: normalized.filter(c => !c.ok), label: VERIFICATION_LABELS[status] };
}

// Los checks de la RPC antigua no distinguían rechazo de ausencia de prueba.
// No promovemos esos falsos a aprobación: identificamos qué queda sin comprobar.
const LEGACY_UNVERIFIED = new Set(['additional', 'checkout', 'publication']);
export function serverVerificationChecks(data = {}, type) {
  return (Array.isArray(data.checks) ? data.checks : []).map(c => verificationCheck({
    ...c,
    ...(c.status ? {} : type === 'couponPrograms' && c.id === 'triggers'
      ? { status: 'not_applicable' }
      : c.ok === false && LEGACY_UNVERIFIED.has(c.id) ? { status: 'unverified' } : {})
  }, { source: 'server' }));
}
