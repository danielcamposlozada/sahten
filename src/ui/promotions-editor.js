import { kv } from '../project/kv.js';
import { onPanelShow } from '../events.js';
import { initialPromotionConfig, quotePromotions, localDateParts, scheduleMatches, expiryLabel } from '../core/promotions.js';
import { promotionReport } from '../core/promotions-report.js';
import { promotionOverview, filterPromotionOverview } from '../core/promotion-overview.js';
import '../styles/promotions.css';

const KEY='sahten_promotions';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});
const options=[['online','Tienda online'],['mostrador','Mostrador']];
const placements=[['ticket','Tickets'],['cart','Carrito'],['checkout','Checkout'],['menu','Menú']];
function load() {
  const stored=kv.json(KEY,null);
  if(stored && stored.version===1 && Array.isArray(stored.campaigns))return stored;
  return initialPromotionConfig();
}
function save(state) {kv.set(KEY,JSON.stringify(state));}
function catalog(w) { return Array.isArray(w.PRODUCTS)?w.PRODUCTS.filter(p=>!p.recetaOnly):[]; }
function formField(id,label,value,type='text',extra='') {
  return '<label class="promo-field"><span>'+esc(label)+'</span><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
}
function checkedSelect(keys,selected,namespace) {
  return keys.map(([id,label])=>'<label class="promo-checkbox"><input data-'+namespace+'="'+esc(id)+'" type="checkbox" '+((selected||[]).includes(id)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('');
}
function runPreview(state,w,method,productId) {
  const p=catalog(w).find(p=>p.id===productId)||catalog(w)[0];
  if(!p)return '<p>No hay productos cargados.</p>';
  const unitPrice=Number(w.mostradorFinalPrice?.(p)??p.pricingPolicies?.mostrador?.price??p.precioMostrador??p.fixedPrices?.mostrador??0);
  const costParts=p.pricingPolicies?.mostrador;
  const costs=costParts && costParts.variableCost!=null && costParts.fixedCost!=null
    ?{[p.id]:Number(costParts.variableCost)+Number(costParts.fixedCost)}:{};
  const q=quotePromotions({lines:[{productId:p.id,qty:1,unitPrice}],method,channel:'mostrador',
    config:{...state,enabled:true},trustedCosts:costs,now:new Date(),
    commissionPercent:method==='mercadopago'?(Number(state.checkoutProFeePercent)||0):0});
  const net=q.netSubtotal, cost=costs[p.id],fee=method==='mercadopago'?q.estimatedPaymentFee:0,profit=cost!=null?net-cost-fee:null;
  return '<div class="promo-sim-results"><div><span>Precio base</span><strong>'+fmt(q.subtotal)+'</strong></div>'
    +'<div><span>Descuento</span><strong>−'+fmt(q.discount)+'</strong></div>'
    +'<div><span>Precio proyectado</span><strong>'+fmt(net)+'</strong></div>'
    +'<div><span>Comisión estimada Checkout Pro</span><strong>'+(method==='mercadopago'&&state.checkoutProFeePercent==null?'Sin configurar':fmt(fee))+'</strong></div>'
    +'<div><span>Resultado estimado</span><strong>'+(profit===null||method==='mercadopago'&&state.checkoutProFeePercent==null?'Datos insuficientes':fmt(profit))+'</strong></div>'
    +'<small>Simulación local. No habilita descuentos en la tienda ni en caja.</small></div>';
}
export function installPromotionsEditor(w=window) {
  let selected='weekly-meals', simulationProduct='p1779467294622',simulationMethod='transferencia', tab='overview', overviewFilter='all', syncFeedback='', cursor=new Date();
  const get=()=>load();
  let live={published:false,campaigns:[]},liveLoaded=false,liveBusy=false,liveError='';
  const liveApi=()=>w.SAHTEN?.online?.controller;
  const canOperate=()=>!w.SAHTEN?.project?.session?.readOnly
    && ['owner','admin'].includes(w.SAHTEN?.online?.role?.())
    && w.SAHTEN?.online?.controller?.info?.()?.signedIn===true;
  async function refreshLive(){
    if(liveBusy)return;
    liveBusy=true;liveError='';
    try{
      const result=await liveApi()?.readPromotionCampaignStates?.();
      live=result&&Array.isArray(result.campaigns)?result:{published:false,campaigns:[]};
      liveLoaded=true;
    }catch(err){liveError=String(err?.message||'No se pudo leer el estado de la tienda.').slice(0,250);liveLoaded=true;}
    finally{liveBusy=false;render();}
  }
  function liveEditor(){
    const banner=!liveLoaded?'Estado de promociones aún no consultado.'
      :!live.published?'El motor promocional no está publicado. No puede activarse desde este panel.'
      :'Solo afecta a nuevos pedidos. No modifica pedidos ya confirmados.';
    const rows=(live.campaigns||[]).map(row=>{
      const disabled=!canOperate()||!live.published||liveBusy;
      return '<div class="promo-row" data-live-campaign="'+esc(row.id)+'"><div><strong>'
        +esc(row.id)+'</strong><p role="status">'+(row.enabled?'Activa en web':'Pausada en web')
        +'</p></div><button type="button" data-live-toggle="'+esc(row.id)+'"'
        +(disabled?' disabled':'')+'>'+(row.enabled?'Pausar':'Reactivar')+'</button></div>';
    }).join('');
    return '<section class="promo-card"><h3>Campañas publicadas · control en vivo</h3>'
      +'<p>'+esc(banner)+'</p>'
      +'<p>El estado online es distinto de la planificación local. El servidor valida permisos y revisiones.</p>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<button type="button" data-live-refresh'+(liveBusy?' disabled':'')+'>'
      +(liveBusy?'Consultando…':'Actualizar estado desde la web')+'</button>'
      +(rows||'<p>No hay campañas publicadas para controlar.</p>')+'</section>';
  }
  function overviewEditor(state){
    const overview=promotionOverview(state,{now:new Date(),live:liveLoaded&&!liveError?live:null});
    const visible=filterPromotionOverview(overview.items,overviewFilter);
    const badges={active:'Activa ahora',inactive:'Inactiva',scheduled:'Programada',pending:'Sin confirmar en web'};
    const canSync=canOperate()&&!!w.SAHTEN?.online?.conn?.()?.projectId&&!w.SAHTEN?.project?.session?.readOnly;
    const cards=visible.map(item=>{
      const next=item.type==='campaigns'?'campaigns':item.type==='upsells'?'extras'
        :item.type==='crossSells'?'recommendations':item.type==='productUpgrades'?'upgrades':'coupons';
      return '<button type="button" class="promo-overview-card" data-open-promo="'+esc(item.id)
        +'" data-open-type="'+esc(next)+'">'
        +'<span class="promo-overview-category">'+esc(item.label)+'</span>'
        +'<span class="promo-overview-status is-'+esc(item.status)+'">'+esc(badges[item.status]||'Inactiva')+'</span>'
        +'<strong>'+esc(item.name)+'</strong>'
        +'<span class="promo-overview-detail">'+esc(item.detail)+'</span>'
        +'<span class="promo-overview-foot">'+(item.localEnabled?'Marcada en borrador':'Borrador desactivado')+' · Ver configuración</span>'
        +'</button>';
    }).join('');
    return '<section class="promo-card"><div class="promo-row"><div><h3>Vista general · Promociones</h3>'
      +'<p>Estado comercial comprobado: no se considera activa ninguna oferta solo por estar guardada o marcada en el proyecto.</p></div>'
      +'<button type="button" data-live-refresh '+(liveBusy?'disabled':'')+'>Actualizar estado web</button></div>'
      +'<div class="promo-overview-summary"><span><strong>'+overview.items.length+'</strong> configuradas</span>'
      +'<span><strong>'+overview.active+'</strong> activas verificadas</span>'
      +'<span><strong>'+overview.pending+'</strong> pendientes/programadas</span>'
      +'<span><strong>'+overview.inactive+'</strong> inactivas</span></div>'
      +'<div class="promo-overview-toolbar" role="group" aria-label="Filtrar promociones">'
      +[['all','Todas'],['active','Activas'],['inactive','No activas']].map(([id,label])=>'<button type="button" data-promo-filter="'+id+'" aria-pressed="'+(overviewFilter===id)+'">'+label+'</button>').join('')
      +'</div>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<div class="promo-overview-grid">'+(cards||'<p class="promo-overview-empty">No hay promociones en este filtro.</p>')+'</div>'
      +'<div class="promo-note">Activa = campaña confirmada por el servidor, motor habilitado y calendario vigente. Las sugerencias y los cupones sin validación de emisión no se anuncian como ofertas disponibles.</div>'
      +'<div class="promo-row"><div><strong>Proyecto local y nube</strong>'
      +'<p>Para traer las últimas promociones sin reemplazar pedidos, stock ni catálogo, usá la actualización selectiva. El archivo local conserva un respaldo previo.</p>'
      +(syncFeedback?'<p role="status">'+esc(syncFeedback)+'</p>':'')+'</div>'
      +'<button type="button" data-promo-sync '+(canSync?'':'disabled')+'>Actualizar promociones desde la nube</button></div>'
      +'</section>';
  }
  function render() {
    const root=w.document.getElementById('promotions-editor');if(!root)return;
    const state=get(), campaigns=state.campaigns||[], c=campaigns.find(x=>x.id===selected)||campaigns[0];
    if(c)selected=c.id;
    const canEdit=!w.document.body.classList.contains('role-no-costs');
    const active=promotionOverview(state,{live:liveLoaded&&!liveError?live:null,now:new Date()}).active;
    root.innerHTML='<div class="promo-heading"><div><h2>Centro de Promociones</h2><p>Campañas, calendario, cupones, tickets y rentabilidad · SAHTEN</p></div>'
      +'<span class="promo-pill">'+(state.enabled?'Motor local activado':'Modo preparación · sin publicar')+'</span></div>'
      +'<div class="promo-metrics"><div><strong>'+campaigns.length+'</strong><small>Campañas configuradas</small></div><div><strong>'+active+'</strong><small>Activas verificadas</small></div><div><strong>'+(state.upsells||[]).length+'</strong><small>Complementos</small></div></div>'
      +'<nav class="promo-tabs" aria-label="Gestión de promociones">'+[['overview','Vista general'],['campaigns','Campañas'],['extras','Complementos'],['recommendations','Sugerencias'],['upgrades','Mejoras'],['live','En vivo'],['calendar','Calendario'],['coupons','Cupones'],['tickets','Tickets'],['sim','Simulador'],['report','Resultados']].map(([k,t])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(k===tab)+'">'+t+'</button>').join('')+'</nav>'
      + (tab==='overview'?overviewEditor(state):tab==='campaigns' ? campaignEditor(state,c,canEdit) : tab==='extras'?draftItemsEditor(state,'upsells','Complementos con descuento') : tab==='recommendations'?draftItemsEditor(state,'crossSells','Recomendaciones sin rebaja') : tab==='upgrades'?draftItemsEditor(state,'productUpgrades','Mejoras de producto') : tab==='live'?liveEditor() : tab==='calendar'?calendarEditor(state):tab==='coupons'?couponEditor(state):tab==='tickets'?ticketEditor(state,canEdit):tab==='sim'?simEditor(state,w):reportEditor(w))
      + '<p class="promo-caution">Borradores guardados dentro del proyecto .sahten. La publicación online y el canje definitivo requieren validación del servidor. No se ejecutan desde esta pantalla.</p>';
    root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();if(tab==='live')refreshLive();}));
    root.querySelector('[data-live-refresh]')?.addEventListener('click',()=>refreshLive());
    root.querySelectorAll('[data-promo-filter]').forEach(b=>b.addEventListener('click',()=>{overviewFilter=b.dataset.promoFilter;render();}));
    root.querySelectorAll('[data-open-promo]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.openType;
      if(tab==='campaigns')selected=b.dataset.openPromo;render();}));
    root.querySelector('[data-promo-sync]')?.addEventListener('click',async()=>{
      if(!canOperate()||!w.SAHTEN?.online?.conn?.()?.projectId)return;
      const yes=await w.sahtenConfirm?.('Se importarán SOLO las promociones del proyecto en la nube. Se conservarán los pedidos, los costos, el stock y el catálogo locales; se guardará un respaldo antes de cambiar los borradores. ¿Continuar?',
        {title:'Actualizar promociones del proyecto',okLabel:'Actualizar promociones'});
      if(yes!==true)return;
      syncFeedback='Consultando promociones y preparando respaldo…';render();
      try{
        const result=await w.SAHTEN.online.pullPromotionsFromCloud();
        syncFeedback=result.action==='unchanged'?'Las promociones locales ya coinciden con las de la nube.':
          'Promociones copiadas y guardadas en el proyecto local. Revisá el estado de sincronización general en Nube y usuarios si hay conflictos.';
      }catch(e){syncFeedback='No se pudo actualizar: '+String(e?.message||e).slice(0,220);}
      render();refreshLive();
    });
    root.querySelectorAll('[data-live-toggle]').forEach(button=>button.addEventListener('click',async()=>{
      if(!canOperate()||liveBusy||!live.published)return;
      const row=live.campaigns.find(x=>x.id===button.dataset.liveToggle);if(!row)return;
      const enable=!row.enabled;
      const confirm=await w.sahtenConfirm?.(
        enable?'¿Reactivar esta campaña? Se aplicará a nuevos pedidos según su calendario.':'¿Pausar esta campaña en los nuevos pedidos?',
        {title:enable?'Reactivar campaña':'Pausar campaña',okLabel:enable?'Reactivar':'Pausar'});
      if(confirm!==true||!canOperate()||liveBusy)return;
      liveBusy=true;liveError='';render();
      try{
        await liveApi().setPromotionCampaignState(row.id,enable,row.revision??null);
        const updated=await liveApi().readPromotionCampaignStates();
        if(!updated||!Array.isArray(updated.campaigns))throw new Error('No se confirmó el estado remoto.');
        live=updated;liveLoaded=true;
      }catch(e){liveError=String(e?.message||'El cambio no se pudo confirmar.').slice(0,250);
        try{const refreshed=await liveApi().readPromotionCampaignStates();if(refreshed)live=refreshed;}catch{}}
      finally{liveBusy=false;render();}
    }));
    root.querySelector('[data-promo-campaign]')?.addEventListener('change',e=>{selected=e.target.value;render()});
    root.querySelector('[data-promo-new]')?.addEventListener('click',()=>{
      if(!canEdit)return;
      const id='custom-'+Date.now().toString(36);
      state.campaigns.push({id,name:'Nueva campaña',kind:'public',enabled:false,
        extraPercent:5,priority:10,channels:['online','mostrador'],schedule:{type:'dates',dates:[]},
        productIds:[],advertising:{enabled:false,placement:[],message:''}});
      selected=id;save(state);render();
    });
    root.querySelector('[data-promo-preview]')?.addEventListener('click',()=>{tab='sim';render()});
    root.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit)return;const key=el.dataset.field,value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
      if(!c)return;
      if(key==='name'||key==='extraPercent'||key==='enabled')c[key]=key==='extraPercent'?Math.max(0,Math.min(20,value)):value;
      else if(key==='scheduleType')c.schedule={type:value,...(value==='weekly'?{weekdays:[1,2,3]}:value==='dates'?{dates:[]}:{})};
      else if(key==='dates')c.schedule.dates=value.split(',').map(s=>s.trim()).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s));
      else if(key==='weekdays')c.schedule.weekdays=value.split(',').map(Number).filter(n=>n>=0&&n<=6);
      else if(key==='from'||key==='until')c.schedule[key]=value||undefined;
      else if(key==='message')c.advertising.message=value;
      else if(key==='advertisingEnabled')c.advertising.enabled=value;
      else if(key==='checkoutProFeePercent')state.checkoutProFeePercent=Math.max(0,Math.min(30,value));
      else if(key==='ticketEnabled')state.ticket.enabled=value;
      else if(key==='ticketAdvertise')state.ticket.advertise=value;
      save(state);render();
    }));
    root.querySelectorAll('[data-product]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit||!c)return;const id=el.dataset.product;
      c.productIds=el.checked?[...new Set([...(c.productIds||[]),id])]:(c.productIds||[]).filter(v=>v!==id);
      save(state);
    }));
    root.querySelectorAll('[data-channel]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit||!c)return;const id=el.dataset.channel;
      c.channels=el.checked?[...new Set([...(c.channels||[]),id])]:(c.channels||[]).filter(v=>v!==id);
      save(state);
    }));
    root.querySelectorAll('[data-placement]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit||!c)return;const id=el.dataset.placement;
      c.advertising.placement=el.checked?[...new Set([...(c.advertising.placement||[]),id])]:(c.advertising.placement||[]).filter(v=>v!==id);
      save(state);
    }));
    root.querySelector('[data-promo-month-prev]')?.addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render()});
    root.querySelector('[data-promo-month-next]')?.addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render()});
    root.querySelector('[data-promo-sim-product]')?.addEventListener('change',e=>{simulationProduct=e.target.value;render()});
    root.querySelector('[data-promo-sim-method]')?.addEventListener('change',e=>{simulationMethod=e.target.value;render()});
  }
  function campaignEditor(state,c,canEdit) {
    if(!c)return '<p>No hay campañas.</p>';
    const disabled=canEdit?'':'disabled';
    return '<div class="promo-split"><section class="promo-card"><div class="promo-row"><h3>Editor de campañas</h3><button type="button" data-promo-new '+disabled+'>+ Nueva</button></div>'
      +'<label class="promo-field"><span>Campaña</span><select data-promo-campaign>'+state.campaigns.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===c.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'
      +'<div class="promo-grid">'+formField('promo-title','Nombre',c.name,'text','data-field="name" '+disabled)+'<label class="promo-field"><span>Tipo de calendario</span><select data-field="scheduleType" '+disabled+'>'+[['weekly','Semanal'],['central_weekends','2° y 3° viernes y sábado'],['dates','Fechas específicas'],['always','Siempre']].map(([v,t])=>'<option value="'+v+'" '+(c.schedule?.type===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'
      
      + (c.schedule?.type==='weekly'?formField('promo-week','Días de semana (0=domingo, 1=lunes)',(c.schedule.weekdays||[]).join(','),'text','data-field="weekdays" '+disabled):'')
      + (c.schedule?.type==='dates'?formField('promo-dates','Fechas (AAAA-MM-DD, separadas por comas)',(c.schedule.dates||[]).join(','),'text','data-field="dates" '+disabled):'')
      +'<div class="promo-grid">'+formField('promo-start','Desde (opcional)',c.schedule?.from||'','date','data-field="from" '+disabled)+formField('promo-end','Hasta (opcional)',c.schedule?.until||'','date','data-field="until" '+disabled)+'</div>'
      +'<div class="promo-grid">'+formField('promo-extra','Puntos de descuento adicionales',c.extraPercent,'number','min="0" max="20" step="1" data-field="extraPercent" '+disabled)
      +'<label class="promo-field"><span>Habilitar en calendario</span><input data-field="enabled" type="checkbox" '+(c.enabled?'checked':'')+' '+disabled+'></label></div>'
      +'<h4>Productos participantes</h4><div class="promo-choices">'+catalog(w).map(p=>'<label class="promo-checkbox"><input data-product="'+esc(p.id)+'" type="checkbox" '+((c.productIds||[]).includes(p.id)?'checked':'')+' '+disabled+'><span>'+esc(p.name)+'</span></label>').join('')+'</div>'
      +'<h4>Canales</h4><div class="promo-inline">'+checkedSelect(options,c.channels,'channel')+'</div></section>'
      +'<section class="promo-card"><h3>Publicidad y condiciones</h3>'
      +'<label class="promo-field"><span>Mensaje publicitario</span><textarea data-field="message" rows="3" '+disabled+'>'+esc(c.advertising?.message||'')+'</textarea></label>'
      +'<h4>Dónde se muestra</h4><div class="promo-choices">'+checkedSelect(placements,c.advertising?.placement,'placement')+'</div>'
      +'<label class="promo-checkbox"><input data-field="advertisingEnabled" type="checkbox" '+(c.advertising?.enabled?'checked':'')+' '+disabled+'> Activar publicidad según calendario</label>'
      +'<div class="promo-note">Cambiar el porcentaje requiere simular la rentabilidad. El motor aplica una sola promoción adicional por producto. Los cambios se guardan como borrador del proyecto.</div>'
      +'<button type="button" data-promo-preview>Simular esta campaña</button></section></div>';
  }
  function calendarEditor(state) {
    const yy=cursor.getFullYear(),m=cursor.getMonth(),first=(new Date(yy,m,1).getDay()+6)%7,last=new Date(yy,m+1,0).getDate();
    const days=Array.from({length:Math.ceil((first+last)/7)*7},(_,i)=>i-first+1);
    const today=localDateParts(new Date()).iso;
    const cells=days.map(d=>{
      if(d<1||d>last)return '<div class="promo-cal-day empty"></div>';
      const date=yy+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const dummy=new Date(date+'T12:00:00-03:00');
      const active=(state.campaigns||[]).filter(c=>c.enabled&&scheduleMatches(c.schedule,dummy));
      return '<div class="promo-cal-day '+(date===today?'today':'')+'"><strong>'+d+'</strong>'+active.map(c=>'<small>'+esc(c.name.split(' · ')[0])+'</small>').join('')+'</div>';
    }).join('');
    return '<section class="promo-card"><div class="promo-row"><h3>Calendario · '+cursor.toLocaleString('es-AR',{month:'long',year:'numeric'})+'</h3><div><button type="button" data-promo-month-prev aria-label="Mes anterior">←</button> <button type="button" data-promo-month-next aria-label="Mes siguiente">→</button></div></div>'
      +'<div class="promo-calendar">'+['L','M','X','J','V','S','D'].map(d=>'<b>'+d+'</b>').join('')+cells+'</div>'
      +'<p>La campaña de tablas se calcula automáticamente como el segundo y tercer viernes y sábado de cada mes. Los domingos permanecen excluidos.</p></section>';
  }
  function draftItemsEditor(state,key,title){
    const items=Array.isArray(state[key])?state[key]:[];
    const cards=items.map(item=>{
      const pct=Array.isArray(item.discountTiers)&&item.discountTiers.length
        ? 'Descuento total según cesta: '+item.discountTiers.map(t=>esc(t.totalDiscountPercent)+'% desde '+fmt(t.minEligibleNetSubtotal)).join(' · ')
        : Number(item.extraPercent)>0?'Adicional propuesto: '+esc(item.extraPercent)+' puntos porcentuales':'Sin descuento adicional';
      const products=Array.isArray(item.productIds)?item.productIds:Array.isArray(item.productId)?item.productId:[item.productId].filter(Boolean);
      return '<article class="promo-row promo-draft-item"><div><strong>'+esc(item.name||item.id)+'</strong>'
        +'<p>'+esc(item.id)+' · '+(item.enabled?'Marcada en borrador':'Desactivada')+'</p>'
        +'<p>'+pct+'</p>'
        +(item.unitDefinition?.portionCroquettes?'<p>Ración: '+esc(item.unitDefinition.portionCroquettes)+' croquetas por unidad</p>':'')
        +(products.length?'<small>SKU: '+products.map(esc).join(', ')+'</small>':'')
        +'</div></article>';
    }).join('');
    return '<section class="promo-card"><h3>'+esc(title)+' ('+items.length+')</h3>'
      +'<p>Configuración guardada en el proyecto. Ninguna propuesta de este apartado se publica por abrir esta pantalla.</p>'
      +'<div class="promo-draft-list">'+(cards||'<p>No hay propuestas configuradas.</p>')+'</div>'
      +'<div class="promo-note">Para ofrecer descuentos reales faltan aprobación de costos, cotización del servidor y activación individual. Mercado Pago queda excluido de esta etapa.</div></section>';
  }
  function couponEditor(state){
    const entries=Object.entries(state.couponPrograms||{});
    const rows=entries.map(([id,program])=>'<article class="promo-row promo-draft-item"><div><strong>'+esc(program.name||id)+'</strong>'
      +'<p>'+esc(id)+' · '+(program.enabled?'Marcado en borrador':'Desactivado')+'</p>'
      +'<p>'+esc(program.extraPercent??0)+' puntos adicionales · Compra mínima '+fmt(program.minEligibleSubtotal)
      +(program.maxExtraAmount!=null?' · Tope '+fmt(program.maxExtraAmount):'')
      +' · Vigencia '+esc(program.validDays??'?')+' días</p>'
      +'<small>Canal: '+esc(program.channel||'online')+(program.requiresConfirmedOrigin?' · Requiere compra anterior confirmada':'')+'</small>'
      +'</div></article>').join('');
    const methods=state.activationPolicy?.allowedPromotionPaymentMethods;
    return '<section class="promo-card"><h3>Cupones y recompensas ('+entries.length+')</h3>'
      +'<p>Métodos elegibles para promociones nuevas: '+esc(Array.isArray(methods)?methods.join(' y '):'sin autorización publicada')+'. El 10% habitual es independiente.</p>'
      +'<div class="promo-draft-list">'+(rows||'<p>No hay programas configurados.</p>')+'</div>'
      +'<div class="promo-note"><strong>Emisión y canje:</strong> requieren servidor, cliente identificado, rentabilidad verificada y confirmación de la compra. Una reimpresión conserva el cupón original; nunca crea otro. Esta pantalla no emite códigos utilizables.</div></section>';
  }
  function ticketEditor(state,canEdit){
    return '<section class="promo-card"><h3>Publicidad en comanda única</h3><p>Siempre primero: datos de cocina, entrega, importes y método de pago. Después: QR Google Reviews y una publicidad seleccionada.</p>'
      +'<label class="promo-checkbox"><input data-field="ticketEnabled" type="checkbox" '+(state.ticket?.enabled?'checked':'')+' '+(canEdit?'':'disabled')+'> Preparar sección promocional</label>'
      +'<label class="promo-checkbox"><input data-field="ticketAdvertise" type="checkbox" '+(state.ticket?.advertise?'checked':'')+' '+(canEdit?'':'disabled')+'> Mostrar publicidad si existe en el pedido</label>'
      +'<div class="promo-note">La activación comercial queda bloqueada hasta verificar la cola de impresión, el ancho de papel y la emisión del lado del servidor.</div></section>';
  }
  function simEditor(state,w) {
    return '<section class="promo-card"><h3>Simulador sin afectar ventas</h3>'
      +'<div class="promo-grid"><label class="promo-field"><span>Producto</span><select data-promo-sim-product>'+catalog(w).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===simulationProduct?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>'
      +'<label class="promo-field"><span>Medio de pago</span><select data-promo-sim-method>'+[['efectivo','Efectivo'],['transferencia','Transferencia'],['mercadopago','Checkout Pro']].map(([v,n])=>'<option value="'+v+'" '+(v===simulationMethod?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'
      +formField('promo-commission','Comisión real de Checkout Pro, IVA incluido (%)',state.checkoutProFeePercent??'','number','data-field="checkoutProFeePercent" min="0" max="30" step="0.01"')
      +runPreview(state,w,simulationMethod,simulationProduct)+'</section>';
  }
  function reportEditor(w){
    const r=promotionReport(w.sahtenOrders?.()||[]);
    return '<section class="promo-card"><h3>Resultados registrados</h3><p>Las métricas aparecen cuando existan pedidos con snapshots del nuevo motor. No representan las campañas aún no publicadas.</p><div class="promo-sim-results">'+
      [['Pedidos evaluados',r.orders],['Pedidos con promoción',r.promotedOrders],['Venta bruta evaluada',fmt(r.gross)],['Descuentos otorgados',fmt(r.discount)],['Venta neta de productos',fmt(r.netProducts)]].map(([k,v])=>'<div><span>'+k+'</span><strong>'+v+'</strong></div>').join('')+
      '</div><h4>Por campaña</h4>'+(Object.values(r.byPromotion).length?Object.values(r.byPromotion).map(v=>'<p>'+esc(v.id)+' · '+v.orders+' líneas · '+fmt(v.revenue)+' vendidos</p>').join(''):'<p>Sin operaciones promocionales registradas.</p>')+'</section>';
  }
  // Renderiza al abrir el panel. Los cambios afectan sólo los borradores de este proyecto.
  return {render,get,save};
}
export function register(){onPanelShow('promociones',()=>window.SAHTEN.promotionsEditor?.render());}
