import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';
import { demoState, readJSON, diffNumbers } from './helpers.js';
import { dumpMenuEngineering } from './scenarios.js';

const baseline = readJSON('tests/fixtures/baseline-v3.json').menuEngineering;

describe('asistente de estrategia (ingeniería de menú) vs v3', () => {
  it('diagnóstico y escenarios por meta idénticos al v3 original', () => {
    const s = demoState();
    const actual = dumpMenuEngineering({
      diagnose: () => C.diagnose(s),
      defaultAnswers: D => C.defaultAnswers(D),
      buildScenarios: (S, D) => C.buildScenarios(s, S, D),
    });
    expect(diffNumbers(actual, baseline).slice(0, 15)).toEqual([]);
  });
});

describe('ingeniería de menú', () => {
  // Una categoría con 4 platos: popular = vende ≥ 70%/4 = 17,5% de la categoría; rentable = margen ≥ promedio ponderado.
  // mismo costo para todos; el tier decide el margen (HI deja mucho, LO deja poco)
  const mk = () => C.createState({
    tiers: [{ id: 'HI', factor: 2 }, { id: 'LO', factor: 1.1 }, { id: 'T3', factor: 1.6 }],
    channels: [{ id: 'mostrador', name: 'Mostrador', surcharge: 0, commission: 0, enabled: true }],
    gastosOp: [{ id: 'g', name: 'Alquiler', amount: 1000 }],
    products: [
      { id: 'estrella', name: 'Estrella', category: 'Platos', tier: 'HI', receta_cost: 1000, porciones: 1, avgMes: 100 },
      { id: 'caballo', name: 'Caballo', category: 'Platos', tier: 'LO', receta_cost: 1000, porciones: 1, avgMes: 100 },
      { id: 'enigma', name: 'Enigma', category: 'Platos', tier: 'HI', receta_cost: 1000, porciones: 1, avgMes: 5 },
      { id: 'perro', name: 'Perro', category: 'Platos', tier: 'LO', receta_cost: 1000, porciones: 1, avgMes: 5 },
    ],
  });

  it('clasifica en estrella / caballo / enigma / perro', () => {
    const D = C.diagnose(mk());
    expect(D.q).toEqual({ estrella: 'star', caballo: 'horse', enigma: 'puzzle', perro: 'dog' });
  });

  it('el escenario de precio topea las estrellas en +5%, sube lo justo a los demás y respeta los bloqueados', () => {
    const s = mk(); const D = C.diagnose(s);
    const S = { ...C.defaultAnswers(D), goal: 'plato', platoPct: 30, maxInc: 20, locked: ['perro'] };
    const sc = C.buildScenarios(s, S, D).find(x => x.key === 'precio');
    const pa = sc.ch.priceAdj;
    expect(pa.estrella).toBeCloseTo(1.05, 9);        // necesitaría más, pero las estrellas suben como mucho 5%
    expect(pa.caballo).toBeGreaterThan(1);
    expect(pa.caballo).toBeLessThan(1.05);           // con poco margen alcanza una suba chica para +30% por plato
    expect(pa.perro).toBeUndefined();
  });

  it('la elasticidad reduce las unidades de los platos que suben', () => {
    const s = mk(); const D = C.diagnose(s);
    const sim = C.simulate(s, D.rows, { priceAdj: { caballo: 1.1 } }, C.ELAST.media);
    const r = sim.rows.find(x => x.id === 'caballo');
    expect(r.units).toBeCloseTo(100 * (1 - 0.8 * 0.1), 9);
    expect(C.simulate(s, D.rows, { priceAdj: { caballo: 1.1 } }, 0).rows.find(x => x.id === 'caballo').units).toBe(100);
  });

  it('aceptar/rechazar: acceptedChanges descarta lo destildado', () => {
    const sc = { ch: { priceAdj: { a: 1.1, b: 1.2 }, ingCut: { x: 0.1 } } };
    expect(C.acceptedChanges({ acc: { 'p:b': false } }, sc)).toEqual({ priceAdj: { a: 1.1 }, ingCut: { x: 0.1 }, chSurcharge: {}, unitAdj: {} });
  });

  it('aplicar cambia ajuste de precio, costo de ingredientes, recargo de canal y unidades', () => {
    const s = demoState();
    const p = s.products[0]; const before = C.mostradorPrice(s, p);
    const ing = s.ingredients.find(i => i.id === 'muzza'); const px = ing.precioPkg;
    C.applyStrategyChanges(s, { priceAdj: { [p.id]: 1.1 }, ingCut: { muzza: 0.1 }, chSurcharge: { rappi: 0.6 }, unitAdj: { [p.id]: 1.15 } });
    expect(p.priceAdj).toBe(1.1);
    expect(ing.precioPkg).toBe(Math.round(px * 0.9 * 100) / 100);
    expect(s.channels.find(c => c.id === 'rappi').surcharge).toBe(0.6);
    expect(s.projection.manualMode).toBe(true);
    expect(s.projection.manualUnits[p.id]).toBe(Math.round(p.avgMes * 1.15));
    expect(C.mostradorPrice(s, p)).not.toBe(before);
  });

  it('con el escenario aceptado, el resultado simulado coincide con el que se obtiene tras aplicar (sin elasticidad)', () => {
    const s = demoState(); const D = C.diagnose(s);
    const S = { ...C.defaultAnswers(D), elast: 'baja' };
    const sc = C.buildScenarios(s, S, D).find(x => x.key === 'precio');
    const simulado = C.simulate(s, D.rows, sc.ch, 0).cmTot;
    expect(simulado).toBeGreaterThan(D.sim.cmTot);
  });
});
