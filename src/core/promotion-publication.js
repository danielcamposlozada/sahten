// Gatekeeper for publishing zero-discount local proposals as live cart recommendations.
// Actual publication still requires an authenticated owner/admin and server CAS validation.
export function publicationKind(type, proposal={}) {
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
