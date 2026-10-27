import { quoteOrder, PaymentError, fail, validUuid, cents } from '../payments/core.js';
import { validateDeliveryPolicy } from './geometry.js';
import { deliveryQuote } from '../core/delivery.js';
import { deliveryDetails } from '../core/order-details.js';
const uuid=v=>{if(!validUuid(v))fail('Identificador no válido.');return v;};
const intent=o=>{
 const d=deliveryDetails(o),cash=o.paymentMethod==='efectivo'&&o.cashTendered!==''&&o.cashTendered!=null?cents(o.cashTendered):null;
 return JSON.stringify([o.source,(o.items||[]).map(i=>[i.productId||i.id,i.qty]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),o.paymentMethod,cash,d.addressFloor||'',d.addressApartment||'',d.deliveryReference||'',String(o.customerName||'').trim(),String(o.customerPhone||'').trim(),o.source==='delivery'?Number(o.lat):null,o.source==='delivery'?Number(o.lng):null,o.source==='delivery'?String(o.address||'').trim():'Retiro en local',cents(o.total),String(o.notes||'').trim()]);
};
export function authorizationFrom(record,policy,destination){
  if(!record?.authorized_at||record.revision!==policy.revision||record.route?.destination?.lat!==destination.lat||record.route?.destination?.lng!==destination.lng)return null;
  return {approved:true,revision:policy.revision,destination,actor:record.authorized_by,reason:record.authorization_reason,at:record.authorized_at,tariffFloorException:!!record.tariff_exception};
}
/** Solo datos y acciones explícitas: el navegador no puede dar por validada su propia ruta. */
export function createDeliveryService({repo,authenticate,resolveRoute,geocode,now=()=>Date.now(),originKey=async()=> 'unknown'}) {
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 async function access(req,sid,admin=false){const user=await authenticate(req);if(!user||!await (admin?repo.canManage:repo.canOperate)(sid,user))fail('Iniciá sesión con un rol autorizado para esta acción.',403);return user;}
 async function limited(sid,req){if(!await repo.run('limit',{bucket:'store:'+sid,max:100})||!await repo.run('limit',{bucket:'buyer:'+sid+':'+await originKey(req),max:25}))fail('Demasiadas consultas. Esperá un minuto.',429);}
 async function context(sid,input){
  const menu=await repo.menu(sid),policy=menu?.delivery?.deliveryV2;
  if(!policy?.active)fail('La nueva configuración de delivery todavía no está activa.',409,'delivery_not_active');
  const validation=input.source==='delivery'?validateDeliveryPolicy(policy):{errors:[]};if(validation.errors.length)fail('La configuración de zonas necesita revisión administrativa.',409,'invalid_policy');
  const destination={lat:Number(input.lat),lng:Number(input.lng)};
  let route=null,authorization=null,record=null;
  if(input.source==='delivery'){
   if(input.lat==null||input.lng==null)fail('Seleccioná una dirección.');
   if(deliveryQuote(policy,destination,0,{now:now()}).status==='route_unverified')route=await resolveRoute(sid,policy.center,destination);
   if(input.deliveryQuoteId){record=await repo.run('quote',{store_id:sid,id:uuid(input.deliveryQuoteId)});authorization=authorizationFrom(record,policy,destination);}
  }
  return {menu,policy,route,authorization,record,now:now()};
 }
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{
   const url=new URL(req.url),action=url.pathname.split('/').filter(Boolean).at(-1);
   if(req.method==='GET'&&['provider','requests'].includes(action)){
    const sid=uuid(url.searchParams.get('store_id'));await access(req,sid,action==='provider');
    return response(await repo.run(action==='provider'?'provider_status':'requests',{store_id:sid}));
   }
   if(!['POST','PUT'].includes(req.method))fail('Acción no disponible.',404);
   const raw=await req.text();if(raw.length>30000)fail('Pedido demasiado grande.',413);let b;try{b=JSON.parse(raw);}catch{fail('Solicitud inválida.');}
   const sid=uuid(b.storeId);
   if(action==='provider'&&req.method==='PUT'){
    await access(req,sid,true);const key=String(b.key||'').trim();if(key.length<20||key.length>1000||/[\r\n]/.test(key))fail('Revisá la clave de openrouteservice.');
    await repo.run('save_provider',{store_id:sid,key});return response({configured:true});
   }
   if(action==='authorize'){
    const user=await access(req,sid,true),record=await repo.run('quote',{store_id:sid,id:uuid(b.quoteId)}),reason=String(b.reason||'').trim().slice(0,300);
    if(!record)fail('La solicitud venció. Volvé a calcularla.',409);
    if(reason.length<5)fail('Explicá el motivo de la autorización.');
    const menu=await repo.menu(sid),p=menu.delivery?.deliveryV2;
    if(!p?.active||p.revision!==record.revision)fail('Cambió la configuración. Volvé a calcular la entrega.',409);
    const q=deliveryQuote(p,record.route.destination,record.result.netSubtotal,{route:record.route,now:now(),hasPaymentDiscount:!!record.payload.paymentDiscount});
    if(!['available','authorization_required'].includes(q.status))fail('No se puede autorizar una zona pausada, fuera de cobertura o bajo el mínimo.',409);
    await repo.run('authorize',{store_id:sid,id:record.id,actor:user.id,reason,tariff_exception:b.tariffFloorException===true});
    return response({approved:true});
   }
   await limited(sid,req);
   if(action==='geocode'){const menu=await repo.menu(sid),query=String(b.query||'').trim();if(query.length<5||query.length>200)fail('Escribí calle, altura y localidad.');if(!menu?.delivery?.deliveryV2)fail('Falta configurar las zonas.',409);return response(await geocode(query,menu.delivery.deliveryV2.center,sid));}
   if(!['quote','request','order','validate-pos'].includes(action))fail('Acción no disponible.',404);
   const operator=action==='validate-pos'||b.pos===true?await access(req,sid):null;
   const input=b.order||{};
   if(action==='order'){const previous=await repo.run('submission',{store_id:sid,request_id:uuid(b.requestId)});if(previous?.order){if(intent(input)!==intent(previous.order))fail('Ese intento corresponde a otro pedido.',409,'order_conflict');return response(previous);}}
   const ctx=await context(sid,input);
   if(operator){ctx.salesChannel='mostrador';ctx.requireCustomer=false;const rules=await repo.posRules(sid);if(rules.tienda?.deliveryV2&&rules.tienda.deliveryV2.revision!==ctx.policy.revision)fail('La configuración de delivery cambió. Sincronizá el proyecto y publicá el menú antes de confirmar.',409,'menu_changed');if(Array.isArray(rules.catalog)){ctx.menu={...ctx.menu,config:{enabled:true,showPrices:true},products:rules.catalog.map(p=>({id:p.id,name:p.name,category:p.category,salesAvailability:p.salesAvailability,price:p.fixedPrices?.mostrador,priceRevision:p.quoteIds?.mostrador})),payments:{...ctx.menu.payments,benefit:rules.tienda?.paymentBenefit??ctx.menu.payments?.benefit}};}ctx.allowedMethods=(rules.payments||[]).map(p=>p.method||({efectivo:'efectivo',transferencia:'transferencia','mercado pago':'mercadopago',tarjeta:'tarjeta'})[String(p.name||'').toLowerCase()]||'other');if(input.manualDiscountId){ctx.commercialDiscount=rules.discounts?.find(d=>d.id===input.manualDiscountId);if(!ctx.commercialDiscount)fail('El descuento cambió. Sincronizá el proyecto y revisá el pedido.',409);}}
   if(action==='order'&&input.paymentMethod==='mercadopago')fail('Completá el pago mediante Checkout Pro.');
   const order=quoteOrder(ctx.menu,input,{...ctx,allowOtherPayments:true,validateCustomer:action==='order'||action==='validate-pos'});
   if(action==='order'||action==='validate-pos'){
    if(cents(input.total)!==cents(order.total))fail('Cambió el total. Revisá el pedido y volvé a confirmar.',409,'menu_changed');
    if(action==='validate-pos'){const id=String(input.localOrderId||'');if(!/^ord_[a-z0-9]{6,80}$/.test(id))fail('Identificador de venta local inválido.');return response({order,validationId:await repo.savePos(sid,id,order)});}
    const result=await repo.run('order',{store_id:sid,request_id:uuid(b.requestId),payload:{...order,num:Math.floor(Math.random()*9000)+1000,createdAt:new Date(now()).toISOString(),status:'pendiente'}});
    return response({...result,order:result.order||order});
   }
   const q=order.shippingQuote;delete order.shippingQuote;
   if(action==='request'&&(String(input.customerName||'').trim().length<2||String(input.customerPhone||'').replace(/\D/g,'').length<7))fail('Completá nombre y teléfono para solicitar autorización.');
   if(action==='request'&&q?.status!=='authorization_required')fail('Esta dirección no necesita autorización o no es elegible.',409);
   let record=ctx.record?.revision===ctx.policy.revision&&intent(ctx.record.payload)===intent(order)?ctx.record:null;
   if(!record&&ctx.route&&['available','authorization_required','below_minimum'].includes(q?.status))record=await repo.run('save_quote',{store_id:sid,payload:order,route:ctx.route,result:q,revision:ctx.policy.revision});
   if(action==='request')await repo.run('request',{store_id:sid,id:record.id,payload:order});
   return response({serverNow:now(),quote:q||null,route:ctx.route,quoteId:ctx.authorization?input.deliveryQuoteId:record?.id,authorization:ctx.authorization,order,requested:action==='request'});
  }catch(e){
   const known=e instanceof PaymentError;
   const routing=String(e.message||'').startsWith('routing_');
   return response({error:known?e.code:routing?e.message:'delivery_unavailable',message:known?e.message:e.message==='routing_geocoder_rate_limited'?'La búsqueda de direcciones alcanzó su límite temporal. Esperá un momento y volvé a buscar.':e.message==='routing_geocoder_unavailable'?'El buscador de direcciones no está disponible en este momento. Reintentá en unos minutos o elegí retiro.':e.message==='routing_not_configured'?'Falta conectar openrouteservice en Ajustes. No se confirmó el envío.':routing?'No se pudo validar el recorrido por calles. Reintentá o elegí retiro.':'No se pudo completar la consulta de envío. Reintentá sin duplicar el pedido.'},known?e.status:503);
  }
 };
}
