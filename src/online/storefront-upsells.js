// Estado de carrito público: solo muestra importes recibidos del servidor.
// No firma ofertas, no aprueba costos y no calcula el descuento incremental.
export function createStorefrontUpsells({context,request,add,onChange,uuid,now=()=>Date.now()}){
 let selected=null,offers=new Map(),busy=false,message='',needsReview=false,generation=0;
 const sessionId=uuid();
 const key=()=>{const c=context();return JSON.stringify([c.items,c.method,c.source,c.coupon,c.menu?.products,c.menu?.promotions,c.menu?.payments,c.menu?.config]);};
 function active(){
  if(selected&&(selected.key!==key()||selected.offer.expiresAt<=now())){
   selected=null;needsReview=true;message='La oferta cambió o venció. Revisá el total antes de continuar.';
  }
  return selected;
 }
 function candidates(){
  const c=context();
  if(!c.connected||c.source!=='pickup'||!['efectivo','transferencia'].includes(c.method)||c.coupon||c.menu?.promotions?.enabled!==true)return [];
  return (c.menu.promotions.upsells||[]).filter(r=>r.enabled&&r.kind==='upsell'&&r.maxUnits===1
   &&r.productIds?.length===1&&!c.items.some(l=>r.productIds.includes(l.productId))
   &&c.items.some(l=>r.triggerProductIds?.includes(l.productId))
   &&!c.items.some(l=>r.suppressIfPresent?.includes(l.productId)))
   .sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)).slice(0,2);
 }
 async function consult(id){
  if(busy||active()||needsReview||!candidates().some(r=>r.id===id))return;
  const fingerprint=key(),g=++generation;busy=true;message='Consultando la oferta del pedido…';onChange();
  try{
   const offer=await request({offerId:id,sessionId});
   if(g!==generation||fingerprint!==key())return;
   if(offer.offerId!==id||typeof offer.token!=='string'||!Number.isFinite(offer.expiresAt)
    ||offer.expiresAt<=now()||!Number.isFinite(offer.total)||!Number.isFinite(offer.discount)
    ||!Number.isFinite(offer.line?.net)||!Number.isFinite(offer.line?.base))throw new Error('No se recibió una oferta válida.');
   offers.set(id,{offer,key:fingerprint});message='';
  }catch(e){if(g===generation)message=e.message||'No se pudo comprobar esta oferta.';}
  finally{if(g===generation){busy=false;onChange();}}
 }
 function accept(id){
  const entry=offers.get(id);
  if(busy||active()||needsReview||!entry||entry.key!==key()||entry.offer.expiresAt<=now())return false;
  if(!candidates().some(r=>r.id===id))return false;
  add(entry.offer.productId);
  selected={offer:entry.offer,key:key(),requestId:uuid()};offers.clear();message='Oferta incluida en el total. Se comprobará nuevamente al confirmar.';onChange();return true;
 }
 return {consult,accept,
  view(){const choice=active();return {selected:choice?.offer||null,candidates:choice||needsReview?[]:candidates().map(r=>({rule:r,offer:offers.get(r.id)?.key===key()?offers.get(r.id).offer:null})),busy,message,needsReview};},
  benefit(method){const value=active();return value&&method===context().method?{amount:value.offer.discount,label:'Beneficio por pago y complemento',paymentDiscount:null}:null;},
  submission(){const value=active();return value?{requestId:value.requestId,upsellToken:value.offer.token,upsellOfferId:value.offer.offerId,upsellSessionId:sessionId}:{};},
  canSubmit(){active();return !busy&&!needsReview;},
  clear(notify=true){selected=null;offers.clear();needsReview=false;message='';generation++;busy=false;if(notify)onChange();}
 };
}
