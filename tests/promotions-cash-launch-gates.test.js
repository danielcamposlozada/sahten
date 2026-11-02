import {describe,it,expect} from 'vitest';
import {couponIssuePolicy} from '../src/promotions/server.js';
import {quotePromotions} from '../src/core/promotions.js';
const base=()=>({enabled:true,paymentPercent:10,minMarginPct:40,requireVerifiedCosts:true,
 activationPolicy:{allowedPromotionPaymentMethods:['efectivo','transferencia']},
 couponPrograms:{first_online:{enabled:true,extraPercent:5,validDays:14,identityVerified:true}},
 verifiedOrderCosts:{verified:true,reviewedAt:'2026-11-01T12:00:00Z',
  reviewedBy:'dueño',additionalOrderCost:0,shippingSubsidy:0},
 campaigns:[{id:'weekly-meals',kind:'public',enabled:true,priority:2,extraPercent:5,
   productIds:['shawarma_pollo'],channels:['online'],schedule:{type:'always'}}],
 upsells:[]});
describe('Lanzamiento sin promociones Mercado Pago',()=>{
 it('MP conserva su cobro normal sin campaña ni cupón nuevo',()=>{
  const p=base();
  const lines=[{productId:'shawarma_pollo',qty:1,unitPrice:16000}];
  const mp=quotePromotions({lines,config:p,method:'mercadopago',
   trustedCosts:{shawarma_pollo:7000}});
  expect(mp.appliedPromotionIds).toEqual([]);
  expect(mp.subtotal).toBe(16000);
  expect(mp.discount).toBe(0);
  expect(mp.netSubtotal).toBe(16000);
  expect(mp.enabled).toBe(false);
  const cash=quotePromotions({lines,config:p,method:'transferencia',
   trustedCosts:{shawarma_pollo:7000}});
  expect(cash.paymentPercent).toBe(10);
  expect(cash.appliedPromotionIds).toContain('weekly-meals');
  expect(cash.discount).toBe(2400);
 });
 it('cupón emitido: ningún programa activo sin economía y canal aprobados',()=>{
  const p=base();expect(couponIssuePolicy(p,'first_online').allowed).toBe(true);
  p.enabled=false;
  expect(couponIssuePolicy(p,'first_online').reason).toBe('promotions_disabled');
  p.enabled=true;p.couponPrograms.first_online.enabled=false;
  expect(couponIssuePolicy(p,'first_online').reason).toBe('program_disabled');
  p.couponPrograms.first_online.enabled=true;p.couponPrograms.first_online.identityVerified=false;
  expect(couponIssuePolicy(p,'first_online').reason).toBe('identity_not_verified');
  p.couponPrograms.first_online.identityVerified=true;p.verifiedOrderCosts.verified=false;
  expect(couponIssuePolicy(p,'first_online').reason).toBe('economic_review_missing');
  p.verifiedOrderCosts.verified=true;
  p.activationPolicy.allowedPromotionPaymentMethods.push('mercadopago');
  expect(couponIssuePolicy(p,'first_online').reason).toBe('payment_channels_unapproved');
 });
 it('sin política explícita de métodos, no se habilita emisión de cupones',()=>{
  const p=base();delete p.activationPolicy.allowedPromotionPaymentMethods;
  expect(couponIssuePolicy(p,'first_online').allowed).toBe(false);
 });
});
