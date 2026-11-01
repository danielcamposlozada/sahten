// Contexto de intención HMAC derivado exclusivamente en Edge; nunca leer
// sessionId/menuRevision del navegador ni poner el secreto en el menú público.
import {sha256,PaymentError} from './core.js';
export async function upsellRequestContext({storeId,menu,order,proof,secret}={}){
  if(typeof secret!=='string'||new TextEncoder().encode(secret).length<32)
    throw new PaymentError('El servicio de ofertas no está configurado.',409,'upsell_secret_missing');
  if(typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof))
    throw new PaymentError('La sesión de compra no es válida.',400,'invalid_upsell_session');
  if(!menu||!order||!['pickup','delivery'].includes(order.source))
    throw new PaymentError('Pedido de oferta inválido.',400,'invalid_upsell_order');
  const products=(menu.products||[]).map(p=>[p.id,p.price,p.priceRevision||'',
    p.salesAvailability||null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const delivery=order.source==='delivery'
    ? [order.address,order.lat,order.lng,order.deliveryQuoteId||null]:null;
  const fingerprint=JSON.stringify({storeId,products,
    config:menu.config,benefit:menu.payments?.benefit,
    promotions:menu.promotions,deliveryPolicy:menu.delivery,source:order.source,
    paymentMethod:order.paymentMethod,delivery});
  const [sessionId,menuRevision]=await Promise.all([
    sha256('sahten-upsell-session-v1:'+proof),
    sha256('sahten-upsell-pricing-v1:'+fingerprint)
  ]);
  return {storeId,sessionId,menuRevision,secret};
}
