// La impresora pertenece a este equipo; no se sincroniza como dato del negocio.
export function receiptProfile(value = 58) {
  const paperMm = [48, 58, 80].includes(Number(value)) ? Number(value) : 58;
  return { paperMm, contentMm: ({ 48: 40, 58: 48, 80: 72 })[paperMm] };
}
export function receiptPaperWidth(storage = globalThis.localStorage) {
  try { return receiptProfile(storage.getItem('sahten-receipt-paper')).paperMm; } catch { return 58; }
}
