import {describe,it,expect} from 'vitest';
import {falafelRacionUpsellDraft,FALAFEL_RACION_ID} from '../src/core/upsell-policy-falafel-racion.js';
import {availableCheckoutUpsell} from '../src/online/upsell-checkout.js';
import {assessIncrementalUpsell} from '../src/core/upsell-economics.js';
const fatay={
 id:'fatay-individual-up',kind:'upsell',name:'Sumá una Fatay',
 enabled:false,maxUnits:1,priority:55,productIds:['fatay'],
 triggerProductIds:['shawarma_pollo','arabe_clasico','falafel_mix'],
 suppressIfPresent:['tabla_celebrar'],extraPercent:10,
 discountTiers:[
  {minEligibleNetSubtotal:20000,totalDiscountPercent:20},
  {minEligibleNetSubtotal:35000,totalDiscountPercent:25},
  {minEligibleNetSubtotal:50000,totalDiscountPercent:30}
 ]
};
const basket=[{productId:'shawarma_pollo',qty:2}];
describe('Falafel: ración completa de seis con la política de Fatay individual',()=>{
 it('duplica la escala, pero no habilita un descuento sin aprobación',()=>{
  const f=falafelRacionUpsellDraft(fatay);
  expect(f.enabled).toBe(false);
  expect(f.productIds).toEqual([FALAFEL_RACION_ID]);
  expect(f.unitDefinition).toEqual({productId:'falafel',quantity:1,portionCroquettes:6});
  expect(f.discountTiers).toEqual(fatay.discountTiers);
  expect(f.maxUnits).toBe(1);
  expect(f.marginAssessment).toBe('incremental_unit_plus_basket');
  expect(f.minMarginPct).toBe(40);
  expect(f.activationBlockers).toContain('verify_six_croquettes_portion_cost_and_tahini');
  expect(f.suppressIfPresent).not.toContain('falafel');
  expect(f.suppressIfPresent).toContain('falafel_mix');
  expect(f.suppressIfPresent).toContain('sandwich_falafel');
 });
 it('nunca apunta al Falafel Mix de tres croquetas y oculta candidato apagado',()=>{
  const f=falafelRacionUpsellDraft(fatay),menu={
   promotions:{enabled:true,upsellGuardRequired:true,upsells:[f]},
   products:[{id:'falafel',name:'Croquetas de Falafel (6)',price:11800},
    {id:'falafel_mix',name:'Falafel Mix',price:8950},
    {id:'shawarma_pollo',name:'Shawarma',price:16000}]
  };
  expect(availableCheckoutUpsell(menu,basket,{method:'transferencia'})).toBeNull();
  f.enabled=true; // activación SOLAMENTE dentro del fixture de test
  expect(availableCheckoutUpsell(menu,basket,{method:'transferencia'}))
    .toMatchObject({offerId:'falafel-racion-up',product:{id:'falafel',price:11800}});
  expect(availableCheckoutUpsell(menu,[...basket,{productId:'falafel',qty:1}],{method:'transferencia'})).toBeNull();
  expect(availableCheckoutUpsell(menu,[...basket,{productId:'falafel_mix',qty:1}],{method:'transferencia'})).toBeNull();
 });
 it('con costo variable o adicional no verificado se rechaza aun con descuento candidato',()=>{
  const f={...falafelRacionUpsellDraft(fatay),enabled:true};
  const lines=[{productId:'shawarma_pollo',qty:2},{productId:'falafel',qty:1}];
  const currentLines=[
   {productId:'shawarma_pollo',net:28800},
   {productId:'falafel',qty:1,net:10620}
  ];
  const assessment=assessIncrementalUpsell({
   lines,currentLines,upsell:f,productId:'falafel',
   proposedExtra:2360,trustedUpsellSelection:{
    verified:true,productId:'falafel',promotionId:f.id,isIncremental:true,eligibleUnits:1
   },trustedEconomics:{
    shawarma_pollo:{verified:true,directCost:2677.49,fixedCost:5066.31},
    falafel:{verified:false,directCost:0,fixedCost:5200.81,
      incrementalVerified:false,additionalIncrementalCost:0}
   },trustedOrderCosts:{verified:true,additionalOrderCost:0,shippingSubsidy:0},
   methodCommissionPercent:0,minBasketMarginPct:40,minIncrementalMarginPct:40
  });
  expect(assessment.approved).toBe(false);
  expect(assessment.reason).toBe('incremental_costs_unverified');
 });
 it('si cambia la escala de Fatay, no publica una réplica incorrecta',()=>{
  expect(()=>falafelRacionUpsellDraft({...fatay,discountTiers:[]})).toThrow(/fatay_tiers_unverified/);
 });
});
