export function createDeliveryClient(w=window){
 async function call(action,fields={},authenticated=false){
  const online=w.SAHTEN.online,c=online.conn(),client=online.controller.client;
  if(!c.url||!c.storeId||!c.anonKey)throw new Error('Conectá la tienda en Nube y usuarios para validar rutas.');
  let token=c.anonKey;if(authenticated){if(!client||!online.controller.info().signedIn)throw new Error('Iniciá sesión para esta acción.');token=await client.auth.token();}
  const r=await w.fetch(c.url+'/functions/v1/sahten-delivery/'+action,{method:action==='provider'&&!fields.key||action==='requests'?'GET':action==='provider'?'PUT':'POST',headers:{apikey:c.anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(action==='provider'&&!fields.key||action==='requests'?{}:{body:JSON.stringify({...fields,storeId:c.storeId})})});
  let data;try{data=await r.json();}catch{throw new Error('El servidor de envíos todavía no está disponible.');}
  if(!r.ok){const e=new Error(data.message||'No se pudo validar el envío.');e.code=data.error;throw e;}return data;
 }
 // GET necesita el negocio en la URL; el resto usa un cuerpo JSON.
 async function get(action){const o=w.SAHTEN.online,c=o.conn(),cl=o.controller.client;if(!cl||!c.storeId||!o.controller.info().signedIn)throw new Error('Iniciá sesión en Nube y usuarios.');return cl.raw('/functions/v1/sahten-delivery/'+action+'?store_id='+encodeURIComponent(c.storeId),{token:await cl.auth.token()});}
 async function geocode(query){
  try{const rows=await call('geocode',{query});if(rows?.length)return rows;}catch(e){if(e.code!=='routing_geocoder_unavailable')throw e;}
  const r=await w.fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ar&accept-language=es&q='+encodeURIComponent(query));
  if(!r.ok)throw new Error(r.status===429?'El buscador está ocupado. Esperá un momento.':'El buscador de direcciones no está disponible. Reintentá en unos minutos.');return r.json();
 }
 return {geocode,quote:order=>call('quote',{order,pos:true},true),validate:order=>call('validate-pos',{order},true),authorize:(quoteId,reason,tariffFloorException=false)=>call('authorize',{quoteId,reason,tariffFloorException},true),provider:()=>get('provider'),saveProvider:key=>call('provider',{key},true),requests:()=>get('requests')};
}
