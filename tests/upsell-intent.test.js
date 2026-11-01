import {describe,it,expect} from 'vitest';
import {issueUpsellChallenge,verifyAcceptedUpsell} from '../src/core/upsell-intent.js';
const secret='s3cure-test-seed-only-not-production-'+ 'a'.repeat(40);
const baseCart=[{productId:'arabe_clasico',qty:1},{productId:'tabla_celebrar',qty:1}];
const acceptedCart=[...baseCart,{productId:'fatay',qty:1}];
const options={
 secret,storeId:'d9b05fcc-1e22-47a1-b3ae-48eacbdff3cc',
 sessionId:'aa111111-1111-4111-8111-111111111111',productId:'fatay',
 offerId:'fatay-individual-up',method:'transferencia',channel:'online',
 menuRevision:'public-304',baseCart,now:1793548800000
};
const accepted=(challenge,extra={})=>verifyAcceptedUpsell({
 secret,token:challenge.token,storeId:options.storeId,sessionId:options.sessionId,
 method:options.method,channel:'online',menuRevision:options.menuRevision,
 acceptedCart,requestId:'bb222222-2222-4222-8222-222222222222',now:options.now+1000,
 consumeNonce:async()=>true,...extra
});
describe('Token de upsell no falsificable',()=>{
 it('emite reto firmado de 5 min y verifica solo un artículo adicional',async()=>{
  const challenge=await issueUpsellChallenge(options);
  expect(challenge.expiresAt-options.now).toBe(300000);
  const proof=await accepted(challenge);
  expect(proof).toMatchObject({verified:true,isIncremental:true,
    productId:'fatay',eligibleUnits:1,offerId:options.offerId,promotionId:options.offerId});
 });
 it('no permite fabricar la prueba ni eliminar productos de la cesta',async()=>{
  const challenge=await issueUpsellChallenge(options);
  for(const cart of [
    baseCart,
    [{productId:'fatay',qty:1}],
    [...baseCart,{productId:'fatay',qty:2}],
    [...baseCart,{productId:'fatay',qty:1},{productId:'baklava',qty:1}],
    [baseCart[0],{productId:'fatay',qty:1}],
    [baseCart[0],baseCart[0],{productId:'fatay',qty:1}]
  ])await expect(accepted(challenge,{acceptedCart:cart})).rejects.toThrow();
 });
 it('no acepta manipulaciones del token, caducidad, ni otro menú/método/sesión',async()=>{
  const challenge=await issueUpsellChallenge(options);
  const tampered=challenge.token.slice(0,-3)+'AAA';
  await expect(accepted(challenge,{token:tampered})).rejects.toThrow();
  await expect(accepted(challenge,{now:options.now+300001})).rejects.toThrow();
  await expect(accepted(challenge,{method:'mercadopago'})).rejects.toThrow();
  await expect(accepted(challenge,{sessionId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'})).rejects.toThrow();
  await expect(accepted(challenge,{menuRevision:'public-305'})).rejects.toThrow();
 });
 it('impide usar el reto en una compra distinta mediante el consumo atómico',async()=>{
  const challenge=await issueUpsellChallenge(options);const used=new Set();
  const consumeNonce=async({nonce})=>!used.has(nonce)&&!!used.add(nonce);
  expect((await accepted(challenge,{consumeNonce})).verified).toBe(true);
  await expect(accepted(challenge,{consumeNonce,requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}))
    .rejects.toThrow('upsell_token_already_used');
 });
 it('sin consumidor atómico no hay descuento autorizado',async()=>{
  const challenge=await issueUpsellChallenge(options);
  await expect(accepted(challenge,{consumeNonce:undefined})).rejects.toThrow('invalid_upsell_acceptance');
  await expect(accepted(challenge,{consumeNonce:async()=>false})).rejects.toThrow('upsell_token_already_used');
 });
 it('la tienda rechaza cualquier oferta si el complemento ya estaba incluido',async()=>{
  await expect(issueUpsellChallenge({...options,baseCart:acceptedCart})).rejects.toThrow('upsell_already_in_cart');
 });
});
