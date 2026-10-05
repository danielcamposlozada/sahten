// ═══════════════════════════════════════════════════════════
// Respaldos del proyecto (sobre un BackupStore)
//   .<nombre>.backup-AAAA-MM-DD.sahten   diario, al abrir por primera vez en el día (se conserva solo el último)
//   .<nombre>.pre-estrategia.sahten      antes de aplicar una estrategia o importar
//   .<nombre>.pre-restauracion.sahten    antes de restaurar un respaldo (por si te arrepentís)
// ═══════════════════════════════════════════════════════════
const safe = name => String(name || 'Proyecto').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Proyecto';
const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const dailyName = (name, d) => `.${safe(name)}.backup-${dayKey(d)}.sahten`;
export const preStrategyName = name => `.${safe(name)}.pre-estrategia.sahten`;
export const preRestoreName = name => `.${safe(name)}.pre-restauracion.sahten`;

const DAILY_RE = /^\..*\.backup-(\d{4}-\d{2}-\d{2})\.sahten$/;
const PRE_RE = /^\..*\.pre-estrategia\.sahten$/;
const RESTORE_RE = /^\..*\.pre-restauracion\.sahten$/;

export const BACKUP_DAYS = 14;

/** Respaldo diario: si hoy ya hay uno no hace nada; si no, guarda `text` y conserva el historial de los últimos
 *  BACKUP_DAYS días (borra los más viejos). La carpeta de respaldos es por proyecto (id), así que renombrar no los pierde. */
export async function dailyBackup(store, key, name, text, now = new Date()) {
  const today = dayKey(now);
  const existing = (await store.list(key)).filter(n => DAILY_RE.test(n));
  if (existing.some(n => DAILY_RE.exec(n)[1] === today)) return { written: false, date: today };
  await store.put(key, dailyName(name, now), text);
  const limit = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (BACKUP_DAYS - 1)));
  for (const n of existing) if (DAILY_RE.exec(n)[1] < limit) await store.remove(key, n);
  return { written: true, date: today };
}

/** Todos los diarios, del más nuevo al más viejo. */
export async function listDailies(store, key) {
  return (await store.list(key)).filter(n => DAILY_RE.test(n)).map(n => ({ name: n, date: DAILY_RE.exec(n)[1] })).sort((a, b) => a.date < b.date ? 1 : -1);
}

/** Respaldo previo a una estrategia o importación. Reemplaza al anterior. */
export async function preStrategyBackup(store, key, name, text, now = new Date()) {
  for (const n of (await store.list(key)).filter(n => PRE_RE.test(n))) await store.remove(key, n);
  await store.put(key, preStrategyName(name), text);
  return { name: preStrategyName(name), at: now.toISOString() };
}
export async function preRestoreBackup(store, key, name, text) {
  for (const n of (await store.list(key)).filter(n => RESTORE_RE.test(n))) await store.remove(key, n);
  await store.put(key, preRestoreName(name), text);
}

/** Qué respaldos hay: { daily: {name,date}|null, preStrategy: nombre|null, preRestore: nombre|null }. */
export async function listBackups(store, key, name, now = new Date()) {
  const names = await store.list(key);
  const d = names.filter(n => DAILY_RE.test(n)).map(n => ({ name: n, date: DAILY_RE.exec(n)[1] })).sort((a, b) => a.date < b.date ? 1 : -1)[0] || null;
  return { daily: d, preStrategy: names.find(n => PRE_RE.test(n)) || null, preRestore: names.find(n => RESTORE_RE.test(n)) || null, today: dayKey(now) };
}
