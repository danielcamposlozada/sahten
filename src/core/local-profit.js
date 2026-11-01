// Rentabilidad local basada en el costo histórico capturado al registrar cada pedido.
// No aplica gastos fijos mensuales de nuevo: cada línea YA contiene el GF asignado.
const cents=n=>Math.round((Number(n)||0)*100)/100;
const localOrigin=o=>['mostrador','menu-online','online','tienda-online'].includes(String(o?.origin||'').toLowerCase());
const completed=o=>['retirado','entregado','completado','completed','delivered'].includes(String(o?.status||'').toLowerCase());
const monthKey=(stamp)=>{const d=new Date(stamp);if(!Number.isFinite(d.valueOf()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit'}).format(d).replace(/\//g,'-');};
export function currentLocalMonth(now=new Date()){return monthKey(now);}
const validMonth=month=>/^(20\d{2})-(0[1-9]|1[0-2])$/.test(String(month));
export function monthlyGoal(s,month=currentLocalMonth(),now=new Date()){
  if(!validMonth(month))return null;
  const goals=s.project?.localProfitGoals;
  if(goals&&Object.prototype.hasOwnProperty.call(goals,month)){
    const n=Number(goals[month]);return Number.isFinite(n)&&n>=0?n:null;
  }
  // Previous versions stored a single value without a month. It is valid for the
  // current month ONLY; never reassign that value to historical/future periods.
  if((!goals||!Object.keys(goals).length)&&month===currentLocalMonth(now)){
    const n=Number(s.project?.localProfitGoal);
    return Number.isFinite(n)&&n>0?n:null;
  }
  return null;
}
export function setMonthlyGoal(s,{month,amount,now=new Date(),actor='admin'}={}){
  if(!validMonth(month))throw new Error('Mes inválido (AAAA-MM).');
  if(amount==null||String(amount).trim()==='')throw new Error('Ingresá una meta mensual.');
  const n=Number(amount);
  if(!Number.isFinite(n)||n<0||n>100000000000)throw new Error('Meta fuera de rango.');
  const target=Math.round(n*100)/100;
  if(!s.project||typeof s.project!=='object')s.project={};
  // If a legacy one-value goal exists, attach it to the current month before
  // editing any other period. Otherwise saving an older month would hide it.
  if(!s.project.localProfitGoals||!Object.keys(s.project.localProfitGoals).length){
    const old=Number(s.project.localProfitGoal),active=currentLocalMonth(now);
    if(Number.isFinite(old)&&old>0&&active){
      s.project.localProfitGoals={...s.project.localProfitGoals,[active]:Math.round(old*100)/100};
    }
  }
  s.project.localProfitGoals||={};
  const previous=monthlyGoal(s,month,now);
  if(previous===target&&Object.prototype.hasOwnProperty.call(s.project.localProfitGoals,month))return false;
  s.project.localProfitGoals[month]=target;
  s.project.localProfitGoalChanges||=[];
  s.project.localProfitGoalChanges.push({
    month,before:previous,after:target,at:new Date(now).toISOString(),actor:String(actor).slice(0,48)
  });
  // Preserve older versions' field as a compatibility snapshot, but it no longer
  // controls previous months or new periods.
  if(month===currentLocalMonth(now))s.project.localProfitGoal=target;
  return true;
}
export function monthlyGoalHistory(s,{now=new Date(),count=12}={}){
  const month=currentLocalMonth(now);
  if(!month)return [];
  const [yy,mm]=month.split('-').map(Number);
  const months=Math.max(1,Math.min(36,Math.floor(count)));
  return Array.from({length:months},(_,i)=>{
    const date=new Date(Date.UTC(yy,mm-1-i,1));
    const m=date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');
    const summary=localMonthlyProfit(s,{month:m,now});
    return {month:m,goal:monthlyGoal(s,m,now),profit:summary.profit,progressPct:summary.progressPct,
      covered:summary.covered,missing:summary.missing,orders:summary.orders,complete:summary.complete};
  });
}
export function localMonthlyProfit(s,{month=currentLocalMonth(),now=new Date()}={}){
  const result={month,orders:0,covered:0,missing:0,excluded:0,discountedSales:0,revenue:0,variable:0,fixed:0,commission:0,
    profit:0,marginPct:null,goal:monthlyGoal(s,month,now)||0,goalConfigured:monthlyGoal(s,month,now)!==null,daysElapsed:0,daysInMonth:0};
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
export function localMonthlyProductProfits(s,{month=currentLocalMonth()}={}){
  const items={};
  for(const order of s.orders||[]){
    if(!localOrigin(order)||!completed(order)||monthKey(order.createdAt||order.date)!==month)continue;
    const entry=s.saleCosts?.[order.id];
    if(!entry||!['at-sale','published-quote'].includes(entry.basis)||entry.channel!=='mostrador'||!Array.isArray(entry.items))continue;
    for(const item of entry.items){
      if(item.missing||!item.productId||!['qty','revenue','variable','fixed','commission'].every(k=>Number.isFinite(Number(item[k]))))continue;
      const row=items[item.productId] ||= {productId:item.productId,qty:0,revenue:0,profit:0,orders:0};
      row.qty+=Number(item.qty);
      row.revenue+=Number(item.revenue);
      row.profit+=Number(item.revenue)-Number(item.variable)-Number(item.fixed)-Number(item.commission);
      row.orders++;
    }
  }
  for(const row of Object.values(items)){row.revenue=cents(row.revenue);row.profit=cents(row.profit);}
  return items;
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
