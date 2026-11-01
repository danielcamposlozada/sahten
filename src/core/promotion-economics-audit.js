// Auditoría de costos de promociones, exclusivamente interna.
// Usa el motor REAL de Sahten: ingredientes + envases + subproductos anidados
// + mercadería + GF por unidad. NUNCA autoriza por sí sola un descuento.
// La aprobación del dueño, la comisión y los costos incrementales siguen aparte.
import {costPerUnit,comboResolveProps} from './costs.js';
import {gfAssigned,absorbsGF,gfPerUnit} from './gf.js';
import {channelPriceWithDisc} from './pricing.js';
const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0;
const round=x=>Math.round(Number(x)*100)/100;

function lineages(s,product,trail=new Set()){
 const issues=[];
 if(trail.has(product.id))return ['subproduct_cycle'];
 const visited=new Set(trail);visited.add(product.id);
 const ingredients=new Map((s.ingredients||[]).map(x=>[x.id,x]));
 const packs=new Map((s.packs||[]).map(x=>[x.id,x]));
 const merchandise=new Map((s.merchandise||[]).map(x=>[x.id,x]));
 const products=new Map((s.products||[]).map(x=>[x.id,x]));
 for(const line of product.ingredients||[]){
  const src=ingredients.get(line.ingId);
  if(!src||!positive(src.precioPkg)||!positive(src.grPaquete)||!positive(line.qty)||
    (line.unit==='u'&&!positive(src.cantidad)))issues.push('ingredient_cost_missing');
 }
 for(const line of product.packaging||[]){
  const src=packs.get(line.envId);
  if(!src||!positive(src.precioPkg)||!positive(src.cantidad)||!positive(line.qty))
    issues.push('packaging_cost_missing');
 }
 for(const line of product.merchandise||[]){
  const src=merchandise.get(line.merchId);
  if(!src||!positive(src.precioPkg)||!positive(src.cantidad)||!positive(line.qty))
   issues.push('resale_cost_missing');
  else if(src.costVerified!==true||src.costStatus!=='purchase_recorded')
   issues.push('resale_supplier_cost_not_audited');
 }
 for(const line of product.combos||[]){
  const target=products.get(line.prodId);
  if(!target||!comboResolveProps(line,target).resolved)
   issues.push('subproduct_reference_invalid');
  else issues.push(...lineages(s,target,visited));
 }
 return [...new Set(issues)];
}
/** Reporte PRIVADO para conciliación, NO se debe copiar a menu.json ni usar
 * como trustedEconomics hasta firma/revisión y costos adicionales aprobados. */
export function auditProductPromotionEconomics(state,productId,{channel='mostrador'}={}){
 const product=(state?.products||[]).find(p=>p.id===productId);
 if(!product)return {productId,sourceComplete:false,issues:['product_missing'],discountApproved:false};
 const issues=lineages(state,product);
 const direct=costPerUnit(state,product,channel);
 const fixed=gfAssigned(state,product,channel);
 const price=channelPriceWithDisc(state,product,channel);
 if(!Number.isFinite(direct)||direct<0)issues.push('invalid_direct_cost');
 if(!Number.isFinite(fixed)||fixed<0)issues.push('invalid_fixed_cost');
 if(!Number.isFinite(price)||price<=0)issues.push('invalid_price');
 if(absorbsGF(product)&&(!Number.isFinite(gfPerUnit(state))||gfPerUnit(state)<0))
  issues.push('invalid_overhead_pool');
 const fullCost=direct+fixed;
 return {
  productId,productName:product.name,channel,
  sourceComplete:issues.length===0,issues:[...new Set(issues)],
  // Estos importes son datos internos; no son costos firmados/auditados del backend.
  unitDirectCost:round(direct),unitFixedAllocation:round(fixed),
  unitCostWithFixedAllocation:round(fullCost),
  listPrice:price==null?null:round(price),
  grossMarginBeforeFees:price>0?round((price-fullCost)/price*100):null,
  discountedUnitMarginApproved:false,discountApproved:false,
  requiresOwnerCostReview:true,requiresVerifiedPaymentFee:true,
  requiresIncrementalLaborPackagingAndDeliveryReview:true
 };
}
