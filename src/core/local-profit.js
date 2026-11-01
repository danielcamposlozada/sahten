// Rentabilidad local basada en el costo histórico capturado al registrar cada pedido.
// No aplica gastos fijos mensuales de nuevo: cada línea YA contiene el GF asignado.
const cents=n=>Math.round((Number(n)||0)*100)/100;
const localOrigin=o=>['mostrador','menu-online','online','tienda-online'].includes(String(o?.origin||'').toLowerCase());
const completed=o=>['retirado','entregado','completado','completed','delivered'].includes(String(o?.status||'').toLowerCase());
const monthKey=(stamp)=>{const d=new Date(stamp);if(!Number.isFinite(d.valueOf()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit'}).format(d).replace(/\//g,'-');};
export function currentLocalMonth(now=new Date()){return monthKey(now);}
export function localMonthlyProfit(s,{month=currentLocalMonth(),now=new Date()}={}){
  const result={month,orders:0,covered:0,missing:0,excluded:0,discountedSales:0,revenue:0,variable:0,fixed:0,commission:0,
    profit:0,marginPct:null,goal:Number(s.project?.localProfitGoal)||0,daysElapsed:0,daysInMonth:0};
  for(const o of s.orders||[]){
    if(!localOrigin(o)||!completed(o)||monthKey(o.createdAt||o.date)!==month){result.excluded++;continue;}
    result.orders++;const entry=s.saleCosts?.[o.id];
    if(!entry||!['at-sale','published-quote'].includes(entry.basis)||entry.channel!=='mostrador'||
       !Array.isArray(entry.items)||!entry.items.length||entry.items.some(i=>i.missing||
       !['revenue','variable','fixed','commission'].every(k=>Number.isFinite(Number(i[k]))))){result.missing++;continue;}
    result.covered++;
    for(const item of entry.items){
      result.revenue+=Number(item.revenue);result.variable+=Number(item.variable);
      result.fixed+=Number(item.fixed);result.commission+=Number(item.commission);
    }
  }
  for(const k of ['revenue','variable','fixed','commission'])result[k]=cents(result[k]);
  result.profit=cents(result.revenue-result.variable-result.fixed-result.commission);
  result.marginPct=result.revenue>0?result.profit/result.revenue*100:null;
  const [year,mo]=String(month).split('-').map(Number);
  if(year>2000&&mo>=1&&mo<=12){
    result.daysInMonth=new Date(year,mo,0).getDate();
    result.daysElapsed=month===monthKey(now)?Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric'}).format(now)):result.daysInMonth;
  }
  result.progressPct=result.goal>0?Math.max(0,result.profit/result.goal*100):null;
  result.remaining=result.goal>0?Math.max(0,cents(result.goal-result.profit)):null;
  result.complete=result.missing===0;
  return result;
}
export function localProductProfitability(s){
  const {channelPriceWithDisc}=s.pricing;
  return (s.products||[]).filter(p=>!p.recetaOnly).map(p=>{
    const price=channelPriceWithDisc(s,p,'mostrador'),varCost=s.costPerUnit(s,p,'mostrador'),
      gf=s.gfAssigned(s,p,'mostrador'),com=s.channelCommission(s,p,'mostrador');
    const valid=Number.isFinite(Number(price))&&price>0&&Number.isFinite(Number(varCost))&&Number.isFinite(Number(gf));
    const margin=valid?cents(price-varCost-gf-price*com):null;
    const cashPrice=valid?cents(price*.9):null;
    const cashMargin=valid?cents(cashPrice-varCost-gf):null;
    return {id:p.id,name:p.name,productType:p.productType||'prepared',price,varCost,gf,commissionRate:com,
      costVerified:p.pricingPolicies?.mostrador?.variableCost!=null && p.pricingPolicies?.mostrador?.fixedCost!=null,
      profit:margin,marginPct:margin==null?null:margin/price*100,
      cashProfit:cashMargin,cashMarginPct:cashMargin==null?null:cashMargin/cashPrice*100};
  }).sort((a,b)=>(a.marginPct??Infinity)-(b.marginPct??Infinity));
}
