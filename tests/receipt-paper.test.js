import { expect, it } from 'vitest';
import { receiptProfile, receiptPaperWidth } from '../src/ui/receipt-paper.js';

it('el papel no se confunde con el ancho imprimible y usa 58 mm como opción segura por defecto', () => {
  expect(receiptProfile(58)).toEqual({ paperMm: 58, contentMm: 48 });
  expect(receiptProfile(48)).toEqual({ paperMm: 48, contentMm: 40 });
  expect(receiptProfile(80)).toEqual({ paperMm: 80, contentMm: 72 });
  expect(receiptPaperWidth({ getItem: () => '48' })).toBe(48);
  expect(receiptPaperWidth({ getItem: () => 'invalido' })).toBe(58);
  expect(receiptPaperWidth({ getItem: () => { throw Error(); } })).toBe(58);
});
