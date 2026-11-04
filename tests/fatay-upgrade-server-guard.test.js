import {describe,it,expect} from 'vitest';
import {quoteOrder} from '../src/payments/core.js';
import {FATAY_THREE_ID,FATAY_FOUR_ID} from '../src/core/fatay-upgrade.js';
const menu={
 config:{enabled:true,showPrices:true,hiddenProducts:[FATAY_FOUR_ID]},
 store:{currency:{symbol:'$',locale:'es-AR'}},
 products:[
  {id:FATAY_THREE_ID,name:'Promo Fatay 3U',price:16850,category:'Entradas'},
  {id:FATAY_FOUR_ID,name:'Fatay con la Cuarta 4U',price:18500,
   category:'Entradas',upsellOnly:true,upgradeFrom:FATAY_THREE_ID},
  {id:'other-secret',name:'Oculto',price:22000,upsellOnly:true,category:'Entradas'}
 ],
 payments:{methods:{efectivo:true,transferencia:true},
 benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 promotions:{enabled:false}
};
const quote=(items,accepted=true,sourceMenu=menu)=>quoteOrder(sourceMenu,{
 source:'pickup',paymentMethod:'transferencia',customerName:'Cliente',
 customerPhone:'1111111111',items,fatayUpgradeAccepted:accepted
},{allowOtherPayments:true,validateCustomer:false,requireCustomer:false});
describe('4U Fatay is exclusively a checkout replacement',()=>{
 it('server accepts one explicitly chosen hidden 4U at published price',()=>{
   const q=quote([{productId:FATAY_FOUR_ID,qty:1}]);
   expect(q.subtotal).toBe(18500);
   expect(q.discount).toBe(1850);
   expect(q.total).toBe(16650);
   expect(q.items[0]).toMatchObject({productId:FATAY_FOUR_ID,qty:1,unitPrice:18500});
 });
 it('refuses direct hidden SKU, a second hidden unit or a different exclusive product',()=>{
   expect(()=>quote([{productId:FATAY_FOUR_ID,qty:1}],false)).toThrow(/disponible/);
   expect(()=>quote([{productId:FATAY_FOUR_ID,qty:2}])).toThrow(/disponible/);
   expect(()=>quote([{productId:'other-secret',qty:1}])).toThrow(/disponible/);
 });
 it('permite un combo 3U y otro 4U cuando se reemplazó uno de dos combos originales',()=>{
   const result=quote([{productId:FATAY_THREE_ID,qty:1},{productId:FATAY_FOUR_ID,qty:1}]);
   expect(result.items).toHaveLength(2);expect(result.total).toBe(31815);
 });
 it('rejects a spoofed upgrade origin even with explicit acceptance',()=>{
   const changed={...menu,products:menu.products.map(p=>p.id===FATAY_FOUR_ID?
     {...p,upgradeFrom:'unpublished_combo'}:p)};
   expect(()=>quote([{productId:FATAY_FOUR_ID,qty:1}],true,changed)).toThrow(/disponible/);
 });
 it('the regular three-unit Fatay remains a normal purchasable line',()=>{
   const q=quote([{productId:FATAY_THREE_ID,qty:1}],false);
   expect(q.total).toBe(15165);
 });
});
