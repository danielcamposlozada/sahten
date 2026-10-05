import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';

const mk = (over = {}) => C.createState({
  gastosOp: [{ id: 'a1', name: 'Alquiler', amount: 1000 }],
  gastosS: [{ id: 's1', name: 'Sueldo', amount: 500 }],
  products: [
    { id: 'p1', avgMes: 100 }, { id: 'p2', avgMes: 50 }, { id: 'p3', avgMes: 50, recetaOnly: true }, { id: 'p4', avgMes: 100, absorbeGF: false },
  ],
  ...over,
});

describe('GF: total y reparto', () => {
  it('el total es la suma de gastos y sueldos, sin descuentos', () => {
    const s = mk();
    expect(C.totalGFRaw(s)).toBe(1500);
    expect(C.totalGF(s)).toBe(1500);
    s.gfDiscHistory.push({ pct: 20, nota: 'viejo' }); // legado: ya no afecta
    expect(C.totalGF(s)).toBe(1500);
  });
  it('se reparte solo entre los productos que absorben GF (por defecto todos menos recetaOnly)', () => {
    const s = mk();
    expect(C.absorbsGF(s.products[0])).toBe(true);
    expect(C.absorbsGF(s.products[2])).toBe(false);
    expect(C.absorbsGF(s.products[3])).toBe(false);          // absorbeGF:false explícito
    expect(C.absorbsGF({ recetaOnly: true, absorbeGF: true })).toBe(true); // el interruptor manda
    expect(C.gfUnitsBase(s)).toBe(150);
    expect(C.gfPerUnit(s)).toBe(10);
    expect(C.gfAssigned(s, s.products[2])).toBe(0);
    expect(C.gfAssigned(s, s.products[0])).toBe(10);
  });
  it('gfPctOverride escala el GF de un producto (100 = promedio)', () => {
    const s = mk();
    s.products[0].gfPctOverride = 150;
    expect(C.gfAssigned(s, s.products[0])).toBe(15);
    s.products[0].gfPctOverride = 70;
    expect(C.gfAssigned(s, s.products[0])).toBeCloseTo(7, 9);
  });
  it('sin ventas por producto usa estUnitsMonth del proyecto', () => {
    const s = mk();
    s.products.forEach(p => { p.avgMes = 0; });
    expect(C.gfPerUnit(s)).toBe(0);
    s.project.estUnitsMonth = 300;
    expect(C.gfPerUnit(s)).toBe(5);
  });
  it('cobertura: lo que se recupera / GF total', () => {
    const s = mk();
    expect(C.gfCoverageAmount(s)).toBe(1500);
    expect(C.gfCoveragePct(s)).toBe(100);
    s.products[0].gfPctOverride = 50;
    expect(C.gfCoveragePct(s)).toBeCloseTo(66.666, 2);
    expect(C.gfCoveragePct(C.createState())).toBe(0);
  });
});

describe('GF: control mensual', () => {
  const day = (y, m, d) => new Date(y, m - 1, d, 12);
  it('los gastos tienen id estable', () => {
    const s = C.createState({ gastosOp: [{ name: 'Luz', amount: 10 }] });
    C.gfEnsureIds(s);
    const id = s.gastosOp[0].id;
    expect(id).toBeTruthy();
    C.gfEnsureIds(s);
    expect(s.gastosOp[0].id).toBe(id);
  });
  it('mes nuevo: presupuesto = GF actual; real precargado con el real del mes anterior', () => {
    const s = mk();
    C.gfmEnsureMonths(s, day(2026, 8, 10));
    const ago = s.gfMonths['2026-08'];
    expect(ago.items.map(i => i.budget)).toEqual([1000, 500]);
    ago.items[0].real = 1200; // el alquiler real fue 1200
    C.gfmEnsureMonths(s, day(2026, 9, 1));
    const sep = s.gfMonths['2026-09'];
    expect(sep.items.find(i => i.name === 'Alquiler')).toMatchObject({ budget: 1000, real: 1200 });
    expect(sep.items.find(i => i.name === 'Sueldo')).toMatchObject({ budget: 500, real: 500 });
  });
  it('los meses pasados se cierran automáticamente (salvo los reabiertos)', () => {
    const s = mk();
    C.gfmEnsureMonths(s, day(2026, 8, 10));
    C.gfmEnsureMonths(s, day(2026, 9, 2));
    expect(s.gfMonths['2026-08']).toMatchObject({ closed: true, autoClosed: true });
    expect(s.gfMonths['2026-09'].closed).toBe(false);
    C.gfmToggleClose(s, '2026-08');          // se reabre a mano
    expect(s.gfMonths['2026-08']).toMatchObject({ closed: false, reopened: true });
    C.gfmEnsureMonths(s, day(2026, 9, 3));
    expect(s.gfMonths['2026-08'].closed).toBe(false);
  });
  it('recordatorio: mes en curso sin revisar, y los últimos 3 días del mes para el próximo', () => {
    const s = mk();
    C.gfmEnsureMonths(s, day(2026, 8, 10));
    expect(C.gfmReminder(s, day(2026, 8, 10))).toMatchObject({ key: '2026-08' });
    C.gfmMarkReviewed(s, '2026-08');
    expect(C.gfmReminder(s, day(2026, 8, 10))).toBeNull();
    expect(C.gfmReminder(s, day(2026, 8, 28))).toBeNull();             // faltan 3 días: 28 de 31 no alcanza (dim-2 = 29)
    expect(C.gfmReminder(s, day(2026, 8, 29))).toMatchObject({ key: '2026-09' });
    expect(C.gfmReminder(s, day(2026, 8, 31)).text).toMatch(/Septiembre 2026/);
    C.gfmGet(s, '2026-09', true, day(2026, 8, 30)); C.gfmMarkReviewed(s, '2026-09');
    expect(C.gfmReminder(s, day(2026, 8, 31))).toBeNull();
  });
  it('gasto extraordinario: alta, renombre, baja y registro; no se puede en un mes cerrado', () => {
    const s = mk();
    C.gfmEnsureMonths(s, day(2026, 8, 10));
    const m = C.gfmAddExtra(s, '2026-08', day(2026, 8, 11));
    expect(m.items.at(-1)).toMatchObject({ extra: true, budget: 0, real: 0 });
    C.gfmRenameItem(s, '2026-08', 2, ' Reparación horno ');
    C.gfmSetReal(s, '2026-08', 2, '4500');
    expect(C.gfmTotals(s.gfMonths['2026-08'])).toMatchObject({ budget: 1500, real: 1000 + 500 + 4500, complete: true });
    C.gfmDelExtra(s, '2026-08', 0);                                    // no es extraordinario: no hace nada
    expect(s.gfMonths['2026-08'].items).toHaveLength(3);
    C.gfmDelExtra(s, '2026-08', 2, day(2026, 8, 12));
    expect(s.gfMonths['2026-08'].items).toHaveLength(2);
    expect(s.gfMonths['2026-08'].log.map(l => l.action)).toEqual(['extra', 'extra-del']);
    C.gfmToggleClose(s, '2026-08');
    expect(C.gfmAddExtra(s, '2026-08')).toBeNull();
  });
  it('registro de cambios: alta, renombre, monto y baja quedan en el mes en curso', () => {
    const s = mk();
    const now = day(2026, 8, 15);
    C.gfmEnsureMonths(s, now);
    C.gfEditAmount(s, 'op', 0, '1100', now);
    C.gfEditName(s, 'op', 0, 'Alquiler local', now);
    const g = C.gfAddRow(s, 's', now);
    C.gfDeleteRow(s, 's', 0, now);
    const log = s.gfMonths['2026-08'].log;
    expect(log.map(l => l.action)).toEqual(['amount', 'rename', 'add', 'delete']);
    expect(log[0]).toMatchObject({ from: 1000, to: 1100, type: 'op' });
    expect(log[1]).toMatchObject({ from: 'Alquiler', to: 'Alquiler local' });
    expect(g.name).toBe('Nuevo empleado');
    expect(C.gfEditAmount(s, 'op', 0, '1100', now)).toBe(false);       // sin cambio no registra
    expect(s.gfMonths['2026-08'].log).toHaveLength(4);
  });
  it('el presupuesto del mes abierto sigue a la lista de gastos; los cerrados conservan lo suyo', () => {
    const s = mk();
    C.gfmEnsureMonths(s, day(2026, 8, 10));
    C.gfmEnsureMonths(s, day(2026, 9, 1));
    C.gfEditAmount(s, 'op', 0, '2000', day(2026, 9, 5));
    expect(s.gfMonths['2026-09'].items[0].budget).toBe(2000);
    expect(s.gfMonths['2026-08'].items[0].budget).toBe(1000);
  });
  it('promedio real de hasta 3 meses cerrados completos reemplaza los montos', () => {
    const s = mk();
    ['2026-05', '2026-06', '2026-07'].forEach((k, i) => {
      const m = C.gfmGet(s, k, true, day(2026, 8, 1));
      m.items[0].real = 1000 + i * 100; m.items[1].real = 500;
      expect(m.closed).toBe(true);
    });
    const keys = C.gfmAverageKeys(s);
    expect(keys).toEqual(['2026-05', '2026-06', '2026-07']);
    C.gfmApplyAverage(s, keys);
    expect(s.gastosOp[0].amount).toBe(1100);
    expect(C.totalGF(s)).toBe(1600);
    expect(C.gfmLastVar(s)).toBeCloseTo((1700 - 1500) / 1500 * 100, 6);
  });
  it('navegación de meses y etiqueta', () => {
    expect(C.gfmShift('2026-12', 1)).toBe('2027-01');
    expect(C.gfmShift('2026-01', -1)).toBe('2025-12');
    expect(C.gfmLabel('2026-03')).toBe('Marzo 2026');
  });
});
