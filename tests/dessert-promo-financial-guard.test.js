import {describe,it,expect} from 'vitest';
import {quotePromotions} from '../src/core/promotions.js';
const config={enabled:true,paymentPercent:10,campaigns:[{
  id:'dessert-safeguarded',kind:'public',enabled:true,channels:['online'],
  productIds:['baklava','torta_de_chocolate'],schedule:{type:'always'},
  extraPercent:2,maxUnits:1,priority:15,minMarginPct:45,requiresVerifiedCosts:false
}]};
const quote=(lines,costs,method='transferencia')=>quotePromotions({
  lines,method,channel:'online',config,trustedCosts:costs});
describe('Campaign discounts for dessert SKUs with live financial floor',()=>{
  it('fails closed when production cost snapshot is unavailable',()=>{
    const result=quote([{productId:'baklava',qty:1,unitPrice:7350}],{});
    expect(result.appliedPromotionIds).toEqual([]);
    expect(result.discount).toBe(735);
  });
  it('caps promotional part at 1 unit, preserves 10% usual benefit',()=>{
    const result=quote([{productId:'baklava',qty:3,unitPrice:7350}],{baklava:3536.19});
    expect(result.appliedPromotionIds).toContain('dessert-safeguarded');
    expect(result.discount).toBe(3*7350*.1+7350*.02);
    expect(result.lines[0].promotionDiscount).toBe(147);
  });
  it('rejects campaigns if margin drops below floor, even if browser advertises the offer',()=>{
    const result=quote([{productId:'baklava',qty:1,unitPrice:7350}],{baklava:3900});
    expect(result.appliedPromotionIds).toEqual([]);
    expect(result.discount).toBe(735);
  });
  it('works for cake at recorded cost, but not on Mercado Pago',()=>{
    expect(quote([{productId:'torta_de_chocolate',qty:1,unitPrice:8200}],
      {torta_de_chocolate:3942.75}).appliedPromotionIds).toContain('dessert-safeguarded');
    expect(quote([{productId:'torta_de_chocolate',qty:1,unitPrice:8200}],
      {torta_de_chocolate:3942.75},'mercadopago').discount).toBe(0);
  });
});
