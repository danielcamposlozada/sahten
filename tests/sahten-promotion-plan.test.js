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
  it('precarga Fatay con la Cuarta como reemplazo, no como regalo ni línea duplicada',()=>{
    const up=plan.productUpgrades.find(p=>p.id==='fatay-cuarta');
    expect(up).toMatchObject({
      enabled:false,kind:'replace_product',approvedConcept:true,
      triggerProductId:'p1779467294622',replacementProductId:'p1779570052552',
      referenceListPrice:18500,replaceInsteadOfAdd:true,unitsPrinted:4,
      extraPercent:0,onlyStandardPaymentBenefit:true,
      excludeCampaignsAndCoupons:true,requireVerifiedTargetCost:true
    });
    expect(up.activationBlockers).toContain('missing_computed_cost_for_replacement_sku');
    expect(plan.campaigns.flatMap(c=>c.productIds)).not.toContain(up.replacementProductId);
  });
  it('Fatay, Baklava, ambos Mamul y Torta de Chocolate tienen upsells propios, todos apagados',()=>{
    expect(plan.planVersion).toBe(4);
    expect(plan.upsells).toHaveLength(5);
    expect(plan.upsells.map(x=>x.productIds[0]).sort()).toEqual([
      'baklava','fatay','mamul_datil','mamul_nuez','torta_de_chocolate'
    ]);
    expect(plan.upsells.every(c=>c.enabled===false&&c.maxUnits===1)).toBe(true);
    expect(plan.upsells.map(c=>c.extraPercent).sort()).toEqual([5,5,5,10,10]);
    expect(plan.upsells.every(c=>c.activationBlockers?.includes('server_basket_level_profit_guard_pending'))).toBe(true);
    expect(plan.activationPolicy.maxDiscountedUpsellLinesPerOrder).toBe(1);
    expect(plan.activationPolicy.maxUpsellCardsPerCart).toBe(2);
  });
  it('Fatay individual no entra en campañas públicas, pero sí como complemento en carrito',()=>{
    const fatay=plan.upsells.find(c=>c.id==='fatay-individual-up');
    expect(fatay).toMatchObject({kind:'upsell',enabled:false,extraPercent:10,marginAssessment:'incremental_unit_plus_basket'});
    expect(fatay.suppressIfPresent).toContain('p1779467294622');
    expect(fatay.suppressIfPresent).toContain('p1779570052552');
    expect(fatay.displayOnlyWhenNotAlreadyInCart).toBe(true);
    expect(plan.exclusions.publicCampaigns).toContain('fatay');
    expect(plan.campaigns.flatMap(c=>c.productIds)).not.toContain('fatay');
  });
  it('venta cruzada sin descuento extra complementa upsells, sin repetir Mamul en ambas secciones',()=>{
    expect(plan.crossSells).toHaveLength(3);
    expect(plan.crossSells.map(c=>c.productId).sort()).toEqual(['falafel_mix','hummus','p1780324945477']);
    expect(plan.crossSells.every(c=>c.enabled===false&&c.extraPercent===0&&c.standardPaymentBenefitOnly)).toBe(true);
    expect(plan.crossSells.map(c=>c.productId)).not.toContain('mamul_nuez');
    expect(plan.crossSells.map(c=>c.productId)).not.toContain('mamul_datil');
  });
  it('compara costo incremental con GF asignado sin contar automáticamente alquiler dos veces',()=>{
    for(const [id,price,variable,fixed] of [
      ['fatay',5850,442.12,3138.42],['baklava',7350,1294.46,2241.73],
      ['mamul_nuez',7000,518.09,3138.42],['mamul_datil',7000,405.59,3362.59],
      ['torta_de_chocolate',8200,1432.01,2510.74]
    ]) {
      const c=plan.upsells.find(x=>x.productIds.includes(id));
      expect(c.historicalUnitEconomics).toMatchObject({listPrice:price,variableCost:variable,allocatedFixedCost:fixed});
      const discounted=price*(1-(10+c.extraPercent)/100);
      expect(discounted-variable).toBeGreaterThan(0);
      expect(c.marginAssessment).toBe('incremental_unit_plus_basket');
    }
    expect(plan.activationPolicy.requireIncrementalAndBasketMarginCheck).toBe(true);
    expect(plan.activationPolicy.doNotReallocateEntireMonthlyFixedCostPerAdditionalUnit).toBe(true);
  });
  it('la barra de envío calcula sobre NETO y no altera la política de zonas',()=>{
    expect(plan.checkoutIncentives.find(c=>c.id==='shipping-progress')).toMatchObject({
      enabled:false,requiresDeliveryZone:true,basis:'discountedNetGoods',extraDiscountPercent:0
    });
    expect(plan.activationPolicy).toMatchObject({minTargetContributionPct:40,minAbsoluteContributionPct:35,
      requireServerQuoteAtCheckout:true,liveControlsPerCampaign:true});
    expect(plan.checkoutIncentives.every(x=>x.enabled===false)).toBe(true);
  });
  it('Baklava 20% total no pasa objetivo 40% con costo registrado actual',()=>{
    const cfg=structuredClone(plan);cfg.enabled=true;cfg.upsells[0].enabled=true;
    const lines=[{productId:'p1779467294622',unitPrice:16850,qty:1},{productId:'baklava',unitPrice:7350,qty:1}];
    const quote=quotePromotions({config:cfg,lines,method:'transferencia',now:date('2026-11-06'),
      trustedCosts:{p1779467294622:6775.05,baklava:3536.19}});
    const dessert=quote.lines.find(l=>l.productId==='baklava');
    expect(dessert.net).toBe(6615);
    expect(dessert.promotionDiscount).toBe(0);
    const proposedNet=7350*.8;
    expect((proposedNet-3536.19)/proposedNet*100).toBeLessThan(40);
  });
  it('Fatay individual sigue fuera de campaña general: 15% da margen inferior a 35%',()=>{
    expect(plan.exclusions.publicCampaigns).toContain('fatay');
    const net=5850*0.85, cost=3138.42+442.12;
    expect((net-cost)/net*100).toBeLessThan(plan.minMarginAbsolutePct);
    expect(plan.exclusions.deferredNotApproved).toContain('25percent_random_reward');
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
