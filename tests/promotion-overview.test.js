import {describe,it,expect} from 'vitest';
import {promotionOverview,filterPromotionOverview} from '../src/core/promotion-overview.js';
const now=new Date('2026-11-02T12:00:00-03:00');
const config={enabled:false,campaigns:[{id:'weekly-meals',name:'Platos',enabled:false,extraPercent:5,schedule:{type:'weekly',weekdays:[1,2,3]}}],
 upsells:[{id:'fatay',name:'Fatay',enabled:false,discountTiers:[{minEligibleNetSubtotal:20000,totalDiscountPercent:20}]}],
 crossSells:[{id:'hummus',enabled:false}],productUpgrades:[{id:'upgrade',enabled:false}],
 couponPrograms:{first_online:{name:'Bienvenida',enabled:false,extraPercent:5,minEligibleSubtotal:30000}}};
describe('grilla de promociones sin falso estado comercial',()=>{
 it('incluye campañas, complementos, sugerencias, mejoras y cupones',()=>{
  const o=promotionOverview(config,{now});
  expect(o.items).toHaveLength(5);expect(o.active).toBe(0);
  expect(o.items.find(x=>x.id==='fatay').detail).toContain('20% total');
  expect(filterPromotionOverview(o.items,'inactive')).toHaveLength(5);
 });
 it('no afirma que esté activa una campaña por el solo flag local',()=>{
  const c={...config,enabled:true,campaigns:[{...config.campaigns[0],enabled:true}]};
  expect(promotionOverview(c,{now}).active).toBe(0);
  expect(promotionOverview(c,{now,live:{published:false,campaigns:[{id:'weekly-meals',enabled:true}]}}).active).toBe(0);
  expect(promotionOverview(c,{now,live:{published:true,campaigns:[{id:'weekly-meals',enabled:true}]}}).active).toBe(1);
 });
 it('distingue campaña programada fuera de calendario',()=>{
  const c={...config,enabled:true,campaigns:[{...config.campaigns[0],enabled:true,schedule:{type:'weekly',weekdays:[5]}}]};
  const o=promotionOverview(c,{now,live:{published:true,campaigns:[{id:'weekly-meals',enabled:true}]}});
  expect(o.active).toBe(0);expect(o.pending).toBe(1);expect(o.items[0].status).toBe('scheduled');
 });
 it('ningún cupón figura activo sin emisión real verificada',()=>{
  const c={...config,enabled:true,couponPrograms:{first_online:{...config.couponPrograms.first_online,enabled:true}}};
  expect(promotionOverview(c,{now}).items.at(-1).status).toBe('pending');
 });
});
