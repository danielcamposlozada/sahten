import { describe,it,expect } from 'vitest';
import { quotePromotions } from '../src/core/promotions.js';
import fs from 'node:fs';
const plan=JSON.parse(fs.readFileSync(new URL('../docs/sahten/plan-promociones-2026.json',import.meta.url),'utf8'));
const date=new Date('2026-11-06T12:00:00-03:00');
const base=()=>{const c=structuredClone(plan);c.enabled=true;c.upsells.forEach(u=>u.enabled=u.id==='fatay-individual-up');c.campaigns.forEach(u=>u.enabled=false);return c;};
const expenses={shawarma_pollo:{verified:true,directCost:3000,fixedCost:1000,incrementalVerified:true,additionalIncrementalCost:0},
 fatay:{verified:true,directCost:442.12,fixedCost:3138.42,incrementalVerified:true,additionalIncrementalCost:0},
 p1779467294622:{verified:true,directCost:1619.07,fixedCost:5155.98,incrementalVerified:true,additionalIncrementalCost:0}};
const cost={shawarma_pollo:4000,fatay:3580.54,p1779467294622:6775.05};
const intent={verified:true,isIncremental:true,productId:'fatay',eligibleUnits:1};
const orderCosts={verified:true,additionalOrderCost:0,shippingSubsidy:0};
const quote=(qty,method='transferencia',opts={})=>quotePromotions({config:base(),channel:'online',method,now:date,
 lines:[{productId:'shawarma_pollo',unitPrice:16000,qty},{productId:'fatay',unitPrice:5850,qty:1}],
 trustedEconomics:expenses,trustedCosts:cost,trustedOrderCosts:orderCosts,trustedUpsellSelection:intent,...opts});
describe('Fatay incremental: 20/25/30% OFF por monto elegible neto',()=>{
 it('no ofrece descuento extra debajo de $20.000 netos en platos',()=>{
   const q=quote(1);expect(q.lines.find(l=>l.productId==='fatay').net).toBe(5265);
   expect(q.appliedPromotionIds).toEqual([]);
 });
 it('a $28.800 netos de platos da 20% TOTAL; efectivo sin duplicar 10%',()=>{
   const q=quote(2);expect(q.lines.find(l=>l.productId==='fatay')).toMatchObject({net:4680,promotionDiscount:585,paymentDiscount:585});
 });
 it('a $43.200 netos de platos da 25% TOTAL',()=>{
   const q=quote(3);expect(q.lines.find(l=>l.productId==='fatay')).toMatchObject({net:4387.5,promotionDiscount:877.5,paymentDiscount:585});
 });
 it('a $57.600 netos de platos da 30% TOTAL y en Mercado Pago también es 30%',()=>{
   const cash=quote(4);expect(cash.lines.find(l=>l.productId==='fatay')).toMatchObject({net:4095,promotionDiscount:1170});
   const mp=quote(4,'mercadopago');
   expect(mp.lines.find(l=>l.productId==='fatay')).toMatchObject({net:4095,promotionDiscount:1755});
 });
 it('no usa el precio de la Fatay, delivery ni otra bebida para inflar el umbral',()=>{
   const q=quote(1,'transferencia',{lines:[
     {productId:'shawarma_pollo',unitPrice:16000,qty:1},
     {productId:'fatay',unitPrice:5850,qty:1},
     {productId:'p1793032422487',unitPrice:2000,qty:10}],
     trustedEconomics:{...expenses,p1793032422487:{verified:true,directCost:915,fixedCost:0}},
     trustedCosts:{...cost,p1793032422487:915}
   });expect(q.lines.find(l=>l.productId==='fatay').promotionDiscount).toBe(0);
 });
 it('no combina promoción extra con combo Fatay y sigue bloqueada sin validación server-side',()=>{
   const q=quote(2,'transferencia',{lines:[
     {productId:'shawarma_pollo',unitPrice:16000,qty:2},
     {productId:'fatay',unitPrice:5850,qty:1},
     {productId:'p1779467294622',unitPrice:16850,qty:1}]});
   expect(q.lines.find(l=>l.productId==='fatay').promotionDiscount).toBe(0);
   expect(quote(4,'transferencia',{trustedUpsellSelection:null}).lines.find(l=>l.productId==='fatay').promotionDiscount).toBe(0);
 });
});
