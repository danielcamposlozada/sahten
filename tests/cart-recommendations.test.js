import {describe,it,expect} from 'vitest';
import {recommendCartAddons} from '../src/core/cart-recommendations.js';

const products=[
 {id:'shawarma',name:'Shawarma',price:15800,category:'Platos'},
 {id:'table',name:'Tabla',price:38000,category:'Promos'},
 {id:'coke220',name:'Coca 220',price:1400,category:'Bebidas'},
 {id:'coke600',name:'Coca 600',price:2500,category:'Bebidas'},
 {id:'water',name:'Agua',price:2000,category:'Bebidas'},
 {id:'sprite',name:'Sprite 220',price:1400,category:'Bebidas'},
 {id:'baklava',name:'Baklava',price:7350,category:'Dulces'},
 {id:'mamul',name:'Mamul',price:7000,category:'Dulces'},
 {id:'hummus',name:'Hummus',price:9900,category:'Platos'}
];
const policy={
 enabled:true,
 beverageContexts:[
  {id:'shared',name:'Una bebida para compartir',priority:80,triggerProductIds:['table'],options:['coke600','water']},
  {id:'small',name:'Una lata con tu plato',priority:60,triggerProductIds:['shawarma'],maxEligibleSubtotal:19999,options:['coke220','sprite']},
  {id:'large',name:'Una botella con tu plato',priority:50,triggerProductIds:['shawarma'],minEligibleSubtotal:20000,options:['coke600','water']}
 ],
 complements:[
  {id:'sweet',name:'¿Algo dulce?',priority:60,productId:'baklava',triggerProductIds:['shawarma','table'],suppressIfPresent:[]},
  {id:'sweet2',name:'Otro dulce',priority:50,productId:'mamul',triggerProductIds:['shawarma','table']},
  {id:'side',name:'Para acompañar',priority:20,productId:'hummus',triggerProductIds:['shawarma'],suppressIfPresent:['table']}
 ]
};
const rec=(cart,options={})=>recommendCartAddons({products,cart,policy,...options});
describe('Sugerencias opcionales, pertinentes y sin descuentos',()=>{
 it('sin platos no sugiere nada: carrito vacío o exclusivamente bebidas',()=>{
  expect(rec([])).toEqual([]);
  expect(rec([{id:'coke220',qty:1}])).toEqual([]);
 });
 it('pedido individual: una lata y un dulce, máximo dos',()=>{
  expect(rec([{id:'shawarma',qty:1}]).map(x=>x.id)).toEqual(['coke220','baklava']);
 });
 it('pedido grande o tabla: una botella y un postre',()=>{
  expect(rec([{id:'shawarma',qty:2}]).map(x=>x.id)).toEqual(['coke600','baklava']);
  expect(rec([{id:'table',qty:1}]).map(x=>x.id)).toEqual(['coke600','baklava']);
 });
 it('si ya hay una bebida, no insiste con otra; si ya hay Baklava sugiere Mamul',()=>{
  expect(rec([{id:'shawarma',qty:1},{id:'water',qty:1}]).map(x=>x.id)).toEqual(['baklava']);
  expect(rec([{id:'shawarma',qty:1},{id:'baklava',qty:1}]).map(x=>x.id)).toEqual(['coke220','mamul']);
 });
 it('no ofrece artículos pausados, ocultos ni retirados',()=>{
  const items=products.map(p=>p.id==='coke220'?{...p,salesAvailability:{paused:true}}:p);
  expect(rec([{id:'shawarma',qty:1}],{products:items})[0].id).toBe('sprite');
  expect(rec([{id:'shawarma',qty:1}],{products:items.filter(p=>p.id!=='sprite')})[0].id).toBe('baklava');
 });
 it('no ofrece complementos excluidos y respeta control de apagado',()=>{
  expect(rec([{id:'shawarma',qty:1},{id:'table',qty:1}]).some(x=>x.id==='hummus')).toBe(false);
  expect(rec([{id:'shawarma',qty:1}],{policy:{enabled:false}})).toEqual([]);
  expect(rec([{id:'shawarma',qty:1}],{showPrices:false})).toEqual([]);
 });
 it('siempre devuelve precio de lista sin descuentos ni costos financieros',()=>{
  for(const item of rec([{id:'shawarma',qty:1}])) {
   expect(item.price).toBe(products.find(p=>p.id===item.id).price);
   expect(item).not.toHaveProperty('discount');
   expect(item).not.toHaveProperty('cost');
  }
 });
});
