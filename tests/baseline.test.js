// Los precios y la proyección del núcleo refactorizado deben dar IDÉNTICOS a los del v3 original
// (baseline generado con `npm run baseline` desde reference/Sahten v3.html).
import { describe, it, expect } from 'vitest';
import { demoState, coreApi, readJSON, diffNumbers } from './helpers.js';
import { SCENARIOS, applyScenarioCore, dumpNumbers } from './scenarios.js';

const baseline = readJSON('tests/fixtures/baseline-v3.json');

describe('baseline v3 vs núcleo refactorizado', () => {
  Object.entries(SCENARIOS).forEach(([name, sc]) => {
    it(`escenario «${name}»: precios por producto y canal, GF y proyección idénticos`, () => {
      const s = demoState();
      applyScenarioCore(s, sc);
      const actual = dumpNumbers(coreApi(s));
      const diffs = diffNumbers(actual, baseline.scenarios[name]);
      expect(diffs.slice(0, 15)).toEqual([]);
    });
  });

  it('el baseline cubre 7 productos y los canales activos', () => {
    const b = baseline.scenarios.base;
    expect(Object.keys(b.products)).toHaveLength(7);
    expect(Object.keys(Object.values(b.products)[0].ch)).toEqual(['mostrador', 'fudo', 'rappi', 'pedidosya', 'mercadopago']);
  });
});
