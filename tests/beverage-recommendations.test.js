import {describe,it,expect} from 'vitest';
import {recommendBeverage} from '../src/core/beverage-recommendations.js';
const p=(id,name,price,category='Bebidas')=>({id,name,price,category});
const menu=[p('sandwich','Sandwich',15800,'Sandwich'),p('tabla','Tabla',38000,'Promos'),
  p('lata','Coca 220',1400),p('botella','Coca 600',2500),p('agua','Agua 600',2000),
  p('sprite','Sprite 220',1400)];
const policy={enabled:true,options:[{id:'lata'},{id:'botella'},{id:'agua'},{id:'sprite'}],
  contexts:[
    {id:'mesa',priority:100,triggerProductIds:['tabla'],options:['botella','agua']},
    {id:'pedido_chico',priority:50,triggerProductIds:['sandwich'],maxEligibleSubtotal:19999,options:['lata','sprite']},
    {id:'plato',priority:30,triggerProductIds:['sandwich'],minEligibleSubtotal:20000,options:['botella','agua']}
  ]};
describe('recomendaciones de bebidas por contexto y disponibilidad',()=>{
 it('no oferta indiscriminadamente a un carrito vacío o a quien compra solo bebida',()=>{
   expect(recommendBeverage({products:menu,cart:[],policy})).toBe(null);
   expect(recommendBeverage({products:menu,cart:[{id:'agua',qty:1}],policy})).toBe(null);
 });
 it('sugiere latita para un sándwich individual; botella para una tabla',()=>{
   expect(recommendBeverage({products:menu,cart:[{id:'sandwich',qty:1}],policy})).toMatchObject({id:'lata',extraDiscountPercent:0});
   expect(recommendBeverage({products:menu,cart:[{id:'tabla',qty:1}],policy})).toMatchObject({id:'botella',extraDiscountPercent:0});
 });
 it('cambia a botella si el pedido de sándwiches supera $20k',()=>{
   expect(recommendBeverage({products:menu,cart:[{id:'sandwich',qty:2}],policy})).toMatchObject({id:'botella'});
 });
 it('no ofrece otra bebida si ya agregó una',()=>{
   expect(recommendBeverage({products:menu,cart:[{id:'sandwich',qty:1},{id:'agua',qty:1}],policy})).toBe(null);
 });
 it('no ofrece producto pausado, oculto o no publicado y usa una alternativa adecuada',()=>{
   const rows=menu.map(x=>x.id==='lata'?{...x,salesAvailability:{paused:true}}:x);
   expect(recommendBeverage({products:rows,cart:[{id:'sandwich',qty:1}],policy})).toMatchObject({id:'sprite'});
   expect(recommendBeverage({products:rows.filter(x=>x.id!=='sprite'),cart:[{id:'sandwich',qty:1}],policy})).toBe(null);
 });
 it('no cobra un descuento adicional y respeta apagado comercial',()=>{
   const rec=recommendBeverage({products:menu,cart:[{id:'tabla',qty:1}],policy});
   expect(rec.price).toBe(2500);
   expect(rec.extraDiscountPercent).toBe(0);
   expect(recommendBeverage({products:menu,cart:[{id:'tabla',qty:1}],policy:{...policy,enabled:false}})).toBe(null);
 });
});