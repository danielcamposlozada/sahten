// Código público sólo para DECIDIR QUÉ PREGUNTAR al servidor. No calcula descuentos.
// La autorización final pertenece a Edge con firma HMAC, nonce y economía privada.
export function availableCheckoutUpsell(menu,cart,{method}={}){
 if(menu?.promotions?.enabled!==true||menu.promotions.upsellGuardRequired!==true)return null;
 if(!['efectivo','transferencia','mercadopago'].includes(method))return null;
 if(!Array.isArray(menu.products)||!Array.isArray(menu.promotions.upsells))return null;
 const ids=new Set((cart||[]).map(x=>String(x.productId||x.id)));
 return menu.promotions.upsells.filter(o=>
  o&&o.enabled===true&&o.kind==='upsell'&&o.maxUnits===1&&
  (o.productIds||[]).some(id=>!ids.has(id)&&menu.products.some(p=>
   p.id===id&&Number(p.price)>0&&p.salesAvailability?.paused!==true&&p.retired!==true))&&
  (o.triggerProductIds||[]).some(id=>ids.has(id))&&
  !(o.suppressIfPresent||[]).some(id=>ids.has(id))
 ).sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0))
 .map(o=>({offerId:o.id,product:menu.products.find(p=>
  o.productIds.includes(p.id)&&!ids.has(p.id)&&p.salesAvailability?.paused!==true&&p.retired!==true)}))
 .find(o=>o.product)||null;
}
export function checkoutUpsellFingerprint(state){
 const items=(state.items||[]).map(x=>[String(x.productId||x.id),Number(x.qty),Number(x.unitPrice||0),String(x.priceRevision||''),!!x.unavailable]).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify([items,state.method,state.source,state.name,state.phone,state.address,
  state.addressFloor,state.addressApartment,state.reference,state.notes,state.cashTendered,
  state.lat,state.lng,state.shipping,state.deliveryQuoteId,state.routeRevision,state.menuRevision]);
}
export function acceptedCheckoutUpsell(state,current,at=Date.now()){
 return !!state?.accepted&&Number.isFinite(state.expiresAt)&&state.expiresAt>at&&
  Number.isFinite(state.orderTotal)&&state.orderTotal>0&&
  state.fingerprint===checkoutUpsellFingerprint(current);
}
