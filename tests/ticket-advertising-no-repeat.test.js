import {describe,it,expect} from 'vitest';
import {selectTicketAdvertisement} from '../src/core/ticket-advertising.js';
import {initialPromotionConfig} from '../src/core/promotions.js';
import {buildReceipt,newTicketAdvertisement} from '../src/ui/receipt-template.js';
import {receiptProfile} from '../src/ui/receipt-paper.js';
const order=()=>({num:245,source:'pickup',createdAt:'2026-11-02T16:30:00-03:00',
 items:[{productId:'fatay',name:'Fatay',qty:1,lineTotal:5850}],
 subtotal:5850,discountAmount:1170,total:4680,paymentMethod:'transferencia',
 promotionSnapshot:{subtotal:5850,discount:1170,netSubtotal:4680,appliedPromotionIds:['weekly-meals'],couponId:null,lines:[
  {productId:'fatay',qty:1,base:5850,paymentDiscount:0,promotionDiscount:1170,
   discount:1170,net:4680,appliedPromotionId:'weekly-meals',appliedPromotionType:'campaign'}
 ]}});
describe('SAHTEN ticket: no anunciar beneficios ya disfrutados',()=>{
 it('el cupón o campaña usada NO puede ocupar el recuadro publicitario',()=>{
  const o=order();
  for(const ad of [
   {kind:'campaign',campaignId:'weekly-meals',headline:'MISMA OFERTA'},
   {kind:'coupon',couponId:'weekly-meals',code:'CODIGO-GASTADO',expiresOn:'2026-12-01'}
  ]){
   o.promotionTicketSnapshot=ad;
   expect(newTicketAdvertisement(o)).toBeNull();
   const html=buildReceipt(o,{paper:receiptProfile(58)});
   expect(html).not.toContain('<section class="receipt-promo"');
   expect(html).not.toContain(ad.headline||ad.code);
   expect(html).toContain('Descuento aplicado');
   expect(html).not.toContain('receipt-saving-row');
  }
 });
 it('permite una campaña futura y DIFERENTE, sin repetir la usada',()=>{
  const cfg=initialPromotionConfig();cfg.enabled=true;cfg.ticket.enabled=true;
  cfg.campaigns[0].enabled=true;cfg.campaigns[0].advertising.enabled=true;
  cfg.campaigns[0].advertising.advanceDays=14;
  cfg.campaigns[1].enabled=true;cfg.campaigns[1].advertising.enabled=true;
  cfg.campaigns[1].advertising.advanceDays=14;
  const o=order();
  const ad=selectTicketAdvertisement(cfg,{now:new Date('2026-11-02T15:00:00-03:00'),
   order:o,channel:'mostrador'});
  expect(ad?.campaignId).not.toBe('weekly-meals');
  expect(ad?.campaignId).toBe('central-tables');
  o.promotionTicketSnapshot=ad;
  expect(buildReceipt(o,{paper:receiptProfile(58)})).toContain('<section class="receipt-promo"');
 });
 it('permite un cupón recién emitido para otra compra, NO reutiliza el gastado',()=>{
  const o=order();o.promotionSnapshot.couponId='old-code';
  const cfg=initialPromotionConfig();cfg.enabled=true;cfg.ticket.enabled=true;
  const reused=selectTicketAdvertisement(cfg,{order:o,coupon:{
   id:'old-code',status:'available',code:'SHT-OLD',expiresOn:'2026-12-01'
  }});
  expect(reused?.couponId).not.toBe('old-code');
  const ad=selectTicketAdvertisement(cfg,{order:o,coupon:{
   id:'new-code',status:'available',code:'SHT-NEW',expiresOn:'2026-12-01'
  }});
  expect(ad?.couponId).toBe('new-code');
  o.promotionTicketSnapshot=ad;
  const html=buildReceipt(o,{paper:receiptProfile(80)});
  expect(html).toContain('SHT-NEW');
  expect(html).toContain('PARA LA PRÓXIMA');
 });
 it('anuncio visual es compacto y el descuento del comprobante no se destaca',()=>{
  const o=order();o.promotionTicketSnapshot={
   kind:'campaign',campaignId:'different',headline:'Conocé las novedades'};
  const small=buildReceipt(o,{paper:receiptProfile(58)});
  const large=buildReceipt(o,{paper:receiptProfile(80)});
  expect(small).toContain('receipt-promo-title{font-size:13px');
  expect(large).toContain('receipt-promo-title{font-size:16px');
  expect(small).toContain('receipt-promo{border:1.4px solid #000');
  expect(small).not.toContain('border-left:3px solid #000');
  expect(small).toContain('Descuento aplicado · Fatay');
 });
});