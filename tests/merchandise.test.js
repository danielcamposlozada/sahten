import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';
import { legacyToFile, fileToLegacy, migrate, serialize } from '../src/project/schema.js';
import { toPublicProject, applyPublicToFile } from '../src/online/roles.js';
import { buildMenuJson } from '../src/online/menuJson.js';

const mk = () => C.createState({
  project: { currencySymbol: '$', locale: 'es-AR', roundTo: 1 },
  tiers: [{ id: 'T3', factor: 2 }], channels: [{ id: 'mostrador', enabled: true, commission: 0, surcharge: 0 }],
  ingredients: [{ id: 'harina', name: 'Harina', unit: 'g', cantidad: 1000, grPaquete: 1000, precioPkg: 2000 }],
  merchandise: [{ id: 'lata', name: 'Gaseosa de prueba', cantidad: 12, precioPkg: 12000, presentacion: 'Docena', proveedor: 'Proveedor privado' }],
  packs: [{ id: 'bolsa', name: 'Bolsa', cantidad: 100, precioPkg: 10000 }],
});

describe('mercadería: un costo y un stock por artículo', () => {
  it('calcula docena y unidad con el motor de presentaciones de ingredientes', () => {
    const s = mk(), item = s.merchandise[0];
    expect(C.merchandiseUnitCost(item)).toBe(1000);
    expect(C.calcMerchandiseCost(s, { merchId: 'lata', qty: 2 })).toBe(2000);
    expect(C.calcMerchandiseCost(s, { merchId: 'lata', qty: 0 })).toBe(0);
    expect(C.calcMerchandiseCost(s, { merchId: 'borrado', qty: 1 })).toBe(0);
    expect(item).not.toHaveProperty('grPaquete'); // no muta el catálogo al consultar costos
  });

  it('incluye mercadería en recetas por porción y combos anidados, sin depender del envase', () => {
    const s = mk();
    const sale = C.createResaleProduct(s, 'lata', 'venta_lata');
    sale.packaging.push({ envId: 'bolsa', qty: 1, unit: 'u' });
    const recipe = { id: 'receta', ingredients: [{ ingId: 'harina', qty: 1000, unit: 'g' }], merchandise: [{ merchId: 'lata', qty: 2 }], porciones: 2 };
    const combo = { id: 'combo', combos: [{ prodId: sale.id, qty: 3, unit: 'u', addPackaging: false }, { prodId: recipe.id, qty: 1, unit: 'u' }] };
    s.products.push(recipe, combo);
    expect(C.costPerUnit(s, sale)).toBe(1100);
    expect(C.costPerUnit(s, recipe)).toBe(2000);
    expect(C.totalCost(s, combo)).toBe(5000);
    expect(C.recalcRecetaCost(s, recipe).totMerchandise).toBe(2000);
    expect(C.orderConsumption(s, { items: [{ productId: combo.id, qty: 2 }] })).toEqual({ lata: 8, harina: 1000 });
  });

  it('crear la venta no duplica artículos y comienza pausada, sin receta inventada', () => {
    const s = mk(), p = C.createResaleProduct(s, 'lata', 'venta');
    expect(C.createResaleProduct(s, 'lata', 'otro')).toBe(p);
    expect(s.products).toHaveLength(1);
    expect(p).toMatchObject({ productType: 'resale', ingredients: [], recetaOnly: false, salesAvailability: { paused: true } });
    p.porcionesOverride = 12; p.porciones = 12;
    expect(C.costPerUnit(s, p)).toBe(1000); // la docena comprada no se vuelve a dividir al vender
  });

  it('descuenta la misma lata al venderla sola o en combo, y restaura una sola vez', () => {
    const s = mk(), p = C.createResaleProduct(s, 'lata', 'venta');
    s.products.push({ id: 'combo', combos: [{ prodId: p.id, qty: 2, unit: 'u' }] });
    C.initStock(s); s.stock.lata.actual = 12;
    expect(s.stock.venta).toBeUndefined();
    const o = { id: 'orden', num: 1, items: [{ productId: p.id, qty: 2 }, { productId: 'combo', qty: 3 }] };
    C.deductOrderStock(s, o);
    expect(s.stock.lata.actual).toBe(4);
    expect(s.movements[0]).toMatchObject({ categoria: 'mercaderia', unit: 'u', qty: -8 });
    expect(C.deductOrderStock(s, o).ok).toBe(false);
    C.restoreOrderStock(s, o); expect(s.stock.lata.actual).toBe(12);
    expect(C.restoreOrderStock(s, o).ok).toBe(false);
  });

  it('cambiar el costo actualiza precios/proyección sin modificar la venta histórica', () => {
    const s = mk(), p = C.createResaleProduct(s, 'lata', 'venta');
    p.avgMes = 10;
    const beforePrice = C.channelPrice(s, p, 'mostrador');
    const o = { id: 'orden', createdAt: '2026-10-28T10:00:00Z', pricingChannelId: 'mostrador', items: [{ productId: p.id, qty: 2, unitPrice: 2000, lineTotal: 4000 }] };
    expect(C.captureSaleCosts(s, o)).toBe(true);
    s.merchandise[0].precioPkg = 18000;
    expect(C.costPerUnit(s, p)).toBe(1500);
    expect(C.channelPrice(s, p, 'mostrador')).toBeGreaterThan(beforePrice);
    expect(C.computeProjection(s).rows.find(row => row.id === p.id).unitCost).toBe(1500);
    expect(C.summarizeSaleCosts([o], s.saleCosts)).toMatchObject({ revenue: 4000, variable: 2000 });
  });

  it('mover un ingrediente en unidades conserva costo, referencias, stock e histórico', () => {
    const s = mk();
    s.ingredients.push({ id: 'vieja', name: 'Lata anterior', unit: 'u', cantidad: 12, grPaquete: 12, precioPkg: 12000 });
    const p = { id: 'receta', ingredients: [{ ingId: 'vieja', qty: 2, unit: 'u' }], receta_cost: 2000 };
    s.products.push(p); s.stock.vieja = { actual: 7, minimo: 2, unit: 'g' };
    const before = C.totalCost(s, p);
    C.moveIngredientToMerchandise(s, 'vieja');
    expect(s.ingredients.some(i => i.id === 'vieja')).toBe(false);
    expect(p.ingredients).toEqual([]);
    expect(p.merchandise).toEqual([{ merchId: 'vieja', qty: 2 }]);
    expect(C.totalCost(s, p)).toBe(before);
    expect(s.stock.vieja).toEqual({ actual: 7, minimo: 2, unit: 'u' });
    expect(C.orderConsumption(s, { items: [{ productId: p.id, qty: 1 }] })).toEqual({ vieja: 2 });
    expect(() => C.moveIngredientToMerchandise(s, 'harina')).toThrow(/unidades/);
  });

  it('guardado, migración antigua y proyecto público conservan la separación y no revelan costos', () => {
    const s = mk(), p = C.createResaleProduct(s, 'lata', 'venta');
    const file = legacyToFile({ MERCADERIA: s.merchandise, PRODUCTS: s.products, CHANNELS: s.channels });
    const back = fileToLegacy(migrate(serialize(file)).file);
    expect(back.MERCADERIA).toEqual(s.merchandise);
    const restoredState = C.stateFromSahten(file);
    expect(C.costPerUnit(restoredState, restoredState.products[0])).toBe(1000);
    expect(back.PRODUCTS[0].merchandise).toEqual(p.merchandise);
    const old = JSON.parse(serialize(file)); delete old.catalog.mercaderia;
    expect(fileToLegacy(old).MERCADERIA).toEqual([]);
    const pub = toPublicProject(file, () => ({ mostrador: 2000 }));
    expect(JSON.stringify(pub)).not.toMatch(/Proveedor privado|precioPkg|merchId/);
    expect(applyPublicToFile(file, pub).catalog.mercaderia).toEqual([]);
    const menu = buildMenuJson(s);
    expect(JSON.stringify(menu)).not.toMatch(/Proveedor privado|precioPkg|merchId/);
  });
});
