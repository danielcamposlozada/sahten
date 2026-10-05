import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';
import { demoState } from './helpers.js';

const small = () => C.createState({
  tiers: [{ id: 'T1', factor: 2 }, { id: 'T2', factor: 1.7 }, { id: 'T3', factor: 1.6 }],
  channels: [
    { id: 'mostrador', name: 'Mostrador', surcharge: 0, commission: 0, enabled: true },
    { id: 'rappi', name: 'Rappi', surcharge: 0.45, commission: 0.3, enabled: true },
  ],
  gastosOp: [{ id: 'g', name: 'Alquiler', amount: 1000 }],
  products: [
    { id: 'a', name: 'A', tier: 'T3', receta_cost: 1000, porciones: 1, avgMes: 10 },
    { id: 'b', name: 'B', tier: 'T3', receta_cost: 500, porciones: 1, avgMes: 30 },
  ],
});

describe('distribución por canal', () => {
  it('se inicializa en partes iguales y suma 100', () => {
    const s = small();
    C.initProjDist(s);
    expect(s.projection.channelDist).toEqual({ mostrador: 50, rappi: 50 });
  });
  it('setProjDist reparte el resto entre los canales libres', () => {
    const s = demoState();
    C.initProjDist(s);
    C.setProjDist(s, 'mostrador', 60);
    const d = s.projection.channelDist;
    expect(d.mostrador).toBe(60);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('un canal bloqueado conserva su porcentaje', () => {
    const s = demoState();
    C.initProjDist(s);
    const before = s.projection.channelDist.fudo;
    s.projection.channelLocked.fudo = true;
    C.setProjDist(s, 'mostrador', 50);
    expect(s.projection.channelDist.fudo).toBe(before);
    expect(Object.values(s.projection.channelDist).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('normalizeProjDist fuerza suma 100', () => {
    const s = small();
    s.projection.channelDist = { mostrador: 30, rappi: 30 };
    expect(C.normalizeProjDist(s)).toBe(true);
    expect(s.projection.channelDist).toEqual({ mostrador: 50, rappi: 50 });
  });
});

describe('computeProjection (única fuente para pantalla, snapshot, CSV y PDF)', () => {
  it('resultado operativo = Σ margen − GF; margen = ingreso neto − costo variable', () => {
    const s = small();
    s.projection.channelDist = { mostrador: 100, rappi: 0 };
    const P = C.computeProjection(s);
    // GF por unidad = 1000/40 = 25. A: (1000+25)*1.6=1640→1650 ; B: (500+25)*1.6=840→850
    expect(P.rows[0]).toMatchObject({ units: 10, ing: 16500, cost: 10000, marg: 6500 });
    expect(P.rows[1]).toMatchObject({ units: 30, ing: 25500, cost: 15000, marg: 10500 });
    expect(P).toMatchObject({ tI: 42000, tC: 25000, tM: 17000, gf: 1000, resultado: 16000, totalUnits: 40 });
    expect(P.gananciaDiaria).toBeCloseTo(16000 / 30, 9);
    expect(P.gananciaWeekly).toBeCloseTo(16000 / 4.33, 9);
    expect(P.ticketProm).toBe(1050);
  });
  it('usa el neto de cada canal (precio − comisión de la plataforma)', () => {
    const s = small();
    s.projection.channelDist = { mostrador: 0, rappi: 100 };
    const P = C.computeProjection(s);
    const net = C.channelNetReceivedWithDisc(s, s.products[0], 'rappi');
    expect(P.rows[0].byChannel.rappi.net).toBe(net);
    expect(P.rows[0].ing).toBe(Math.round(10 * net));
    expect(P.channelBreakdown.find(c => c.id === 'rappi')).toMatchObject({ pct: 100, units: 40 });
  });
  it('sin distribución cargada, normaliza solo (snapshot y CSV no dependen de abrir la pantalla)', () => {
    const s = small();
    expect(s.projection.channelDist).toEqual({});
    const P = C.computeProjection(s);
    expect(P.tI).toBeGreaterThan(0);
    expect(s.projection.channelDist).toEqual({ mostrador: 50, rappi: 50 });
  });
  it('modo manual usa las unidades manuales (y avgMes para los no cargados)', () => {
    const s = small();
    s.projection.manualMode = true;
    s.projection.manualUnits = { a: 100 };
    expect(C.getProjUnits(s, s.products[0])).toBe(100);
    expect(C.getProjUnits(s, s.products[1])).toBe(30);
    expect(C.computeProjection(s).totalUnits).toBe(130);
    expect(C.computeProjection(s).mode).toBe('manual');
  });
  it('el GF aportado por producto = unidades × GF asignado', () => {
    const s = small();
    const P = C.computeProjection(s);
    expect(P.rows[0].gfContrib).toBe(250);
    expect(P.gfContribTotal).toBe(1000);
  });
  it('no redondea las unidades por canal (se redondea solo al mostrar)', () => {
    const s = small();
    s.projection.channelDist = { mostrador: 33, rappi: 67 };
    const P = C.computeProjection(s);
    expect(P.rows[0].byChannel.mostrador.units).toBeCloseTo(3.3, 9);
  });
  it('con el proyecto demo: totales consistentes con la suma de filas', () => {
    const s = demoState();
    const P = C.computeProjection(s);
    expect(P.tI).toBe(P.rows.reduce((a, r) => a + r.ing, 0));
    expect(P.tM).toBe(P.tI - P.tC);
    expect(P.resultado).toBe(P.tM - P.gf);
    expect(Object.values(P.dist).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
