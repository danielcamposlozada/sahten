// La impresora pertenece a este equipo; no se sincroniza como dato del negocio.
export function receiptProfile(value = 58, { calibration = 100, printer = 'thermal' } = {}) {
  const paperMm = [48, 58, 80, 210, 216].includes(Number(value)) ? Number(value) : 58;
  calibration = Math.max(80, Math.min(110, Number(calibration) || 100));
  return { paperMm, contentMm: Math.round((({ 48: 40, 58: 48, 80: 72, 210: 186, 216: 192 })[paperMm]) * calibration) / 100,
    calibration, printer, pageSize: paperMm === 210 ? 'A4' : paperMm === 216 ? 'letter' : 'auto' };
}
export function currentReceiptProfile(storage = globalThis.localStorage) {
  try { return receiptProfile(receiptPaperWidth(storage), { calibration: storage.getItem('sahten-receipt-calibration') || 100, printer: storage.getItem('sahten-receipt-printer') || 'thermal' }); }
  catch { return receiptProfile(); }
}
export function saveReceiptProfile({ paperMm, calibration = 100, printer = 'thermal' }, storage = globalThis.localStorage) {
  const p = receiptProfile(paperMm, { calibration, printer });
  storage.setItem('sahten-receipt-paper', String(p.paperMm));
  storage.setItem('sahten-receipt-calibration', String(p.calibration));
  storage.setItem('sahten-receipt-printer', ['it01', 'thermal', 'normal'].includes(printer) ? printer : 'thermal');
  return p;
}
export function receiptPaperWidth(storage = globalThis.localStorage) {
  try { return receiptProfile(storage.getItem('sahten-receipt-paper')).paperMm; } catch { return 58; }
}
