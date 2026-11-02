import {describe,it,expect} from 'vitest';
import { selectTicketAdvertisement } from '../src/core/ticket-advertising.js';
import { buildReceipt,buildKitchenReceipt } from '../src/ui/receipt-template.js';
import { receiptProfile } from '../src/ui/receipt-paper.js';

const desserts={id:'postres-extra-online-nov26',kind:'public',enabled:true,
  name:'Postres seleccionados · 12% con efectivo o transferencia',channels:['online'],
  schedule:null,extraPercent:2,maxUnits:1,productIds:['baklava','torta_de_chocolate'],
  advertising:{enabled:true,placement:['ticket'],message:
    'En tu próxima compra online: Baklava o torta con 12% total al pagar en efectivo o transferencia.'}};
describe('Claridad comercial en el ticket térmico compacto',()=>{
 it('explica beneficio 12% total, una unidad, medio de pago y falta de fecha fin sin inventar vencimiento',()=>{
   const ad=selectTicketAdvertisement({enabled:true,ticket:{enabled:true,advertise:true},campaigns:[desserts]},
    {now:new Date('2026-11-02T16:00:00Z'),channel:'online',rotationKey:1});
   expect(ad).toMatchObject({kind:'campaign',layout:'B',campaignId:desserts.id,
     expiry:'Sin fecha de fin programada'});
   expect(ad.headline).toContain('Baklava o torta con 12% total');
   expect(ad.headline).not.toContain('En tu próxima compra online:');
   expect(ad.terms).toContain('Hasta 1 unidad participante');
   expect(ad.terms).toContain('Efectivo o transferencia');
   const order={num:11,items:[],source:'pickup',createdAt:'2026-11-02T16:00:00Z',
     subtotal:10000,total:10000,promotionTicketSnapshot:ad};
   const html=buildReceipt(order,{paper:receiptProfile(58)});
   expect(html).toContain('receipt-promo--B');
   expect(html).toContain('Sin fecha de fin programada');
   expect(html).toContain('Hasta 1 unidad participante');
   expect(html).toContain('font-size:12px');
   expect(html).not.toContain('Se aplica según los días, productos y medios');
   expect(buildKitchenReceipt(order,{paper:receiptProfile(58)})).not.toContain('receipt-promo--B');
 });
 it('una campaña general usada se puede volver a anunciar durante la misma semana',()=>{
   const weekly={...desserts,id:'weekly-meals',schedule:{type:'weekly',weekdays:[1,2,3]},
     advertising:{...desserts.advertising,message:'Hasta 15% en platos seleccionados'}};
   const ad=selectTicketAdvertisement({enabled:true,ticket:{enabled:true,advertise:true},campaigns:[weekly]},
    {now:new Date('2026-11-02T16:00:00Z'),channel:'online',excludedPromotionIds:['weekly-meals']});
   expect(ad.startsOn).toBeUndefined();
   expect(ad.repeatPurchase).toBe(true);
   expect(ad.expiry).toBe('Sin fecha de fin programada');
 });
 it('el ticket muestra el ahorro YA APLICADO y vuelve a publicitar la misma oferta para el próximo pedido',()=>{
   const now=new Date('2026-11-02T16:00:00Z');
   const ad=selectTicketAdvertisement({
     enabled:true,ticket:{enabled:true,advertise:true},campaigns:[desserts]},
     {now,channel:'any',appliedPromotionIds:['postres-extra-online-nov26']});
   expect(ad).toMatchObject({repeatPurchase:true,campaignId:'postres-extra-online-nov26'});
   const receipt=buildReceipt({
     num:99,source:'pickup',createdAt:now.toISOString(),discountAmount:1200,subtotal:10000,total:8800,
     items:[{productId:'baklava',name:'Baklava',qty:1,lineTotal:10000}],
     promotionSnapshot:{subtotal:10000,discount:1200,netSubtotal:8800,paymentPercent:10,
       lines:[{productId:'baklava',qty:1,base:10000,paymentDiscount:1000,
         promotionDiscount:200,discount:1200,net:8800,appliedPromotionType:'campaign'}]},
     promotionTicketSnapshot:ad
   },{paper:receiptProfile(58)});
   expect(receipt).toContain('Beneficio por pago 10 %');
   expect(receipt).toContain('Promo: Baklava');
   expect(receipt).toContain('VOLVÉ A APROVECHAR');
   expect(receipt).toContain('Solo online');
   expect(receipt).toContain('sahten.online');
   expect((receipt.match(/class="receipt-promo receipt-promo--B"/g)||[])).toHaveLength(1);
 });
});
