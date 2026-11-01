import { kv } from '../project/kv.js';
import { onPanelShow } from '../events.js';
import { initialPromotionConfig, quotePromotions, localDateParts, scheduleMatches, expiryLabel } from '../core/promotions.js';
import { promotionReport } from '../core/promotions-report.js';
import '../styles/promotions.css';

const KEY='sahten_promotions';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});
const options=[['online','Tienda online'],['mostrador','Mostrador']];
const placements=[['ticket','Tickets'],['cart','Carrito'],['checkout','Checkout'],['menu','Menú']];
function load() {
  const stored=kv.json(KEY,null);
  return stored && stored.version===1 && Array.isArray(stored.campaigns)
    ? stored : initialPromotionConfig();
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
  let selected='weekly-meals', simulationProduct='',simulationMethod='transferencia', tab='campaigns', cursor=new Date();
  const get=()=>load();
  let liveState={published:false,campaigns:[]},liveLoaded=false;
  const liveRevision=id=>liveState.campaigns.find(c=>c.id===id)?.revision??null;
  const canOperate=()=>!w.SAHTEN.project.session.readOnly
    &&!w.document.body.classList.contains('role-no-costs')
    &&['owner','admin'].includes(w.SAHTEN.online?.role?.()||'')
    &&w.SAHTEN.online?.controller?.info()?.signedIn===true;
  function applyRemote(remote){
    if(!remote||!Array.isArray(remote.campaigns))return;
    const next={published:remote.published===true,campaigns:remote.campaigns};
    const changed=!liveLoaded||JSON.stringify(next)!==JSON.stringify(liveState);
    liveState=next;liveLoaded=true;
    const root=w.document.getElementById('promotions-editor');
    const active=w.document.activeElement,editing=root?.contains(active)&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
    if(changed&&root&&!editing)render();
  }
  function render() {
    const root=w.document.getElementById('promotions-editor');if(!root)return;
    const state=get(), campaigns=state.campaigns||[], c=campaigns.find(x=>x.id===selected)||campaigns[0];
    if(c)selected=c.id;
    const canEdit=!w.document.body.classList.contains('role-no-costs');
    const now=localDateParts(new Date()),active=campaigns.filter(x=>x.enabled&&scheduleMatches(x.schedule,new Date())).length;
    root.innerHTML='<div class="promo-heading"><div><h2>Centro de Promociones</h2><p>Campañas, calendario, cupones, tickets y rentabilidad · SAHTEN</p></div>'
      +'<span class="promo-pill">'+(state.enabled?'Motor local activado':'Modo preparación · sin publicar')+'</span></div>'
      +'<div class="promo-metrics"><div><strong>'+campaigns.length+'</strong><small>Campañas configuradas</small></div><div><strong>'+active+'</strong><small>Vigentes en calendario</small></div><div><strong>'+(state.upsells||[]).length+'</strong><small>Complementos</small></div></div>'
      +'<nav class="promo-tabs" aria-label="Gestión de promociones">'+[['campaigns','Campañas'],['extras','Complementos'],['calendar','Calendario'],['coupons','Cupones'],['tickets','Tickets'],['sim','Simulador'],['report','Resultados']].map(([k,t])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(k===tab)+'">'+t+'</button>').join('')+'</nav>'
      + (tab==='campaigns' ? campaignEditor(state,c,canEdit) : tab==='extras'?extrasEditor(state,w):tab==='calendar'?calendarEditor(state):tab==='coupons'?couponEditor(state):tab==='tickets'?ticketEditor(state,canEdit):tab==='sim'?simEditor(state,w):reportEditor(w))
      + '<p class="promo-caution">Borradores guardados dentro del proyecto .sahten. La publicación online y el canje definitivo requieren validación del servidor. No se ejecutan desde esta pantalla.</p>';
    root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render()}));
    root.querySelector('[data-promo-campaign]')?.addEventListener('change',e=>{selected=e.target.value;render()});
    root.querySelector('[data-promo-live-retry]')?.addEventListener('click',()=>{
      w.SAHTEN.online?.promotionPublisher?.flush().catch(()=>{});
      render();
    });
    root.querySelector('[data-promo-live-discard]')?.addEventListener('click',()=>{
      const id=root.querySelector('[data-promo-live-discard]')?.dataset.promoLiveDiscard;
      if(!id)return;
      w.SAHTEN.online?.promotionPublisher?.discard(id);
      w.SAHTEN.online?.readStates?.().catch(()=>{});
      render();
    });
    root.querySelector('[data-promo-live-toggle]')?.addEventListener('click',async e=>{
      const id=e.currentTarget.dataset.promoLiveToggle,
        row=liveState.campaigns.find(x=>x.id===id),
        pending=w.SAHTEN.online?.promotionPublisher?.info()?.changes?.[id];
      if(!canOperate()||!liveState.published||!row||pending)return;
      const enabled=!row.enabled,priorProject=w.SAHTEN.project.session.id;
      if(!await w.sahtenConfirm(enabled?
        'Se volverá a habilitar esta promoción en la web según su calendario y sus productos publicados.':
        'La promoción dejará de aplicarse a nuevos pedidos de la web. Los pedidos anteriores no cambian.',
        {title:enabled?'Reactivar promoción en vivo':'Pausar promoción en vivo',okLabel:enabled?'Reactivar':'Pausar'}))return;
      if(priorProject!==w.SAHTEN.project.session.id||!canOperate())return;
      w.dispatchEvent(new w.CustomEvent('sahten:promotion-campaign',{detail:{id,enabled}}));
      render();
    });
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
    const remote=liveState.campaigns.find(row=>row.id===c.id);
    const info=w.SAHTEN.online?.promotionPublisher?.info();
    const pending=info?.changes?.[c.id];
    const published=liveLoaded&&liveState.published&&!!remote;
    const status=!liveLoaded?'Consultando el estado de la web…'
      :!liveState.published?'Motor de promociones todavía no publicado en la tienda'
      :!remote?'Esta campaña todavía no está publicada'
      :pending?(info.states?.[c.id]==='publicando'?'Enviando el cambio a la tienda…'
        :info.states?.[c.id]==='error'?'Error al sincronizar · la promoción sigue según el servidor'
        :info.states?.[c.id]==='sin conexión'?'Sin conexión · cambio aún no aplicado en la tienda'
        :'Cambio pendiente de confirmación')
      :remote.enabled?'Promoción habilitada en la web':'Promoción pausada en la web';
    const operable=published&&canOperate()&&!pending;
    const recovery=pending?'<div><button type="button" data-promo-live-retry="'+esc(c.id)+'">Reintentar sincronización</button> '
      +'<button type="button" data-promo-live-discard="'+esc(c.id)+'">Descartar cambio pendiente</button></div>':'';
    const liveControls='<div class="promo-note" role="status"><strong>Estado real en sahten.online:</strong> '+esc(status)
      +'<p>Este control es independiente del borrador y no requiere republicar la web.</p>'
      +'<button type="button" data-promo-live-toggle="'+esc(c.id)+'"'+(operable?'':' disabled')
      +'>'+(remote?.enabled?'Pausar en web':'Reactivar en web')+'</button>'+recovery+'</div>';
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
      +liveControls+'<div class="promo-note">Cambiar el porcentaje requiere simular la rentabilidad. El motor aplica una sola promoción adicional por producto. Los cambios se guardan como borrador del proyecto.</div>'
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
  function extrasEditor(state,w) {
    const lookup=id=>catalog(w).find(p=>p.id===id)?.name||id||'Producto no encontrado';
    const up=state.productUpgrades||[],extra=state.upsells||[],cross=state.crossSells||[];
    const upgrades=up.map(p=>'<article class="promo-note"><h4>'+esc(p.name)+'</h4>'
      +'<p><strong>Origen:</strong> '+esc(lookup(p.triggerProductId))+' → <strong>Reemplazo:</strong> '+esc(lookup(p.replacementProductId))+'</p>'
      +'<p><strong>Operación:</strong> reemplazar el combo, nunca sumar ambos. La cocina recibe '+esc(p.unitsPrinted)+' unidades.</p>'
      +'<p>Precio de lista de referencia: '+fmt(p.referenceListPrice)+' · Sin descuento adicional: solo beneficio de pago habitual.</p>'
      +'<p><strong>Estado:</strong> '+(p.enabled?'Configurada':'Desactivada')
      +' · costo de 4 unidades y margen incremental pendientes de validación</p></article>').join('');
    const dessert=extra.map(p=>'<article class="promo-note"><h4>'+esc(p.name)+'</h4>'
      +'<p>Producto: '+esc((p.productIds||[]).map(lookup).join(', '))
      +' · Máximo '+esc(p.maxUnits||1)+' unidad con +'+esc(p.extraPercent)+' puntos adicionales.</p>'
      +'<p>La oferta de 20% total en Baklava requiere costo, comisión y margen confirmados antes de activarse.</p>'
      +'<p><strong>Estado:</strong> '+(p.enabled?'Configurada':'Desactivada')+'</p></article>').join('');
    const crossSelling=cross.map(p=>'<article class="promo-note"><h4>'+esc(p.name)+'</h4>'
      +'<p>Producto: '+esc(lookup(p.productId))+' · Sin descuento adicional; únicamente corresponde el beneficio por forma de pago.</p>'
      +'<p><strong>Estado:</strong> '+(p.enabled?'Configurada':'Desactivada')+'</p></article>').join('');
    const shipping=(state.checkoutIncentives||[]).filter(p=>p.kind==='delivery_threshold_progress')
      .map(p=>'<p><strong>Progreso de envío:</strong> calcular sobre el subtotal NETO, y solo según la zona vigente. '
        +(p.enabled?'Preparado':'Desactivado')+'. No concede envío gratis fuera de la política de zonas.</p>').join('');
    return '<section class="promo-card"><h3>Complementos y descuentos selectivos</h3>'
      +'<p>Estas propuestas están guardadas en el proyecto. No generan ofertas ni pedidos por sí solas. '
      +'Los controles operativos se habilitan después de validar servidor, cobros y margen.</p>'
      +'<h4>Reemplazo de combo</h4>'+(upgrades||'<p>Sin reemplazos configurados.</p>')
      +'<h4>Postre con beneficio</h4>'+(dessert||'<p>Sin descuentos de postre.</p>')
      +'<h4>Venta cruzada sin nuevos descuentos</h4>'+(crossSelling||'<p>Sin sugerencias.</p>')
      +shipping+'</section>';
  }
  function couponEditor(state){
    const programs=Object.values(state.couponPrograms||{});
    return '<section class="promo-card"><h3>Cupones y recompensas · Plan precargado</h3>'
      +'<div class="promo-grid">'+programs.map(c=>'<article class="promo-note"><h4>'+esc(c.name)+'</h4>'
        +'<p><strong>Estado:</strong> Preparado, sin emisión</p>'
        +'<p>Compra elegible mínima: '+fmt(c.minEligibleSubtotal)+' · +'+esc(c.extraPercent)+' puntos porcentuales</p>'
        +'<p>Vigencia: '+esc(c.validDays)+' días desde la emisión confirmada'
        +(c.maxExtraAmount!=null?' · Tope adicional: '+fmt(c.maxExtraAmount):'')+'</p>'
        +'</article>').join('')+'</div>'
      +'<div class="promo-note"><strong>Emisión y canje desactivados.</strong> Deben verificarse del lado del servidor, vincularse a un cliente y una compra confirmada, y pasar las pruebas de pago/reversión. Reimprimir un ticket jamás emite otro cupón. Vencimiento de ejemplo: '+esc(expiryLabel('2026-11-14'))+'.</div></section>';
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
  return {render,get,save,applyRemote,liveRevision,liveState:()=>liveState};
}
export function register(){onPanelShow('promociones',()=>window.SAHTEN.promotionsEditor?.render());}
