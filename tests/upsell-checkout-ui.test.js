import {describe,it,expect} from 'vitest';
import {availableCheckoutUpsell,checkoutUpsellFingerprint,acceptedCheckoutUpsell} from '../src/online/upsell-checkout.js';
const menu=()=>({products:[
 {id:'shawarma',price:17000,category:'Shawarma'},
 {id:'fatay',price:5850,category:'Fatay',salesAvailability:{paused:false}},
 {id:'agua',price:2000,category:'Bebidas'}],
 promotions:{enabled:true,upsellGuardRequired:true,upsells:[
 {id:'fatay-up',enabled:true,kind:'upsell',maxUnits:1,priority:20,productIds:['fatay'],
 triggerProductIds:['shawarma'],suppressIfPresent:[]}]}
});
const cart=[{productId:'shawarma',qty:2}];
describe('Checkout de ofertas - cliente pregunta, servidor decide',()=>{
 it('no ofrece descuentos cuando el menú está apagado o guard HMAC ausente',()=>{
  const m=menu();m.promotions.enabled=false;
  expect(availableCheckoutUpsell(m,cart,{method:'mercadopago'})).toBeNull();
  m.promotions.enabled=true;m.promotions.upsellGuardRequired=false;
  expect(availableCheckoutUpsell(m,cart,{method:'mercadopago'})).toBeNull();
 });
 it('oferta para SUPERMIX sin repetir productos o ofrecer pausados',()=>{
  const m=menu();
  expect(availableCheckoutUpsell(m,cart,{method:'mercadopago'}))
   .toMatchObject({offerId:'fatay-up',product:{id:'fatay'}});
  expect(availableCheckoutUpsell(m,[...cart,{productId:'fatay',qty:1}],{method:'mercadopago'})).toBeNull();
  m.products[1].salesAvailability.paused=true;
  expect(availableCheckoutUpsell(m,cart,{method:'transferencia'})).toBeNull();
 });
 it('firma de contexto de interfaz no sobrevive a cambio de método, envío, dirección, cantidades ni vencimiento',()=>{
  const current={items:cart,method:'mercadopago',source:'pickup',name:'Prueba',phone:'12345678',
   address:'Retiro',shipping:0,routeRevision:'r1',menuRevision:1};
  const accepted={accepted:true,fingerprint:checkoutUpsellFingerprint(current),
   expiresAt:Date.parse('2030-01-01'),orderTotal:33333};
  const at=Date.parse('2029-12-31');
  expect(acceptedCheckoutUpsell(accepted,current,at)).toBe(true);
  for(const change of [{method:'transferencia'},{source:'delivery'},{shipping:1500},
   {address:'Calle 5'},{items:[{productId:'shawarma',qty:3}]},{routeRevision:'r2'}])
   expect(acceptedCheckoutUpsell(accepted,{...current,...change},at)).toBe(false);
  expect(acceptedCheckoutUpsell(accepted,current,Date.parse('2030-01-02'))).toBe(false);
 });
});
