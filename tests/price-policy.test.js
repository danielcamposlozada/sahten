import { describe, expect, it } from 'vitest';
import * as C from '../src/core/index.js';
import { emptyFile, legacyToFile, fileToLegacy, serialize, migrate } from '../src/project/schema.js';
import { toPublicProject, applyPublicToFile } from '../src/online/roles.js';
import { buildMenuJson } from '../src/online/menuJson.js';
const fixture = () => C.createState({ project: { roundTo: 1 }, tiers: [{ id: 'T', factor: 2 }], products: [{ id: 'p', name: 'Ejemplo', tier: 'T', receta_cost: 3000, porciones: 1, avgMes: 10 }], gastosOp: [{ amount: 10000 }], channels: [{ id: 'mostrador', enabled: true, commission: .04, surcharge: .1 }, { id: 'web', enabled: true, commission: .1, surcharge: .2 }] });
const start = new Date('2026-10-23T10:00:00Z');
const order = extra => ({ id: 'o', createdAt: '2026-10-23T11:00:00Z', items: [{ productId: 'p', name: 'Ejemplo', qty: 2, unitPrice: 10000, lineTotal: 20000 }], discountAmount: 1000, total: 19000, ...extra });

describe('bloqueos por producto y canal', () => {
  it('conserva el precio exacto frente a costos, tier, redondeo, recargos y descuentos', () => {
    const s = fixture(), p = s.products[0];
    C.savePricePolicy(p, 'mostrador', { price: 10001.25, variableCost: 3200, fixedCost: 1500 }, { now: start, actor: 'owner', reason: 'Carta' });
    s.globalCommission = 20; s.project.roundTo = 500; p.discount = .5; p.priceAdj = 2; p.channelDiscounts = { mostrador: 20 }; p.receta_cost = 9000; s.gastosOp[0].amount = 50000;
    expect(C.mostradorFinalPrice(s, p)).toBe(10001.25);
    expect(C.channelPriceWithDisc(s, p, 'mostrador')).toBe(10001.25);
    expect(C.tierProfitPerUnit(s, p)).toBe(0); // no atribuye al tier una ganancia de un precio manual
    expect(C.costPerUnit(s, p)).toBe(3200); expect(C.gfAssigned(s, p)).toBe(1500);
    expect(C.actualCostPerUnit(s, p)).toBe(9000); expect(C.actualGfAssigned(s, p)).toBe(5000);
    expect(C.costPerUnit(s, p, 'web')).toBe(9000);
    expect(C.channelPrice(s, p, 'web')).not.toBe(10001.25);
  });
  it('permite bloquear solo costos o comisión, y volver a automático sin borrar el historial', () => {
    const s = fixture(), p = s.products[0];
    C.savePricePolicy(p, 'web', { price: 10000, variableCost: 3200, commissionRate: .15 }, { now: start });
    s.channels[1].commission = .4;
    expect(C.channelNetReceivedWithDisc(s, p, 'web')).toBe(8500);
    C.savePricePolicy(p, 'web', { price: null, variableCost: null, fixedCost: null, commissionRate: null }, { now: new Date('2026-10-23T12:00:00Z') });
    expect(C.isPriceFixed(p, 'web')).toBe(false); expect(C.costPerUnit(s, p, 'web')).toBe(3000);
    expect(p.pricingHistory).toHaveLength(2);
    expect(p.pricingHistory[1].before.price).toBe(10000);
    expect(p.pricingHistory[0].after.variableCost).toBe(3200);
  });
  it('rechaza valores vacíos inválidos, negativos y comisiones fuera de rango; no crea revisiones sin cambios', () => {
    const p = fixture().products[0];
    for (const value of [-1, NaN, Infinity, '100', 0]) expect(() => C.savePricePolicy(p, 'mostrador', { price: value })).toThrow();
    expect(() => C.savePricePolicy(p, 'mostrador', { commissionRate: 1.1 })).toThrow();
    C.savePricePolicy(p, 'mostrador', { fixedCost: 0 });
    expect(C.savePricePolicy(p, 'mostrador', { fixedCost: 0 })).toBe(false);
    expect(p.pricingHistory).toHaveLength(1);
  });
  it('la proyección pondera los costos de cada canal y resta el GF mensual una sola vez', () => {
    const s = fixture(), p = s.products[0];
    C.savePricePolicy(p, 'mostrador', { price: 10000, variableCost: 3000, fixedCost: 500 });
    C.savePricePolicy(p, 'web', { price: 12000, variableCost: 4000, fixedCost: 1500 });
    s.projection.channelDist = { mostrador: 50, web: 50 };
    const projection = C.computeProjection(s);
    expect(projection.tC).toBe(35000); expect(projection.gfContribTotal).toBe(10000);
    expect(projection.resultado).toBe(projection.tI - 35000 - 10000);
    const rows = C.baseRows(s); expect(rows[0].cost).toBe(3500);
    const sim = C.simulate(s, rows, { priceAdj: { p: 2 }, ingCut: {}, chSurcharge: { web: 2 } }, 0);
    expect(sim.rows[0].price).toBe(10000); expect(sim.rows[0].net).toBe(rows[0].net);
  });
});

describe('historial privado de ventas', () => {
  it('reparte descuentos en centavos sin saldos negativos ni perder importe y rechaza cantidades inválidas',()=>{
    const s=fixture();
    const o=order({items:Array.from({length:100},()=>({productId:'p',name:'Ejemplo',qty:1,unitPrice:.01,lineTotal:.01})),discountAmount:.5});
    expect(C.captureSaleCosts(s,o)).toBe(true);
    expect(s.saleCosts.o.items.every(i=>i.revenue>=0)).toBe(true);
    expect(C.summarizeSaleCosts([o],s.saleCosts).revenue).toBe(.5);
    expect(C.captureSaleCosts(s,order({id:'invalida',items:[{productId:'p',qty:-1,unitPrice:100,lineTotal:-100}]}))).toBe(false);
  });
  it('conserva los costos, comisión y descuento aplicados aunque cambien las reglas o se elimine el producto', () => {
    const s = fixture(), p = s.products[0], o = order();
    C.savePricePolicy(p, 'mostrador', { price: 10000, variableCost: 3200, fixedCost: 1500 });
    expect(C.captureSaleCosts(s, o)).toBe(true);
    p.receta_cost = 20000; p.pricingPolicies = {}; s.channels[0].commission = .9; s.products = [];
    expect(C.captureSaleCosts(s, o)).toBe(false);
    expect(C.summarizeSaleCosts([o], s.saleCosts)).toMatchObject({ covered: 1, revenue: 19000, variable: 6400, fixed: 3000, commission: 760, contribution: 11840, afterAssigned: 8840 });
    expect(C.summarizeSaleCosts([{ ...o, status: 'cancelado' }], s.saleCosts).covered).toBe(0);
  });
  it('recupera la versión publicada para una caja o web que envía el pedido después de un cambio', () => {
    const s = fixture(), p = s.products[0];
    C.savePricePolicy(p, 'mostrador', { price: 10000, variableCost: 3200, fixedCost: 1500 }, { now: start });
    C.preparePricingQuotes(s, start);
    expect(C.preparePricingQuotes(s, start)).toBe(false);
    const revision = C.pricingQuoteIds(s, p).mostrador;
    const o = order(); o.items[0].priceRevision = revision;
    C.savePricePolicy(p, 'mostrador', { price: 15000, variableCost: 8000, fixedCost: 3000 });
    expect(C.captureSaleCosts(s, o, { basis: 'from-quote' })).toBe(true);
    expect(s.saleCosts.o.basis).toBe('published-quote');
    expect(s.saleCosts.o.items[0].unitVariable).toBe(3200);
    expect(C.summarizeSaleCosts([o], s.saleCosts).covered).toBe(1);
  });
  it('no atribuye costos actuales a ventas antiguas ni acepta referencias inventadas o de otro precio', () => {
    const s = fixture(), o = order();
    expect(C.captureSaleCosts(s, o, { basis: 'from-quote' })).toBe(false);
    C.preparePricingQuotes(s, start); o.items[0].priceRevision = C.pricingQuoteIds(s, s.products[0]).mostrador;
    expect(C.captureSaleCosts(s, o, { basis: 'from-quote' })).toBe(false);
    expect(C.summarizeSaleCosts([o], s.saleCosts)).toMatchObject({ covered: 0, missing: 1 });
  });
  it('guarda historial y versiones privadas en el proyecto, y solo identificadores/etiquetas en la caja', () => {
    const s = fixture(), p = s.products[0]; C.savePricePolicy(p, 'mostrador', { price: 10000, fixedCost: 1234 }, { now: start }); C.preparePricingQuotes(s, start);
    const f = emptyFile(); f.catalog.productos = [p]; f.channels = s.channels; f.costs.pricingQuotes = s.pricingQuotes;
    const roundtrip = migrate(JSON.parse(serialize(f))).file;
    expect(roundtrip.catalog.productos[0].pricingHistory).toHaveLength(1);
    expect(Object.keys(roundtrip.costs.pricingQuotes)).toHaveLength(2);
    const pub = toPublicProject(f, p => ({ mostrador: C.channelPrice(s, p, 'mostrador') }), p => C.pricingQuoteIds(s, p));
    expect(pub.products[0].priceFixedChannels).toEqual(['mostrador']);
    for (const secret of ['unitVariable', 'fixedCost', 'pricingHistory', 'fingerprint']) expect(JSON.stringify(pub)).not.toContain(secret);
    const staff = applyPublicToFile(f, pub); expect(staff.costs.pricingQuotes).toEqual({}); expect(staff.costs.saleCosts).toEqual({});
    const menu = buildMenuJson(s, { quoteIds: { p: C.pricingQuoteIds(s, p).mostrador } });
    expect(menu.products[0].price).toBe(10000);
    expect(JSON.stringify(menu)).not.toMatch(/pricingPolicies|Precio fijado|priceFixedChannels|unitVariable|fixedCost/);
    const L = fileToLegacy(f); expect(legacyToFile(L).costs.pricingQuotes).toEqual(f.costs.pricingQuotes);
  });
});
