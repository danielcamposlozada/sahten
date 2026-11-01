// Protocolo de aceptación de un upsell. Nunca se lee trustedUpsellSelection del cliente.
// El servidor registra una cesta base SIN el extra y una cesta final CON exactamente
// una unidad. Ambos hashes incluyen tienda, método, entrega y precios publicados.
const cents = value => Math.round(Number(value)*100);
const validId = s => typeof s==='string' && /^[a-zA-Z0-9_-]{1,150}$/.test(s);
export class UpsellIntentError extends Error {
  constructor(reason){super(reason);this.name='UpsellIntentError';this.code='upsell_intent_invalid';}
}
const invalid = reason => {throw new UpsellIntentError(reason);};
export function normalizedItems(items){
  if(!Array.isArray(items) || !items.length || items.length>100)invalid('empty_cart');
  const acc=new Map();
  for(const item of items){
    const id=String(item?.productId||item?.id||''),qty=Number(item?.qty);
    if(!validId(id)||!Number.isInteger(qty)||qty<1||qty>99)invalid('invalid_item');
    const next=(acc.get(id)||0)+qty;
    if(next>99)invalid('too_many_units');
    acc.set(id,next);
  }
  return [...acc].sort((a,b)=>a[0].localeCompare(b[0])).map(([productId,qty])=>({productId,qty}));
}
export function incrementalCart(items,productId){
  if(!validId(productId))invalid('invalid_offer_product');
  const lines=normalizedItems(items);
  if(lines.some(l=>l.productId===productId))invalid('offer_already_in_cart');
  return normalizedItems([...lines,{productId,qty:1}]);
}
export function originalCartFromAccepted(items,productId){
  const lines=normalizedItems(items);
  if(!validId(productId)||!lines.some(l=>l.productId===productId&&l.qty===1))
    invalid('not_a_single_incremental_item');
  return normalizedItems(lines.filter(l=>l.productId!==productId));
}
function orderContext({storeId,order,menu,items}){
  if(!/^[a-f\d-]{36}$/i.test(String(storeId||'')))invalid('invalid_store');
  if(!['pickup','delivery'].includes(order?.source))invalid('invalid_source');
  if(!['mercadopago','efectivo','transferencia','tarjeta'].includes(order?.paymentMethod))
    invalid('invalid_payment_method');
  const delivery=order.source==='delivery'
    ? {lat:Number(order.lat),lng:Number(order.lng),address:String(order.address||'').trim().slice(0,300)}
    : null;
  if(delivery&&(!Number.isFinite(delivery.lat)||!Number.isFinite(delivery.lng)||
    Math.abs(delivery.lat)>90||Math.abs(delivery.lng)>180||delivery.address.length<5))
    invalid('delivery_destination_missing');
  const catalog=new Map((menu?.products||[]).map(x=>[x.id,x]));
  const products=normalizedItems(items).map(({productId,qty})=>{
    const p=catalog.get(productId);
    if(!p||p.recetaOnly||p.salesAvailability?.paused===true||
      menu?.config?.hiddenProducts?.includes(productId)||
      menu?.config?.hiddenCategories?.includes(p.category)||
      !Number.isFinite(Number(p.price))||Number(p.price)<=0)invalid('product_unavailable');
    return {productId,qty,unitCents:cents(p.price),revision:String(p.priceRevision||'')};
  });
  return JSON.stringify({storeId,source:order.source,method:order.paymentMethod,
    delivery,products});
}
export async function cartHash(params){
  const bytes=new TextEncoder().encode(orderContext(params));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function promo(menu,id,productId){
  const c=menu?.promotions;
  if(c?.enabled!==true || c.upsellGuardRequired===false)invalid('promotions_off');
  const offer=(c.upsells||[]).find(u=>u.id===id&&u.kind==='upsell'&&u.enabled===true
    &&u.maxUnits===1&&u.productIds?.includes(productId));
  if(!offer)invalid('offer_not_published');
  return offer;
}
export async function issueUpsellIntent({storeId,menu,order,productId,promotionId}){
  const offer=promo(menu,promotionId,productId);
  const before=normalizedItems(order?.items);
  if(before.some(l=>l.productId===productId)|| !before.some(l=>offer.triggerProductIds?.includes(l.productId))||
    before.some(l=>offer.suppressIfPresent?.includes(l.productId)))invalid('offer_not_eligible');
  const after=incrementalCart(before,productId);
  return {
    storeId,productId,promotionId,
    beforeHash:await cartHash({storeId,order,menu,items:before}),
    afterHash:await cartHash({storeId,order,menu,items:after}),
    before,after
  };
}
export async function verifyAcceptedUpsell({record,storeId,menu,order,requestId,now=Date.now()}){
  if(!record||!record.id || !record.product_id||!record.promotion_id||
    !/^[a-f\d-]{36}$/i.test(String(requestId||''))||
    record.store_id!==storeId)invalid('intent_not_found');
  const expiry=Date.parse(record.expires_at);
  if(!Number.isFinite(expiry)||expiry<=now)invalid('intent_expired');
  const offer=promo(menu,record.promotion_id,record.product_id);
  const before=originalCartFromAccepted(order?.items,record.product_id);
  if(!before.some(l=>offer.triggerProductIds?.includes(l.productId))||
    before.some(l=>offer.suppressIfPresent?.includes(l.productId)))invalid('offer_not_eligible');
  const [beforeHash,afterHash]=await Promise.all([
    cartHash({storeId,order,menu,items:before}),
    cartHash({storeId,order,menu,items:order.items})
  ]);
  if(record.before_hash!==beforeHash||record.after_hash!==afterHash)
    invalid('cart_modified_after_offer');
  if(record.redeemed_at && record.request_id!==requestId)invalid('intent_already_redeemed');
  return {
    redemption:{id:record.id,storeId,requestId,beforeHash,afterHash},
    trustedSelection:{verified:true,isIncremental:true,eligibleUnits:1,
      productId:record.product_id,promotionId:record.promotion_id}
  };
}
