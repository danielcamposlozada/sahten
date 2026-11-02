import {describe,it,expect} from 'vitest';
import {auditFalafelRacion} from '../src/core/upsell-falafel-racion-audit.js';
import {auditProductPromotionEconomics} from '../src/core/promotion-economics-audit.js';
const fixture=()=>{
 const products=[
  {id:'falafel',name:'Croquetas de Falafel',
   pesoTotal:150,pesoUnit:'u',porcionCant:6,porcionUnit:'u',porciones:6,
   ingredients:[{ingId:'garbanzo',qty:3000,unit:'g'}],
   packaging:[{envId:'fritos',qty:1,unit:'u'}],
   combos:[{prodId:'tahini',qty:30,unit:'g',addPackaging:true}],
   fixedPrices:{mostrador:11800}},
  {id:'tahini',pesoTotal:1000,pesoUnit:'g',porciones:1,
   ingredients:[{ingId:'sesamo',qty:1000,unit:'g'}],
   packaging:[],combos:[]}
 ];
 return {products,ingredients:[
   {id:'garbanzo',precioPkg:8762.5,grPaquete:3000,cantidad:3000,unit:'g'},
   {id:'sesamo',precioPkg:3523.6,grPaquete:1000,cantidad:1000,unit:'g'}],
  packs:[{id:'fritos',precioPkg:17041.7,cantidad:100}]};
};
describe('Auditoría no autorizante de la ración de seis croquetas',()=>{
 it('separa ingredientes por 25 raciones pero usa tahini y envase una vez por venta',()=>{
  const result=auditFalafelRacion(fixture());
  expect(result.batchCroquettes).toBe(150);
  expect(result.batchRations).toBe(25);
  expect(result.ingredientCostPerRation).toBe(350.5);
  expect(result.fullTahiniCostPerSale).toBe(105.71);
  expect(result.fullPackagingCostPerSale).toBe(170.42);
  expect(result.correctedCostEstimate).toBe(626.63);
  expect(result.legacyCostPerUnit).toBe(361.55);
  expect(result.directCostUnderstatement).toBe(265.08);
  expect(result.costReconstructionComplete).toBe(true);
  expect(result.verified).toBe(false);
  expect(result.discountApproved).toBe(false);
 });
 it('el auditor general marca como incompleto el cálculo tradicional que divide salsa y envase /25',()=>{
  const data=fixture();
  data.channels=[{id:'mostrador',name:'Mostrador',commission:0,enabled:true}];
  data.project={estUnitsMonth:100};
  data.gastosOp=[];data.gastosS=[];
  const result=auditProductPromotionEconomics(data,'falafel');
  expect(result.sourceComplete).toBe(false);
  expect(result.issues).toContain('sale_tahini_and_packaging_diluted_in_batch_cost');
  expect(result.sixCroquetteSaleCostEstimate).toBe(626.63);
  expect(result.discountApproved).toBe(false);
 });
 it('si falta precio de envase no valida reconstrucción y no autoriza descuento',()=>{
  const s=fixture();s.packs=[];
  const result=auditFalafelRacion(s);
  expect(result.issues).toContain('packaging_cost_missing');
  expect(result.costReconstructionComplete).toBe(false);
  expect(result.discountApproved).toBe(false);
 });
 it('no confunde tres croquetas del mix con ración de seis',()=>{
  const s=fixture();s.products[0].porcionCant=3;
  const result=auditFalafelRacion(s);
  expect(result.issues).toContain('croquettes_yield_or_sale_quantity_not_verified');
  expect(result.discountApproved).toBe(false);
 });
 it('si la salsa ya no se sirve en 30g bloquea hasta revisión',()=>{
  const s=fixture();s.products[0].combos[0].qty=10;
  expect(auditFalafelRacion(s).issues).toContain('tahini_serving_not_verified');
 });
});
