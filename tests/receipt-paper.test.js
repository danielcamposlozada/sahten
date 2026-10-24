import { expect, it } from 'vitest';
import { receiptProfile, receiptPaperWidth, currentReceiptProfile, saveReceiptProfile } from '../src/ui/receipt-paper.js';

it('el papel no se confunde con el ancho imprimible y usa 58 mm como opción segura por defecto', () => {
  expect(receiptProfile(58)).toMatchObject({ paperMm: 58, contentMm: 48 });
  expect(receiptProfile(48)).toMatchObject({ paperMm: 48, contentMm: 40 });
  expect(receiptProfile(80)).toMatchObject({ paperMm: 80, contentMm: 72 });
  expect(receiptPaperWidth({ getItem: () => '48' })).toBe(48);
  expect(receiptPaperWidth({ getItem: () => 'invalido' })).toBe(58);
  expect(receiptPaperWidth({ getItem: () => { throw Error(); } })).toBe(58);
});
it('calibra IT01 al 88 % sin acumular reducciones y admite papel normal',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  saveReceiptProfile({paperMm:48,printer:'it01',calibration:88},storage);
  expect(currentReceiptProfile(storage)).toMatchObject({contentMm:35.2,paperMm:48,calibration:88});
  saveReceiptProfile(currentReceiptProfile(storage),storage);
  expect(currentReceiptProfile(storage).contentMm).toBe(35.2);
  expect(receiptProfile(210)).toMatchObject({pageSize:'A4',contentMm:186});
  expect(receiptProfile(216)).toMatchObject({pageSize:'letter',contentMm:192});
});
