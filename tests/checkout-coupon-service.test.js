import {it,expect,vi} from 'vitest';
import {createPaymentService} from '../src/payments/service.js';
import {sha256} from '../src/payments/core.js';
const sid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-000000000002',rid='00000000-0000-4000-8000-000000000003',cid='00000000-0000-4000-8000-000000000004';
const code='SHT-ABCDEFGHJKLMNPQR',proof='a'.repeat(64),now=Date.parse('2026-11-05T16:00:00Z');
function fixture(){
 let checkout=null;const provider=[],actions=[];
 const account={id:aid,store_id:sid,mode:'production',account_id:'123',site_url:'https://fixture.invalid',credentials:{accessToken:'FAKE-ONLY',webhookSecret:'FAKE-ONLY'}};
 const coupon={ok:true,id:cid,status:'available',channel:'online',expiresOn:'2099-01-01',extraPercent:10,totalPercent:20,productIds:['x'],mercadopago:{enabled:true,totalPercent:5,minEligibleSubtotal:0,maxExtraAmount:null}};
 const repo={menu:vi.fn(async()=>({products:[{id:'x',name:'Ficticio',price:10000}],promotions:{enabled:true,commercialPolicy:{minMarginPct:40,maxTotalPercent:25,mercadopagoFeePercent:10,mercadopagoFeeProvisional:true}}})),promotionCosts:async()=>({x:3000}),lookupCoupon:vi.fn(async()=>coupon),findCheckout:vi.fn(async()=>null),releaseCoupon:vi.fn(async()=>({released:true})),run:vi.fn(async(action,args)=>{
  actions.push([action,args]);if(action==='limit')return true;if(['account','secrets'].includes(action))return account;
  if(action==='reserve'){checkout={...args,id:rid,store_id:sid,account_id:aid,mode:'production',order:args.order,payment_status:'pending',attempts:1,expires_at:new Date(now+1800000).toISOString()};return checkout;}
  if(action==='checkout')return checkout;return {};
 })};
 const fetchImpl=vi.fn(async(url,opts)=>{provider.push([url,opts]);return Response.json({id:'fake-pref',init_point:'https://www.mercadopago.com.ar/checkout/fake'});});
 const handler=createPaymentService({repo,authenticate:async()=>null,fetchImpl,endpoint:'https://backend.invalid',now:()=>now});
 const order={source:'pickup',items:[{id:'x',qty:1}],customerName:'Ficticio',customerPhone:'1123456789',total:9500};
 const send=(overrides={})=>handler(new Request('https://backend.invalid/checkout',{method:'POST',headers:{origin:account.site_url},body:JSON.stringify({storeId:sid,requestId:rid,proof,order,couponCode:code,...overrides})}));
 return {repo,provider,fetchImpl,send,order,actions,coupon,getCheckout:()=>checkout};
}
it('sends the discounted final amount to Mercado Pago after validating a Sahten coupon',async()=>{
 const f=fixture();expect((await f.send()).status).toBe(200);
 const pref=JSON.parse(f.provider[0][1].body);expect(pref.items.reduce((n,i)=>n+i.unit_price*i.quantity,0)).toBe(9500);
 expect(JSON.stringify(pref)).not.toContain('FAKE-ONLY');expect(JSON.stringify(pref)).not.toContain(code);
 expect(f.repo.lookupCoupon).toHaveBeenCalledWith(sid,await sha256(code),'1123456789',rid);
 expect(f.getCheckout().order.promotionSnapshot).toMatchObject({discount:500,paymentPercent:0,couponId:cid});
 expect(f.repo.releaseCoupon).not.toHaveBeenCalled();
});
it('ignores client-supplied coupon terms and refuses an unsupported payment-method coupon',async()=>{
 const f=fixture();f.coupon.mercadopago.enabled=false;
 const response=await f.send({order:{...f.order,coupon:{discount:9999,totalPercent:99}}});
 expect(response.status).toBe(409);expect(f.provider).toHaveLength(0);expect(f.actions.some(([a])=>a==='reserve')).toBe(false);
});
it('a provider timeout releases only the worker lease, preserving the coupon payment hold',async()=>{
 const f=fixture();f.fetchImpl.mockRejectedValue(Error('Timeout'));
 expect((await f.send()).status).toBe(502);expect(f.actions.some(([a])=>a==='release')).toBe(true);expect(f.repo.releaseCoupon).not.toHaveBeenCalled();
});
it('a retry with the same proof reuses the stored quote even if catalog costs changed',async()=>{
 const f=fixture();await f.send();const previous={...f.getCheckout(),checkout_url:'https://www.mercadopago.com.ar/checkout/fake'};
 f.repo.findCheckout.mockResolvedValue(previous);f.repo.menu.mockRejectedValue(Error('Catalog changed'));
 expect((await f.send()).status).toBe(200);expect(f.repo.menu).toHaveBeenCalledTimes(1);expect(f.provider).toHaveLength(1);
 const altered=await f.send({order:{...f.order,total:1}});expect(altered.status).toBe(409);
});
