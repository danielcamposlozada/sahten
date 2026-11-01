// Normalización reversible de precios fijados -> precios finales comerciales.
// Garantía: el importe cobrado se conserva EXACTAMENTE y no se cambia ningún GF.
// El factor calibrado sólo se usa al quitar expresamente un precio final en el futuro.
import { channelPriceWithDisc,getTier,getChannel,globalComm } from './pricing.js';
import { costPerUnit } from './costs.js';
import { gfAssigned } from './gf.js';
import { isPriceFixed } from './price-policy.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export function fixedPriceAudit(s) {
  const products=s.products||[], channels=(s.channels||[]).map(c=>c.id);
  const rows=[];
  for(const p of products)for(const ch of new Set([...channels,...Object.keys(p.pricingPolicies||{}),...(p.priceFixedChannels||[])])){
    if(!isPriceFixed(p,ch))continue;
    const policy=p.pricingPolicies?.[ch]||{};
    const target=channelPriceWithDisc(s,p,ch)??policy.price??p.fixedPrices?.[ch];
    const cost=costPerUnit(s,p,ch), fixed=gfAssigned(s,p,ch);
    const total=cost+fixed;
    rows.push({productId:p.id,name:p.name,channel:ch,oldPrice:Number(target),
      variableCost:cost,fixedCost:fixed,tier:p.tier,tierFactor:getTier(s,p.tier).factor,
      impliedFactor:total>0?Number(target)/total:null,
      contribution:valid(Number(target))?Number(target)-total:null,
      costVerified:policy.fixedCost!=null&&policy.variableCost!=null,
      convertible:valid(Number(target))});
  }
  return rows;
}
export function normalizeFixedPrices(s,{now=new Date(),actor='admin',dryRun=false}={}){
  const rows=fixedPriceAudit(s), changed=[],skipped=[];
  for(const id of new Set(rows.map(r=>r.productId))){
    const p=(s.products||[]).find(p=>p.id===id);
    if(!p)continue;
    const group=rows.filter(r=>r.productId===id), before=clone(p);
    if(group.some(r=>!r.convertible)){skipped.push({productId:id,reason:'Precio final inválido'});continue;}
    const backup={at:new Date(now).toISOString(),actor,priorPolicies:clone(p.pricingPolicies||{}),
      priorFixedChannels:clone(p.priceFixedChannels||[]),priorPriceTargets:clone(p.priceTargets||{}),
      priorPriceAdjByChannel:clone(p.priceAdjByChannel||{}),channels:group.map(r=>r.channel)};
    // El target es la autoridad comercial, no una etiqueta de bloqueo de precio.
    p.priceTargets={...(p.priceTargets||{})};
    p.priceAdjByChannel={...(p.priceAdjByChannel||{})};
    p.pricingPolicies={...(p.pricingPolicies||{})};
    const current=[];
    for(const r of group){
      p.priceTargets[r.channel]=r.oldPrice;
      const channel=getChannel(s,r.channel),factor=r.tierFactor;
      const surcharges=(1+(channel.surcharge||0))*(1+globalComm(s));
      const base=r.variableCost+r.fixedCost;
      // Calibración informativa y de respaldo; no cambia el GF ni el tier compartido.
      if(base>0&&factor>0&&surcharges>0){
        p.priceAdjByChannel[r.channel]=r.oldPrice/(base*factor*surcharges);
      }
      if(p.pricingPolicies[r.channel])p.pricingPolicies[r.channel]={...p.pricingPolicies[r.channel],price:null};
      p.priceFixedChannels=(p.priceFixedChannels||[]).filter(ch=>ch!==r.channel);
      current.push({channel:r.channel,price:r.oldPrice});
    }
    const changedGf=group.some(r=>Math.abs(gfAssigned(s,p,r.channel)-r.fixedCost)>0.001);
    const changedPrice=group.some(r=>Math.abs(Number(channelPriceWithDisc(s,p,r.channel))-r.oldPrice)>0.001);
    if(changedGf||changedPrice){
      Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,before);
      skipped.push({productId:id,reason:changedGf?'Cambió el gasto fijo':'El precio no coincide exactamente'});
      continue;
    }
    if(dryRun){Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,before);}
    else{
      p.priceNormalizationHistory=[...(p.priceNormalizationHistory||[]),backup];
      p.priceNormalization={version:1,effectiveAt:backup.at,channels:current};
    }
    changed.push({productId:id,name:p.name,channels:group.map(r=>r.channel),
      original:group.map(r=>({channel:r.channel,price:r.oldPrice,fixedCost:r.fixedCost}))});
  }
  return {examined:rows.length,products:changed.length,changed,skipped,dryRun};
}
export function undoFixedPriceNormalization(s,productId) {
  const p=(s.products||[]).find(x=>x.id===productId);
  const backup=p?.priceNormalizationHistory?.at(-1);
  if(!p||!backup)return false;
  p.pricingPolicies=clone(backup.priorPolicies);p.priceFixedChannels=clone(backup.priorFixedChannels);
  p.priceTargets=clone(backup.priorPriceTargets);p.priceAdjByChannel=clone(backup.priorPriceAdjByChannel);
  p.priceNormalizationHistory.pop();
  if(!p.priceNormalizationHistory.length)delete p.priceNormalization;
  return true;
}
