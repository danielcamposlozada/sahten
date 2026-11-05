// Revisión informativa de borradores. NO es una autorización para publicar
// descuentos ni sustituye el control económico ni el canje del checkout.
import {promotionRule} from './promotion-policy.js';
import { verificationCheck } from './promotion-verification.js';
const list=value=>Array.isArray(value)?value:[];
const unique=items=>new Set(items).size===items.length;
const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const trimmed=value=>String(value||'').trim();
const check=(id,label,ok,action='edit')=>verificationCheck({id,label,
 status:ok===true?'approved':ok===false?'rejected':'unverified',action});
export function promotionDraftReview(type,proposal={},localProducts=[],config={}) {
 const productIds=new Set(list(localProducts).filter(p=>p?.id).map(p=>String(p.id)));
 const ids=list(proposal.eligibleProductIds).length?list(proposal.eligibleProductIds):list(proposal.productIds).length?list(proposal.productIds):[proposal.productId||proposal.replacementProductId].filter(Boolean);
 const limit=ids.length?Math.min(...ids.map(id=>promotionRule(config,id,proposal).maxTotalPercent)):promotionRule(config).maxTotalPercent;
 const base=Number(config.paymentPercent??10);
 const id=trimmed(proposal.id);
 const validId=/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,75}$/.test(id);
 const name=trimmed(proposal.name);
 const checks=[check('identity','Nombre e identificador completos',validId&&name.length>=4&&name.length<=100)];
 if(type==='couponPrograms'){
   const percent=Number(proposal.extraPercent);
   const minimum=Number(proposal.minEligibleSubtotal);
   const cap=proposal.maxExtraAmount==null||proposal.maxExtraAmount===''?null:Number(proposal.maxExtraAmount);
   const days=Number(proposal.validDays);
   checks.push(check('terms','Descuento, mínimo, tope y vencimiento definidos',
     Number.isFinite(percent)&&percent>0&&percent+base<=limit&&
     Number.isFinite(minimum)&&minimum>=0&&
     (cap===null||Number.isFinite(cap)&&cap>0)&&
     Number.isInteger(days)&&days>=1&&days<=365&&
     ['online','mostrador'].includes(proposal.channel)));
   checks.push(check('ledger','Emisión vinculada a una venta confirmada',null,'verify_server'));
   checks.push(check('redeem','Canje único y recotización verificados en web y mostrador',null,'verify_server'));
   checks.push(check('published','Programa publicado y autorizado por el servidor',null,'verify_server'));
 } else {
   const targets=type==='productUpgrades'
     ?[proposal.replacementProductId]
     :type==='crossSells'?[proposal.productId]:list(proposal.productIds);
   const validTargets=targets.length>=1&&targets.every(x=>trimmed(x)&&productIds.has(String(x)))&&unique(targets);
   const triggers=list(proposal.triggerProductIds).length?list(proposal.triggerProductIds)
     :proposal.triggerProductId?[proposal.triggerProductId]:[];
   const validTriggers=triggers.length>0&&unique(triggers)&&triggers.every(x=>productIds.has(String(x)));
   checks.push(check('products','Producto objetivo definido en el proyecto local',validTargets));
   checks.push(check('triggers','Productos que disparan la oferta configurados',validTriggers));
   const tiers=list(proposal.discountTiers);
   const percent=Number(proposal.extraPercent);
   const discount=tiers.length?tiers.every(t=>Number.isFinite(Number(t.totalDiscountPercent))
     &&Number(t.totalDiscountPercent)>10&&Number(t.totalDiscountPercent)<=limit
     &&money(Number(t.minEligibleNetSubtotal))):
     Number.isFinite(percent)&&percent>=0&&percent+base<=limit;
   const specialFatay=type==='upsells'&&proposal.id==='fatay-individual-up'
     &&targets.length===1&&targets[0]==='fatay'&&proposal.maxUnits===1&&tiers.length>0
     &&tiers.every(t=>Number(t.totalDiscountPercent)>10&&Number(t.totalDiscountPercent)<=30
       &&money(Number(t.minEligibleNetSubtotal)));
   checks.push(specialFatay&&!discount
     ?verificationCheck({id:'limits',status:'pending',label:'Escala especial Fatay hasta 30%: requiere validación y autorización específicas',action:'exception_review'})
     :check('limits',limit===20?'Descuento dentro del 20% total habitual':'Descuento dentro del máximo total configurado: '+limit+'%',discount));
   if(type==='crossSells'&&discount&&percent===0&&!tiers.length){
     checks.push(check('publication','La sugerencia sin rebaja puede validarse desde Recomendaciones web',true));
     return {checks,readyForDiscount:false,missing:checks.filter(c=>!c.ok),placements:['cart']};
   }
   checks.push(check('economics','Costos incrementales y margen de carrito aprobados',null,'verify_server'));
   checks.push(check('checkout',type==='productUpgrades'
     ?'Reemplazo de producto recotizado en el checkout'
     :'Aceptación explícita y descuento recotizado por servidor',null,'verify_server'));
   checks.push(check('published','Oferta verificada, publicada y activada en servidor',null,'verify_server'));
 }
 return {checks,readyForDiscount:false,missing:checks.filter(c=>!c.ok),
   placements:list(proposal.advertising?.placement||proposal.placement)};
}
