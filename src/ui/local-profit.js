import { state } from '../core/state.js';
import { costPerUnit } from '../core/costs.js';
import { gfAssigned } from '../core/gf.js';
import { channelPriceWithDisc, channelCommission } from '../core/pricing.js';
import { afterRender, onDataChanged, onPanelShow } from '../events.js';
import { localMonthlyProfit,localProductProfitability,localMonthlyProductProfits,monthlyGoal,setMonthlyGoal,monthlyGoalHistory,currentLocalMonth } from '../core/local-profit.js';
import './local-profit.css';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'$'+(Number(v)||0).toLocaleString('es-AR',{maximumFractionDigits:0});
const rounded=v=>Number.isFinite(Number(v))?Number(v).toFixed(1)+'%':'—';
export function installLocalProfitUi(w=window) {
  const d=w.document;
  const visible=()=>!d.body.classList.contains('role-no-costs');
  const canEdit=()=>visible()&&(!d.body.dataset.role||['owner','admin'].includes(d.body.dataset.role))&&!w.SAHTEN?.project?.session?.readOnly;
  const profitRows=()=>localProductProfitability({
    ...state,
    costPerUnit,gfAssigned,channelCommission,
    pricing:{channelPriceWithDisc}
  });
  let selectedMonth=null,historyOpen=false;
  const monthLabel=m=>new Date(m+'-01T12:00:00-03:00').toLocaleString('es-AR',{month:'long',year:'numeric'});
  function renderGoal({anchorId='rentabilidad-goal-anchor',rootId='rentabilidad-goal-card',summary=false}={}){
    const anchor=d.getElementById(anchorId);
    const rerender=()=>renderGoal({anchorId,rootId,summary});
    if(!anchor)return;
    let root=d.getElementById(rootId);
    if(!visible()){root?.remove();return;}
    if(!root){root=d.createElement('section');root.id=rootId;root.className='local-profit-card';anchor.insertAdjacentElement('afterend',root);}
    const current=currentLocalMonth();
    const month=selectedMonth&&/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)?selectedMonth:current;
    const data=localMonthlyProfit(state,{month});
    const done=data.progressPct!=null&&data.progressPct>=100;
    const progress=data.progressPct==null?0:Math.max(0,Math.min(100,data.progressPct));
    const dayPct=data.daysInMonth?Math.min(100,Math.round(data.daysElapsed/data.daysInMonth*100)):0;
    const history=monthlyGoalHistory(state,{count:18});
    const changes=Array.isArray(state.project?.localProfitGoalChanges)?[...state.project.localProfitGoalChanges].reverse():[];
    const storedGoal=monthlyGoal(state,month);
    const percent=data.progressPct==null?'—':rounded(data.progressPct);
    root.innerHTML='<div class="local-profit-head"><div><span class="local-eyebrow">CANAL LOCAL · '+esc(monthLabel(month))+'</span><h2>Meta mensual de ganancia</h2><p>Mostrador + pedidos de sahten.online · Excluye otras plataformas.</p></div>'
      +'<div class="local-month-tools"><label for="local-profit-month">Mes</label><input id="local-profit-month" type="month" min="2024-01" max="2099-12" value="'+esc(month)+'" aria-label="Seleccionar mes de ganancia"></div>'
      +(data.goalConfigured?'<div class="local-profit-goal"><small>Meta del mes</small><strong>'+money(data.goal)+'</strong></div>':'')+'</div>'
      +'<div class="local-profit-numbers"><strong class="'+(data.profit<0?'negative':'')+'">'+money(data.profit)+'</strong>'
      +'<div class="local-profit-secondary">'+(data.goal>0?
        '<span class="local-progress-state">'+(done?'Meta alcanzada':money(data.remaining)+' para llegar')+'</span><span>'+percent+' de la meta</span>'
        :'<span>'+(data.goalConfigured?'La meta de este mes está desactivada.':'Todavía no hay meta configurada para este mes.')+'</span>')+'</div></div>'
      +'<div class="local-profit-progress" role="progressbar" aria-label="Avance de la meta mensual local" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(progress)+'"><div style="width:'+progress+'%"></div></div>'
      +'<div class="local-progress-axis"><span>0%</span><span>'+(month===current?'Mes transcurrido: '+dayPct+'%':'Resultado de '+esc(monthLabel(month)))+'</span><span>100% de la meta</span></div>'
      +'<div class="local-profit-breakdown"><span><b>'+money(data.revenue)+'</b> ventas netas</span><span><b>−'+money(data.variable)+'</b> costo variable</span><span><b>−'+money(data.fixed)+'</b> GF asignado</span><span><b>−'+money(data.commission)+'</b> comisión</span><span><b>'+rounded(data.marginPct)+'</b> margen</span></div>'
      +'<div class="local-profit-foot"><span>'+data.covered+' pedidos con costos históricos'+(data.missing?' · <strong>'+data.missing+' sin costo auditado</strong>':'')+'. '
      +(data.missing?'Resultado parcial: faltan costos en algunos pedidos.':'Estimación después del GF asignado por pedido; no es un cierre contable.')+'</span>'
      +(canEdit()?'<button type="button" data-local-goal-edit>Configurar meta del mes</button>':'')+'</div>'
      +'<form data-local-goal-form hidden class="local-goal-form"><label>Meta para '+esc(monthLabel(month))+' ($)<input type="number" min="0" step="1000" data-local-goal-input value="'+(storedGoal??'')+'" required></label><button type="submit">Guardar meta de '+esc(month)+'</button><small data-local-goal-error role="alert"></small></form>'
      +(summary?'':'<details class="local-month-history" '+(historyOpen?'open':'')+'><summary>Historial de metas y ganancias mensuales</summary><div class="local-profit-table-wrap"><table><thead><tr><th>Mes</th><th>Meta</th><th>Ganancia registrada</th><th>Avance</th><th>Datos</th><th>Acción</th></tr></thead><tbody>'
      +history.map(h=>'<tr><td><strong>'+esc(monthLabel(h.month))+'</strong></td><td>'+(h.goal!=null?money(h.goal):'Sin configurar')+'</td><td>'+money(h.profit)+'</td><td>'+(h.goal>0?rounded(h.progressPct):'—')+'</td><td>'+(h.missing?'<span title="Faltan costos de pedidos">Parcial ('+h.missing+')</span>':'Verificado ('+h.covered+')')+'</td><td><button type="button" data-local-month="'+h.month+'">Ver / editar</button></td></tr>').join('')+'</tbody></table></div>'
      +(changes.length?'<details class="local-goal-audit"><summary>Registro de ediciones ('+changes.length+')</summary><ul>'+changes.slice(0,50).map(x=>'<li>'+esc(x.month)+' · '+(x.before==null?'Sin meta':money(x.before))+' → '+money(x.after)+' · '+esc(new Date(x.at).toLocaleString('es-AR'))+'</li>').join('')+'</ul></details>':'')
      +'</details>');
    root.querySelector('#local-profit-month')?.addEventListener('change',e=>{
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))return;
      selectedMonth=e.target.value;rerender();
    });
    root.querySelectorAll('[data-local-month]').forEach(b=>b.addEventListener('click',()=>{
      selectedMonth=b.dataset.localMonth;historyOpen=true;rerender();
    }));
    root.querySelector('.local-month-history')?.addEventListener('toggle',e=>{historyOpen=e.target.open;});
    root.querySelector('[data-local-goal-edit]')?.addEventListener('click',()=>{
      const form=root.querySelector('[data-local-goal-form]');form.hidden=!form.hidden;
      if(!form.hidden)form.querySelector('input')?.focus();
    });
    root.querySelector('[data-local-goal-form]')?.addEventListener('submit',e=>{
      e.preventDefault();
      if(!canEdit())return;
      const val=root.querySelector('[data-local-goal-input]')?.value;
      try {
        const changed=setMonthlyGoal(state,{month,amount:val,actor:d.body.dataset.role||'admin'});
        if(changed){w.SAHTEN?.project?.markDirty?.();w.scheduleSave?.();}
        historyOpen=true;rerender();
      }catch(err){root.querySelector('[data-local-goal-error]').textContent=err.message;}
    });
  }
  function renderProfitability() {
    if(!visible()){d.getElementById('product-profitability')?.remove();return;}
    const panel=d.getElementById('panel-productos');if(!panel)return;
    let root=d.getElementById('product-profitability');
    if(!root){root=d.createElement('section');root.id='product-profitability';root.className='local-profit-card local-profit-table';panel.prepend(root);}
    const rows=profitRows().filter(x=>x.price>0);
    const warning=rows.filter(x=>!x.costVerified).length;
    const monthly=localMonthlyProductProfits(state);
    root.innerHTML='<div class="local-profit-head"><div><span class="local-eyebrow">ANÁLISIS COMERCIAL · MOSTRADOR</span><h2>Rentabilidad por producto</h2>'
      +'<p>Precios vigentes; ganancia por unidad después de costo variable, GF asignado y comisión local, antes de promociones.</p></div>'
      +'<strong class="local-products-count">'+rows.length+' productos</strong></div>'
      +'<div class="local-profit-table-wrap"><table><thead><tr><th>Producto</th><th>Precio</th><th>Costo variable</th><th>GF/unidad</th><th>Ganancia/unidad</th><th>Margen</th><th>Ganancia este mes</th></tr></thead><tbody>'
      +rows.map(x=>'<tr><td><strong>'+esc(x.name)+'</strong>'+(x.costVerified?'':'<small>Costos por revisar</small>')+'</td>'
        +'<td>'+money(x.price)+'</td><td>'+money(x.varCost)+'</td><td>'+money(x.gf)+'</td>'
        +'<td class="'+(x.profit<0?'local-loss':'')+'"><strong>'+money(x.profit)+'</strong></td>'
        +'<td><span class="local-margin '+(x.marginPct<35?'low':x.marginPct<45?'medium':'high')+'">'+rounded(x.marginPct)+'</span></td>'
        +'<td><strong>'+(monthly[x.id]?money(monthly[x.id].profit):'—')+'</strong>'+(monthly[x.id]?'<small>'+monthly[x.id].qty+' unidades vendidas</small>':'')+'</td></tr>').join('')
      +'</tbody></table></div>'
      +'<p class="local-profit-disclaimer">Ordenados de menor a mayor margen. Ganancia mensual basada únicamente en pedidos locales completados con costos históricos. '+warning+' producto(s) tienen costos todavía no verificados; sus márgenes son orientativos. Las promociones y comisiones específicas pueden reducir la ganancia.</p>';
  }
  function renderMerchProfitability(){
    const panel=d.getElementById('panel-mercaderia');if(!panel)return;
    let root=d.getElementById('merch-profitability');
    if(!visible()){root?.remove();return;}
    if(!root){root=d.createElement('section');root.id='merch-profitability';root.className='local-profit-card';panel.prepend(root);}
    const resale=profitRows().filter(x=>x.productType==='resale');
    const merch=state.merchandise||[];
    root.innerHTML='<div class="local-profit-head"><div><span class="local-eyebrow">REVENTA Y MERCADERÍA</span><h2>Rentabilidad de artículos revendidos</h2>'
      +'<p>Se calcula por producto vinculado a Mercadería; el costo de compra aislado no equivale a ganancia.</p></div></div>'
      +(resale.length?'<div class="local-profit-table-wrap"><table><thead><tr><th>Producto</th><th>Precio de venta</th><th>Costo + GF</th><th>Ganancia/unidad</th><th>Margen</th></tr></thead><tbody>'
      +resale.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+money(x.price)+'</td><td>'+money(x.varCost+x.gf)+'</td><td>'+money(x.profit)+'</td><td><span class="local-margin '+(x.marginPct<35?'low':'high')+'">'+rounded(x.marginPct)+'</span></td></tr>').join('')+'</tbody></table></div>'
      :'<p>Aún no hay productos de reventa vinculados. Los '+merch.length+' artículos de mercadería solo tienen costo de compra; para medir margen deben asociarse a un producto con precio de venta.</p>');
  }
  afterRender('renderDashboard',renderGoal);
  afterRender('renderProductos',renderProfitability);
  onPanelShow('mercaderia',renderMerchProfitability);
  onDataChanged(()=>{renderGoal();renderProfitability();renderMerchProfitability();});
  return {renderGoal,renderProfitability,renderMerchProfitability,localMonthlyProfit:()=>localMonthlyProfit(state)};
}
