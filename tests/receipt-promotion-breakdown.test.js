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
  expect(rendered).toContain('Complemento: Fatay');
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
  expect(html(r)).not.toContain('Complemento: Fatay');
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

it('a real issued coupon appears before the review QR with full terms on 48 and 58 mm',()=>{
 for(const contentMm of [40,48]){
  const r=sale({promotionTicketSnapshot:{kind:'coupon',code:'SHT-ABCDEFGHJKLMNPQR',expiresOn:'2099-01-01',headline:'Tu segunda compra',terms:'Solo online. Mínimo $40.000. Tope adicional $4.000. Un uso por teléfono.'}});
  const output=buildReceipt(r,{paper:{contentMm},reviewHtml:'<section>GOOGLE REVIEW</section>'});
  expect(output.indexOf('SHT-ABCDEFGHJKLMNPQR')).toBeLessThan(output.indexOf('GOOGLE REVIEW'));
  expect(output).toContain('Tope adicional $4.000');expect(output).toContain('width: '+contentMm+'mm');
  r.promotionTicketSnapshot.invalidated=true;expect(buildReceipt(r,{paper:{contentMm}})).not.toContain('SHT-ABCDEFGHJKLMNPQR');
 }
});
