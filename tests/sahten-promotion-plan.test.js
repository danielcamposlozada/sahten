import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {quotePromotions,scheduleMatches} from '../src/core/promotions.js';

const plan=JSON.parse(fs.readFileSync(new URL('../docs/sahten/plan-promociones-2026.json',import.meta.url),'utf8'));
const date=iso=>new Date(iso+'T12:00:00-03:00');
describe('Plan del negocio SAHTEN en documento, nunca embebido en el instalador genérico',()=>{
  it('define SKUs concretos, pero no habilita descuentos ni publicidad',()=>{
    expect(plan.version).toBe(1);
    expect(plan.enabled).toBe(false);
    expect(plan.ticket.enabled).toBe(false);
    expect(plan.requireVerifiedCosts).toBe(true);
    expect(plan.campaigns.map(c=>c.enabled)).toEqual([false,false]);
    expect(plan.campaigns[0].productIds).toEqual(['p1779467294622','p1779997171373','sandwich_falafel','arabe_clasico','shawarma_pollo']);
    expect(plan.campaigns[1].productIds).toEqual(['tabla_celebrar','p1779997050112']);
    expect(plan.campaigns.flatMap(c=>c.productIds)).not.toContain('shawarma_mixto');
    expect(plan.campaigns.flatMap(c=>c.productIds)).not.toContain('fatay');
  });
  it('el calendario de tablas solo contempla viernes y sábados del segundo/tercer fin de semana',()=>{
    for(const d of ['2026-11-13','2026-11-14','2026-11-20','2026-11-21'])
      expect(scheduleMatches(plan.campaigns[1].schedule,date(d))).toBe(true);
    expect(scheduleMatches(plan.campaigns[1].schedule,date('2026-11-15'))).toBe(false);
    expect(plan.campaigns[0].schedule).toEqual({type:'weekly',weekdays:[1,2,3]});
  });
  it('deja definidos, pero no utilizables, los dos cupones de compra',()=>{
    expect(plan.couponPrograms.first_online).toMatchObject({enabled:false,extraPercent:5,minEligibleSubtotal:30000,validDays:14,channel:'online'});
    expect(plan.couponPrograms.second_online).toMatchObject({enabled:false,extraPercent:10,minEligibleSubtotal:40000,maxExtraAmount:4000,validDays:14,requiresConfirmedOrigin:true});
  });
  it('deja Baklava sin activar, máximo 1 unidad y sin combinar con Tabla para Celebrar',()=>{
    expect(plan.upsells[0]).toMatchObject({enabled:false,extraPercent:10,maxUnits:1,productIds:['baklava']});
    expect(plan.upsells[0].suppressIfPresent).toContain('tabla_celebrar');
  });
  it('cuando el motor está apagado, conserva 10% de transferencia; exigir costos bloquea extras',()=>{
    const c=structuredClone(plan),lines=[{productId:'p1779467294622',unitPrice:16850,qty:1}],now=date('2026-11-02');
    const off=quotePromotions({config:c,lines,method:'transferencia',now});
    expect(off.netSubtotal).toBe(15165);expect(off.appliedPromotionIds).toEqual([]);
    c.enabled=true;c.campaigns[0].enabled=true;
    const withoutCosts=quotePromotions({config:c,lines,method:'transferencia',now});
    expect(withoutCosts.netSubtotal).toBe(15165);expect(withoutCosts.appliedPromotionIds).toEqual([]);
    const withCosts=quotePromotions({config:c,lines,method:'transferencia',now,trustedCosts:{p1779467294622:6775.05}});
    expect(withCosts.netSubtotal).toBe(14322.5);expect(withCosts.appliedPromotionIds).toEqual(['weekly-meals']);
  });
});
