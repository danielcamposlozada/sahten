// Recomendación contextual de bebida, sin descuentos extra ni acceso a costos.
// Solo se sugieren productos publicados y disponibles, nunca bebidas solas.
export function recommendBeverage({products=[],cart=[],policy=null,showPrices=true}={}){
  if(!policy?.enabled || !showPrices || !Array.isArray(products) || !Array.isArray(cart))return null;
  const selected=new Set(cart.filter(x=>Number(x.qty)>0).map(x=>String(x.productId||x.id)));
  if(!selected.size)return null;
  const catalogue=new Map(products.filter(p=>p&&typeof p.id==='string').map(p=>[p.id,p]));
  // No presionar con bebidas cuando el pedido ya tiene alguna.
  if([...selected].some(id=>catalogue.get(id)?.category==='Bebidas'))return null;
  const subtotal=cart.reduce((n,x)=>{
    const p=catalogue.get(String(x.productId||x.id));
    return n+(p&&Number.isFinite(Number(p.price))?Number(p.price)*Number(x.qty||0):0);
  },0);
  const groups=(policy.contexts||[]).filter(g=>
    g && Array.isArray(g.triggerProductIds) &&
    g.triggerProductIds.some(id=>selected.has(id)) &&
    Number(g.minEligibleSubtotal||0)<=subtotal &&
    (g.maxEligibleSubtotal==null || subtotal<=Number(g.maxEligibleSubtotal))
  ).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
  const options=new Set((policy.options||[]).map(x=>x.id));
  for(const group of groups){
    for(const id of group.options||[]){
      if(!options.has(id)||selected.has(id))continue;
      const p=catalogue.get(id);
      if(!p || p.retired || p.salesAvailability?.paused===true || p.salesAvailability?.retired===true ||
        p.category!=='Bebidas'||!Number.isFinite(Number(p.price))||Number(p.price)<=0)continue;
      return {id:p.id,name:p.name,price:Number(p.price),group:group.id,headline:group.name||'¿Sumás una bebida?',extraDiscountPercent:0};
    }
  }
  return null;
}
