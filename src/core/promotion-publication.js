import { promotionRule } from './promotion-policy.js';
import { validateCampaignDraft } from './campaign-builder.js';
// Gatekeeper: rules are checked again against the real catalog and costs by the server.
export function publicationKind(type, proposal={},config={}) {
  if(type==='campaigns'){
    if(proposal.enabled!==true)return {ready:false,reason:'Primero incluí la campaña en la planificación local.'};
    if(!/^[a-z0-9][a-z0-9_-]{2,50}$/.test(String(proposal.id||'')) || proposal.kind!=='public')
      return {ready:false,reason:'El identificador de la campaña no es válido.'};
    const issues=validateCampaignDraft(proposal);
    if(issues.length)return {ready:false,reason:issues.join(' ')};
    if(!Array.isArray(proposal.channels)||proposal.channels.length!==1||proposal.channels[0]!=='online')
      return {ready:false,reason:'La primera publicación verificada admite solo el canal Tienda online. Mostrador requiere cotización específica.'};
    if((proposal.productIds||[]).some(id=>Number(proposal.extraPercent)+Number(config.paymentPercent??10)>promotionRule(config,id,proposal).maxTotalPercent))
      return {ready:false,reason:'El descuento supera el máximo total configurado ('+promotionRule(config).maxTotalPercent+'%). Revisá Reglas de rentabilidad.'};
    if(!Number.isInteger(Number(proposal.priority??10)) || Number(proposal.priority??10)>100)
      return {ready:false,reason:'Revisá la prioridad (0–100).'};
    return {ready:true,reason:'Lista para verificar costos y publicarse pausada. Después podrás activarla desde el switch en vivo.'};
  }
  if (type!=='crossSells')return {ready:false,reason:type==='campaigns'
    ?'Las campañas deben publicarse y validarse con el motor de descuentos.'
    :type==='couponPrograms'?'El programa necesita emisión y canje único verificados en el servidor.'
    :type==='productUpgrades'?'La mejora requiere costo verificado y reemplazo seguro en checkout.'
    :'El complemento con descuento requiere márgenes y recotización verificados en checkout.'};
  if (proposal.enabled!==true)return {ready:false,reason:'Primero incluí la propuesta en la planificación local.'};
  if (Number(proposal.extraPercent||0)!==0 || Number(proposal.discountPercent||0)!==0 || (Array.isArray(proposal.discountTiers)&&proposal.discountTiers.length>0))return {ready:false,reason:'Solo se publican sugerencias sin descuento desde esta opción.'};
  const places=proposal.placement||proposal.advertising?.placement||['cart'];
  if (!Array.isArray(places) || !places.length || places.some(x=>x!=='cart'))
    return {ready:false,reason:'Por ahora las sugerencias pueden publicarse únicamente en el carrito.'};
  return {ready:true,reason:'Se puede publicar como sugerencia a precio completo en el carrito.'};
}
export function preparePublishedRecommendation(proposal,products=[]) {
  const gate=publicationKind('crossSells',proposal);
  if(!gate.ready)throw new Error(gate.reason);
  const id=String(proposal.id||'');
  if(!/^[a-z0-9][a-z0-9_-]{2,50}$/.test(id))throw new Error('El identificador no es válido para publicar.');
  const name=String(proposal.name||'').trim();
  if(name.length<3||name.length>100)throw new Error('El título debe tener entre 3 y 100 caracteres.');
  const available=new Map(products.filter(x=>x?.id&&Number(x.price)>0&&x.salesAvailability?.retired!==true)
    .map(x=>[x.id,x]));
  const productId=String(proposal.productId||'');
  if(!available.has(productId)||available.get(productId).category==='Bebidas')
    throw new Error('El producto sugerido no está publicado como comida a precio de lista.');
  const triggers=Array.isArray(proposal.triggerProductIds)?[...new Set(proposal.triggerProductIds)]:[];
  if(!triggers.length||triggers.length>25||triggers.some(id=>!available.has(id)))
    throw new Error('Revisá los productos que activan la sugerencia: deben estar publicados.');
  const excludes=Array.isArray(proposal.suppressIfPresent)?[...new Set(proposal.suppressIfPresent)]:[];
  if(excludes.some(id=>!available.has(id)))throw new Error('Una exclusión hace referencia a un producto no publicado.');
  const priority=Number(proposal.priority??30);
  if(!Number.isInteger(priority)||priority<0||priority>100)throw new Error('La prioridad debe estar entre 0 y 100.');
  return {id,name,enabled:true,priority,productId,triggerProductIds:triggers,
    suppressIfPresent:excludes,placement:['cart']};
}
