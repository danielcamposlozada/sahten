// Texto del indicador de guardado (puro)
export function ago(from, now = new Date()) {
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 5) return 'ahora';
  if (s < 60) return 'hace ' + s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  return h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.floor(h / 24) + ' d';
}
export function indicatorText(i, now = new Date()) {
  if (i.status === 'closed') return '';
  if (i.readOnly) return '👁 Solo lectura';
  if (i.status === 'saving') return '⏳ Guardando…';
  if (i.status === 'error') return '⚠ Error al guardar';
  if (i.status === 'unsaved') return i.canAutosave ? '● Sin guardar' : '● Sin guardar · descargá una copia';
  if (i.status === 'dirty') return i.canAutosave ? '● Cambios sin guardar' : '● Cambios sin descargar';
  return i.savedAt ? '✓ Guardado ' + ago(i.savedAt, now) : '✓ Guardado';
}
