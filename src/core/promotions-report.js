// Reporte agregado a partir de snapshots inmutables guardados en cada pedido.
export function promotionReport(orders = []) {
  const result={orders:0,promotedOrders:0,provisionalOrders:0,gross:0,discount:0,netProducts:0,byPromotion:{}};
  for(const order of orders||[]){
    if(!order||order.status==='cancelado')continue;
    const snapshot=order.promotionSnapshot;
    if(!snapshot||snapshot.version!==1)continue;
    result.orders++;
    if(snapshot.costReview?.status==='provisional')result.provisionalOrders++;
    result.gross+=Number(snapshot.subtotal)||0;
    result.discount+=Number(snapshot.discount)||0;
    result.netProducts+=Number(snapshot.netSubtotal)||0;
    if((snapshot.appliedPromotionIds||[]).length)result.promotedOrders++;
    const countedPromotions=new Set();
    for(const line of snapshot.lines||[]){
      const key=line.appliedPromotionId;
      if(!key)continue;
      const row=result.byPromotion[key]||{id:key,orders:0,units:0,revenue:0,discount:0};
      row.units+=Number(line.qty)||0;
      row.revenue+=Number(line.net)||0;
      row.discount+=Number(line.promotionDiscount)||0;
      if(!countedPromotions.has(key)){row.orders++;countedPromotions.add(key);}
      result.byPromotion[key]=row;
    }
  }
  const round=n=>Math.round(n*100)/100;
  for(const k of ['gross','discount','netProducts'])result[k]=round(result[k]);
  for(const r of Object.values(result.byPromotion))for(const k of ['revenue','discount'])r[k]=round(r[k]);
  return result;
}
