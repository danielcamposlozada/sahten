// Auditoría de la ración de 6 croquetas de Falafel (USO INTERNO).
// Esta función NO habilita promociones: diferencia materias primas por lote
// de tahini/packaging usados una vez por venta, que el costo tradicional diluye.
import {calcIngCost,calcEnvCost,calcComboCost,actualCostPerUnit,getPorc} from './costs.js';
const money=n=>Math.round(n*100)/100;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function auditFalafelRacion(state){
 const p=(state?.products||[]).find(x=>x.id==='falafel');
 const issues=[];
 if(!p)return {sku:'falafel',verified:false,discountApproved:false,issues:['falafel_missing']};
 const ingredients=new Map((state.ingredients||[]).map(x=>[x.id,x]));
 const packs=new Map((state.packs||[]).map(x=>[x.id,x]));
 const products=new Map((state.products||[]).map(x=>[x.id,x]));
 const totalCroquettes=Number(p.pesoTotal),unitsPerSale=Number(p.porcionCant);
 const portionUnitValid=p.pesoUnit==='u'&&p.porcionUnit==='u'&&
  Number.isSafeInteger(totalCroquettes)&&Number.isSafeInteger(unitsPerSale)&&
  totalCroquettes>0&&unitsPerSale===6&&totalCroquettes%unitsPerSale===0;
 if(!portionUnitValid)issues.push('croquettes_yield_or_sale_quantity_not_verified');
 const batchRations=portionUnitValid?totalCroquettes/unitsPerSale:null;
 const configuredRations=getPorc(p);
 if(batchRations!==null&&Math.abs(configuredRations-batchRations)>0.001)
  issues.push('portion_model_inconsistent');
 const ingredientRows=p.ingredients||[];
 if(!ingredientRows.length)issues.push('recipe_ingredients_missing');
 for(const row of ingredientRows){
  const item=ingredients.get(row.ingId);
  if(!item||!Number.isFinite(Number(item.precioPkg))||
   Number(item.precioPkg)<=0||!Number.isFinite(Number(item.grPaquete))||
   Number(item.grPaquete)<=0||!(Number(row.qty)>0))
   issues.push('ingredient_source_missing');
 }
 const sauceRows=(p.combos||[]).filter(r=>r.prodId==='tahini');
 if(sauceRows.length!==1||Number(sauceRows[0]?.qty)!==30||
    sauceRows[0]?.unit!=='g'||!products.has('tahini'))
  issues.push('tahini_serving_not_verified');
 if((p.combos||[]).some(r=>r.prodId!=='tahini'))
  issues.push('additional_combo_requires_review');
 const packRows=p.packaging||[];
 if(!packRows.length)issues.push('sale_packaging_not_registered');
 for(const row of packRows){
  const item=packs.get(row.envId);
  if(!item||!Number.isFinite(Number(item.precioPkg))||
   Number(item.precioPkg)<=0||!Number.isFinite(Number(item.cantidad))||
   Number(item.cantidad)<=0||!(Number(row.qty)>0))
   issues.push('packaging_cost_missing');
 }
 // El rendimiento del lote se divide en raciones comerciales de 6.
 // Sin embargo, el envase y la salsa de 30g se usan por VENTA:
 // deben contabilizarse completos por ración, no por lote.
 const recipeBatch=ingredientRows.reduce((n,r)=>n+calcIngCost(state,r),0);
 const packagingSale=packRows.reduce((n,r)=>n+calcEnvCost(state,r),0);
 const tahiniSale=sauceRows.reduce((n,r)=>n+calcComboCost(state,r),0);
 const oldEngineUnit=actualCostPerUnit(state,p);
 const reconstructed=portionUnitValid
  ? recipeBatch/batchRations+packagingSale+tahiniSale:null;
 if(![recipeBatch,packagingSale,tahiniSale,oldEngineUnit].every(finite)||
    reconstructed!==null&&!finite(reconstructed))issues.push('invalid_reconstructed_cost');
 const price=Number(p?.fixedPrices?.mostrador);
 if(!Number.isFinite(price)||price<=0)issues.push('price_missing');
 return {
  sku:'falafel',unitDefinition:'racion_6_croquetas',
  saleUnits:6,batchCroquettes:portionUnitValid?totalCroquettes:null,
  batchRations,configuredRations,
  recipeBatchCost:money(recipeBatch),
  ingredientCostPerRation:batchRations?money(recipeBatch/batchRations):null,
  fullTahiniCostPerSale:money(tahiniSale),
  fullPackagingCostPerSale:money(packagingSale),
  legacyCostPerUnit:money(oldEngineUnit),
  correctedCostEstimate:reconstructed===null?null:money(reconstructed),
  directCostUnderstatement:reconstructed===null?null:money(reconstructed-oldEngineUnit),
  publicUnitListPrice:finite(price)?money(price):null,
  costReconstructionComplete:issues.length===0,
  issues:[...new Set(issues)],
  verified:false,discountApproved:false,
  blockers:['owner_approve_batch_yield_and_portion','verify_incremental_labor_energy_waste',
    'verify_packaging_sauce_per_sale','verify_mp_fee_order_costs_shipping',
    'verify_margin_40pct_unit_and_basket']
 };
}
