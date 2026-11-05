import {it,expect} from 'vitest';
import {promotionRule,promotionHeadroom,validatePromotionPolicy} from '../src/core/promotion-policy.js';
import {quotePromotions} from '../src/core/promotions.js';
import {promotionReport} from '../src/core/promotions-report.js';
it('resolves explicit product rule, campaign rule and global default without truthiness errors for zero',()=>{
 const config={commercialPolicy:{minMarginPct:35,maxTotalPercent:25,products:{x:{minMarginPct:0,maxTotalPercent:30}}}};
 expect(promotionRule(config,'x',{minMarginPct:45})).toMatchObject({minMarginPct:0,maxTotalPercent:30});
 expect(promotionRule(config,'y',{minMarginPct:45}).minMarginPct).toBe(45);
 expect(promotionRule(config,'y').minMarginPct).toBe(35);
 expect(validatePromotionPolicy({...config.commercialPolicy,minMarginPct:-1}).length).toBeGreaterThan(0);
});
it('explains limited headroom and never substitutes an unknown cost with zero',()=>{
 expect(promotionHeadroom({price:7350,cost:3536.19,rule:{minMarginPct:45,maxTotalPercent:25}}).maxTotalPercent).toBe(12.52);
 expect(promotionHeadroom({price:100,cost:null}).known).toBe(false);
});
it('a configurable 25% total applies with cost proof; zero margin still refuses a loss and snapshots preserve the policy revision',()=>{
 const config={enabled:true,paymentPercent:10,requireVerifiedCosts:true,commercialPolicy:{minMarginPct:35,maxTotalPercent:25,revision:'policy1'},campaigns:[{id:'promo',kind:'public',enabled:true,extraPercent:15,productIds:['x'],schedule:{type:'always'}}]};
 const quote=cost=>quotePromotions({config,lines:[{productId:'x',qty:1,unitPrice:100}],method:'efectivo',trustedCosts:{x:cost}});
 expect(quote(40).discount).toBe(25);expect(quote(40).lines[0].rule.revision).toBe('policy1');
 config.commercialPolicy.minMarginPct=0;expect(quote(80).discount).toBe(10);
});
it('counts an order once per promotion even when several products participate',()=>{
 const snap={version:1,subtotal:200,discount:30,netSubtotal:170,appliedPromotionIds:['p'],lines:['a','b'].map(productId=>({productId,qty:1,net:85,promotionDiscount:5,appliedPromotionId:'p'}))};
 expect(promotionReport([{promotionSnapshot:snap}]).byPromotion.p).toMatchObject({orders:1,units:2,discount:10});
});

it('a total coupon target survives a changed ordinary payment benefit without increasing the promised total',()=>{
 const coupon={id:'c',status:'available',channel:'online',expiresOn:'2099-01-01',extraPercent:10,totalPercent:20,productIds:['x']};
 const config={enabled:true,paymentPercent:12,requireVerifiedCosts:true,commercialPolicy:{minMarginPct:20,maxTotalPercent:25},campaigns:[]};
 const quote=quotePromotions({config,coupon,lines:[{productId:'x',qty:1,unitPrice:100}],method:'efectivo',trustedCosts:{x:30}});
 expect(quote.discount).toBe(20);expect(quote.lines[0].promotionDiscount).toBe(8);
 config.paymentPercent=25;
 const higher=quotePromotions({config,coupon,lines:[{productId:'x',qty:1,unitPrice:100}],method:'efectivo',trustedCosts:{x:30}});
 expect(higher.discount).toBe(25);expect(higher.couponId).toBeNull();
});

it('keeps a provisional fee explicit, accepts a verified zero and preserves the quote assumption',async()=>{
 const {promotionPaymentFee}=await import('../src/core/promotion-policy.js');
 const {quoteOrder}=await import('../src/payments/core.js');
 expect(promotionPaymentFee({})).toMatchObject({percent:10,provisional:true,source:'provisional_default'});
 expect(promotionPaymentFee({checkoutProFeePercent:0})).toMatchObject({percent:0,provisional:false});
 const commercialPolicy={minMarginPct:20,maxTotalPercent:25,mercadopagoFeePercent:10,mercadopagoFeeProvisional:true,revision:'rate-1'};
 expect(validatePromotionPolicy({...commercialPolicy,mercadopagoFeePercent:100})).not.toHaveLength(0);
 const menu={products:[{id:'x',name:'Ficticio',price:10000}],promotions:{enabled:true,commercialPolicy,campaigns:[]}};
 const order=quoteOrder(menu,{source:'pickup',items:[{id:'x',qty:1}]},{validateCustomer:false,trustedCosts:{x:3000}});
 expect(order.promotionSnapshot).toMatchObject({estimatedPaymentFee:1000,paymentFeeAssumption:{percent:10,provisional:true,revision:'rate-1'}});
 expect(order.total).toBe(10000);expect(order).not.toHaveProperty('actualPaymentFee');
 commercialPolicy.mercadopagoFeePercent=15;
 expect(order.promotionSnapshot.paymentFeeAssumption.percent).toBe(10);
});

it('Checkout Pro loads online costs and persists the fee assumption with the trusted quote',async()=>{
 const {createPaymentService}=await import('../src/payments/service.js');
 const sid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-000000000002',rid='00000000-0000-4000-8000-000000000003';
 const loaded=[],reserved=[];
 const repo={menu:async()=>({config:{enabled:true},products:[{id:'x',name:'Ficticio',price:10000}],promotions:{enabled:true,commercialPolicy:{minMarginPct:40,maxTotalPercent:20,mercadopagoFeePercent:10,mercadopagoFeeProvisional:true},campaigns:[]}}),promotionCosts:async(id,channel)=>{loaded.push([id,channel]);return {x:3000};},run:async(action,args)=>{
  if(action==='account')return {id:aid,site_url:'https://fixture.invalid'};
  if(action==='limit')return true;
  if(action==='reserve'){reserved.push(args);return {id:rid,order:args.order,mode:'test',payment_status:'pending',checkout_url:'https://www.mercadopago.com.ar/checkout/ficticio'};}
  throw Error('Unexpected operation');
 }};
 const handler=createPaymentService({repo,authenticate:async()=>null,fetchImpl:async()=>{throw Error('Network must not be used');},endpoint:'https://backend.invalid'});
 const result=await handler(new Request('https://backend.invalid/checkout',{method:'POST',headers:{origin:'https://fixture.invalid'},body:JSON.stringify({storeId:sid,requestId:rid,proof:'a'.repeat(64),order:{source:'pickup',customerName:'Ficticio',customerPhone:'1123456789',items:[{id:'x',qty:1}],total:10000}})}));
 expect(result.status).toBe(200);expect(loaded).toEqual([[sid,'online']]);
 expect(reserved[0].order.promotionSnapshot.paymentFeeAssumption).toMatchObject({percent:10,provisional:true});
});

it('applies a Sahten coupon with Mercado Pago on net products only, with method-specific minimum and no cash stacking',()=>{
 const coupon={id:'mp-c',status:'available',channel:'online',expiresOn:'2099-01-01',totalPercent:20,extraPercent:10,minEligibleSubtotal:30000,productIds:['x'],mercadopago:{enabled:true,totalPercent:10,minEligibleSubtotal:40000,maxExtraAmount:null}};
 const config={enabled:true,paymentPercent:10,requireVerifiedCosts:true,commercialPolicy:{minMarginPct:40,maxTotalPercent:25}};
 const quote=(qty,override=coupon)=>quotePromotions({config,coupon:override,method:'mercadopago',commissionPercent:10,lines:[{productId:'x',qty,unitPrice:10000}],trustedCosts:{x:3000}});
 expect(quote(3).discount).toBe(0);expect(quote(3).couponId).toBeNull();
 expect(quote(5)).toMatchObject({discount:5000,netSubtotal:45000,paymentPercent:0,estimatedPaymentFee:4500,couponId:'mp-c'});
 expect(quote(20).discount).toBe(20000);
 expect(quote(5,{...coupon,mercadopago:{...coupon.mercadopago,enabled:false}}).discount).toBe(0);
});
