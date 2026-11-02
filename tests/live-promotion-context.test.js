import {describe,it,expect} from 'vitest';
import {campaignContext} from '../src/core/promotion-context.js';
import {ticketCampaignDetails} from '../src/core/live-promotion-catalog.js';
const now=new Date('2026-11-02T15:00:00-03:00');
const base={id:'dessert',name:'Postres',enabled:true,extraPercent:2,maxUnits:1,
  channels:['online'],productIds:['baklava','torta_de_chocolate'],
  advertising:{enabled:true,placement:['ticket','cart','checkout'],message:'12% en postres'},schedule:null};
describe('Todas las condiciones visibles de una campaña',()=>{
 it('postres permanentes: todos los días, sin vencimiento, 12% total y sin extra obligatorio',()=>{
  const c=campaignContext(base,{now,paymentPercent:10,productNames:{baklava:'Baklava',torta_de_chocolate:'Torta de chocolate'}});
  expect(c.scheduleText).toContain('Todos los días');
  expect(c.expiryText).toContain('Sin fecha de finalización');
  expect(c.discount).toBe('12% total (10% habitual + 2 puntos adicionales)');
  expect(c.methods).toContain('Efectivo o transferencia');
  expect(c.cap).toContain('Máximo 1 unidad');
  expect(c.extraRequirement).toContain('No exige agregar otro producto');
  expect(c.participating.map(x=>x.name)).toEqual(['Baklava','Torta de chocolate']);
  expect(ticketCampaignDetails(base).terms).toContain('Todos los días');
 });
 it('semanales y tablas informan días exactos, horarios y vencimientos',()=>{
  const weekly={...base,schedule:{type:'weekly',weekdays:[1,2,3],from:'2026-11-01',until:'2026-11-30',startTime:'12:00',endTime:'16:00'}};
  const c=campaignContext(weekly,{now});
  expect(c.scheduleText).toContain('Lunes, martes, miércoles');
  expect(c.hours).toBe('De 12:00 a 16:00');
  expect(c.until).toBe('30/11/2026');
  expect(ticketCampaignDetails(weekly).terms.join(' · ')).toContain('lun/mar/mié');
  const central={...base,schedule:{type:'central_weekends'}};
  expect(campaignContext(central,{now}).scheduleText).toContain('segundo y tercer viernes y sábado');
  expect(ticketCampaignDetails(central).terms.join(' ')).toContain('2.º y 3.º');
 });
});
