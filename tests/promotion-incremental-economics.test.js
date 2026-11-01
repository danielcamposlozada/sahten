import { describe,it,expect } from 'vitest';
import { assessIncrementalUpsell } from '../src/core/upsell-economics.js';
import { quotePromotions } from '../src/core/promotions.js';
import { quoteOrder } from '../src/payments/core.js';

const at=new Date('2026-11-06T14:00:00-03:00');
const shawarma='shawarma_pollo',fatay='fatay',baklava='baklava';
const main={productId:shawarma,unitPrice:16000,qty:1};
const addon={productId:fatay,unitPrice:5850,qty:1};
const config={
  version:1,enabled:true,paymentPercent:10,minMarginPct:40,requireVerifiedCosts:true,
  activationPolicy:{requireIncrementalAndBasketMarginCheck:true,basketContributionTargetPct:40,maxDiscountedUpsellLinesPerOrder:1},
  campaigns:[],upsells:[
    {id:'fatay-up',kind:'upsell',enabled:true,extraPercent:10,priority:55,maxUnits:1,productIds:[fatay],triggerProductIds:[shawarma],suppressIfPresent:['p1779467294622','p1779570052552']},
    {id:'baklava-up',kind:'upsell',enabled:true,extraPercent:10,priority:40,maxUnits:1,productIds:[baklava],triggerProductIds:[shawarma],suppressIfPresent:[]}
  ]
};
const economies={
  [shawarma]:{verified:true,incrementalVerified:true,directCost:2677.49,fixedCost:5066.31,additionalIncrementalCost:0},
  [fatay]:{verified:true,incrementalVerified:true,directCost:442.12,fixedCost:3138.42,additionalIncrementalCost:0},
  [baklava]:{verified:true,incrementalVerified:true,directCost:1294.46,fixedCost:2241.73,additionalIncrementalCost:0},
};
const costs={[shawarma]:7743.80,[fatay]:3580.54,[baklava]:3536.19};
const selection={verified:true,isIncremental:true,productId:fatay,promotionId:'fatay-up',eligibleUnits:1};
const orderCosts={verified:true,additionalOrderCost:0,shippingSubsidy:0};
const request=(overrides={})=>quotePromotions({
  config,lines:[main,addon],method:'transferencia',channel:'online',now:at,
  trustedCosts:costs,trustedEconomics:economies,trustedUpsellSelection:selection,
  trustedOrderCosts:orderCosts,...overrides
});

describe('upsell marginal + margen de toda la cesta',()=>{
  it('aplica Fatay a 20% total únicamente con origen comprobado en servidor y costos verificados',()=>{
    const x=request();expect(x.appliedPromotionIds).toEqual(['fatay-up']);
    expect(x.lines.find(l=>l.productId===fatay)).toMatchObject({
      base:5850,paymentDiscount:585,promotionDiscount:585,discount:1170,net:4680
    });
    expect(x.netSubtotal).toBe(19080);
  });
  it('falla de forma cerrada sin prueba server-side, con intento inventado en input o costo marginal faltante',()=>{
    for(const params of [
      {trustedUpsellSelection:null},
      {trustedUpsellSelection:{...selection,verified:false}},
      {trustedUpsellSelection:{...selection,productId:'baklava'}},
      {trustedUpsellSelection:{...selection,promotionId:'baklava-up'}},
      {trustedUpsellSelection:{verified:true,productId:fatay,isIncremental:true,eligibleUnits:1}},
      {trustedOrderCosts:null},
      {trustedEconomics:{...economies,[fatay]:{...economies[fatay],incrementalVerified:false}}},
      {trustedEconomics:{[fatay]:economies[fatay]}},
    ]){
      const x=request(params);
      expect(x.lines.find(l=>l.productId===fatay).promotionDiscount).toBe(0);
      expect(x.netSubtotal).toBe(19665);
    }
  });
  it('rechaza una oferta cuando mano de obra/packaging adicionales bajan margen incremental o global',()=>{
    const result=request({trustedEconomics:{...economies,[fatay]:{...economies[fatay],additionalIncrementalCost:4000}}});
    expect(result.appliedPromotionIds).toEqual([]);
    const x=request({trustedOrderCosts:{...orderCosts,shippingSubsidy:3000}});
    expect(x.appliedPromotionIds).toEqual([]);
  });
  it('evita aplicar un segundo descuento aunque haya dos complementos',()=>{
    const x=request({lines:[main,addon,{productId:baklava,unitPrice:7350,qty:1}]});
    expect(x.lines.filter(l=>l.appliedPromotionType==='upsell')).toHaveLength(1);
    expect(x.lines.find(l=>l.productId===baklava).promotionDiscount).toBe(0);
  });
  it('ignora fatay cuando el combo 3U o 4U ya está en el carrito',()=>{
    const combo={productId:'p1779467294622',unitPrice:16850,qty:1};
    const x=request({lines:[main,addon,combo],trustedEconomics:{...economies,[combo.productId]:{verified:true,directCost:1619.07,fixedCost:5155.98}},trustedCosts:{...costs,[combo.productId]:6775.05}});
    expect(x.lines.find(l=>l.productId===fatay).promotionDiscount).toBe(0);
  });
  it('impide descuento cuando hay cantidad >1 y si no hay plato que dispare la sugerencia',()=>{
    expect(request({lines:[main,{...addon,qty:2}]}).appliedPromotionIds).toEqual([]);
    expect(request({lines:[addon]}).appliedPromotionIds).toEqual([]);
  });
  it('no resta alquiler dos veces de la contribución incremental, sí del margen de la cesta',()=>{
    const before=[
      {productId:shawarma,qty:1,net:14400,appliedPromotionId:null},
      {productId:fatay,qty:1,net:5265,appliedPromotionId:null}
    ];
    const base={lines:[{productId:shawarma,qty:1},{productId:fatay,qty:1}],currentLines:before,
      upsell:config.upsells[0],productId:fatay,proposedExtra:585,
      trustedEconomics:economies,trustedUpsellSelection:selection,trustedOrderCosts:orderCosts,
      minBasketMarginPct:40,minIncrementalMarginPct:40};
    const allowed=assessIncrementalUpsell(base);
    expect(allowed.approved).toBe(true);
    expect(allowed.incrementalContribution).toBe(4237.88);
    expect(allowed.basketMarginPct).toBeGreaterThan(40);
    expect(assessIncrementalUpsell({...base,minBasketMarginPct:50}).approved).toBe(false);
  });
  it('el checkout no acepta supuestas validaciones de costos o intención suministradas por el cliente',()=>{
    const menu={store:{currency:{symbol:'$',locale:'es-AR'}},config:{enabled:true,showPrices:true},
      products:[{id:shawarma,name:'Shawarma',price:16000},{id:fatay,name:'Fatay',price:5850}],
      payments:{methods:{transferencia:true},benefit:{enabled:true,percent:10,channels:{online:true,mostrador:true}}},
      promotions:{...config,upsellGuardRequired:false},delivery:{enabled:true}};
    const input={source:'pickup',paymentMethod:'transferencia',customerName:'Prueba',customerPhone:'1122334455',
      items:[{productId:shawarma,qty:1},{productId:fatay,qty:1}],
      trustedEconomics:economies,trustedUpsellSelection:selection,trustedOrderCosts:orderCosts};
    const x=quoteOrder(menu,input,{allowOtherPayments:true,validateCustomer:false,now:at.getTime()});
    expect(x.total).toBe(19665);
    expect(x.promotionSnapshot.appliedPromotionIds).toEqual([]);
  });
});
