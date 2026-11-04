import {describe,it,expect,vi} from 'vitest';
import {createStorefrontUpsells} from '../src/online/storefront-upsells.js';
function setup(){
 let i=0;const c={connected:true,source:'pickup',method:'transferencia',coupon:'',items:[{productId:'plato',qty:1}],menu:{products:[{id:'plato',price:30000},{id:'baklava',price:7000}],promotions:{enabled:true,upsells:[{id:'baklava-up',name:'Baklava adicional',enabled:true,kind:'upsell',maxUnits:1,productIds:['baklava'],triggerProductIds:['plato']}]}}};
 const request=vi.fn(async()=>({offerId:'baklava-up',productId:'baklava',token:'signed-server-token',expiresAt:5000,total:32600,discount:4400,line:{base:7000,net:5600}}));
 let time=1000;const editor=createStorefrontUpsells({context:()=>c,request,add:id=>c.items.push({productId:id,qty:1}),onChange:vi.fn(),uuid:()=>String(++i),now:()=>time});
 return{c,request,editor,setTime:t=>time=t};
}
describe('Aceptación explícita del complemento en la tienda',()=>{
 it('no agrega el producto al consultar y usa únicamente el total devuelto por servidor al aceptar',async()=>{
  const x=setup();expect(x.editor.benefit('transferencia')).toBeNull();
  await x.editor.consult('baklava-up');expect(x.c.items).toHaveLength(1);
  expect(x.editor.accept('baklava-up')).toBe(true);expect(x.c.items).toHaveLength(2);
  expect(x.editor.benefit('transferencia').amount).toBe(4400);
  expect(x.editor.submission()).toMatchObject({upsellToken:'signed-server-token',upsellOfferId:'baklava-up'});
  expect(x.editor.benefit('mercadopago')).toBeNull();
 });
 it('cambiar cantidades o vencer la oferta exige revisar el nuevo total; no cobra otro precio silenciosamente',async()=>{
  for(const change of [x=>x.c.items[0].qty++,x=>x.setTime(5001),x=>x.c.method='mercadopago']){
   const x=setup();await x.editor.consult('baklava-up');x.editor.accept('baklava-up');change(x);
   expect(x.editor.canSubmit()).toBe(false);expect(x.editor.view().needsReview).toBe(true);
   expect(x.editor.submission()).toEqual({});x.editor.clear();expect(x.editor.canSubmit()).toBe(true);
  }
 });
 it('descarta respuestas viejas y no ofrece combinaciones con cupón ni delivery',async()=>{
  const x=setup();let resolve;
  x.request.mockImplementationOnce(()=>new Promise(r=>resolve=r));const task=x.editor.consult('baklava-up');
  x.c.items[0].qty=2;resolve({offerId:'baklava-up',token:'old',expiresAt:5000,total:1,discount:1,line:{base:1,net:0}});await task;
  expect(x.editor.accept('baklava-up')).toBe(false);
  x.c.coupon='SHT-EXAMPLE';expect(x.editor.view().candidates).toHaveLength(0);
  x.c.coupon='';x.c.source='delivery';expect(x.editor.view().candidates).toHaveLength(0);
 });
});
