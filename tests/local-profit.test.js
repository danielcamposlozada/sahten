import {describe,it,expect} from 'vitest';
import {localMonthlyProfit,localProductProfitability,currentLocalMonth} from '../src/core/local-profit.js';
const order=(id,origin,status,createdAt='2026-11-01T15:00:00-03:00')=>({id,origin,status,createdAt});
const cost=(revenue,variable,fixed,commission=0)=>({basis:'at-sale',channel:'mostrador',items:[{revenue,variable,fixed,commission}]});
describe('barra de ganancia local del mes',()=>{
 it('incluye sólo pedidos completados de Mostrador y tienda propia en hora Argentina',()=>{
   const s={project:{localProfitGoal:20000},orders:[
     order('a','mostrador','retirado'),order('b','menu-online','entregado'),
     order('c','rappi','entregado'),order('d','mostrador','cancelado'),
     order('e','mostrador','pendiente'),order('f','mostrador','retirado','2026-10-31T23:00:00-03:00')],
     saleCosts:{a:cost(15000,4000,3000,500),b:cost(10000,2500,1200),c:cost(100000,100,100),d:cost(50000,1,1),e:cost(50000,1,1),f:cost(20000,1000,1000)}};
   const q=localMonthlyProfit(s,{month:'2026-11',now:new Date('2026-11-10T15:00:00-03:00')});
   expect(q.orders).toBe(2);expect(q.covered).toBe(2);
   expect(q.profit).toBe(13800);expect(q.progressPct).toBe(69);
 });
 it('no inventa rentabilidad de pedidos sin costos y avisa que el resultado es parcial',()=>{
   const s={project:{localProfitGoal:10000},orders:[order('a','mostrador','retirado'),order('x','menu-online','entregado')],saleCosts:{a:cost(10000,4000,1000)}};
   const q=localMonthlyProfit(s,{month:'2026-11'});
   expect(q.missing).toBe(1);expect(q.complete).toBe(false);
   expect(q.profit).toBe(5000);
 });
 it('no usa el ticket total como ingreso de productos ni resta el GF dos veces',()=>{
   const s={project:{},orders:[{...order('a','mostrador','retirado'),total:19000,shipping:9000}],saleCosts:{a:cost(10000,3000,1500)}};
   const q=localMonthlyProfit(s,{month:'2026-11'});expect(q.profit).toBe(5500);expect(q.goal).toBe(0);
   expect(q.progressPct).toBe(null);
 });
 it('agrupa por calendario Buenos Aires incluso si UTC está en otro mes',()=>{
   expect(currentLocalMonth(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10');
 });
});
describe('métricas de rentabilidad por producto',()=>{
 it('muestra monto y porcentaje después de costos + GF + comisión, conservando descuentos de pago separados',()=>{
   const s={products:[{id:'a',name:'Producto',pricingPolicies:{mostrador:{variableCost:3000,fixedCost:1000}}}],
     pricing:{channelPriceWithDisc:()=>10000},
     costPerUnit:()=>3000,gfAssigned:()=>1000,channelCommission:()=>0};
   const r=localProductProfitability(s)[0];
   expect(r.profit).toBe(6000);expect(r.marginPct).toBe(60);
   expect(r.cashProfit).toBe(5000);
 });
});
