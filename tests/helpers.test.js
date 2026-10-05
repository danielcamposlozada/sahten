import { describe, it, expect } from 'vitest';
import { diffNumbers } from './helpers.js';

describe('diffNumbers (guarda del baseline)', () => {
  it('detecta una diferencia de un solo peso y de estructura', () => {
    expect(diffNumbers({ a: { b: 18300 } }, { a: { b: 18300 } })).toEqual([]);
    expect(diffNumbers({ a: { b: 18301 } }, { a: { b: 18300 } })).toHaveLength(1);
    expect(diffNumbers({ a: {} }, { a: { b: 1 } })).toHaveLength(1);
    expect(diffNumbers({ a: 1 + 1e-12 }, { a: 1 })).toEqual([]); // tolerancia de coma flotante
  });
});
