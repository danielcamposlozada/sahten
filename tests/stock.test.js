import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';

const mk = () => C.createState({
  ingredients: [
    { id: 'harina', name: 'Harina', precioPkg: 1500, grPaquete: 1000, unit: 'g', cantidad: 1000 },
    { id: 'carne', name: 'Carne', precioPkg: 20000, grPaquete: 1000, unit: 'g', cantidad: 1000 },
  ],
  packs: [{ id: 'bolsa', name: 'Bolsa', precioPkg: 6400, cantidad: 100 }],
  products: [
    // rinde 4 porciones: cada venta consume ¼ de la receta
    { id: 'pizza', name: 'Pizza', porciones: 4, ingredients: [{ ingId: 'harina', qty: 1, unit: 'kg' }, { ingId: 'carne', qty: 400, unit: 'g' }], packaging: [{ envId: 'bolsa', qty: 1 }] },
    // se arma con ½ pizza + su propia bolsa
    { id: 'combo', name: 'Combo', porciones: 1, ingredients: [], packaging: [{ envId: 'bolsa', qty: 1 }], combos: [{ prodId: 'pizza', qty: 2, unit: 'u' }] },
    { id: 'gaseosa', name: 'Gaseosa', porciones: 1 },   // sin receta: se descuenta como producto
  ],
});
const order = items => ({ id: 'o1', num: 7, items });

describe('consumo por orden', () => {
  it('receta ÷ porciones × cantidad, con envases', () => {
    const s = mk();
    expect(C.orderConsumption(s, order([{ productId: 'pizza', qty: 2 }]))).toEqual({ harina: 500, carne: 200, bolsa: 0.5 });
  });
  it('combos: consume la proporción del sub-producto y respeta addPackaging', () => {
    const s = mk();
    const c = C.orderConsumption(s, order([{ productId: 'combo', qty: 1 }]));
    expect(c.harina).toBeCloseTo(500, 9);   // 2 porciones de 4
    expect(c.bolsa).toBeCloseTo(1 + 0.5, 9); // su bolsa + media bolsa de la pizza
    s.products[1].combos[0].addPackaging = false;
    expect(C.orderConsumption(s, order([{ productId: 'combo', qty: 1 }])).bolsa).toBe(1);
  });
  it('un producto sin receta se descuenta a sí mismo', () => {
    expect(C.orderConsumption(mk(), order([{ productId: 'gaseosa', qty: 3 }]))).toEqual({ gaseosa: 3 });
  });
  it('ignora productos borrados', () => {
    expect(C.orderConsumption(mk(), order([{ productId: 'fantasma', qty: 3 }]))).toEqual({});
  });
});

describe('descuento y reversión de stock', () => {
  const stocked = () => { const s = mk(); C.initStock(s); s.stock.harina.actual = 2000; s.stock.carne.actual = 100; s.stock.bolsa.actual = 10; return s; };

  it('descuenta, registra movimientos y marca la orden', () => {
    const s = stocked(); const o = order([{ productId: 'pizza', qty: 4 }]);
    const r = C.deductOrderStock(s, o, new Date(2026, 7, 1, 10, 30));
    expect(r.ok).toBe(true);
    expect(s.stock.harina.actual).toBe(1000);
    expect(s.stock.bolsa.actual).toBe(9);
    expect(o.stockDeducted.items.harina).toBe(1000);
    expect(s.movements).toHaveLength(3);
    expect(s.movements[0]).toMatchObject({ tipo: 'egreso', ing: 'Harina', qty: -1000, categoria: 'ingrediente' });
    expect(s.movements[0].nota).toBe('Venta #0007');
  });
  it('stock insuficiente: queda en 0, avisa en la nota y solo devuelve lo que realmente se descontó', () => {
    const s = stocked(); const o = order([{ productId: 'pizza', qty: 4 }]);
    C.deductOrderStock(s, o);
    expect(s.stock.carne.actual).toBe(0);                  // necesitaba 400 y había 100
    expect(s.movements.find(m => m.ing === 'Carne').nota).toMatch(/stock insuficiente/);
    expect(o.stockDeducted.items.carne).toBe(100);
    C.restoreOrderStock(s, o);
    expect(s.stock.carne.actual).toBe(100);
  });
  it('revertir deja el stock como estaba y quita la marca', () => {
    const s = stocked(); const o = order([{ productId: 'pizza', qty: 2 }]);
    const antes = JSON.parse(JSON.stringify(s.stock));
    C.deductOrderStock(s, o);
    C.restoreOrderStock(s, o);
    expect(s.stock).toEqual(antes);
    expect(o.stockDeducted).toBeUndefined();
    expect(s.movements.filter(m => m.tipo === 'ingreso')).toHaveLength(3);
  });
  it('no descuenta dos veces la misma orden; sin receta ni envases avisa', () => {
    const s = stocked(); const o = order([{ productId: 'pizza', qty: 1 }]);
    C.deductOrderStock(s, o);
    expect(C.deductOrderStock(s, o)).toEqual({ ok: false, reason: 'ya-descontado' });
    expect(C.deductOrderStock(s, order([{ productId: 'fantasma', qty: 1 }]))).toEqual({ ok: false, reason: 'sin-receta' });
    expect(C.restoreOrderStock(s, order([]))).toEqual({ ok: false });
  });
  it('initStock crea filas con la unidad correcta', () => {
    const s = mk(); C.initStock(s);
    expect(s.stock.harina).toMatchObject({ unit: 'g' });
    expect(s.stock.bolsa).toMatchObject({ unit: 'u', minimo: 50 });
    expect(s.stock.pizza).toMatchObject({ unit: 'u', minimo: 0 });
  });
});
