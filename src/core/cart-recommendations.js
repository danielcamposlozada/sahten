// Sugerencias contextuales, sin descuentos ni uso de datos privados.
// Orden determinista: hasta una bebida + un acompañamiento pertinente.
const itemId = row => String(row?.productId || row?.id || '');
const published = product => product && !product.retired
  && product.salesAvailability?.paused !== true
  && product.salesAvailability?.retired !== true
  && Number.isFinite(Number(product.price)) && Number(product.price) > 0;
export function recommendCartAddons({products=[],cart=[],policy=null,showPrices=true}={}){
  if(!policy?.enabled || !showPrices || !Array.isArray(products) || !Array.isArray(cart))return [];
  const catalog=new Map(products.filter(p=>p && typeof p.id==='string').map(p=>[p.id,p]));
  const quantities=new Map();
  for(const row of cart) {
    const id=itemId(row),qty=Number(row?.qty);
    if(catalog.has(id) && Number.isInteger(qty) && qty>0)
      quantities.set(id,(quantities.get(id)||0)+qty);
  }
  if(!quantities.size)return [];
  const has=id=>quantities.has(id), mainSubtotal=[...quantities]
    .filter(([id])=>catalog.get(id)?.category!=='Bebidas')
    .reduce((n,[id,qty])=>n+Number(catalog.get(id).price)*qty,0);
  const groups=Array.isArray(policy.beverageContexts)?policy.beverageContexts:[];
  const complements=Array.isArray(policy.complements)?policy.complements:[];
  const suggestions=[];
  const hasBeverage=[...quantities.keys()].some(id=>catalog.get(id)?.category==='Bebidas');
  const triggerFor=r=>(r.triggerProductIds||[]).find(id=>has(id));
  const matching=r=>Boolean(triggerFor(r));
  const ordered=(rows)=>[...rows].filter(Boolean).sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0));
  if(!hasBeverage){
    for(const group of ordered(groups)){
      if(!matching(group))continue;
      if(mainSubtotal<Number(group.minEligibleSubtotal||0)||
        (group.maxEligibleSubtotal!=null&&mainSubtotal>Number(group.maxEligibleSubtotal)))continue;
      const product=(group.options||[]).map(id=>catalog.get(id))
        .find(p=>p?.category==='Bebidas'&&!has(p.id)&&published(p));
      if(product){
        suggestions.push({id:product.id,name:product.name,price:Number(product.price),
          kind:'beverage',headline:String(group.name||'¿Sumás una bebida?').slice(0,100),
          contextProduct:catalog.get(triggerFor(group))?.name||''});
        break;
      }
    }
  }
  for(const c of ordered(complements)){
    if(!matching(c)|| (c.suppressIfPresent||[]).some(id=>has(id)))continue;
    const p=catalog.get(c.productId);
    if(!p || !published(p) || p.category==='Bebidas' || has(p.id))continue;
    if(suggestions.some(x=>x.id===p.id))continue;
    suggestions.push({id:p.id,name:p.name,price:Number(p.price),
      kind:'complement',headline:String(c.name||'¿Algo para acompañar?').slice(0,100),
      contextProduct:catalog.get(triggerFor(c))?.name||''});
    break;
  }
  return suggestions.slice(0,2);
}
