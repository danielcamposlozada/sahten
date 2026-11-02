import {describe,it,expect} from 'vitest';
import {mergeCloudPromotions} from '../src/online/promotion-sync.js';
const local={project:{id:'local'},catalog:{productos:[{id:'x',price:20}]},sales:{orders:[{id:'sale'}]},costs:{secret:1},
 stock:{items:{x:9}},promotions:{version:1,enabled:true,campaigns:[],upsells:[]}};
const remote={promotions:{version:1,enabled:true,ticket:{enabled:true},campaigns:[{id:'camp',enabled:true}],upsells:[{id:'fatay',enabled:true}],
 couponPrograms:{first_online:{enabled:true}}},sales:{orders:[]},catalog:{productos:[]}};
describe('recuperación selectiva de promociones',()=>{
 it('no toca ventas/costos/catalogo/stock ni dispara publicación de descuentos',()=>{
  const m=mergeCloudPromotions(local,remote);
  expect(m.sales).toEqual(local.sales);expect(m.costs).toEqual(local.costs);
  expect(m.catalog).toEqual(local.catalog);expect(m.stock).toEqual(local.stock);
  expect(m.promotions.enabled).toBe(true);expect(m.promotions.ticket.enabled).toBe(true);
  expect(m.promotions.campaigns[0].enabled).toBe(true);
  expect(m.promotions.upsells[0].enabled).toBe(true);
  expect(m.promotions.couponPrograms.first_online.enabled).toBe(true);
  expect(remote.promotions.campaigns[0].enabled).toBe(true);
 });
 it('falla cerrado con datos remotos no válidos',()=>{
  expect(()=>mergeCloudPromotions(local,{})).toThrow('remote_promotions_invalid');
  expect(()=>mergeCloudPromotions(local,{promotions:{version:1,campaigns:[],upsells:null}})).toThrow('remote_promotions_invalid');
 });
});
