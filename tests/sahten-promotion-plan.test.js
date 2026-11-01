import {describe,it,expect} from 'vitest';
import {initialPromotionConfig,quotePromotions,scheduleMatches} from '../src/core/promotions.js';

const date=iso=>new Date(iso+'T12:00:00-03:00');
describe('Plan comercial SAHTEN: precarga segura',()=>{
  it('importa SKUs verificados del catálogo real sin habilitar publicidad, descuentos ni cupones',()=>{
    const p=initialPromotionConfig();
    expect(p.planVersion).toBe(2);
    expect(p.enabled).toBe(false);
    expect(p.campaigns).toHaveLength(2);
    expect(p.campaigns.map(c=>c.enabled)).toEqual([false,false]);
    expect(p.ticket.enabled).toBe(false);
    expect(p.requireVerifiedCosts).toBe(true);
    expect(p.campaigns[0].productIds).toEqual([
      'p1779467294622','p1779997171373','sandwich_falafel','arabe_clasico','shawarma_pollo'
    ]);
    expect(p.campaigns[1].productIds).toEqual(['tabla_celebrar','p1779997050112']);
    expect(p.campaigns.flatMap(c=>c.productIds)).not.toContain('shawarma_mixto');
    expect(p.campaigns.flatMap(c=>c.productIds)).not.toContain('fatay');
  });
  it('los días aprobados incluyen únicamente lunes-miércoles y segundo/tercer viernes-sábado',()=>{
    const p=initialPromotionConfig();
    expect(p.campaigns[0].schedule).toMatchObject({type:'weekly',weekdays:[1,2,3]});
    expect(p.campaigns[1].schedule).toMatchObject({type:'central_weekends'});
    for(const d of ['2026-11-13','2026-11-14','2026-11-20','2026-11-21'])
      expect(scheduleMatches(p.campaigns[1].schedule,date(d))).toBe(true);
    expect(scheduleMatches(p.campaigns[1].schedule,date('2026-11-15'))).toBe(false);
  });
  it('la bienvenida y repetición están preparadas, no activadas ni emitidas',()=>{
    const p=initialPromotionConfig();
    expect(p.couponPrograms.first_online).toMatchObject({
      enabled:false,channel:'online',minEligibleSubtotal:30000,extraPercent:5,validDays:14
    });
    expect(p.couponPrograms.second_online).toMatchObject({
      enabled:false,channel:'online',minEligibleSubtotal:40000,extraPercent:10,
      maxExtraAmount:4000,validDays:14,requiresConfirmedOrigin:true
    });
  });
  it('Baklava: máximo una unidad y 10 puntos extra, sin activar ni duplicar Tabla para Celebrar',()=>{
    const p=initialPromotionConfig(),b=p.upsells[0];
    expect(b).toMatchObject({enabled:false,productIds:['baklava'],maxUnits:1,extraPercent:10});
    expect(b.suppressIfPresent).toContain('tabla_celebrar');
  });
  it('el motor apagado conserva el 10% de transferencia; sin costos verificados bloquea campañas si se habilitan',()=>{
    const cfg=initialPromotionConfig(),lines=[{productId:'p1779467294622',unitPrice:16850,qty:1}],now=date('2026-11-02');
    const off=quotePromotions({config:cfg,lines,method:'transferencia',now});
    expect(off.netSubtotal).toBe(15165);expect(off.appliedPromotionIds).toEqual([]);
    cfg.enabled=true;cfg.campaigns[0].enabled=true;
    const blocked=quotePromotions({config:cfg,lines,method:'transferencia',now});
    expect(blocked.netSubtotal).toBe(15165);expect(blocked.appliedPromotionIds).toEqual([]);
    const checked=quotePromotions({config:cfg,lines,method:'transferencia',now,trustedCosts:{p1779467294622:6775.05}});
    expect(checked.netSubtotal).toBe(14322.5);expect(checked.appliedPromotionIds).toEqual(['weekly-meals']);
  });
});