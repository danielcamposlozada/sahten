import { describe,it,expect } from 'vitest';
import {buildPreference,paymentPreferenceItems,PaymentError} from '../src/payments/core.js';
const makeOrder=(parts={})=>({source:'pickup',paymentMethod:'mercadopago',
 items:[{productId:'fatay',name:'Fatay',qty:1,unitPrice:5850},
        {productId:'baklava',name:'Baklava',qty:1,unitPrice:7350}],
 subtotal:13200,discount:0,shipping:0,total:13200,...parts});
const makeCheckout=(order)=>({id:'11111111-1111-4111-8111-111111111111',
 store_id:'22222222-2222-4222-8222-222222222222',order});
const account={site_url:'https://sahten.online'};
const charged=rows=>Math.round(rows.reduce((n,x)=>n+x.unit_price*x.quantity,0)*100)/100;
const preference=order=>buildPreference(makeCheckout(order),account,'https://test.functions.supabase.co/functions/v1/sahten-payments',Date.parse('2026-11-01T14:00:00Z'));

describe('Mercado Pago cobra exactamente el total cotizado por servidor',()=>{
 it('sin promociones mantiene la estructura de productos original y el envío',()=>{
  const order=makeOrder({shipping:1500,total:14700});
  const p=preference(order);
  expect(charged(p.items)).toBe(14700);
  expect(p.items).toEqual([
   {id:'fatay',title:'Fatay',currency_id:'ARS',quantity:1,unit_price:5850},
   {id:'baklava',title:'Baklava',currency_id:'ARS',quantity:1,unit_price:7350},
   {id:'shipping',title:'Envío',currency_id:'ARS',quantity:1,unit_price:1500}]);
 });
 it('Fatay 20% TOTAL: Mercado Pago recibe $4.680, no $5.850',()=>{
  const order=makeOrder({discount:1170,total:12030,promotionSnapshot:{
    subtotal:13200,discount:1170,netSubtotal:12030,
    lines:[{productId:'fatay',qty:1,base:5850,discount:1170,net:4680},
           {productId:'baklava',qty:1,base:7350,discount:0,net:7350}]
  }});
  const p=preference(order);
  expect(charged(p.items)).toBe(12030);
  expect(p.items.find(x=>x.id==='fatay').unit_price).toBe(4680);
  expect(p.items.find(x=>x.id==='baklava').unit_price).toBe(7350);
 });
 it('Fatay 25 y 30% y Baklava 20%: cada línea respeta el neto del motor',()=>{
  for(const pct of [25,30]){
   const fatayNet=Math.round(5850*(100-pct))/100;
   const discount=13200-fatayNet-5880;
   const q=makeOrder({discount,total:13200-discount,
    promotionSnapshot:{subtotal:13200,discount,netSubtotal:13200-discount,
      lines:[{productId:'fatay',qty:1,base:5850,discount:5850-fatayNet,net:fatayNet},
       {productId:'baklava',qty:1,base:7350,discount:1470,net:5880}]}});
   const items=paymentPreferenceItems(q);
   expect(charged(items)).toBe(q.total);
   expect(items.find(x=>x.id==='fatay').unit_price).toBe(fatayNet);
   expect(items.find(x=>x.id==='baklava').unit_price).toBe(5880);
  }
 });
 it('redondeos de centavos: dos grupos de precio por SKU sin centavos perdidos',()=>{
  const order=makeOrder({items:[{productId:'mamul',name:'Mamul',qty:3,unitPrice:7000}],
    subtotal:21000,discount:1.01,total:20998.99,
    promotionSnapshot:{subtotal:21000,discount:1.01,netSubtotal:20998.99,
      lines:[{productId:'mamul',qty:3,base:21000,discount:1.01,net:20998.99}]}});
  const items=paymentPreferenceItems(order);
  expect(items).toHaveLength(2);
  expect(items.every(x=>x.id==='mamul')).toBe(true);
  expect(items.reduce((n,x)=>n+x.quantity,0)).toBe(3);
  expect(charged(items)).toBe(20998.99);
 });
 it('un descuento sin desglose también se reparte y cierra exactamente',()=>{
  const q=makeOrder({discount:150.01,shipping:1250,total:14299.99});
  const result=paymentPreferenceItems(q);
  expect(charged(result)).toBe(14299.99);
  expect(result.filter(x=>x.id!=='shipping').every(x=>x.unit_price>0)).toBe(true);
 });
 it('un producto 100% bonificado no se cobra a precio de lista',()=>{
  const q=makeOrder({discount:5850,total:7350,
   promotionSnapshot:{subtotal:13200,discount:5850,netSubtotal:7350,
    lines:[{productId:'fatay',qty:1,base:5850,discount:5850,net:0},
     {productId:'baklava',qty:1,base:7350,discount:0,net:7350}]}});
  const result=paymentPreferenceItems(q);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('baklava');
  expect(charged(result)).toBe(7350);
 });
 it('bloquea pedidos manipulados, descuentos no conciliados o snapshots de otro producto',()=>{
  const standard=makeOrder();
  for(const tampered of [
   {...standard,total:12500},
   {...standard,subtotal:13000},
   {...standard,discount:500,total:13200},
   {...standard,promotionSnapshot:{subtotal:13200,discount:200,netSubtotal:13000,lines:[]}},
   {...standard,promotionSnapshot:{subtotal:13200,discount:0,netSubtotal:13200,
     lines:[{productId:'fatay',qty:1,base:5850,discount:0,net:5850},
            {productId:'fatay',qty:1,base:7350,discount:0,net:7350}]}}
  ]){
   expect(()=>paymentPreferenceItems(tampered)).toThrow(PaymentError);
  }
 });
});
