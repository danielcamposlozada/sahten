import {it,expect,vi} from 'vitest';
import {createDeliveryService} from '../src/delivery/service.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';

const sid='b0a7ce44-8833-4a55-bb11-2c774daa3151';
const reqId='397e3c7f-d0a3-4b6a-b89a-a384d920d771';
const build=()=>{
 const policy=sahtenDeliveryPolicy();policy.active=true;policy.hours.enabled=false;
 const menu={store:{currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true},
  delivery:{deliveryV2:policy},
  payments:{methods:{efectivo:true,transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
  products:[{id:'shawarma_pollo',name:'Shawarma',price:16000},{id:'fatay',name:'Fatay',price:5850}],
  promotions:{enabled:false,upsellGuardRequired:true,campaigns:[],upsells:[{
    id:'fatay-up',kind:'upsell',enabled:false,maxUnits:1,productIds:['fatay'],
    triggerProductIds:['shawarma_pollo'],suppressIfPresent:[],extraPercent:10
  }]}
 };
 const repo={menu:vi.fn(async()=>menu),
  run:vi.fn(async action=>action==='limit'?true:null),
  upsellEconomics:vi.fn(async()=>({verified:false})),
  issueUpsellIntent:vi.fn(async()=>null),
  readUpsellIntent:vi.fn(async()=>null),
  redeemUpsellIntent:vi.fn(async()=>null)};
 const handler=createDeliveryService({repo,authenticate:async()=>null,
   resolveRoute:async()=>null,geocode:async()=>[],originKey:async()=> 'safe-client'});
 const order={source:'pickup',paymentMethod:'transferencia',
   items:[{productId:'shawarma_pollo',qty:2}],total:28800};
 const call=async(action,content={})=>{
   const r=await handler(new Request('https://example.test/'+action,{method:'POST',
     headers:{'Content-Type':'application/json'},body:JSON.stringify({storeId:sid,order,...content})}));
   return {status:r.status,data:await r.json()};
 };
 return {repo,menu,order,call};
};
it('motor de descuentos apagado: no se puede pedir ni usar tokens',async()=>{
 const a=build();
 const offer=await a.call('offer',{productId:'fatay',promotionId:'fatay-up'});
 expect(offer.status).toBe(409);
 const order=await a.call('order',{requestId:reqId,
    order:{...a.order,items:[...a.order.items,{productId:'fatay',qty:1}],
      upsellIntentId:'4d125b6a-fb84-4cd9-ae72-4efa1dab7e04',total:34065}});
 expect(order.status).toBe(409);
 expect(a.repo.issueUpsellIntent).not.toHaveBeenCalled();
 expect(a.repo.redeemUpsellIntent).not.toHaveBeenCalled();
 expect(a.repo.run.mock.calls.some(x=>x[0]==='order')).toBe(false);
});
it('la cotización normal de retiro sigue usando el 10% sin promociones',async()=>{
 const a=build();const q=await a.call('quote');
 expect(q.status).toBe(200);
 expect(q.data.order).toMatchObject({subtotal:32000,discount:3200,total:28800});
 expect(a.repo.issueUpsellIntent).not.toHaveBeenCalled();
});
it('con motor habilitado pero costos no revisados, no emite ni canjea ofertas',async()=>{
 const a=build();
 a.menu.promotions.enabled=true;a.menu.promotions.upsells[0].enabled=true;
 const offer=await a.call('offer',{productId:'fatay',promotionId:'fatay-up'});
 expect(offer.status).toBe(409);
 expect(a.repo.upsellEconomics).toHaveBeenCalledTimes(1);
 expect(a.repo.issueUpsellIntent).not.toHaveBeenCalled();
 expect(a.repo.redeemUpsellIntent).not.toHaveBeenCalled();
});
