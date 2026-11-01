import {describe,it,expect} from 'vitest';
import {cartHash,issueUpsellIntent,verifyAcceptedUpsell,normalizedItems,UpsellIntentError} from '../src/core/upsell-intent.js';

const sid='b0a7ce44-8833-4a55-bb11-2c774daa3151';
const product='fatay', promoId='fatay-individual-up';
const date=Date.parse('2026-11-01T17:00:00Z');
const menu={config:{enabled:true},products:[
 {id:'shawarma_pollo',name:'Shawarma',price:16000,priceRevision:'r1'},
 {id:'fatay',name:'Fatay',price:5850,priceRevision:'r2'},
 {id:'cocacola_600ml',name:'Coca',price:2500,priceRevision:'r3'}
],promotions:{enabled:true,upsellGuardRequired:true,upsells:[
 {id:promoId,kind:'upsell',enabled:true,maxUnits:1,productIds:['fatay'],
 triggerProductIds:['shawarma_pollo'],suppressIfPresent:['combo_fatay']}
]}};
const base={source:'pickup',paymentMethod:'transferencia',items:[{productId:'shawarma_pollo',qty:2}]};
const after={...base,items:[...base.items,{productId:'fatay',qty:1}]};
const issue=()=>issueUpsellIntent({storeId:sid,order:base,menu,productId:product,promotionId:promoId});
const record=async()=>{const i=await issue();return {id:'4d125b6a-fb84-4cd9-ae72-4efa1dab7e04',
  store_id:sid,product_id:product,promotion_id:promoId,
  before_hash:i.beforeHash,after_hash:i.afterHash,
  expires_at:new Date(date+300000).toISOString(),redeemed_at:null,request_id:null};};
const verify=async(o=after,overrides={})=>verifyAcceptedUpsell({
 record:await record(),storeId:sid,menu,order:o,requestId:'397e3c7f-d0a3-4b6a-b89a-a384d920d771',now:date,...overrides
});
describe('intención irreversible del upsell incremental',()=>{
 it('normaliza orden/carrito sin depender del orden de productos',async()=>{
   expect(normalizedItems([{id:'fatay',qty:1},{id:'fatay',qty:1},{id:'shawarma_pollo',qty:1}]))
    .toEqual([{productId:'fatay',qty:2},{productId:'shawarma_pollo',qty:1}]);
   const a=await cartHash({storeId:sid,order:after,menu,items:after.items});
   const b=await cartHash({storeId:sid,order:after,menu,items:[...after.items].reverse()});
   expect(a).toBe(b);
 });
 it('sólo aprueba EXACTAMENTE una Fatay adicional con intención previa del servidor',async()=>{
   const v=await verify();
   expect(v.trustedSelection).toMatchObject({verified:true,isIncremental:true,
     productId:'fatay',promotionId:promoId,eligibleUnits:1});
   expect(v.redemption.storeId).toBe(sid);
 });
 it('no permite crear intención con Fatay ya incluida, sin disparador ni con combo excluido',async()=>{
   for(const items of [[{id:'fatay',qty:1}],[{id:'cocacola_600ml',qty:1}],
    [{id:'shawarma_pollo',qty:1},{id:'fatay',qty:1}],
    [{id:'shawarma_pollo',qty:1},{id:'combo_fatay',qty:1}]]) {
     await expect(issueUpsellIntent({storeId:sid,order:{...base,items},menu,
       productId:product,promotionId:promoId})).rejects.toThrow(UpsellIntentError);
   }
 });
 it('no permite reutilizar token con otros productos, cantidades ni contexto de pago',async()=>{
   for(const changed of [
     {...after,items:[{id:'shawarma_pollo',qty:3},{id:'fatay',qty:1}]},
     {...after,items:[{id:'shawarma_pollo',qty:2},{id:'fatay',qty:2}]},
     {...after,items:[{id:'shawarma_pollo',qty:2},{id:'fatay',qty:1},{id:'cocacola_600ml',qty:1}]},
     {...after,paymentMethod:'mercadopago'},
     {...after,source:'delivery',address:'Maipu 121, Vicente Lopez',lat:-34.51,lng:-58.47}
   ])await expect(verify(changed)).rejects.toThrow(UpsellIntentError);
 });
 it('precio, revisión y disponibilidad de menú se validan de nuevo al aceptar',async()=>{
   const m=structuredClone(menu);m.products[1].price=6000;
   await expect(verify(after,{menu:m})).rejects.toThrow(UpsellIntentError);
   m.products[1].price=5850;m.products[1].priceRevision='new';
   await expect(verify(after,{menu:m})).rejects.toThrow(UpsellIntentError);
   m.products[1].priceRevision='r2';m.products[1].salesAvailability={paused:true};
   await expect(verify(after,{menu:m})).rejects.toThrow(UpsellIntentError);
 });
 it('token vence, es específico de tienda y no sirve después de otra compra',async()=>{
   const r=await record();
   await expect(verify(after,{record:r,now:date+300001})).rejects.toThrow(UpsellIntentError);
   await expect(verify(after,{record:{...r,store_id:'other'}})).rejects.toThrow(UpsellIntentError);
   await expect(verify(after,{record:{...r,redeemed_at:new Date(date).toISOString(),
     request_id:'2d52d1de-e188-45a8-9d21-8ceeb474e977'}})).rejects.toThrow(UpsellIntentError);
 });
 it('motor o campaña apagados rechazan incluso un token emitido previamente',async()=>{
   await expect(verify(after,{menu:{...menu,promotions:{...menu.promotions,enabled:false}}}))
     .rejects.toThrow(UpsellIntentError);
   const m=structuredClone(menu);m.promotions.upsells[0].enabled=false;
   await expect(verify(after,{menu:m})).rejects.toThrow(UpsellIntentError);
 });
 it('no acepta identificadores de producto ni cantidades falsas',()=>{
   expect(()=>normalizedItems([{id:'fatay',qty:0}])).toThrow(UpsellIntentError);
   expect(()=>normalizedItems([{id:'fatay',qty:100}])).toThrow(UpsellIntentError);
   expect(()=>normalizedItems([{id:'fatay<script>',qty:1}])).toThrow(UpsellIntentError);
 });
});
