import {describe,it,expect} from 'vitest';
import {createState} from '../src/core/state.js';
import {channelPrice,channelPriceWithDisc,mostradorFinalPrice,channelCommission} from '../src/core/pricing.js';
import {costPerUnit} from '../src/core/costs.js';
import {gfAssigned} from '../src/core/gf.js';
import {isPriceFixed} from '../src/core/price-policy.js';
const mk=()=>{
 const variable=2677.49,fixed=5066.31,tierFactor=1.5,target=16000;
 const adj=target/((variable+fixed)*tierFactor*1.3*1.02);
 return createState({tiers:[{id:'T4',factor:1.4},{id:'T6',factor:1.5}],
 channels:[{id:'mostrador',enabled:true,surcharge:0.3,commission:0},{id:'rappi',enabled:true,surcharge:0.5,commission:0.3}],
 globalCommission:2,gastosOp:[],gastosS:[],project:{roundTo:50},
 products:[{id:'p',name:'Shawarma de pollo',tier:'T4',formulaTierByChannel:{mostrador:'T6'},priceAdj:1,priceAdjByChannel:{mostrador:adj},
 pricingMode:{mostrador:'calculated'},priceTargets:{mostrador:target},fixedPrices:{mostrador:target},
 formulaCalibration:{originalTier:'T4'},pricingPolicies:{mostrador:{price:null,variableCost:variable,fixedCost:fixed}}}]
 });
};
describe('tier calibrado: la fórmula, no el precio anclado, es autoridad',()=>{
 it('mantiene exactamente precio $16000 y GF original, y no figura fijado',()=>{
   const s=mk(),p=s.products[0];
   expect(channelPrice(s,p,'mostrador')).toBe(16000);
   expect(mostradorFinalPrice(s,p)).toBe(16000);
   expect(isPriceFixed(p,'mostrador')).toBe(false);
   expect(gfAssigned(s,p)).toBe(5066.31);
 });
 it('si cambia el costo de un producto calculado, el precio se recalcula',()=>{
   const s=mk(),p=s.products[0];
   p.pricingPolicies.mostrador.variableCost+=2000;
   expect(channelPrice(s,p,'mostrador')).toBeGreaterThan(16000);
 });
 it('si se cambia el ancla legacy no cambia el precio nuevo',()=>{
   const s=mk(),p=s.products[0];p.priceTargets.mostrador=900;
   p.fixedPrices.mostrador=900;
   expect(channelPrice(s,p,'mostrador')).toBe(16000);
 });
 it('el canal Rappi conserva el tier original antes de recalibración local',()=>{
   const s=mk(),p=s.products[0];
   const before=channelPrice(s,p,'rappi');
   p.formulaTierByChannel={};p.formulaCalibration=undefined;p.pricingMode={};p.fixedPrices={};p.priceTargets={};
   const after=channelPrice(s,p,'rappi');
   expect(after).toBe(before);
 });
});
