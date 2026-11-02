// La cuarta Fatay es una REEMPLAZO de la Promo 3U, no un producto de carta.
// Uso exclusivo del carrito; no introduce un SKU ni un precio inventado.
export const FATAY_THREE_ID='p1779467294622';
export const FATAY_FOUR_ID='p1779570052552';
export function eligibleFatayUpgrade(menu,cart) {
 const products=Array.isArray(menu?.products)?menu.products:[];
 const three=products.find(p=>p.id===FATAY_THREE_ID);
 const four=products.find(p=>p.id===FATAY_FOUR_ID&&p.upsellOnly===true);
 if(!three||!four||!Number.isFinite(Number(four.price))||Number(four.price)<=Number(three.price)||
    four.retired===true||four.salesAvailability?.paused===true)return null;
 if(!Number.isInteger(Number(cart?.[FATAY_THREE_ID]))||Number(cart[FATAY_THREE_ID])<1||
    Number(cart?.[FATAY_FOUR_ID]||0)>0)return null;
 return {threeId:FATAY_THREE_ID,fourId:FATAY_FOUR_ID,
    replacementPrice:Number(four.price),currentPrice:Number(three.price),
    extraAtList:Number(four.price)-Number(three.price),
    name:four.name,units:4};
}
export function applyFatayUpgrade(menu,cart){
 const rule=eligibleFatayUpgrade(menu,cart);
 if(!rule)return {applied:false,cart};
 const next={...cart,[rule.threeId]:Number(cart[rule.threeId])-1,
   [rule.fourId]:1};
 if(next[rule.threeId]===0)delete next[rule.threeId];
 return {applied:true,cart:next,upgrade:rule};
}
