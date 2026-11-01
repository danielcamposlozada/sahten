import { state } from '../core/state.js';
import { costPerUnit } from '../core/costs.js';
import { gfAssigned } from '../core/gf.js';
import { channelPriceWithDisc, channelCommission } from '../core/pricing.js';
import { afterRender, onDataChanged, onPanelShow } from '../events.js';
import { localMonthlyProfit,localProductProfitability,localMonthlyProductProfits } from '../core/local-profit.js';
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
  function renderGoal(){
    const anchor=d.getElementById('dash-kpis');
    if(!anchor)return;
    let root=d.getElementById('dash-local-profit');
    if(!visible()){root?.remove();return;}
    if(!root){root=d.createElement('section');root.id='dash-local-profit';root.className='local-profit-card';anchor.insertAdjacentElement('afterend',root);}
    const data=localMonthlyProfit(state);
    const done=data.progressPct!=null && data.progressPct>=100;
    const progress=data.progressPct==null?0:Math.max(0,Math.min(100,data.progressPct));
    const dayPct=data.daysInMonth?Math.min(100,Math.round(data.daysElapsed/data.daysInMonth*100)):0;
    const label=new Date(data.month+'-01T12:00:00-03:00').toLocaleString('es-AR',{month:'long',year:'numeric'});
    root.innerHTML='<div class="local-profit-head"><div><span class="local-eyebrow">CANAL LOCAL · '+esc(label)+'</span><h2>Meta mensual de ganancia</h2><p>Mostrador + pedidos de sahten.online · Excluye otras plataformas.</p></div>'
      +(data.goal>0?'<div class="local-profit-goal"><small>Meta</small><strong>'+money(data.goal)+'</strong></div>':'')+'</div>'
      +'<div class="local-profit-numbers"><strong class="'+(data.profit<0?'negative':'')+'">'+money(data.profit)+'</strong>'
      +'<div class="local-profit-secondary">'+(data.goal>0?
        '<span class="local-progress-state">'+(done?'Meta alcanzada':money(data.remaining)+' para llegar')+'</span><span>'+rounded(data.progressPct)+' completado</span>'
        :'<span>Configurá tu objetivo de ganancia para mostrar el avance.</span>')+'</div></div>'
      +'<div class="local-profit-progress" role="progressbar" aria-label="Avance de la meta mensual de ganancia local" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(progress)+'"><div style="width:'+progress+'%"></div></div>'
      +'<div class="local-progress-axis"><span>0%</span><span>Mes transcurrido: '+dayPct+'%</span><span>100% de la meta</span></div>'
      +'<div class="local-profit-breakdown"><span><b>'+money(data.revenue)+'</b> ventas netas</span><span><b>−'+money(data.variable)+'</b> costo variable</span><span><b>−'+money(data.fixed)+'</b> GF asignado</span><span><b>−'+money(data.commission)+'</b> comisión</span><span><b>'+rounded(data.marginPct)+'</b> margen</span></div>'
      +'<div class="local-profit-foot"><span>'+data.covered+' pedidos con costos históricos'+(data.missing?' · <strong>'+data.missing+' sin costo auditado</strong>':'')+'. '
      +(data.missing?'El resultado es parcial, NO el total del mes.':'Resultado estimado después del GF asignado por pedido; no es un cierre contable.')+'</span>'
      +(canEdit()?'<button type="button" data-local-goal-edit>Editar meta</button>':'')+'</div>'
      +'<div data-local-goal-form hidden class="local-goal-form"><label>Ganancia mensual deseada ($)<input type="number" min="0" step="1000" data-local-goal-input value="'+(Number(state.project?.localProfitGoal)||'')+'"></label><button type="button" data-local-goal-save>Guardar meta</button></div>';
    root.querySelector('[data-local-goal-edit]')?.addEventListener('click',()=>{
      const form=root.querySelector('[data-local-goal-form]');
      form.hidden=!form.hidden;
      if(!form.hidden)form.querySelector('input')?.focus();
    });
    root.querySelector('[data-local-goal-save]')?.addEventListener('click',()=>{
      if(!canEdit())return;
      const val=Number(root.querySelector('[data-local-goal-input]')?.value);
      if(!Number.isFinite(val)||val<0||val>100000000000)return;
      state.project.localProfitGoal=Math.round(val*100)/100;
      w.SAHTEN?.project?.markDirty?.();
      w.scheduleSave?.();
      renderGoal();
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
