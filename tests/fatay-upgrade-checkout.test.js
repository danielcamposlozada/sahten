import {describe,it,expect} from 'vitest';
import {eligibleFatayUpgrade,applyFatayUpgrade,FATAY_THREE_ID,FATAY_FOUR_ID} from '../src/core/fatay-upgrade.js';
const menu={products:[{id:FATAY_THREE_ID,name:'Promo Fatay (3U)',price:16850},
{id:FATAY_FOUR_ID,name:'Fatay con la Cuarta (4U)',price:18500,upsellOnly:true}]};
describe('Fatay 3U to 4U',()=>{
 it('replaces only one 3U with one 4U without adding two extra lines',()=>{
   const source={[FATAY_THREE_ID]:2,baklava:1};
   expect(eligibleFatayUpgrade(menu,source)?.extraAtList).toBe(1650);
   const next=applyFatayUpgrade(menu,source);
   expect(next.cart).toEqual({[FATAY_THREE_ID]:1,baklava:1,[FATAY_FOUR_ID]:1});
   expect(source[FATAY_THREE_ID]).toBe(2);
   expect(applyFatayUpgrade(menu,next.cart).applied).toBe(false);
 });
 it('cannot upgrade without published hidden 4U, or without 3U',()=>{
  expect(eligibleFatayUpgrade(menu,{})).toBeNull();
  expect(eligibleFatayUpgrade({products:menu.products.slice(0,1)},{[FATAY_THREE_ID]:1})).toBeNull();
  expect(eligibleFatayUpgrade({products:menu.products.map(p=>({...p,upsellOnly:false}))},{[FATAY_THREE_ID]:1})).toBeNull();
 });
});
