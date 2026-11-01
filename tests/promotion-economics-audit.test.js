import {describe,it,expect} from 'vitest';
import {auditProductPromotionEconomics} from '../src/core/promotion-economics-audit.js';

const make=()=>{
 const fatay={id:'fatay',name:'Fatay de prueba',category:'Salados',porciones:1,
  pesoTotal:1,pesoUnit:'u',porcionesOverride:1,
  avgMes:50,ingredients:[{ingId:'relleno',qty:1,unit:'u'}],
  packaging:[],combos:[],merchandise:[],fixedPrices:{mostrador:5850}};
 const supermix={id:'p1779299917243',name:'Shawarma SUPERMIX',
  category:'Shawarmas',porciones:1,avgMes:50,
  ingredients:[{ingId:'carne',qty:1,unit:'u'}],
  packaging:[{envId:'papel',qty:1,unit:'u'}],
  combos:[{prodId:'fatay',qty:1,unit:'u',addPackaging:true}],
  merchandise:[],fixedPrices:{mostrador:16850}};
 return {
  products:[supermix,fatay],
  ingredients:[{id:'carne',unit:'u',cantidad:1,grPaquete:1,precioPkg:100},
   {id:'relleno',unit:'u',cantidad:1,grPaquete:1,precioPkg:200}],
  packs:[{id:'papel',cantidad:1,precioPkg:30}],
  merchandise:[],gastosOp:[{amount:1000}],gastosS:[],
  channels:[{id:'mostrador',name:'Mostrador',surcharge:0,commission:0,enabled:true}],
  tiers:[{id:'general',factor:1}],globalCommission:0,
  project:{currencySymbol:'$',estUnitsMonth:100}
 };
};
describe('Auditoría económica integral y no autorizante',()=>{
 it('SUPERMIX suma ingredientes, envases y Fatay: nunca usa solo receta_cost',()=>{
  const state=make();
  const result=auditProductPromotionEconomics(state,'p1779299917243');
  expect(result.sourceComplete).toBe(true);
  expect(result.unitDirectCost).toBe(330);
  expect(result.unitFixedAllocation).toBe(10);
  expect(result.unitCostWithFixedAllocation).toBe(340);
  expect(result.discountApproved).toBe(false);
  expect(result.requiresOwnerCostReview).toBe(true);
 });
 it('con un subproducto faltante o empaque no encontrado bloquea validación del costo',()=>{
  const state=make();
  state.products=state.products.filter(p=>p.id!=='fatay');
  const result=auditProductPromotionEconomics(state,'p1779299917243');
  expect(result.sourceComplete).toBe(false);
  expect(result.issues).toContain('subproduct_reference_invalid');
  state.products[0].packaging[0].envId='no-existe';
  expect(auditProductPromotionEconomics(state,'p1779299917243').issues)
   .toContain('packaging_cost_missing');
 });
 it('bebidas pueden costar dinero y seguir sin costo de proveedor auditado',()=>{
  const state=make();state.products.push({
   id:'bebida_sprite_zero_220ml',name:'Sprite Zero 220 ml',
   category:'Bebidas',porciones:1,avgMes:0,absorbeGF:false,
   ingredients:[],packaging:[],combos:[],
   merchandise:[{merchId:'sprite',qty:1}],fixedPrices:{mostrador:1400}
  });
  state.merchandise.push({id:'sprite',cantidad:8,precioPkg:6770,costVerified:false,
   costStatus:'missing_supplier_cost'});
  const result=auditProductPromotionEconomics(state,'bebida_sprite_zero_220ml');
  expect(result.unitDirectCost).toBe(846.25);
  expect(result.sourceComplete).toBe(false);
  expect(result.issues).toContain('resale_supplier_cost_not_audited');
  expect(result.discountApproved).toBe(false);
 });
});
