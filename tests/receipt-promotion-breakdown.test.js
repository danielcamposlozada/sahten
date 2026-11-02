import {describe,it,expect} from 'vitest';
import {buildReceipt,receiptDiscountLines} from '../src/ui/receipt-template.js';
const sale=(extras={})=>{
 const items=[
 {productId:'main',name:'Arabe Clásico',qty:1,lineTotal:18250},
 {productId:'fatay',name:'Fatay',qty:1,lineTotal:5850}
 ];
 return {num:23,source:'pickup',createdAt:'2026-11-01T18:00:00-03:00',
   paymentMethod:'transferencia',items,subtotal:24100,discount:3580,discountAmount:3580,
   total:20520,discountName:'Promociones y beneficios',
   promotionSnapshot:{paymentPercent:10,subtotal:24100,discount:3580,netSubtotal:20520,
    lines:[
      {productId:'main',qty:1,base:18250,paymentDiscount:1825,promotionDiscount:0,discount:1825,net:16425},
      {productId:'fatay',qty:1,base:5850,paymentDiscount:585,promotionDiscount:1170,discount:1755,net:4095,appliedPromotionType:'upsell'}
    ]},...extras};
};
const html=order=>buildReceipt(order,{paper:{contentMm:72,pageSize:'auto'}});
describe('Tickets con importes conciliados',()=>{
 it('desglosa beneficio por pago y Fatay sin inventar ni acumular descuento',()=>{
  const r=sale();const parsed=receiptDiscountLines(r);const rendered=html(r);
  expect(parsed).toEqual({paymentAmount:2410,extras:[{productId:'fatay',name:'Fatay',amount:1170,kind:'upsell'}]});
  expect(rendered).toContain('Beneficio por pago 10 %');
  expect(rendered).toContain('Descuento aplicado · Fatay');
  expect(rendered).toContain('−$2.410');
  expect(rendered).toContain('−$1.170');
  expect(rendered).toContain('$20.520');
  expect(rendered).not.toContain('−$3.580');
 });
 it('desglosa Baklava en delivery y mantiene el flete, sin duplicarlo',()=>{
  const r=sale({source:'delivery',address:'Calle ficticia 100',shipping:2500,total:23020});
  expect(html(r)).toContain('Envío');
  expect(html(r)).toContain('$2.500');
  expect(html(r)).toContain('$23.020');
 });
 it('una cotización manipulada cae al descuento total original sin inventar líneas',()=>{
  const r=sale();r.promotionSnapshot.lines[1].promotionDiscount=1800;
  expect(receiptDiscountLines(r)).toBeNull();
  expect(html(r)).toContain('Promociones y beneficios');
  expect(html(r)).toContain('−$3.580');
  expect(html(r)).not.toContain('Descuento aplicado · Fatay');
 });
 it('no muestra desglose de promociones cuando no hay snapshot del servidor',()=>{
  const r=sale();delete r.promotionSnapshot;
  expect(receiptDiscountLines(r)).toBeNull();
  expect(html(r)).toContain('−$3.580');
 });
 it('escapa etiquetas peligrosas y no ejecuta valores del pedido',()=>{
  const r=sale();
  r.items[1].name='<script>alert(1)</script>';
  const x=html(r);
  expect(x).not.toContain('<script>');
  expect(x).toContain('&lt;script&gt;');
 });
});

describe('Promoción visual de ticket térmico',()=>{
 it('imprime un bloque publicitario legible en 58 y 80 mm y separa el ahorro en la cuenta',()=>{
   for(const width of [48,72]){
     const order=sale({promotionTicketSnapshot:{kind:'campaign',campaignId:'proxima-campana-diferente',headline:'Compartí más, disfrutá más',startsOn:'2026-11-07'}});
     const doc=buildReceipt(order,{paper:{contentMm:width,pageSize:'auto'}});
     expect(doc).toContain('receipt-promo-eyebrow');
     expect(doc).toContain('NOVEDADES SAHTEN');
     expect(doc).toContain('Compartí más, disfrutá más');
     expect(doc).toContain('DESDE EL 07/11/2026');
     expect(doc).not.toContain('receipt-saving-row');
     expect(doc).toContain('$20.520');
     expect(doc).toMatch(/receipt-promo\{border:1\.4px solid #000/);
   }
 });
 it('prioriza el código de cupón confirmado con etiqueta propia y llamada a la acción',()=>{
   const doc=html(sale({promotionTicketSnapshot:{kind:'coupon',couponId:'new-reward-1',expiresOn:'2026-11-14',headline:'Volvé por más',code:'SAH-TICKET-EXAMPLE',label:'Válido según condiciones'}}));
   expect(doc).toContain('PARA LA PRÓXIMA');
   expect(doc).toContain('CÓDIGO PARA TU PRÓXIMA COMPRA');
   expect(doc).toContain('SAH-TICKET-EXAMPLE');
   expect(doc).toContain('SAHTEN.ONLINE');
   expect(doc).toContain('Válido según condiciones');
 });
 it('omite cupones sin código y escapa el contenido promocional',()=>{
   expect(html(sale({promotionTicketSnapshot:{kind:'coupon',headline:'Oferta sin código'}}))).not.toContain('receipt-promo-eyebrow">TU');
   const doc=html(sale({promotionTicketSnapshot:{kind:'coupon',couponId:'new-reward-2',expiresOn:'2026-11-14',headline:'<script>alert(1)</script>',code:'X<&Y'}}));
   expect(doc).not.toContain('<script>');
   expect(doc).toContain('&lt;script&gt;');
   expect(doc).toContain('X&lt;&amp;Y');
 });
});
