import {it,expect,vi} from 'vitest';
import {createDeliveryService} from '../src/delivery/service.js';
import {sahtenDeliveryPolicy} from '../src/delivery/preset.js';

const storeId='00000000-0000-4000-8000-000000000001';
const requestId='00000000-0000-4000-8000-000000000002';
const couponId='00000000-0000-4000-8000-000000000003';
const validCode='SHT-ABCDEFGH';
const coupon={
 id:couponId,status:'available',channel:'online',program:'manual',name:'Cupón de prueba',
 expiresOn:'2027-01-01',extraPercent:2,minEligibleSubtotal:5000,
 productIds:['baklava'],maxExtraAmount:1000
};
function setup(){
 const policy={...sahtenDeliveryPolicy(),hours:{...sahtenDeliveryPolicy().hours,enabled:false},active:true};
 const menu={store:{currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true},
 products:[{id:'baklava',name:'Baklava',price:7350}],
 delivery:{deliveryV2:policy},payments:{methods:{efectivo:true,transferencia:true,mercadopago:true},
 benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
 promotions:{enabled:true,version:1,paymentPercent:10,campaigns:[],upsells:[]}};
 const orders=[],old=new Map();
 const repo={
  run:vi.fn(async(action,args)=>{
   if(action==='limit')return true;
   if(action==='submission')return old.get(args.request_id)||null;
   if(action==='order') {orders.push(args.payload);return {id:requestId,order:args.payload};}
   return null;
  }),
  menu:vi.fn(async()=>menu),
  lookupCoupon:vi.fn(async()=>coupon),
  promotionCosts:vi.fn(async()=>({baklava:3536.19})),
  confirmCouponOrder:vi.fn(async(sid,digest,rid,payload)=>{
   const saved={id:requestId,order:payload};old.set(rid,saved);orders.push(payload);return saved;
  }),
  posRules:vi.fn(async()=>({})),
  canManage:async()=>false,canOperate:async()=>false
 };
 const handler=createDeliveryService({repo,authenticate:async()=>null,
  now:()=>Date.parse('2026-11-02T16:00:00Z'),originKey:async()=> 'ip'});
 const input={source:'pickup',customerName:'Cliente',customerPhone:'1112223333',
  items:[{productId:'baklava',qty:1}],paymentMethod:'efectivo',total:6468};
 const call=async(action,order=input,couponCode=validCode,request=requestId)=>{
   const r=await handler(new Request('https://test.invalid/'+action,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({storeId,order,couponCode,requestId:request})
   }));return {status:r.status,data:await r.json()};
 };
 return {repo,call,orders,input,menu,old};
}
it('quote verifies coupon on server, then submits and redeems with one atomic call',async()=>{
 const s=setup();
 const quote=await s.call('quote');expect(quote.status,JSON.stringify(quote.data)).toBe(200);
 expect(quote.data.order.total).toBe(6468);
 expect(quote.data.order.promotionSnapshot.couponId).toBe(couponId);
 const result=await s.call('order');
 expect(result.status).toBe(200);
 expect(s.repo.confirmCouponOrder).toHaveBeenCalledTimes(1);
 const [sid,digest,rid,payload]=s.repo.confirmCouponOrder.mock.calls[0];
 expect(sid).toBe(storeId);expect(digest).toMatch(/^[0-9a-f]{64}$/);
 expect(rid).toBe(requestId);expect(payload.couponCodeDigest).toBe(digest);
 expect(payload.promotionSnapshot.couponId).toBe(couponId);
 expect(s.repo.run.mock.calls.filter(c=>c[0]==='order')).toHaveLength(0);
});
it('refuses coupon with client-forged total and does not reserve it',async()=>{
 const s=setup();
 const result=await s.call('order',{...s.input,total:1});
 expect(result.status).toBe(409);
 expect(s.repo.confirmCouponOrder).not.toHaveBeenCalled();
});
it('excludes Mercado Pago and operator coupon shortcuts',async()=>{
 const s=setup();
 const result=await s.call('order',{...s.input,paymentMethod:'mercadopago'});
 expect(result.status).not.toBe(200);
 expect(s.repo.lookupCoupon).not.toHaveBeenCalled();
});
it('retry with a different coupon or without the original coupon is a conflict',async()=>{
 const s=setup();{const first=await s.call('order');expect(first.status,JSON.stringify(first.data)).toBe(200);}
 const repeated=await s.call('order');expect(repeated.status).toBe(200);
 expect(s.repo.confirmCouponOrder).toHaveBeenCalledTimes(1);
 expect((await s.call('order',s.input,'SHT-BCDEFGHJ')).status).toBe(409);
 expect((await s.call('order',s.input,'')).status).toBe(409);
});
it('does not consume a coupon if the engine rejects its margin',async()=>{
 const s=setup();s.repo.promotionCosts=async()=>({baklava:5200});
 const r=await s.call('order');
 expect(r.status).toBe(409);
 expect(s.repo.confirmCouponOrder).not.toHaveBeenCalled();
});
