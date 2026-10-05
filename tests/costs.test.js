import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';

const mk = (over = {}) => C.createState({
  ingredients: [
    { id: 'harina', name: 'Harina', precioPkg: 1500, grPaquete: 1000, unit: 'g', cantidad: 1000 },
    { id: 'huevo', name: 'Huevos', precioPkg: 8000, grPaquete: 30, unit: 'u', cantidad: 30 },
  ],
  packs: [{ id: 'bolsa', name: 'Bolsa', precioPkg: 6400, cantidad: 100 }],
  ...over,
});

describe('costo de ingredientes', () => {
  it('convierte g, kg, ml, L y u a costo', () => {
    const s = mk();
    expect(C.calcIngCost(s, { ingId: 'harina', qty: 200, unit: 'g' })).toBeCloseTo(300, 9);
    expect(C.calcIngCost(s, { ingId: 'harina', qty: 0.2, unit: 'kg' })).toBeCloseTo(300, 9);
    expect(C.calcIngCost(s, { ingId: 'harina', qty: 0.2, unit: 'L' })).toBeCloseTo(300, 9);
    expect(C.calcIngCost(s, { ingId: 'harina', qty: 200, unit: 'ml' })).toBeCloseTo(300, 9);
    expect(C.calcIngCost(s, { ingId: 'huevo', qty: 5, unit: 'u' })).toBeCloseTo(1333.3333, 3); // 5 huevos de un maple de 30 a $8000
  });
  it('sin ingId (o ingrediente borrado) usa el valor manual v', () => {
    const s = mk();
    expect(C.calcIngCost(s, { v: 250 })).toBe(250);
    expect(C.calcIngCost(s, { ingId: 'no-existe', v: 99 })).toBe(99);
    expect(C.calcIngCost(s, {})).toBe(0);
  });
});

describe('costo de envases', () => {
  it('precio por unidad × cantidad; protege contra división por 0', () => {
    const s = mk();
    expect(C.calcEnvCost(s, { envId: 'bolsa', qty: 3, unit: 'u' })).toBeCloseTo(192, 9);
    expect(C.calcEnvCost(s, { envId: 'bolsa' })).toBeCloseTo(64, 9); // qty por defecto 1
    s.packs[0].cantidad = 0; // paquete mal cargado
    expect(Number.isFinite(C.calcEnvCost(s, { envId: 'bolsa', qty: 2 }))).toBe(true);
    expect(C.calcEnvCost(s, { v: 12 })).toBe(12);
  });
  it('calcPackCost delega en calcEnvCost (una sola regla, respeta la unidad)', () => {
    const s = mk();
    expect(C.calcPackCost).toBe(C.calcEnvCost);
    expect(C.calcPackCost(s, { envId: 'bolsa', qty: 1, unit: 'kg' })).toBeCloseTo(64000, 6);
  });
});

describe('costo del producto', () => {
  it('suma ingredientes + envases + combos y divide por porciones', () => {
    const s = mk();
    const p = { id: 'torta', ingredients: [{ ingId: 'harina', qty: 1000, unit: 'g' }], packaging: [{ envId: 'bolsa', qty: 1 }], combos: [], porciones: 4 };
    s.products.push(p);
    expect(C.totalCost(s, p)).toBeCloseTo(1500 + 64, 9);
    expect(C.costPerUnit(s, p)).toBeCloseTo(391, 9);
  });
  it('sin ingredientes respeta el costo manual receta_cost', () => {
    const s = mk();
    const p = { id: 'x', receta_cost: 800, packaging: [{ v: 100 }] };
    expect(C.totalCost(s, p)).toBe(900);
  });
  it('recalcRecetaCost no pisa el costo manual si no hay ingredientes', () => {
    const s = mk();
    const manual = { id: 'm', receta_cost: 777, ingredients: [] };
    C.recalcRecetaCost(s, manual);
    expect(manual.receta_cost).toBe(777);
    const conIng = { id: 'c', receta_cost: 1, ingredients: [{ ingId: 'harina', qty: 100, unit: 'g' }] };
    C.recalcRecetaCost(s, conIng);
    expect(conIng.receta_cost).toBeCloseTo(150, 9);
  });
  it('tolera arrays faltantes', () => {
    const s = mk();
    expect(C.totalCost(s, { id: 'vacio' })).toBe(0);
    expect(C.costPerUnit(s, { id: 'vacio' })).toBe(0);
  });
});

describe('combos', () => {
  const base = () => {
    const s = mk();
    s.products.push({ id: 'salsa', receta_cost: 400, porciones: 4, packaging: [{ v: 80 }] }); // solo costo manual
    return s;
  };
  it('usa receta_cost cuando el sub-producto no tiene ingredientes', () => {
    const s = base();
    // 1 porción de 4 → proporción 0.25 de (400 + 80)
    expect(C.calcComboCost(s, { prodId: 'salsa', qty: 1, unit: 'u' })).toBeCloseTo(120, 9);
  });
  it('addPackaging:false no suma el envase del sub-producto', () => {
    const s = base();
    expect(C.calcComboCost(s, { prodId: 'salsa', qty: 1, unit: 'u', addPackaging: false })).toBeCloseTo(100, 9);
  });
  it('por peso: 250 g de un lote de 1 kg = 25%', () => {
    const s = base();
    s.products[0].pesoTotal = 1; s.products[0].pesoUnit = 'kg';
    expect(C.calcComboCost(s, { prodId: 'salsa', qty: 250, unit: 'g' })).toBeCloseTo(120, 9);
  });
  it('referencias circulares no se cuelgan ni dan NaN', () => {
    const s = mk();
    s.products.push({ id: 'a', receta_cost: 100, porciones: 1, combos: [{ prodId: 'b', qty: 1, unit: 'u' }] });
    s.products.push({ id: 'b', receta_cost: 100, porciones: 1, combos: [{ prodId: 'a', qty: 1, unit: 'u' }] });
    const c = C.totalCost(s, s.products[0]);
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeGreaterThanOrEqual(100);
  });
  it('combo con producto inexistente o sin cantidad cuesta 0', () => {
    const s = base();
    expect(C.calcComboCost(s, { prodId: 'nada', qty: 1 })).toBe(0);
    expect(C.calcComboCost(s, { prodId: 'salsa', qty: 0 })).toBe(0);
    expect(C.calcComboCost(s, {})).toBe(0);
  });
});

describe('porciones', () => {
  it('prioridad: override › automático con merma › campo manual', () => {
    expect(C.getPorc({ porciones: 3 })).toBe(3);
    expect(C.getPorc({ porciones: 3, pesoTotal: 2, pesoUnit: 'kg', porcionCant: 250, porcionUnit: 'g' })).toBe(8);
    expect(C.getPorc({ porciones: 3, pesoTotal: 2, pesoUnit: 'kg', porcionCant: 250, porcionUnit: 'g', merma: 25 })).toBe(6);
    expect(C.getPorc({ porciones: 3, pesoTotal: 2, pesoUnit: 'kg', porcionCant: 250, porcionUnit: 'g', porcionesOverride: 5 })).toBe(5);
  });
  it('unidades incompatibles caen al campo manual; nunca devuelve 0', () => {
    expect(C.calcAutoPorc({ pesoTotal: 1, pesoUnit: 'kg', porcionCant: 1, porcionUnit: 'u' })).toBeNull();
    expect(C.getPorc({ porciones: 0 })).toBe(1);
    expect(C.getPorc({})).toBe(1);
    expect(C.getPorc({ porcionesOverride: 0.001 })).toBe(0.01); // un override positivo muy chico se sostiene en el piso 0.01
  });
});

describe('peso automático', () => {
  it('suma ingredientes y combos con peso', () => {
    const s = mk();
    const p = { ingredients: [{ ingId: 'harina', qty: 1, unit: 'kg' }, { ingId: 'harina', qty: 500, unit: 'g' }], combos: [] };
    expect(C.calcAutoWeight(s, p)).toMatchObject({ grams: 1500, value: 1.5, unit: 'kg' });
    expect(C.calcAutoWeight(s, { ingredients: [] })).toBeNull();
  });
});
