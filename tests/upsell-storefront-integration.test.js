import {it,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {buildIndexHtml} from '../src/online/publish.js';
import {createDeliveryService} from '../src/delivery/service.js';
import {createUpsellCheckout} from '../src/promotions/upsell-checkout.js';
it('la web consulta y acepta la oferta; el servidor recalcula y conserva exactamente ese descuento al guardar',async()=>{
 const sid='11111111-1111-4111-8111-111111111111';
 const menu={version:1,store:{name:'Test',currency:{symbol:'$',locale:'es-AR'}},
  config:{enabled:true,showPrices:true,showImages:false,categories:['Platos','Dulces']},
  products:[{id:'plato',name:'Plato',price:30000,category:'Platos'},{id:'baklava',name:'Baklava',price:7000,category:'Dulces'}],
  delivery:{enabled:false,deliveryV2:{active:true}},payments:{methods:{transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true}}},
  supabase:{url:'https://test.supabase.co',anonKey:'public-test-only',storeId:sid},
  promotions:{enabled:true,paymentPercent:10,campaigns:[],upsellGuardRequired:true,upsells:[{id:'baklava-up',name:'Baklava adicional',kind:'upsell',enabled:true,maxUnits:1,productIds:['baklava'],triggerProductIds:['plato'],extraPercent:10}]}};
 const economy={revision:'review-1',products:{plato:{verified:true,directCost:5000,fixedCost:3000},baklava:{verified:true,incrementalVerified:true,directCost:800,fixedCost:500,additionalIncrementalCost:100}},orderCosts:{verified:true,additionalOrderCost:300,shippingSubsidy:0}};
 const orders=[],nonces=new Map();
 const checkout=createUpsellCheckout({secret:'not-a-real-key-for-local-tests-'+ 'a'.repeat(40),readEconomics:async()=>economy,
  consumeNonce:async c=>{if(nonces.has(c.nonce))return nonces.get(c.nonce)===c.requestId;nonces.set(c.nonce,c.requestId);return true;}});
 const service=createDeliveryService({upsellCheckout:checkout,authenticate:async()=>null,repo:{
  menu:async()=>menu,promotionCosts:async()=>({plato:8000,baklava:1300}),run:async action=>action==='limit'?true:null,
  confirmUpsellOrder:async(_sid,_request,payload)=>{orders.push(payload);return{id:'saved-order',order:payload};}
 }});
 const dom=new JSDOM(buildIndexHtml(menu),{url:'https://test.shop/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.scrollTo=()=>{};w.fetch=async(url,options)=>{
   if(String(url)==='menu.json')return Response.json(menu);
   if(String(url).includes('/functions/v1/sahten-delivery/'))return service(new Request(String(url),options));
   return Response.json([]);
  };}});
 try{
  const w=dom.window,d=w.document;
  await vi.waitFor(()=>expect(d.querySelector('[data-inc="plato"]')).not.toBeNull());
  d.querySelector('[data-inc="plato"]').click();w.openCart();d.querySelector('#cart-next').click();
  for(const [id,value]of [['f-name','Persona de prueba'],['f-phone','1122334455']]){const input=d.getElementById(id);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
  expect(d.querySelector('[data-upsell-consult="baklava-up"]')).not.toBeNull();
  d.querySelector('[data-upsell-consult="baklava-up"]').click();
  await vi.waitFor(()=>expect(d.querySelector('[data-upsell-accept="baklava-up"]')).not.toBeNull());
  expect(orders).toHaveLength(0);expect(nonces.size).toBe(0);
  d.querySelector('[data-upsell-accept="baklava-up"]').click();
  expect(d.querySelector('#send').textContent).toContain('32.600');
  d.querySelector('#send').click();
  await vi.waitFor(()=>expect(orders).toHaveLength(1));
  expect(orders[0]).toMatchObject({total:32600,discount:4400,upsellReviewId:'review-1'});
  expect(orders[0].promotionSnapshot.lines.find(l=>l.productId==='baklava')).toMatchObject({net:5600,promotionDiscount:700});
  expect(nonces.size).toBe(1);
 }finally{dom.window.close();}
});
