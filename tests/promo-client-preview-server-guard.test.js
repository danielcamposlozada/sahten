import {describe,it,expect} from 'vitest';
import {quotePromotions} from '../src/core/promotions.js';
const config={enabled:true,paymentPercent:10,campaigns:[{
  id:'mamul',kind:'public',enabled:true,channels:['online'],schedule:{type:'always'},
  productIds:['mamul_datil'],extraPercent:2,maxUnits:1,minMarginPct:38,
  requiresVerifiedCosts:false
}]};
const lines=[{productId:'mamul_datil',unitPrice:7000,qty:1}];
describe('Storefront preview without sensitive costs',()=>{
it('previews 12% when no cost data and does not treat the preview as authorization',()=>{
 const preview=quotePromotions({lines,method:'transferencia',channel:'online',config,clientPreview:true});
 const server=quotePromotions({lines,method:'transferencia',channel:'online',config});
 expect(preview.discount).toBe(840);
 expect(server.discount).toBe(700);
 expect(server.appliedPromotionIds).toEqual([]);
});
it('server only applies verified promo under contribution floor',()=>{
 const ok=quotePromotions({lines,method:'transferencia',channel:'online',config,trustedCosts:{mamul_datil:3768.18}});
 const fail=quotePromotions({lines,method:'transferencia',channel:'online',config,trustedCosts:{mamul_datil:4200}});
 expect(ok.discount).toBe(840);
 expect(fail.discount).toBe(700);
});
});
