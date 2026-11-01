// Autorización de complementos en DOS pasos, solo para Edge Functions.
// El navegador no puede crear un token: la clave HMAC vive exclusivamente en el backend.
// Esta librería NO concede descuento; exige verificaciones de rentabilidad posteriores.
const enc=new TextEncoder();
const allowedId=s=>typeof s==='string'&&/^[a-z0-9_-]{1,100}$/i.test(s);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=value=>{
 if(!/^[A-Za-z0-9_-]{1,8192}$/.test(value))fail('invalid_upsell_token');
 const bin=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(bin,c=>c.charCodeAt(0));
};
const canonical=rows=>{
 if(!Array.isArray(rows)||rows.length<1||rows.length>50)fail('invalid_upsell_cart');
 const known=new Set();
 return rows.map(r=>{
  const id=String(r?.productId||r?.id||''),qty=Number(r?.qty);
  if(!allowedId(id)||!Number.isSafeInteger(qty)||qty<1||qty>99||known.has(id))
    fail('invalid_upsell_cart');
  known.add(id);return {productId:id,qty};
 }).sort((a,b)=>a.productId.localeCompare(b.productId));
};
async function key(secret){
 if(typeof secret!=='string'||enc.encode(secret).length<32)fail('invalid_upsell_server_secret');
 return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const changed=(before,after,productId)=>{
 const a=new Map(before.map(x=>[x.productId,x.qty]));
 const b=new Map(after.map(x=>[x.productId,x.qty]));
 if(a.has(productId)||b.get(productId)!==1||b.size!==a.size+1)return false;
 for(const [id,qty] of a)if(b.get(id)!==qty)return false;
 return true;
};
/** Primera consulta desde el carrito SIN complemento. Emite una oferta por 5 min.
 * El endpoint debe obtener la sesión, el precio y el menú desde su contexto
 * autenticado/limitado. No usar configuraciones proporcionadas por el browser. */
export async function issueUpsellChallenge({
  secret,storeId,sessionId,productId,offerId,channel='online',method,
  menuRevision,baseCart,now=Date.now(),ttlMs=300000
}={}){
 if(!allowedId(storeId)||!allowedId(sessionId)||!allowedId(productId)||
   !allowedId(offerId)||!['online','mostrador'].includes(channel)||
   !['efectivo','transferencia','mercadopago'].includes(method)||
   !(typeof menuRevision==='string'&&menuRevision.length>0&&menuRevision.length<=100)||
   !Number.isSafeInteger(now)||!Number.isSafeInteger(ttlMs)||ttlMs<10000||ttlMs>300000)
   fail('invalid_upsell_challenge');
 const before=canonical(baseCart);
 if(before.some(x=>x.productId===productId))fail('upsell_already_in_cart');
 const nonce=b64(crypto.getRandomValues(new Uint8Array(24)));
 const claims={v:1,storeId,sessionId,productId,offerId,channel,method,menuRevision,
   baseCart:before,nonce,issuedAt:now,expiresAt:now+ttlMs};
 const encoded=b64(enc.encode(JSON.stringify(claims)));
 const signature=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(encoded))));
 return {token:encoded+'.'+signature,expiresAt:claims.expiresAt,productId,offerId};
}
/** Aceptación definitiva. Devuelve prueba de incremento SOLO tras verificar
 * firma, sesión, método, revisión, cambio exacto del carrito y consumo atómico
 * de nonce en el servidor; la protección de costos se comprueba por separado. */
export async function verifyAcceptedUpsell({
 secret,token,storeId,sessionId,channel='online',method,menuRevision,
 acceptedCart,consumeNonce,requestId,now=Date.now()
}={}){
 if(typeof token!=='string'||token.length>12000||
   typeof consumeNonce!=='function'||!allowedId(requestId)||
   !Number.isSafeInteger(now))fail('invalid_upsell_acceptance');
 const [payload,sig,...extra]=token.split('.');
 if(!payload||!sig||extra.length)fail('invalid_upsell_token');
 const mac=await key(secret);
 let valid=false;
 try{valid=await crypto.subtle.verify('HMAC',mac,un64(sig),enc.encode(payload));}
 catch{fail('invalid_upsell_token');}
 if(!valid)fail('invalid_upsell_signature');
 let claims;try{claims=JSON.parse(new TextDecoder().decode(un64(payload)));}catch{fail('invalid_upsell_token');}
 if(claims?.v!==1||!allowedId(claims.productId)||!allowedId(claims.offerId)||
   !allowedId(claims.nonce)||claims.storeId!==storeId||claims.sessionId!==sessionId||
   claims.channel!==channel||claims.method!==method||claims.menuRevision!==menuRevision||
   !Number.isSafeInteger(claims.issuedAt)||!Number.isSafeInteger(claims.expiresAt)||
   claims.expiresAt-claims.issuedAt>300000||claims.expiresAt-claims.issuedAt<10000||
   now>claims.expiresAt||now<claims.issuedAt-15000)
   fail('upsell_challenge_stale_or_mismatched');
 if(!changed(canonical(claims.baseCart),canonical(acceptedCart),claims.productId))
   fail('upsell_not_incremental');
 // consumeNonce DEBE ser un INSERT ON CONFLICT atómico, asociado al requestId;
 // si falla o ya se usó en otro pedido no hay beneficio.
 const consumed=await consumeNonce({
   nonce:claims.nonce,storeId,sessionId,requestId,offerId:claims.offerId,
   expiresAt:claims.expiresAt
 });
 if(consumed!==true)fail('upsell_token_already_used');
 return {verified:true,productId:claims.productId,isIncremental:true,
   eligibleUnits:1,offerId:claims.offerId,promotionId:claims.offerId,requestId};
}
