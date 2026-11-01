import { describe,it,expect } from 'vitest';
import { fixedPriceAudit,normalizeFixedPrices,undoFixedPriceNormalization } from '../src/core/price-normalization.js';
import { channelPriceWithDisc, tierProfitPerUnit } from '../src/core/pricing.js';
import { gfAssigned } from '../src/core/gf.js';
const base=()=>({
 products:[{id:'shawarma_carne',name:'Shawarma de Carne',tier:'T5',priceAdj:1,avgMes:5,absorbeGF:true,
   pricingPolicies:{mostrador:{price:18600,variableCost:4664.99,fixedCost:5380.15,commissionRate:null}}}],
 tiers:[{id:'T5',name:'Mínimo',factor:1.2}],
 channels:[{id:'mostrador',name:'Mostrador',enabled:true,surcharge:0,commission:0}],
 gastosOp:[],gastosS:[],project:{estUnitsMonth:10,roundTo:50},globalCommission:0
});
describe('normalización reversible de precios de SAHTEN',()=>{
 it('mantiene precio, GF y variable sin etiqueta de fijado',()=>{
  const s=base(),p=s.products[0],before=channelPriceWithDisc(s,p,'mostrador'),gf=gfAssigned(s,p);
  expect(before).toBe(18600);expect(gf).toBe(5380.15);
  const report=normalizeFixedPrices(s);
  expect(report.products).toBe(1);expect(channelPriceWithDisc(s,p,'mostrador')).toBe(before);
  expect(gfAssigned(s,p)).toBe(gf);
  expect(p.pricingPolicies.mostrador.price).toBe(null);
  expect(p.priceTargets.mostrador).toBe(18600);
  expect(tierProfitPerUnit(s,p)).toBeCloseTo(8554.86,2);
 });
 it('simulación no altera ningún campo',()=>{
  const s=base(),a=JSON.stringify(s);
  const preview=normalizeFixedPrices(s,{dryRun:true});
  expect(preview.products).toBe(1);
  expect(JSON.stringify(s)).toBe(a);
 });
 it('puede deshacer la normalización y recuperar el precio anterior',()=>{
  const s=base(),p=s.products[0];
  normalizeFixedPrices(s);
  expect(undoFixedPriceNormalization(s,p.id)).toBe(true);
  expect(p.pricingPolicies.mostrador.price).toBe(18600);
  expect(channelPriceWithDisc(s,p,'mostrador')).toBe(18600);
 });
});
