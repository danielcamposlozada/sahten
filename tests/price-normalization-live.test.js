import { describe,it,expect } from 'vitest';
import * as C from '../src/core/index.js';
import { isPriceFixed } from '../src/core/price-policy.js';

const state=()=>C.createState({
  tiers:[{id:'T4',factor:1.4}],
  channels:[{id:'mostrador',name:'Mostrador',surcharge:0.3,commission:0,enabled:true}],
  products:[{id:'shawarma',name:'Shawarma',tier:'T4',avgMes:20,
    pricingPolicies:{mostrador:{price:16000,variableCost:2677.49,fixedCost:5066.31}},
    priceAdj:1,discount:0}],
  gastosOp:[],gastosS:[],globalCommission:2
});
describe('SAHTEN final price migration — backward compatible',()=>{
  it('conserva monto y gasto fijo y elimina marca de precio fijado con target comercial',()=>{
    const s=state(),p=s.products[0], gf=C.gfAssigned(s,p),old=C.channelPriceWithDisc(s,p,'mostrador');
    expect(old).toBe(16000);expect(isPriceFixed(p)).toBe(true);
    p.priceTargets={mostrador:old};
    p.priceAdjByChannel={mostrador:old/((gf+C.costPerUnit(s,p))*1.4*1.3*1.02)};
    p.fixedPrices={mostrador:old};p.pricingPolicies.mostrador.price=null;
    expect(isPriceFixed(p)).toBe(false);
    expect(C.channelPriceWithDisc(s,p,'mostrador')).toBe(old);
    expect(C.gfAssigned(s,p)).toBe(gf);
    expect(C.tierProfitPerUnit(s,p)).toBeCloseTo(old-gf-2677.49,2);
  });
  it('sin migración sigue intacto el cálculo antiguo y sus redondeos',()=>{
    const s=state(),p=s.products[0];expect(C.channelPrice(s,p,'mostrador')).toBe(16000);
    p.pricingPolicies.mostrador.price=null;expect(C.channelPrice(s,p,'mostrador')).not.toBe(16000);
  });
  it('un precio comercial prevalece sobre el fallback antiguo, sin descuentos duplicados',()=>{
    const s=state(),p=s.products[0];p.priceTargets={mostrador:16000};
    p.fixedPrices={mostrador:16000};p.pricingPolicies.mostrador.price=null;
    p.channelDiscounts={mostrador:15};expect(C.channelPriceWithDisc(s,p,'mostrador')).toBe(16000);
  });
});
