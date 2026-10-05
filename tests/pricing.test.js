import { describe, it, expect } from 'vitest';
import * as C from '../src/core/index.js';

const mk = (over = {}) => {
  const s = C.createState({
    tiers: [{ id: 'T1', factor: 2 }, { id: 'T2', factor: 1.7 }, { id: 'T3', factor: 1.6 }],
    channels: [
      { id: 'mostrador', name: 'Mostrador', surcharge: 0, commission: 0, enabled: true },
      { id: 'rappi', name: 'Rappi', surcharge: 0.45, commission: 0.3, enabled: true },
      { id: 'off', name: 'Apagado', surcharge: 0, commission: 0, enabled: false },
    ],
    gastosOp: [{ id: 'g', name: 'Alquiler', amount: 1000 }],
    products: [{ id: 'p', name: 'Plato', tier: 'T3', receta_cost: 1000, porciones: 1, avgMes: 10 }],
    ...over,
  });
  return s;
};

describe('precio de mostrador', () => {
  it('(costo + GF) × tier, redondeado a $50 por defecto', () => {
    const s = mk(); // GF por unidad = 1000 / 10 = 100
    expect(C.mostradorPrice(s, s.products[0])).toBe(1750); // (1000+100)*1.6 = 1760 → 1750
  });
  it('ajuste de precio por producto (asistente de estrategia)', () => {
    const s = mk(); s.products[0].priceAdj = 1.1;
    expect(C.mostradorPrice(s, s.products[0])).toBe(1950); // 1760*1.1 = 1936 → 1950
  });
  it('descuento porcentual y fijo', () => {
    const s = mk();
    s.products[0].discount = 0.1;
    expect(C.mostradorPrice(s, s.products[0])).toBe(1600); // 1760*.9 = 1584 → 1600
    s.products[0].discount = 200; s.products[0].discountType = 'fixed';
    expect(C.mostradorPrice(s, s.products[0])).toBe(1550); // 1760-200 = 1560 → 1550
    s.products[0].discount = 99999;
    expect(C.mostradorPrice(s, s.products[0])).toBe(0);    // nunca negativo
  });
  it('el redondeo sigue la moneda del proyecto', () => {
    const s = mk(); s.project.roundTo = 0.5;
    expect(C.mostradorPrice(s, s.products[0])).toBe(1760);
    s.project.roundTo = 100;
    expect(C.mostradorPrice(s, s.products[0])).toBe(1800);
  });
  it('el tier cambia el factor', () => {
    const s = mk(); s.products[0].tier = 'T1';
    expect(C.mostradorPrice(s, s.products[0])).toBe(2200);
  });
});

describe('canales y comisión global', () => {
  it('la comisión global se aplica UNA sola vez en el delivery', () => {
    const s = mk(); s.globalCommission = 10;
    const p = s.products[0];
    // mostrador 1750 × (1+0.45) × (1+0.10) = 2791.25 → 2800   (aplicada dos veces daría 3070)
    expect(C.channelPrice(s, p, 'rappi')).toBe(2800);
    expect(C.mostradorFinalPrice(s, p)).toBe(1950);            // 1750 × 1.10 = 1925 → 1950 (el .5 sube)
    expect(C.channelPrice(s, p, 'mostrador')).toBe(1950);
  });
  it('lo que recibís = precio cobrado × (1 − comisión de la plataforma)', () => {
    const s = mk(); s.globalCommission = 10;
    expect(C.channelNetReceived(s, s.products[0], 'rappi')).toBe(1960);
  });
  it('un canal apagado no tiene precio', () => {
    const s = mk();
    expect(C.channelPrice(s, s.products[0], 'off')).toBeNull();
    expect(C.channelNetReceived(s, s.products[0], 'off')).toBeNull();
    expect(C.channelPriceWithDisc(s, s.products[0], 'off')).toBeNull();
  });
  it('descuento de canal: el del producto pisa al del canal (no se acumulan)', () => {
    const s = mk(); const p = s.products[0];
    s.channels[1].channelDisc = 10;
    expect(C.effectiveChannelDisc(s, p, 'rappi')).toBe(0.1);
    p.channelDiscounts = { rappi: 20 };
    expect(C.effectiveChannelDisc(s, p, 'rappi')).toBe(0.2);
    const base = C.channelPrice(s, p, 'rappi');
    expect(C.channelPriceWithDisc(s, p, 'rappi')).toBe(Math.round(base * 0.8 / 50) * 50);
  });
  it('comisión global y USD vienen del estado, no del DOM', () => {
    const s = mk();
    expect(C.globalComm(s)).toBe(0);
    s.globalCommission = '7.5';
    expect(C.globalComm(s)).toBeCloseTo(0.075, 12);
    expect(C.getUSD(s)).toBe(1200);
    s.usdRate = 1500;
    expect(C.getUSD(s)).toBe(1500);
    s.usdRate = 'abc';
    expect(C.getUSD(s)).toBe(1200);
  });
});

describe('robustez con proyectos vacíos', () => {
  it('getTier / getChannel no rompen sin tiers ni canales', () => {
    const s = C.createState();
    expect(C.getTier(s, 'T9')).toMatchObject({ factor: 1 });
    expect(C.getChannel(s, 'x')).toMatchObject({ id: 'mostrador', surcharge: 0 });
    expect(C.mostradorPrice(s, { id: 'a', receta_cost: 100 })).toBe(100);
  });
  it('getTier cae al tier estándar (3.º) si no encuentra el id', () => {
    const s = mk();
    expect(C.getTier(s, 'nada').id).toBe('T3');
  });
});

describe('formato de moneda', () => {
  it('símbolo, locale y decimales según el proyecto', () => {
    const s = C.createState();
    expect(C.fmt(s, 12345.6)).toBe('$12.346');
    s.project = { currencySymbol: 'US$', roundTo: 0.5, locale: 'en-US' };
    expect(C.fmt(s, 12345.6)).toBe('US$12,345.60');
    expect(C.RND(s, 10.3)).toBe(10.5);
  });
});

describe('ganancia extra por tier', () => {
  it('(factor − 1) × (costo + GF) × unidades', () => {
    const s = mk();
    expect(C.tierProfitPerUnit(s, s.products[0])).toBeCloseTo(0.6 * 1100, 9);
    expect(C.tierProfitTotal(s)).toBeCloseTo(0.6 * 1100 * 10, 9);
  });
});
