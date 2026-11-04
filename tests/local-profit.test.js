import {describe,it,expect} from 'vitest';
import {localMonthlyProfit,localProductProfitability,currentLocalMonth,monthlyGoal,setMonthlyGoal,monthlyGoalHistory} from '../src/core/local-profit.js';
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

describe('historial de metas locales por mes',()=>{
 it('guardar noviembre no cambia octubre ni diciembre',()=>{
   const s={project:{},orders:[],saleCosts:{}},now=new Date('2026-11-01T15:00:00-03:00');
   expect(setMonthlyGoal(s,{month:'2026-10',amount:10000,now})).toBe(true);
   expect(setMonthlyGoal(s,{month:'2026-11',amount:25000,now})).toBe(true);
   expect(monthlyGoal(s,'2026-10',now)).toBe(10000);
   expect(monthlyGoal(s,'2026-11',now)).toBe(25000);
   expect(monthlyGoal(s,'2026-12',now)).toBe(null);
   expect(localMonthlyProfit(s,{month:'2026-10',now}).goal).toBe(10000);
   expect(localMonthlyProfit(s,{month:'2026-11',now}).goal).toBe(25000);
   expect(s.project.localProfitGoalChanges.length).toBe(2);
 });
 it('una modificación registra el valor anterior y conserva metas de otros meses',()=>{
   const s={project:{},orders:[]},now=new Date('2026-11-12T18:00:00-03:00');
   setMonthlyGoal(s,{month:'2026-10',amount:10000,now});
   setMonthlyGoal(s,{month:'2026-11',amount:20000,now});
   expect(setMonthlyGoal(s,{month:'2026-11',amount:23000,now})).toBe(true);
   expect(monthlyGoal(s,'2026-11',now)).toBe(23000);
   expect(monthlyGoal(s,'2026-10',now)).toBe(10000);
   expect(s.project.localProfitGoalChanges[2].before).toBe(20000);
   expect(s.project.localProfitGoalChanges[2].after).toBe(23000);
   expect(monthlyGoalHistory(s,{now,count:2}).length).toBe(2);
 });
 it('meta antigua global no se repite retroactivamente y se migra al mes actual',()=>{
   const s={project:{localProfitGoal:35000},orders:[]},now=new Date('2026-11-11T13:00:00-03:00');
   expect(monthlyGoal(s,'2026-10',now)).toBe(null);
   expect(monthlyGoal(s,'2026-11',now)).toBe(35000);
   expect(setMonthlyGoal(s,{month:'2026-11',amount:35000,now})).toBe(true);
   expect(s.project.localProfitGoals['2026-11']).toBe(35000);
   expect(monthlyGoal(s,'2026-12',now)).toBe(null);
 });
 it('conserva meta antigua de noviembre aunque primero se edite octubre',()=>{
   const s={project:{localProfitGoal:35000},orders:[]},now=new Date('2026-11-11T13:00:00-03:00');
   expect(setMonthlyGoal(s,{month:'2026-10',amount:20000,now})).toBe(true);
   expect(monthlyGoal(s,'2026-10',now)).toBe(20000);
   expect(monthlyGoal(s,'2026-11',now)).toBe(35000);
 });
 it('meta del mes anterior se conserva cuando comienza el siguiente',()=>{
   const s={project:{},orders:[]};
   const nov=new Date('2026-11-11T13:00:00-03:00');
   setMonthlyGoal(s,{month:'2026-11',amount:40000,now:nov});
   expect(monthlyGoal(s,'2026-11',new Date('2026-12-03T13:00:00-03:00'))).toBe(40000);
   expect(monthlyGoal(s,'2026-12',new Date('2026-12-03T13:00:00-03:00'))).toBe(null);
 });
 it('no acepta metas inválidas',()=>{
   const s={project:{},orders:[]};
   expect(()=>setMonthlyGoal(s,{month:'2026-13',amount:1000})).toThrow();
   expect(()=>setMonthlyGoal(s,{month:'2026-11',amount:-1})).toThrow();
 });
});

it('una venta con adicionales pendientes permanece provisional aunque los costos base estén capturados',()=>{
 const original={...order('pending','menu-online','retirado'),promotionSnapshot:{costReview:{status:'provisional',auditId:'historical-review'}}};
 const s={project:{},orders:[original],saleCosts:{pending:cost(10000,3000,1000)}};
 const result=localMonthlyProfit(s,{month:'2026-11'});
 expect(result.provisional).toBe(1);expect(result.complete).toBe(false);expect(result.profit).toBe(6000);
 expect(original.promotionSnapshot.costReview.auditId).toBe('historical-review');
});
