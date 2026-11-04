import {createReviewedUpsellEditor} from './reviewed-upsells.js';
import { kv } from '../project/kv.js';
import { onPanelShow } from '../events.js';
import { initialPromotionConfig, quotePromotions, localDateParts, scheduleMatches, expiryLabel } from '../core/promotions.js';
import { promotionReport } from '../core/promotions-report.js';
import { promotionOverview, filterPromotionOverview } from '../core/promotion-overview.js';
import { publishedPromotionCatalog, livePromotionStatus } from '../core/live-promotion-catalog.js';
import { campaignContext } from '../core/promotion-context.js';
import { createLiveRecommendationEditor } from './live-cart-recommendations.js';
import { publicationKind } from '../core/promotion-publication.js';
import { promotionDraftReview } from '../core/promotion-draft-review.js';
import { VERIFICATION_LABELS, serverVerificationChecks, summarizeVerification } from '../core/promotion-verification.js';
import { WEEK_DAYS, campaignTemplate, validateCampaignDraft, describeSchedule } from '../core/campaign-builder.js';
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
  let selected='weekly-meals', simulationProduct='p1779467294622',simulationMethod='transferencia', tab='overview', overviewFilter='all', syncFeedback='', campaignFeedback='', cursor=new Date();
  const get=()=>load();
  let localFormDirty=false;
  let draftEditing=null, couponEditing=null, publishFeedback='',publishBusy=false,recInitialized=false;
  const draftVerifications=new Map();
  let verificationFeedback='',verificationBusy=false;
  const upsellEditor=createReviewedUpsellEditor(w,()=>get().upsells,()=>{if(tab==='extras')render();});
  const recEditor=createLiveRecommendationEditor(w,()=>{if(!localFormDirty)render();});
  let live={published:false,campaigns:[]},liveTicket=null,liveManagement=null,liveLoaded=false,
    liveBusy=false,liveError='',liveContext='',lastLiveAt=0,liveEditDirty=false,liveSaveBusy=false,liveSaveFeedback='';
  const liveCatalog=()=>publishedPromotionCatalog(get().campaigns,
    liveLoaded&&!liveError?live:null,liveManagement||liveTicket);
  const liveNames=()=>Object.fromEntries((liveManagement?.products||catalog(w)).map(p=>[p.id,p.name]));
  const liveApi=()=>w.SAHTEN?.online?.controller;
  const currentLiveContext=()=>[w.SAHTEN?.project?.session?.id||'',w.SAHTEN?.online?.conn?.()?.storeId||'',w.SAHTEN?.online?.conn?.()?.url||''].join('|');
  function ensureLiveContext(){
    const key=currentLiveContext();
    if(liveContext!==key){liveContext=key;liveLoaded=false;liveError='';live={published:false,campaigns:[]};liveTicket=null;liveManagement=null;liveEditDirty=false;localFormDirty=false;recInitialized=false;recEditor.reset();upsellEditor.reset();draftVerifications.clear();verificationFeedback='';}
  }
  const canOperate=()=>!w.SAHTEN?.project?.session?.readOnly
    && ['owner','admin'].includes(w.SAHTEN?.online?.role?.())
    && w.SAHTEN?.online?.controller?.info?.()?.signedIn===true;
  async function refreshLive(){
    ensureLiveContext();
    if(liveBusy||liveEditDirty||localFormDirty)return;
    const context=liveContext;
    liveBusy=true;liveError='';
    try{
      const [result,ticketResult,management,upsells]=await Promise.all([
        liveApi()?.readPromotionCampaignStates?.(),
        liveApi()?.readPromotionTicketCampaigns?.().catch(()=>null)??Promise.resolve(null),
        liveApi()?.readPromotionCampaignDetails?.().catch(()=>null)??Promise.resolve(null),
        canOperate()?(liveApi()?.readUpsellManagement?.().catch(()=>null)??Promise.resolve(null)):Promise.resolve(null)
      ]);
      if(context!==currentLiveContext()||liveEditDirty||localFormDirty)return;
      if(!result||!Array.isArray(result.campaigns))throw new Error('No se recibió el estado publicado de las campañas.');
      upsellEditor.ingest(upsells);live=result;liveTicket=ticketResult?.source==='published_server'?ticketResult:null;
      liveManagement=management?.source==='published_management'?management:null;
      liveLoaded=true;lastLiveAt=Date.now();
    }catch(err){
      if(context===currentLiveContext()){
        liveError=String(err?.message||'No se pudo leer el estado de la tienda.').slice(0,250);liveLoaded=true;lastLiveAt=0;
      }
    }finally{liveBusy=false;if(!liveEditDirty&&!localFormDirty)render();}
  }
  // Un switch disponible únicamente cuando el checkout publicó la campaña.
  // No cambia flags locales de forma optimista.
  function liveSwitch(id){
    const row=(live.campaigns||[]).find(x=>x.id===id);
    const usable=canOperate()&&liveLoaded&&live.published===true&&!liveBusy&&!liveError&&!!row;
    const checked=!!row?.enabled;
    return '<button type="button" class="promo-live-switch" role="switch" aria-label="'+esc((checked?'Pausar':'Activar')+' campaña '+id)+'" aria-checked="'+checked+'" data-live-toggle="'+esc(id)+'"'
      +(usable?'':' disabled')+'><span class="promo-live-track"></span><span>'+esc(checked?'En vivo · Pausar':'Pausada · Activar')+'</span></button>';
  }
  // Cada tipo tiene interruptor de planificación. SOLO el de campañas publicadas
  // es un control en vivo del servidor; no se finge publicar un borrador.
  function draftSwitch(key,item){
    const editable=!w.SAHTEN?.project?.session?.readOnly && !w.document.body.classList.contains('role-no-costs');
    return '<button type="button" class="promo-draft-plan" aria-label="'+esc((item.enabled?'Quitar':'Incluir')+' en planificación local '+(item.name||item.id))+'"'
      +' aria-pressed="'+!!item.enabled+'" data-draft-toggle="'+esc(key)+'" data-draft-id="'+esc(item.id)+'"'+(editable?'':' disabled')+'>'
      +'<span>'+(item.enabled?'✓ En planificación local · Quitar':'+ Incluir en planificación local')+'</span></button>';
  }
  const draftKey=(type,id)=>type+':'+id;
  function draftFromState(state,type,id){
    if(type==='couponPrograms'){
      const v=state.couponPrograms?.[id];
      return v?{...v,id}:null;
    }
    return (state[type]||[]).find(x=>x.id===id)||null;
  }
  async function verifyDraft(type,id,{quiet=false}={}){
    if(!['upsells','productUpgrades','couponPrograms'].includes(type)
      ||!canOperate()||!liveApi()?.verifyPromotionDraft)return null;
    const draft=draftFromState(get(),type,id);
    if(!draft)return null;
    const ctx=currentLiveContext(),fingerprint=JSON.stringify(draft),key=draftKey(type,id);
    const requestId=Symbol('verification');
    draftVerifications.set(key,{fingerprint,pending:true,requestId});
    if(!quiet){verificationFeedback='Consultando precios, costos y requisitos en el servidor…';render();}
    try{
      const data=await liveApi().verifyPromotionDraft(type,draft);
      if(ctx!==currentLiveContext()||draftVerifications.get(key)?.requestId!==requestId||JSON.stringify(draftFromState(get(),type,id))!==fingerprint)return null;
      if(!data||data.source!=='server'||data.type!==type||data.id!==id||!Array.isArray(data.checks)||!data.checks.length)
        throw new Error('El servidor no devolvió una verificación completa.');
      draftVerifications.set(key,{fingerprint,data,pending:false,requestId});
      if(!quiet)verificationFeedback='Verificación del servidor completada para «'+draft.name+'».';
      return data;
    }catch(err){
      if(ctx===currentLiveContext()&&draftVerifications.get(key)?.requestId===requestId&&JSON.stringify(draftFromState(get(),type,id))===fingerprint){
        draftVerifications.set(key,{fingerprint,error:String(err?.message||err).slice(0,240),pending:false,requestId});
        if(!quiet)verificationFeedback='No se pudo verificar «'+draft.name+'»: '+String(err?.message||err);
      }
      return null;
    }finally{
      if(ctx===currentLiveContext()&&draftVerifications.get(key)?.requestId===requestId&&draftVerifications.get(key)?.pending)draftVerifications.delete(key);
      if(!quiet)render();
    }
  }
  function readinessChecklist(type,item){
    const review=promotionDraftReview(type,item,catalog(w));
    const missing=review.missing.length;
    const renderCheck=c=>'<li class="promo-check is-'+esc(c.status)+'"><strong>'+esc(VERIFICATION_LABELS[c.status])+'</strong> · '+esc(c.label||c.id)+(!c.ok&&c.action?'<small>Próximo paso: '+esc(({edit:'revisar la configuración',costs:'revisar costos y márgenes',checkout:'comprobar la integración de checkout',verify_server:'verificar con el servidor',exception_review:'revisar excepción comercial y margen; no activa el descuento'})[c.action]||c.action)+'</small>':'')+'</li>';
    const places=review.placements.length?review.placements.map(id=>placements.find(([v])=>v===id)?.[1]||id).join(', '):'Sin ubicación configurada';
    const record=draftVerifications.get(draftKey(type,item.id));
    const current=record?.fingerprint===JSON.stringify(item)?record:null;
    const data=current?.data;
    const serverChecks=serverVerificationChecks(data,type);
    const result=summarizeVerification(serverChecks);
    const permission=canOperate()&&typeof liveApi()?.verifyPromotionDraft==='function';
    const fiscal=data?'<div class="promo-server-evidence"><strong>Resultado del servidor · '+esc(data.checkedAt||'')+'</strong>'
      +'<p>Descuento total de prueba (efectivo/transferencia): '+esc(data.totalPercent)+'% · Margen objetivo: '+esc(data.minMarginPercent)+'%</p>'
      +(Array.isArray(data.products)&&data.products.length?'<div class="promo-economics-table"><table><thead><tr><th>Producto</th><th>Precio</th><th>Costo base</th><th>Margen previo a gastos extra</th><th>Presupuesto disponible para gastos extra</th></tr></thead><tbody>'
       +data.products.map(p=>'<tr><td>'+esc(p.name||p.id)+(p.published===false?' · sin publicar':'')+'</td>'
         +'<td>'+ (p.price==null?'—':fmt(p.price))+'</td>'
         +'<td>'+ (p.baseCost==null?'Sin costo registrado':fmt(p.baseCost))+'</td>'
         +'<td>'+ (p.estimatedMarginPct==null?'No calculable':esc(p.estimatedMarginPct)+'%')+'</td>'
         +'<td>'+ (p.headroomAt40Pct==null?'No calculable':fmt(p.headroomAt40Pct))+'</td></tr>').join('')
       +'</tbody></table></div>':'<p>Elegí productos elegibles para calcular el margen sobre un escenario concreto.</p>')
      +'<p>Resultado de comprobaciones: '+esc(result.label)+'.</p><ul>'+serverChecks.map(renderCheck).join('')+'</ul>'
      +'<p class="promo-caution">Esta consulta no publica ni activa beneficios. Los permisos de publicación y activación se verifican por separado en el servidor.</p>'
      +'</div>':'';
    return '<details class="promo-note promo-draft-checklist"'+(data?' open':'')+'><summary>Revisar publicación · verificación '+(data?'del servidor': 'local')+' · '+missing+' requisito'+(missing===1?'':'s')+' local'+(missing===1?'':'es')+' pendiente'+(missing===1?'':'s')+'</summary>'
      +'<ul>'+review.checks.map(renderCheck).join('')+'</ul>'
      +'<p><small>Ubicaciones previstas: '+esc(places)+'. Planificación, no anuncio activo.</small></p>'
      +'<button type="button" data-verify-draft="'+esc(item.id)+'" data-verify-type="'+esc(type)+'"'
      +(permission&&!current?.pending?'':' disabled')+'>'+(current?.pending?'Verificando…':'Verificar con datos reales del servidor')+'</button>'
      +(!permission?'<p>Conectá la tienda como dueño o administrador para comprobar el costo publicado.</p>':'')
      +(current?.error?'<p class="promo-caution" role="alert">'+esc(current.error)+'</p>':'')
      +fiscal
      +(type==='upsells'?'<button type="button" data-upsell-open>Revisar costos y dar de alta</button>':'<button type="button" disabled title="Se habilita solo tras checkout y canje verificados">Publicar descuento · pendiente de integración</button>')
      +'</details>';
  }
  function liveCampaignEditor(c){
    const permitted=canOperate(),s=c.schedule||{type:'always'},adv=c.advertising||{};
    const terms=campaignContext(c,{paymentPercent:liveManagement?.paymentPercent||10,productNames:liveNames()});
    const d=permitted?'':'disabled';
    const facts=[
      ['Cuándo',terms.scheduleText+' · '+terms.hours],
      ['Vigencia',terms.dates],['Canal',terms.channelNames.join(' y ')],
      ['Descuento',terms.discount],['Medios de pago',terms.methods],
      ['Límite',terms.cap],['Requisito',terms.extraRequirement],
      ['Productos',terms.participating.map(x=>x.name).join(', ')],
      ['Publicitado en',terms.ads.join(', ')||'Ninguno']
    ];
    const factsHtml=facts.map(([k,v])=>'<div class="promo-live-fact"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
    const fields=[
      formField('live-name','Nombre',c.name,'text','data-live-field="name" maxlength="100" '+d),
      formField('live-percent','Puntos adicionales al 10% habitual',c.extraPercent??0,'number','data-live-field="extraPercent" min="0" max="10" step=".5" '+d),
      formField('live-limit','Máximo unidades (vacío = sin tope)',c.maxUnits??'','number','data-live-field="maxUnits" min="1" max="30" '+d),
      formField('live-priority','Prioridad',c.priority??0,'number','data-live-field="priority" min="0" max="100" '+d),
      formField('live-from','Desde (opcional)',s.from||'','date','data-live-field="from" '+d),
      formField('live-until','Hasta (opcional, vacío = sin vencimiento)',s.until||'','date','data-live-field="until" '+d),
      formField('live-timefrom','Horario desde',s.startTime||'','time','data-live-field="startTime" '+d),
      formField('live-timeuntil','Horario hasta',s.endTime||'','time','data-live-field="endTime" '+d)
    ].join('');
    const choices=(type,values,defs)=>defs.map(([id,label])=>
      '<label class="promo-checkbox"><input type="checkbox" data-live-'+type+'="'+esc(id)+'" '
      +((values||[]).includes(id)?'checked':'')+' '+d+'>'+esc(label)+'</label>').join('');
    return '<section class="promo-card promo-live-editor" data-campaign-id="'+esc(c.id)+'">'
      +'<div class="promo-row"><h3>Editar campaña publicada · sincronización directa</h3>'+liveSwitch(c.id)+'</div>'
      +'<div class="promo-live-facts">'+factsHtml+'</div>'
      +'<h4>Oferta comercial</h4><div class="promo-grid">'+fields+'</div>'
      +'<label class="promo-field">Calendario<select data-live-field="scheduleType" '+d+'>'
      +[['always','Todos los días'],['weekly','Días de la semana'],['central_weekends','2.º y 3.º viernes y sábado'],['dates','Fechas concretas']].map(([v,t])=>'<option value="'+v+'"'+(s.type===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'
      +'<div class="promo-weekdays">'+choices('weekday',s.weekdays||[],WEEK_DAYS.map(([name,id])=>[id,name]))+'</div>'
      +'<label class="promo-field">Fechas concretas (AAAA-MM-DD, separadas por coma)<input data-live-field="dates" value="'+esc((s.dates||[]).join(', '))+'" '+d+'></label>'
      +'<h4>Canales</h4><div class="promo-inline">'+choices('channel',c.channels,options)+'</div>'
      +'<details class="promo-live-products"><summary>Productos participantes · '+terms.participating.length+' elegidos</summary>'
      +'<label class="promo-field">Buscar producto<input data-live-search placeholder="Filtrar la lista"></label>'
      +'<div class="promo-choices">'+choices('product',c.productIds,(liveManagement?.products||catalog(w)).map(p=>[p.id,p.name||p.id]))+'</div></details>'
      +'<h4>Publicidad de esta campaña</h4><label class="promo-checkbox"><input type="checkbox" data-live-field="advertisingEnabled" '+(adv.enabled?'checked':'')+' '+d+'> Mostrar anuncios (no modifica el descuento)</label>'
      +'<label class="promo-field">Mensaje para el cliente<textarea data-live-field="message" rows="3" maxlength="190" '+d+'>'+esc(adv.message||'')+'</textarea></label>'
      +'<div class="promo-inline">'+choices('placement',adv.placement,placements)+'</div>'
      +'<div class="promo-grid"><label class="promo-field">Formato ticket<select data-live-field="ticketFormat" '+d+'>'
      +[['','Automático'],['A','A · general'],['B','B · descuento'],['D','D · especial']].map(([v,t])=>'<option value="'+v+'"'+(adv.ticketFormat===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'
      +formField('live-advance','Días de anticipo en ticket',adv.advanceDays??4,'number','data-live-field="advanceDays" min="0" max="14" '+d)+'</div>'
      +'<p class="promo-note">Texto, vigencia y calendario se actualizan directamente. Cambiar descuento, productos o canales requiere comprobar costos y margen. Ningún cambio modifica pedidos anteriores.</p>'
      +'<p role="status">'+esc(liveSaveFeedback||'Guardá para sincronizar los cambios.')+'</p>'
      +'<button type="button" data-live-save '+(permitted&&!liveSaveBusy?'':'disabled')+'>'
      +(liveSaveBusy?'Validando…':'Guardar en la web y todos los equipos')+'</button>'
      +' <button type="button" data-live-reset>Descartar cambios</button></section>';
  }
  function liveEditor(){
    const banner=!liveLoaded?'Estado de promociones aún no consultado.'
      :!live.published?'El motor promocional no está publicado. No puede activarse desde este panel.'
      :'Solo afecta a nuevos pedidos. No modifica pedidos ya confirmados.';
    const rows=(live.campaigns||[]).map(row=>{
      const record=liveCatalog().find(c=>c.id===row.id);
      const state=livePromotionStatus(row,record);
      const context=record?campaignContext(record,{
        paymentPercent:liveManagement?.paymentPercent||10,productNames:liveNames()
      }):null;
      return '<div class="promo-row" data-live-campaign="'+esc(row.id)+'"><div><strong>'
        +esc(record?.name||row.id)+'</strong><p role="status">'+esc(state.label)
        +'</p>'+(context?'<small>'+esc(context.scheduleText+' · '+context.hours+' · '+context.dates)
        +'</small><small>'+esc(context.discount+' · '+context.channelNames.join(' y '))
        +'</small>':'')+'</div>'+liveSwitch(row.id)+'</div>';
    }).join('');
    return '<section class="promo-card"><h3>Campañas publicadas · control en vivo</h3>'
      +'<p>'+esc(banner)+'</p>'
      +'<p>El switch cambia el estado del servidor y lo vuelve a consultar. La tienda recibe cambios del menú en su refresco de hasta 10 segundos. No habilita campañas que todavía no se publicaron.</p>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<button type="button" data-live-refresh'+(liveBusy?' disabled':'')+'>'
      +(liveBusy?'Consultando…':'Actualizar estado desde la web')+'</button>'
      +(rows||'<p>No hay campañas publicadas para controlar.</p>')+'</section>';
  }
  function publishedRecommendation(id){
    return recEditor.get()?.rules?.complements?.find(x=>x.id===id)||null;
  }
  function draftPublicationControl(type,item){
    if(type==='campaigns'){
      const published=live.campaigns?.find(x=>x.id===item.id);
      if(published)return '<span class="promo-note" role="status">Campaña publicada · '+(published.enabled?'Activa en web':'Pausada en web')+'</span>';
      const gate=publicationKind(type,item);
      if(!gate.ready)return '<p class="promo-caution">No se puede publicar todavía: '+esc(gate.reason)+'</p>';
      if(!liveLoaded||!live.published||liveError)return '<p class="promo-note">Consultá primero el estado del motor promocional publicado.</p>';
      return '<button type="button" class="rec-publish-btn" data-publish-campaign="'+esc(item.id)+'"'
        +(canOperate()&&!publishBusy&&!liveBusy?'':' disabled')+'>Publicar campaña (pausada)</button>'
        +(!canOperate()?'<small>Conectá la tienda como dueño o administrador para publicar.</small>':'');
    }
    if(type!=='crossSells')return '';
    const published=publishedRecommendation(item.id);
    if(published)return '<span class="promo-note" role="status">'+(published.enabled===false?'Publicada, pero pausada en web':'Publicada y habilitada en web')+'</span>'
      +'<button type="button" data-rec-open>Administrar publicación</button>';
    const gate=publicationKind(type,item);
    if(!gate.ready)return '<p class="promo-caution">No se puede publicar todavía: '+esc(gate.reason)+'</p>';
    return '<button type="button" class="rec-publish-btn" data-publish-draft="'+esc(item.id)+'"'
      +(canOperate()&&!publishBusy?'':' disabled')+'>Publicar en web</button>'
      +(!canOperate()?'<small>Conectá la tienda como dueño o administrador para publicar.</small>':'');
  }
  function overviewEditor(state){
    const connected=liveLoaded&&!liveError&&live.published===true;
    const source=connected?{...state,campaigns:[
      ...liveCatalog(),
      ...(state.campaigns||[]).filter(x=>!live.campaigns.some(r=>r.id===x.id))
    ],upsells:[...upsellEditor.entries().map(r=>r.definition),...(state.upsells||[]).filter(x=>!upsellEditor.entries().some(r=>r.id===x.id))]}:state;
    const overview=promotionOverview(source,{now:new Date(),live:connected?live:null});
    const merged=overview.items.map(item=>{
      if(item.type==='upsells'){const row=upsellEditor.entries().find(r=>r.id===item.id);if(row)return {...item,status:row.requiresReview?'pending':row.enabled?(row.additionalDeferred?'provisional':'active'):'inactive',active:row.enabled&&!row.requiresReview};}
      if(item.type!=='crossSells')return item;
      const published=publishedRecommendation(item.id);
      if(!published)return item;
      return {...item,status:published.enabled===false?'inactive':'active',active:published.enabled!==false};
    });
    const operational=connected?merged.filter(item=>(item.type==='campaigns'&&live.campaigns.some(r=>r.id===item.id))||
      item.type==='crossSells'&&!!publishedRecommendation(item.id)||item.type==='upsells'&&upsellEditor.entries().some(r=>r.id===item.id)):merged;
    const visible=filterPromotionOverview(operational,overviewFilter);
    const draftRows=connected?merged.filter(item=>!operational.includes(item)):[];
    const activeCount=operational.filter(x=>x.active).length;
    const pendingCount=operational.filter(x=>x.status==='pending'||x.status==='scheduled').length;
    const inactiveCount=operational.filter(x=>x.status==='inactive'||x.status==='draft').length;
    const badges={provisional:'Habilitada · costos adicionales pendientes',active:'Activa ahora',inactive:'Pausada',scheduled:'Activa · fuera de calendario',pending:'Pendiente de validación · no publicada',draft:'Borrador local'};
    const canSync=canOperate()&&!!w.SAHTEN?.online?.conn?.()?.projectId&&w.SAHTEN?.project?.session?.info?.()?.hasFile===true;
    const renderCard=item=>{
      const next=item.type==='campaigns'?'campaigns':item.type==='upsells'?'extras'
        :item.type==='crossSells'?'recommendations':item.type==='productUpgrades'?'upgrades':'coupons';
      const published=publishedRecommendation(item.id);
      const publishedUpsell=item.type==='upsells'&&upsellEditor.entries().find(r=>r.id===item.id);
      const isPublished=connected&&item.type==='campaigns'&&live.campaigns.some(r=>r.id===item.id);
      const record=isPublished?liveCatalog().find(r=>r.id===item.id):null;
      const ctx=record?campaignContext(record,{
        paymentPercent:liveManagement?.paymentPercent||10,productNames:liveNames()
      }):null;
      const shortContext=ctx?ctx.scheduleText+' · '+ctx.channelNames.join(' / ')
        +' · '+ctx.discount+' · '+ctx.expiryText:'';
      return '<article class="promo-overview-card"><span class="promo-overview-category">'+esc(item.label)+'</span>'
        +'<span class="promo-overview-status is-'+esc(item.status)+'">'+esc(badges[item.status]||'Inactiva')+'</span>'
        +'<strong>'+esc(item.name)+'</strong>'
        +'<span class="promo-overview-detail">'+esc(ctx?shortContext:item.detail)+'</span>'
        +(ctx?'<span class="promo-overview-foot">'+esc(ctx.cap+' · '+ctx.extraRequirement)+'</span>':'')
        +'<span class="promo-overview-foot">'+(isPublished?'Campaña publicada · sincronizada desde la web':publishedUpsell?'Complemento publicado · retiro online':item.type==='crossSells'&&published?'Confirmada con el servidor':'Planificación local')+'</span>'
        +'<div class="promo-overview-actions">'+(item.type==='campaigns'?liveSwitch(item.id):publishedUpsell?'<button type="button" data-upsell-open>Gestionar publicación y costos</button>':item.type==='crossSells'&&published?'<button type="button" data-rec-open>Administrar en web</button>':draftSwitch(({upsells:'upsells',crossSells:'crossSells',productUpgrades:'productUpgrades',couponPrograms:'couponPrograms'})[item.type]||({extras:'upsells',recommendations:'crossSells',upgrades:'productUpgrades',coupons:'couponPrograms'})[item.type]||item.type,{id:item.id,name:item.name,enabled:item.localEnabled}))+'</div>'
        +(isPublished||publishedUpsell?'':draftPublicationControl(item.type,Array.isArray(get()[item.type])?get()[item.type].find(x=>x.id===item.id)||item:item))
        +(!publishedUpsell&&['upsells','productUpgrades','couponPrograms'].includes(item.type)?readinessChecklist(item.type,{...((item.type==='couponPrograms'?get().couponPrograms?.[item.id]:get()[item.type]?.find(x=>x.id===item.id))||item),id:item.id}):'')
        +'<button type="button" class="promo-open" data-open-promo="'+esc(item.id)+'" data-open-type="'+esc(next)+'">'+(isPublished?'Ver campaña':'Editar propuesta')+'</button></article>';
    };
    const cards=visible.map(renderCard).join('');
    const draftCards=draftRows.map(renderCard).join('');
    return '<section class="promo-card"><div class="promo-row"><div><h3>Vista general · Promociones</h3>'
      +'<p>'+(connected?'Estado real del servidor. Pausá o activá desde aquí; las demás apps consultan el mismo estado.':'Conectá la tienda para consultar las campañas publicadas.')+'</p></div>'
      +'<div class="promo-row"><button type="button" data-live-refresh '+(liveBusy?'disabled':'')+'>Actualizar estado web</button>'
      +'<button type="button" data-verify-all '+(canOperate()&&!verificationBusy?'':'disabled')+'>'+(verificationBusy?'Verificando propuestas…':'Verificar todos los borradores')+'</button></div></div>'
      +'<div class="promo-overview-summary"><span><strong>'+operational.length+'</strong> ofertas visibles</span>'
      +'<span><strong>'+activeCount+'</strong> habilitadas por servidor</span>'
      +'<span><strong>'+pendingCount+'</strong> programadas</span>'
      +'<span><strong>'+inactiveCount+'</strong> pausadas</span></div>'
      +'<div class="promo-overview-toolbar" role="group" aria-label="Filtrar promociones">'
      +[['all','Todas'],['active','Activas'],['inactive','No activas']].map(([id,label])=>'<button type="button" data-promo-filter="'+id+'" aria-pressed="'+(overviewFilter===id)+'">'+label+'</button>').join('')
      +'</div>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<div class="promo-overview-grid">'+(cards||'<p class="promo-overview-empty">No hay promociones en este filtro.</p>')+'</div>'
      +(connected&&draftCards?'<details class="promo-local-drafts"><summary>'+draftRows.length+' propuestas en preparación (no publicadas)</summary><p>Este apartado contiene únicamente borradores: las ofertas publicadas aparecen arriba y se controlan en vivo.</p><div class="promo-overview-grid">'+draftCards+'</div></details>':'')
      +'<div class="promo-row"><button type="button" data-promo-create>+ Crear campaña</button><button type="button" data-rec-open>Gestionar recomendaciones publicadas</button></div>'
      +(publishFeedback?'<p class="promo-note" role="status">'+esc(publishFeedback)+'</p>':'')
      +(verificationFeedback?'<p class="promo-note" role="status">'+esc(verificationFeedback)+'</p>':'')
      +'<div class="promo-note">Los borradores de Complementos, Mejoras y Cupones se gestionan en sus pestañas, separados de las ofertas publicadas.</div>'
      +'<details class="promo-local-import"><summary>Importar propuestas antiguas (opcional)</summary><div class="promo-row"><div><strong>Archivo local y nube</strong>'
      +'<p>Los estados de las campañas publicadas se actualizan solos. Este control sólo sirve para importar borradores antiguos, sin reemplazar pedidos ni catálogo.</p>'
      +(syncFeedback?'<p role="status">'+esc(syncFeedback)+'</p>':'')+'</div>'
      +'<button type="button" data-promo-sync '+(canSync?'':'disabled')+'>Importar borradores (opcional)</button></div></details>'
      +'</section>';
  }
  function render() {
    ensureLiveContext();
    const root=w.document?.getElementById?.('promotions-editor');if(!root)return;
    localFormDirty=false;
    const state=get();
    const published=liveLoaded&&!liveError&&live.published?liveCatalog():[];
    const campaigns=published.length?[...published,...(state.campaigns||[]).filter(x=>!published.some(p=>p.id===x.id))]:(state.campaigns||[]);
    const c=campaigns.find(x=>x.id===selected)||campaigns[0];
    if(c)selected=c.id;
    const canEdit=!w.document.body.classList.contains('role-no-costs')&&!w.SAHTEN?.project?.session?.readOnly;
    const canEditSelected=canEdit&&!!c&&!live.campaigns?.some(x=>x.id===c.id);
    const active=promotionOverview({...state,campaigns},{live:liveLoaded&&!liveError?live:null,now:new Date()}).active;
    const publishedLabel=liveError?'Estado web no verificado'
      :!liveApi()?.info?.()?.signedIn?'Conectá la tienda para ver el estado'
      :!liveLoaded?'Consultando estado de la tienda…'
      :live.published?'Motor promocional publicado':'Campañas sin publicar en la web';
    root.innerHTML='<div class="promo-heading"><div><h2>Centro de Promociones</h2><p>Campañas, calendario, cupones, tickets y rentabilidad · SAHTEN</p></div>'
      +'<span class="promo-pill" role="status">'+esc(publishedLabel)+'</span></div>'
      +'<div class="promo-metrics"><div><strong>'+campaigns.length+'</strong><small>Campañas configuradas</small></div><div><strong>'+active+'</strong><small>Activas verificadas</small></div><div><strong>'+(state.upsells||[]).length+'</strong><small>Complementos</small></div></div>'
      +'<nav class="promo-tabs" aria-label="Gestión de promociones">'+[['overview','Vista general'],['campaigns','Campañas'],['publishedRecs','Recomendaciones web'],['extras','Complementos'],['recommendations','Sugerencias'],['upgrades','Mejoras'],['live','En vivo'],['calendar','Calendario'],['coupons','Cupones'],['tickets','Tickets'],['sim','Simulador'],['report','Resultados']].map(([k,t])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(k===tab)+'">'+t+'</button>').join('')+'</nav>'
      + (tab==='overview'?overviewEditor(state):tab==='campaigns' ? campaignEditor(state,c,canEditSelected) : tab==='publishedRecs'?recEditor.render():tab==='extras'?(upsellEditor.render()+draftItemsEditor(state,'upsells','Borradores de complementos')) : tab==='recommendations'?draftItemsEditor(state,'crossSells','Recomendaciones sin rebaja') : tab==='upgrades'?draftItemsEditor(state,'productUpgrades','Mejoras de producto') : tab==='live'?liveEditor() : tab==='calendar'?calendarEditor({...state,campaigns}):tab==='coupons'?couponEditor(state):tab==='tickets'?ticketEditor({...state,ticket:liveTicket?.ticket||state.ticket},canEdit&&!liveTicket):tab==='sim'?simEditor(state,w):reportEditor(w))
      + '<p class="promo-caution">El tablero consulta las campañas reales de la tienda. Los borradores que aún no cumplen requisitos no pueden aplicar descuentos ni emitir cupones.</p>';
    root.oninput=event=>{
      if(event.target.matches('input,select,textarea')&&!event.target.matches('[data-live-search]'))localFormDirty=true;
    };
    recEditor.bind(root);upsellEditor.bind(root);
    root.querySelectorAll('[data-upsell-open]').forEach(b=>b.addEventListener('click',()=>{tab='extras';render();upsellEditor.refresh();}));
    root.querySelectorAll('[data-rec-open]').forEach(btn=>btn.addEventListener('click',()=>{tab='publishedRecs';render();recEditor.refresh();}));
    root.querySelectorAll('[data-verify-draft]').forEach(b=>b.addEventListener('click',()=>{
      if(!canOperate()||verificationBusy)return;
      verifyDraft(b.dataset.verifyType,b.dataset.verifyDraft);
    }));
    root.querySelector('[data-verify-all]')?.addEventListener('click',async()=>{
      if(!canOperate()||verificationBusy)return;
      verificationBusy=true;verificationFeedback='Verificando todos los complementos, mejoras y cupones…';render();
      const state=get();
      const tasks=[...['upsells','productUpgrades'].flatMap(type=>(state[type]||[]).map(x=>({type,id:x.id}))),
        ...Object.keys(state.couponPrograms||{}).map(id=>({type:'couponPrograms',id}))];
      let checked=0;try{
        const queue=[...tasks];
        await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
          while(queue.length){
            const task=queue.shift();
            if(await verifyDraft(task.type,task.id,{quiet:true}))checked++;
          }
        }));
        verificationFeedback='Verificación completada: '+checked+' de '+tasks.length+' propuestas consultadas en el servidor. Revisá los checks de cada tarjeta.';
      }finally{verificationBusy=false;render();}
    });
    root.querySelectorAll('[data-publish-campaign]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!canOperate()||publishBusy||liveBusy||!live.published)return;
      const draft=get().campaigns?.find(x=>x.id===btn.dataset.publishCampaign);
      if(!draft)return;
      const gate=publicationKind('campaigns',draft);
      if(!gate.ready){publishFeedback=gate.reason;campaignFeedback=gate.reason;render();return;}
      const accepted=await w.sahtenConfirm?.(
        '¿Publicar «'+draft.name+'» en la tienda online? El servidor validará productos, costos y margen. Se publicará PAUSADA: no habrá descuentos nuevos hasta que uses el switch Activar.',
        {title:'Publicar campaña pausada',okLabel:'Publicar pausada'});
      if(accepted!==true||!canOperate()||publishBusy||liveBusy||currentLiveContext()!==liveContext)return;
      const context=liveContext;
      publishBusy=true;publishFeedback='Validando rentabilidad y publicación…';campaignFeedback=publishFeedback;render();
      try{
        const response=await liveApi().publishPromotionCampaignDraft(draft);
        if(response?.published!==true || response.id!==draft.id || response.enabled!==false)
          throw new Error('El servidor no confirmó una publicación pausada.');
        const checked=await liveApi().readPromotionCampaignStates();
        if(context!==currentLiveContext())return;
        if(!checked?.campaigns?.some(x=>x.id===draft.id && x.enabled===false))
          throw new Error('La campaña no aparece pausada en el menú del servidor.');
        live=checked;liveLoaded=true;
        publishFeedback='«'+draft.name+'» publicada en pausa. Para activarla, utilizá el switch en vivo.';
        campaignFeedback=publishFeedback;
      }catch(e){
        if(context===currentLiveContext()){
          publishFeedback='No se publicó: '+String(e?.message||e).slice(0,190);
          campaignFeedback=publishFeedback;
          try{const read=await liveApi().readPromotionCampaignStates();if(read)live=read;}catch{}
        }
      }finally{publishBusy=false;render();}
    }));
    root.querySelectorAll('[data-publish-draft]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!canOperate()||publishBusy)return;
      const draft=get().crossSells?.find(x=>x.id===btn.dataset.publishDraft);
      if(!draft)return;
      const gate=publicationKind('crossSells',draft);
      if(!gate.ready){publishFeedback=gate.reason;render();return;}
      const accepted=await w.sahtenConfirm?.('¿Publicar «'+draft.name+'» como sugerencia sin descuento en el carrito de sahten.online? El producto se cobrará a precio de lista.',
        {title:'Publicar sugerencia',okLabel:'Publicar en web'});
      if(accepted!==true||!canOperate()||publishBusy)return;
      publishBusy=true;publishFeedback='Publicando y verificando con el servidor…';render();
      try{
        await recEditor.publishDraft(draft);
        publishFeedback='Publicación confirmada: «'+draft.name+'» ya está habilitada en la web.';
      }catch(err){publishFeedback='No se publicó: '+String(err?.message||err).slice(0,190);}
      finally{publishBusy=false;render();}
    }));
    root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();if(tab==='live')refreshLive();if(tab==='publishedRecs')recEditor.refresh();if(tab==='extras')upsellEditor.refresh();}));
    root.querySelector('[data-live-refresh]')?.addEventListener('click',()=>{refreshLive();recEditor.refresh();});
    root.querySelector('[data-promo-create]')?.addEventListener('click',()=>{tab='campaigns';render();root.querySelector('[data-promo-new]')?.focus();});
    root.querySelectorAll('[data-promo-filter]').forEach(b=>b.addEventListener('click',()=>{overviewFilter=b.dataset.promoFilter;render();}));
    root.querySelectorAll('[data-open-promo]').forEach(b=>b.addEventListener('click',()=>{
      tab=b.dataset.openType;
      if(tab==='campaigns')selected=b.dataset.openPromo;
      if(tab==='coupons')couponEditing=b.dataset.openPromo;
      if(['extras','recommendations','upgrades'].includes(tab)){
        draftEditing={key:{extras:'upsells',recommendations:'crossSells',upgrades:'productUpgrades'}[tab],
          id:b.dataset.openPromo};
      }
      render();
    }));
    root.querySelector('[data-promo-sync]')?.addEventListener('click',async()=>{
      if(!canOperate()||!w.SAHTEN?.online?.conn?.()?.projectId||!w.SAHTEN?.project?.session?.info?.()?.hasFile)return;
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
    root.querySelector('[data-ticket-live-save]')?.addEventListener('click',async()=>{
      if(!canOperate()||!liveManagement?.ticket||!liveApi()?.updatePromotionTicketSettings)return;
      const next={
        enabled:!!root.querySelector('[data-ticket-live="enabled"]')?.checked,
        advertise:!!root.querySelector('[data-ticket-live="advertise"]')?.checked
      };
      const previous=liveManagement.ticket;
      if(next.enabled===previous.enabled&&next.advertise===previous.advertise){
        liveSaveFeedback='Estas opciones ya coinciden con la tienda.';render();return;
      }
      const yes=await w.sahtenConfirm?.('Actualizar la publicidad en todos los tickets de cliente nuevos y en las apps conectadas?',
        {title:'Guardar publicidad',okLabel:'Guardar en vivo'});
      if(yes!==true)return;
      try{
        await liveApi().updatePromotionTicketSettings(next,previous.revision??null);
        liveSaveFeedback='Opciones del ticket publicadas y sincronizadas.';
        await refreshLive();
      }catch(e){
        liveSaveFeedback='No se guardó el ajuste del ticket: '+String(e?.message||e).slice(0,200);
        render();
      }
    });
    root.querySelector('.promo-live-editor')?.addEventListener('input',()=>{liveEditDirty=true;});
    root.querySelector('[data-live-search]')?.addEventListener('input',ev=>{
      const q=ev.target.value.toLowerCase();
      root.querySelectorAll('.promo-live-products .promo-checkbox').forEach(el=>{
        el.hidden=!el.textContent.toLowerCase().includes(q);
      });
    });
    root.querySelector('[data-live-reset]')?.addEventListener('click',()=>{
      liveEditDirty=false;liveSaveFeedback='Cambios descartados.';render();refreshLive();
    });
    root.querySelector('[data-live-save]')?.addEventListener('click',async()=>{
      const el=root.querySelector('.promo-live-editor'),id=el?.dataset.campaignId,
        c=liveCatalog().find(x=>x.id===id),revision=live.campaigns?.find(x=>x.id===id)?.revision??null;
      if(!c||!canOperate()||liveSaveBusy||!liveApi()?.updatePromotionCampaignDetails)return;
      const value=key=>el.querySelector('[data-live-field="'+key+'"]')?.value??'';
      const checked=key=>!!el.querySelector('[data-live-field="'+key+'"]')?.checked;
      const selected=(key)=>[...el.querySelectorAll('[data-live-'+key+']:checked')].map(x=>x.getAttribute('data-live-'+key));
      const type=value('scheduleType'),schedule={type};
      if(type==='weekly')schedule.weekdays=selected('weekday').map(Number).sort((a,b)=>a-b);
      if(type==='dates')schedule.dates=value('dates').split(',').map(s=>s.trim()).filter(Boolean);
      for(const k of ['from','until','startTime','endTime'])if(value(k))schedule[k]=value(k);
      const adv={...c.advertising,enabled:checked('advertisingEnabled'),message:value('message').trim(),
        placement:selected('placement'),advanceDays:Number(value('advanceDays')),
        ticketFormat:value('ticketFormat')||null};
      const candidate={name:value('name').trim(),priority:Number(value('priority')),
        extraPercent:Number(value('extraPercent')),maxUnits:value('maxUnits')===''?null:Number(value('maxUnits')),
        productIds:selected('product'),channels:selected('channel'),
        schedule,advertising:adv};
      const before={...c,schedule:c.schedule||{type:'always'},advertising:c.advertising||{}};
      const changes=Object.fromEntries(Object.entries(candidate).filter(([k,v])=>
        JSON.stringify(v)!==JSON.stringify(before[k])));
      if(!Object.keys(changes).length){liveEditDirty=false;liveSaveFeedback='No hay cambios para publicar.';render();return;}
      const economics=['extraPercent','productIds','channels'].some(k=>Object.hasOwn(changes,k));
      const yes=await w.sahtenConfirm?.(economics
        ?'El servidor volverá a verificar costos, precios y margen. Si no es rentable, rechazará el cambio. ¿Guardar?'
        :'Guardar los cambios de esta campaña en Supabase y reflejarlos en la web y los demás equipos?',
        {title:'Guardar campaña publicada',okLabel:'Guardar y sincronizar'});
      if(yes!==true)return;
      liveSaveBusy=true;liveSaveFeedback='Validando y guardando en el servidor…';
      const status=el.querySelector('[role="status"]');if(status)status.textContent=liveSaveFeedback;
      try{
        await liveApi().updatePromotionCampaignDetails(id,changes,revision);
        liveEditDirty=false;liveSaveFeedback='Cambios publicados y sincronizados. Los demás equipos verán la actualización.';
        await refreshLive();
      }catch(err){
        liveSaveFeedback='No se guardó: '+String(err?.message||err).slice(0,220)+'. Revisá el conflicto o el margen.';
        const p=el.querySelector('[role="status"]');if(p)p.textContent=liveSaveFeedback;
      }finally{liveSaveBusy=false;}
    });
    root.querySelectorAll('[data-live-open]').forEach(button=>button.addEventListener('click',()=>{
      selected=button.dataset.liveOpen;liveEditDirty=false;tab='campaigns';render();
    }));
    root.querySelectorAll('[data-live-toggle]').forEach(button=>button.addEventListener('click',async()=>{
      if(!canOperate()||liveBusy||!live.published)return;
      const row=live.campaigns.find(x=>x.id===button.dataset.liveToggle);if(!row)return;
      const enable=!row.enabled;
      const confirm=await w.sahtenConfirm?.(
        enable?'¿Reactivar esta campaña? Se aplicará a nuevos pedidos según su calendario.':'¿Pausar esta campaña en los nuevos pedidos?',
        {title:enable?'Reactivar campaña':'Pausar campaña',okLabel:enable?'Reactivar':'Pausar'});
      if(confirm!==true||!canOperate()||liveBusy||!live.published||currentLiveContext()!==liveContext)return;
      liveBusy=true;liveError='';render();
      try{
        await liveApi().setPromotionCampaignState(row.id,enable,row.revision??null);
        const updated=await liveApi().readPromotionCampaignStates();
        if(!updated||!Array.isArray(updated.campaigns)||!updated.campaigns.some(c=>c.id===row.id&&c.enabled===enable))throw new Error('No se confirmó el cambio en el servidor.');
        live=updated;liveLoaded=true;lastLiveAt=Date.now();
      }catch(e){liveError=String(e?.message||'El cambio no se pudo confirmar.').slice(0,250);
        try{const refreshed=await liveApi().readPromotionCampaignStates();if(refreshed)live=refreshed;}catch{}}
      finally{liveBusy=false;render();}
    }));
    root.querySelector('[data-coupon-create]')?.addEventListener('click',()=>{
      if(!canEdit)return;
      const programs=state.couponPrograms&&typeof state.couponPrograms==='object'?state.couponPrograms:{};
      let id='cupon-'+Date.now().toString(36),i=1;
      while(Object.hasOwn(programs,id))id='cupon-'+Date.now().toString(36)+'-'+i++;
      state.couponPrograms=programs;
      programs[id]={name:'Nuevo programa de cupón',enabled:false,extraPercent:5,minEligibleSubtotal:0,
        maxExtraAmount:null,validDays:14,channel:'online',requiresConfirmedOrigin:false,
        activationBlockers:['atomic_checkout_redemption_required']};
      couponEditing=id;save(state);render();
    });
    root.querySelectorAll('[data-coupon-edit]').forEach(b=>b.addEventListener('click',()=>{
      if(!canEdit)return;couponEditing=b.dataset.couponEdit;render();
    }));
    root.querySelectorAll('[data-coupon-duplicate]').forEach(b=>b.addEventListener('click',()=>{
      if(!canEdit)return;
      const source=state.couponPrograms?.[b.dataset.couponDuplicate];if(!source)return;
      let id='cupon-'+Date.now().toString(36),i=1;
      while(Object.hasOwn(state.couponPrograms,id))id='cupon-'+Date.now().toString(36)+'-'+i++;
      state.couponPrograms[id]={...JSON.parse(JSON.stringify(source)),name:'Copia de '+String(source.name||'Cupón').slice(0,80),enabled:false};
      couponEditing=id;save(state);render();
    }));
    root.querySelectorAll('[data-coupon-delete]').forEach(b=>b.addEventListener('click',async()=>{
      if(!canEdit)return;const id=b.dataset.couponDelete;
      const accepted=await w.sahtenConfirm?.('¿Eliminar este borrador de cupón? No afecta códigos ni pedidos.',
        {title:'Eliminar programa de cupón',okLabel:'Eliminar borrador'});
      if(accepted!==true||!canEdit||!Object.hasOwn(state.couponPrograms||{},id))return;
      delete state.couponPrograms[id];if(couponEditing===id)couponEditing=null;save(state);render();
    }));
    root.querySelector('[data-coupon-cancel]')?.addEventListener('click',()=>{couponEditing=null;render();});
    root.querySelector('[data-coupon-save]')?.addEventListener('click',()=>{
      if(!canEdit||!couponEditing)return;
      const item=state.couponPrograms?.[couponEditing];if(!item)return;
      const name=root.querySelector('#coupon-name')?.value.trim(),pct=Number(root.querySelector('#coupon-percent')?.value),
        min=Number(root.querySelector('#coupon-minimum')?.value),capStr=root.querySelector('#coupon-cap')?.value.trim(),
        cap=capStr===''?null:Number(capStr),days=Number(root.querySelector('#coupon-days')?.value),
        channel=root.querySelector('#coupon-channel')?.value;
      if(!name||name.length<4||name.length>100||!Number.isFinite(pct)||pct<=0||pct>10
        ||!Number.isFinite(min)||min<0||(cap!==null&&(!Number.isFinite(cap)||cap<=0))
        ||!Number.isInteger(days)||days<1||days>365||!['online','mostrador'].includes(channel)){
        w.sahtenAlert?.('Revisá nombre, descuento hasta 10 puntos, mínimo, tope y vigencia de 1 a 365 días.');return;
      }
      const eligibleProductIds=[...root.querySelectorAll('[data-coupon-product]:checked')].map(x=>x.dataset.couponProduct);
      Object.assign(item,{name,extraPercent:pct,minEligibleSubtotal:min,maxExtraAmount:cap,
        validDays:days,channel,eligibleProductIds,requiresConfirmedOrigin:root.querySelector('#coupon-origin')?.checked===true,enabled:false});
      couponEditing=null;save(state);render();
    });
    root.querySelectorAll('[data-draft-toggle]').forEach(button=>button.addEventListener('click',()=>{
      if(w.SAHTEN?.project?.session?.readOnly||w.document.body.classList.contains('role-no-costs'))return;
      const key=button.dataset.draftToggle,id=button.dataset.draftId;
      const item=key==='couponPrograms'?state.couponPrograms?.[id]:
        Array.isArray(state[key])?state[key].find(x=>x.id===id):null;
      if(!item)return;
      item.enabled=!item.enabled;save(state);render();
    }));
    root.querySelectorAll('[data-draft-create]').forEach(b=>b.addEventListener('click',()=>{
      if(!canEdit)return;
      const key=b.dataset.draftCreate,id='borrador-'+Date.now().toString(36);
      const item={id,name:'Nueva propuesta',enabled:false,extraPercent:key==='crossSells'?0:5,
        kind:key==='upsells'?'upsell':key==='crossSells'?'recommendation':'replace_product',
        priority:30,productId:'',productIds:[],triggerProductIds:[],
        advertising:{enabled:false,placement:['cart'],message:''},
        activationBlockers:['cost_and_checkout_verification_required']};
      state[key]=Array.isArray(state[key])?state[key]:[];
      state[key].push(item);draftEditing={key,id};save(state);render();
    }));
    root.querySelectorAll('[data-draft-edit]').forEach(b=>b.addEventListener('click',()=>{
      draftEditing={key:b.dataset.draftGroup,id:b.dataset.draftEdit};render();
    }));
    root.querySelectorAll('[data-draft-duplicate]').forEach(b=>b.addEventListener('click',()=>{
      if(!canEdit)return;const key=b.dataset.draftGroup;
      const original=(state[key]||[]).find(x=>x.id===b.dataset.draftDuplicate);if(!original)return;
      const item=JSON.parse(JSON.stringify(original));item.id='borrador-'+Date.now().toString(36);
      item.name='Copia de '+String(item.name||'Propuesta').slice(0,80);item.enabled=false;
      state[key].push(item);draftEditing={key,id:item.id};save(state);render();
    }));
    root.querySelectorAll('[data-draft-delete]').forEach(b=>b.addEventListener('click',async()=>{
      if(!canEdit)return;const key=b.dataset.draftGroup,id=b.dataset.draftDelete;
      const agreed=await w.sahtenConfirm?.('¿Eliminar este borrador del proyecto? No afecta promociones publicadas.',
        {title:'Eliminar borrador',okLabel:'Eliminar'});
      if(agreed!==true||!canEdit)return;
      state[key]=(state[key]||[]).filter(x=>x.id!==id);
      draftEditing=null;save(state);render();
    }));
    root.querySelector('[data-draft-cancel]')?.addEventListener('click',()=>{draftEditing=null;render();});
    root.querySelector('[data-draft-save]')?.addEventListener('click',()=>{
      if(!canEdit||!draftEditing)return;
      const item=(state[draftEditing.key]||[]).find(x=>x.id===draftEditing.id);
      if(!item)return;
      const name=root.querySelector('#draft-name')?.value.trim();
      const percent=Number(root.querySelector('#draft-extra')?.value||0);
      const target=root.querySelector('[data-draft-target]')?.value;
      const triggers=[...root.querySelectorAll('[data-draft-trigger]:checked')].map(x=>x.dataset.draftTrigger);
      const placement=[...root.querySelectorAll('[data-draft-placement]:checked')].map(x=>x.dataset.draftPlacement);
      if(!name||!target||!triggers.length||!Number.isFinite(percent)||percent<0||percent>20){
        w.sahtenAlert?.('Completá nombre, producto, al menos un disparador y descuento válido.');return;
      }
      item.name=name.slice(0,100);item.extraPercent=percent;item.triggerProductIds=triggers;
      if(draftEditing.key==='upsells')item.productIds=[target];
      else if(draftEditing.key==='crossSells')item.productId=target;
      else item.replacementProductId=target;
      if(draftEditing.key==='productUpgrades')item.triggerProductId=triggers[0];
      item.advertising={...(item.advertising||{}),placement,enabled:false};
      if(draftEditing.key==='crossSells')item.placement=placement;
      item.enabled=false;draftEditing=null;save(state);render();
    });
    root.querySelector('[data-promo-campaign]')?.addEventListener('change',e=>{selected=e.target.value;render()});
    root.querySelector('[data-promo-new]')?.addEventListener('click',()=>{
      if(!canEdit)return;
      const id='custom-'+Date.now().toString(36);
      const preset=root.querySelector('[data-promo-preset]')?.value||'mon-wed';
      state.campaigns.push(campaignTemplate(preset,id));
      selected=id;campaignFeedback='Campaña creada como borrador. Elegí los productos y revisá el calendario antes de publicarla.';
      save(state);render();
    });
    root.querySelector('[data-promo-duplicate]')?.addEventListener('click',()=>{
      if(!canEdit||!c)return;
      const id='custom-'+Date.now().toString(36);
      if(state.campaigns.some(x=>x.id===id))return;
      state.campaigns.push({...JSON.parse(JSON.stringify(c)),id,name:'Copia de '+String(c.name||'Campaña').slice(0,88),enabled:false});
      selected=id;campaignFeedback='Nueva copia local, pausada y sin publicar. Revisá el calendario y el costo antes de activar.';
      save(state);render();
    });
    root.querySelector('[data-promo-delete]')?.addEventListener('click',async()=>{
      if(!canEdit||!c||!liveLoaded||liveError||liveBusy||live.campaigns.some(x=>x.id===c.id))return;
      const target=c.id;
      const yes=await w.sahtenConfirm?.('¿Eliminar el borrador local «'+c.name+'»? Sólo se permiten campañas sin publicar.',
        {title:'Eliminar borrador',okLabel:'Eliminar'});
      if(yes!==true||!canEdit||live.campaigns.some(x=>x.id===target))return;
      state.campaigns=state.campaigns.filter(x=>x.id!==target);
      selected=state.campaigns[0]?.id||'';
      campaignFeedback='El borrador se eliminó del proyecto local. La web no cambió.';
      save(state);render();
    });
    root.querySelector('[data-promo-preview]')?.addEventListener('click',()=>{tab='sim';render()});
    root.querySelectorAll('[data-promo-weekday]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit||!c)return;
      const day=Number(el.dataset.promoWeekday),days=new Set(c.schedule?.weekdays||[]);
      if(el.checked)days.add(day);else days.delete(day);
      c.schedule={...c.schedule,type:'weekly',weekdays:[...days].sort((a,b)=>a-b)};
      save(state);render();
    }));
    root.querySelector('[data-promo-dates-add]')?.addEventListener('click',()=>{
      if(!canEdit||!c||!/^\\d{4}-\\d{2}-\\d{2}$/.test(root.querySelector('[data-promo-date]')?.value||''))return;
      c.schedule.dates=[...new Set([...(c.schedule.dates||[]),root.querySelector('[data-promo-date]').value])].sort();
      save(state);render();
    });
    root.querySelectorAll('[data-promo-date-remove]').forEach(b=>b.addEventListener('click',()=>{
      if(!canEdit||!c)return;c.schedule.dates=(c.schedule.dates||[]).filter(x=>x!==b.dataset.promoDateRemove);save(state);render();
    }));
    root.querySelector('[data-promo-check]')?.addEventListener('click',()=>{
      if(!c)return;campaignFeedback=validateCampaignDraft(c).length
        ?'Falta completar: '+validateCampaignDraft(c).join(' ')
        :'Configuración completa para revisar. Aún no se publicó; el motor del checkout debe validarse primero.';
      render();
    });
    root.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{
      if(!canEdit)return;const key=el.dataset.field,value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
      if(!c)return;
      if(key==='name'||key==='extraPercent'||key==='enabled')c[key]=key==='extraPercent'?Math.max(0,Math.min(20,value)):value;
      else if(key==='scheduleType')c.schedule={...c.schedule,type:value,...(value==='weekly'?{weekdays:c.schedule?.weekdays?.length?c.schedule.weekdays:[1,3]}:value==='dates'?{dates:c.schedule?.dates||[]}:{})};
      else if(key==='dates')c.schedule.dates=value.split(',').map(s=>s.trim()).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s));
      else if(key==='weekdays')c.schedule.weekdays=value.split(',').map(Number).filter(n=>n>=0&&n<=6);
      else if(['from','until','startTime','endTime'].includes(key))c.schedule[key]=value||undefined;
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
    if(c&&liveManagement?.campaigns?.some(x=>x.id===c.id))return liveCampaignEditor(c);
    if(!c)return '<section class="promo-card"><h3>No hay campañas</h3><button type="button" data-promo-new>+ Nueva campaña</button></section>';
    const disabled=canEdit?'':'disabled';
    const schedule=c.schedule??{type:'always'};
    const errors=validateCampaignDraft(c);
    const days=schedule.type==='weekly'?'<fieldset class="promo-weekdays"><legend>Elegí los días que se repite</legend>'
      +WEEK_DAYS.map(([name,id])=>'<label class="promo-day"><input type="checkbox" data-promo-weekday="'+id+'" '+(schedule.weekdays?.includes(id)?'checked':'')+' '+disabled+'><span>'+name+'</span></label>').join('')+'</fieldset>':'';
    const dates=schedule.type==='dates'?'<div class="promo-date-picker"><label class="promo-field">Fecha<input type="date" data-promo-date></label>'
      +'<button type="button" data-promo-dates-add '+disabled+'>Agregar fecha</button></div>'
      +'<div class="promo-date-chips">'+(schedule.dates||[]).map(date=>'<button type="button" data-promo-date-remove="'+esc(date)+'" '+disabled+'>'+esc(date)+' ×</button>').join('')+'</div>':'';
    const remote=(live.campaigns||[]).find(row=>row.id===c.id);
    const ready=liveLoaded&&live.published&&remote;
    return '<div class="promo-split"><section class="promo-card">'
      +'<h3>1. Empezá con una plantilla</h3><p>Podés crear campañas semanales sin escribir números de días ni fechas a mano.</p>'
      +'<div class="promo-row"><label class="promo-field">Campaña nueva<select data-promo-preset>'
      +[['mon-wed','Lunes y miércoles'],['weekly','Repetir cada semana'],['central','2.º y 3.º viernes y sábado'],['dates','Elegir fechas concretas']]
        .map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')+'</select></label>'
      +'<button type="button" data-promo-new '+disabled+'>+ Crear borrador</button></div>'
      +'<label class="promo-field">Campaña<select data-promo-campaign>'+(liveLoaded&&live.published?[...liveCatalog(),...(state.campaigns||[]).filter(x=>!live.campaigns.some(p=>p.id===x.id))]:state.campaigns).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===c.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'
      +'<div class="promo-row"><button type="button" data-promo-duplicate '+disabled+'>Duplicar campaña como borrador</button>'
      +'<button type="button" data-promo-delete '+(canEdit&&liveLoaded&&!liveError&&!liveBusy&&!remote?'':'disabled')+'>Eliminar borrador local</button></div>'
      +(remote?'<div class="promo-note">Campaña publicada. Las condiciones se consultan desde la web y la activación se controla mediante el interruptor en vivo; este formulario no sobrescribe las reglas del servidor.</div>':'')
      +'<h3>2. Qué ofrecés</h3>'
      +'<div class="promo-grid">'+formField('promo-title','Nombre visible',c.name,'text','data-field="name" maxlength="100" '+disabled)
      +formField('promo-extra','Descuento adicional (puntos porcentuales)',c.extraPercent,'number','min="1" max="20" step="1" data-field="extraPercent" '+disabled)+'</div>'
      +'<h4>Productos participantes</h4><p>Marcá los productos que tendrán el beneficio.</p>'
      +'<div class="promo-choices">'+catalog(w).map(p=>'<label class="promo-checkbox"><input data-product="'+esc(p.id)+'" type="checkbox" '+((c.productIds||[]).includes(p.id)?'checked':'')+' '+disabled+'><span>'+esc(p.name)+'</span></label>').join('')+'</div>'
      +'<h4>Canales</h4><div class="promo-inline">'+checkedSelect(options,c.channels,'channel')+'</div>'
      +'<h3>3. Cuándo aparece</h3>'
      +'<label class="promo-field">Repetición<select data-field="scheduleType" '+disabled+'>'
      +[['weekly','Cada semana'],['central_weekends','2.º y 3.º viernes y sábado'],['dates','Fechas elegidas'],['always','Todos los días']]
        .map(([v,t])=>'<option value="'+v+'" '+(schedule.type===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'
      +days+dates
      +'<div class="promo-grid">'+formField('promo-start','Fecha de inicio (opcional)',schedule.from||'','date','data-field="from" '+disabled)
      +formField('promo-end','Fecha de fin (opcional)',schedule.until||'','date','data-field="until" '+disabled)
      +formField('promo-start-time','Desde la hora (opcional)',schedule.startTime||'','time','data-field="startTime" '+disabled)
      +formField('promo-end-time','Hasta la hora (opcional)',schedule.endTime||'','time','data-field="endTime" '+disabled)+'</div>'
      +'<div class="promo-plan-preview"><strong>Vista previa del calendario</strong><p>'+esc(describeSchedule(schedule))+'</p>'
      +'<p>'+esc(schedule.from||'Desde ahora')+' — '+esc(schedule.until||'Sin fecha de vencimiento')+'</p></div>'
      +'<h3>4. Revisá antes de publicar</h3>'
      +'<div class="promo-note">'+(errors.length?'Falta completar: '+errors.map(esc).join(' · '):'Los datos básicos de esta campaña están completos. Falta validación comercial y publicación segura en el servidor.')+'</div>'
      +'<label class="promo-checkbox"><input data-field="enabled" type="checkbox" '+(c.enabled?'checked':'')+' '+disabled+'> Incluir en la planificación local (no activa descuentos en la web)</label>'
      +'<button type="button" data-promo-check>Verificar configuración</button> <button type="button" data-promo-preview>Simular descuento</button>'
      +(campaignFeedback?'<p role="status">'+esc(campaignFeedback)+'</p>':'')
      +'</section><section class="promo-card"><h3>Estado de la campaña en la tienda</h3>'
      +'<p>El estado publicado se controla por separado del borrador para que no haya activaciones accidentales.</p>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +(ready?liveSwitch(c.id):'<p class="promo-note">Esta campaña todavía es un borrador; su activación comercial no está publicada.</p>'+liveSwitch(c.id))
      +draftPublicationControl('campaigns',c)
      +'<button type="button" data-live-refresh>Consultar estado web</button>'
      +'<h3>Mensaje y publicidad</h3>'
      +'<label class="promo-field">Mensaje publicitario<textarea data-field="message" rows="3" '+disabled+'>'+esc(c.advertising?.message||'')+'</textarea></label>'
      +'<h4>Superficies</h4><div class="promo-choices">'+checkedSelect(placements,c.advertising?.placement,'placement')+'</div>'
      +'<label class="promo-checkbox"><input data-field="advertisingEnabled" type="checkbox" '+(c.advertising?.enabled?'checked':'')+' '+disabled+'> Preparar publicidad (no publicar todavía)</label>'
      +'<div class="promo-note">Las promociones adicionales serán solo para efectivo y transferencia cuando se complete la validación del servidor. El descuento habitual del 10% se mantiene y Mercado Pago no se modifica.</div>'
      +'</section></div>';
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
        +'<p>'+esc(item.id)+' · '+(key==='crossSells'&&publishedRecommendation(item.id)?'Publicada en web':item.enabled?'Marcada en borrador':'Desactivada')+'</p>'
        +'<p>'+pct+'</p>'
        +(item.unitDefinition?.portionCroquettes?'<p>Ración: '+esc(item.unitDefinition.portionCroquettes)+' croquetas por unidad</p>':'')
        +(key==='upsells'?'<p class="promo-caution">Motivo: '+esc((item.activationBlockers||[]).some(x=>/backend|server_basket|checkout/.test(x))
            ?'Falta publicar y validar el cálculo del descuento en el checkout.'
            :(item.activationBlockers||[]).some(x=>/cost|margin|packaging/.test(x))
              ?'Falta verificar el costo y margen de este complemento.'
              :'No hay una oferta de descuento publicada para este complemento.')+'</p>'
          :key==='productUpgrades'?'<p class="promo-caution">Motivo: falta costo verificado y lógica de reemplazo para la venta.</p>'
          :'<p class="promo-note">Esta es una propuesta local. Las sugerencias reales se administran en «Recomendaciones web».</p>')
        +(products.length?'<small>SKU: '+products.map(esc).join(', ')+'</small>':'')
        +'</div><div class="rec-rule-controls">'+(key==='crossSells'&&publishedRecommendation(item.id)?'<button type="button" data-rec-open>Administrar en web</button>':draftSwitch(key,item))
        +'<button type="button" data-draft-edit="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Editar</button>'
        +'<button type="button" data-draft-duplicate="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Duplicar</button>'
        +'<button type="button" data-draft-delete="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Eliminar</button></div>'
        +draftPublicationControl(key,item)
        +readinessChecklist(key,item)+'</article>';
    }).join('');
    return '<section class="promo-card"><h3>'+esc(title)+' ('+items.length+')</h3>'
      +'<p>Estos son BORRADORES del proyecto, no las recomendaciones publicadas. El switch cambia solo la planificación, NO activa descuentos.</p>'
      +'<div class="promo-draft-list">'+(cards||'<p>No hay propuestas configuradas.</p>')+'</div>'
      +'<div class="promo-row"><button type="button" data-draft-create="'+esc(key)+'">+ Crear borrador</button><button type="button" data-rec-open>Gestionar recomendaciones publicadas</button></div>'
      +(publishFeedback?'<p class="promo-note" role="status">'+esc(publishFeedback)+'</p>':'')
      +(draftEditing?.key===key?draftRuleEditor(state,key):'')
      +'<div class="promo-note">Para ofrecer descuentos reales faltan aprobación de costos, cotización del servidor y activación individual. Mercado Pago queda excluido de esta etapa.</div></section>';
  }
  function draftRuleEditor(state,key){
    const item=(state[key]||[]).find(x=>x.id===draftEditing?.id);
    if(!item)return '';
    const prod=catalog(w),target=key==='upsells'?item.productIds?.[0]:key==='crossSells'?item.productId:item.replacementProductId;
    const triggers=Array.isArray(item.triggerProductIds)?item.triggerProductIds:(item.triggerProductId?[item.triggerProductId]:[]);
    const loc=item.advertising?.placement||item.placement||['cart'];
    return '<div class="promo-card rec-edit-form"><h4>Editar propuesta local · NO publicada</h4>'
      +formField('draft-name','Nombre',item.name||'','text','maxlength="100"')
      +formField('draft-extra','Puntos de descuento propuestos',item.extraPercent||0,'number','min="0" max="20" step="1"')
      +'<label class="promo-field">Producto objetivo<select data-draft-target><option value="">Elegí producto</option>'
      +prod.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===target?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>'
      +'<fieldset class="rec-choices"><legend>Mostrar si el carrito contiene</legend>'
      +prod.map(p=>'<label class="rec-product-check"><input type="checkbox" data-draft-trigger="'+esc(p.id)+'"'
        +(triggers.includes(p.id)?' checked':'')+'>'+esc(p.name)+'</label>').join('')+'</fieldset>'
      +'<fieldset class="rec-choices"><legend>Ubicaciones propuestas (solo planificación)</legend>'
      +placements.map(([id,name])=>'<label class="rec-product-check"><input type="checkbox" data-draft-placement="'+esc(id)+'"'
        +(loc.includes(id)?' checked':'')+'>'+esc(name)+'</label>').join('')+'</fieldset>'
      +'<p>Guardar esta propuesta NO crea un descuento público. El checkout debe verificar costos, márgenes y límites antes de habilitarla.</p>'
      +'<div class="promo-row"><button type="button" data-draft-save>Guardar borrador</button>'
      +'<button type="button" data-draft-cancel>Cancelar</button></div></div>';
  }
  function couponEditor(state){
    const entries=Object.entries(state.couponPrograms||{});
    const canEdit=!w.SAHTEN?.project?.session?.readOnly&&!w.document.body.classList.contains('role-no-costs');
    const rows=entries.map(([id,p])=>'<article class="promo-row promo-draft-item"><div><strong>'+esc(p.name||id)+'</strong>'
      +'<p>'+esc(id)+' · '+(p.enabled?'En planificación local':'Fuera de planificación')+' · No publicado</p>'
      +'<p>'+esc(p.extraPercent??0)+' puntos adicionales · Compra mínima '+fmt(p.minEligibleSubtotal)
      +(p.maxExtraAmount!=null?' · Tope '+fmt(p.maxExtraAmount):'')+' · Vigencia '+esc(p.validDays??'?')+' días</p>'
      +'<small>Canal previsto: '+esc(p.channel||'online')+(p.requiresConfirmedOrigin?' · Requiere compra anterior confirmada':'')+'</small>'
      +'</div><div class="rec-rule-controls">'+draftSwitch('couponPrograms',{...p,id})
      +['Editar','Duplicar','Eliminar'].map((label,i)=>'<button type="button" data-coupon-'+['edit','duplicate','delete'][i]+'="'+esc(id)+'"'+(canEdit?'':' disabled')+'>'+label+'</button>').join('')
      +'</div>'+readinessChecklist('couponPrograms',{...p,id})+'</article>').join('');
    const methods=state.activationPolicy?.allowedPromotionPaymentMethods;
    const editing=couponEditing?state.couponPrograms?.[couponEditing]:null;
    const form=editing?'<div class="promo-card rec-edit-form"><h4>Editar programa de cupón · borrador local</h4><p>Identificador: '+esc(couponEditing)+'</p>'
      +formField('coupon-name','Nombre',editing.name||'','text','maxlength="100"')
      +formField('coupon-percent','Puntos adicionales (máximo 10)',editing.extraPercent??5,'number','min="0.01" max="10" step="0.01"')
      +formField('coupon-minimum','Compra mínima elegible',editing.minEligibleSubtotal??0,'number','min="0" step="0.01"')
      +formField('coupon-cap','Tope del beneficio en $ (opcional)',editing.maxExtraAmount??'','number','min="0.01" step="0.01"')
      +formField('coupon-days','Vigencia en días',editing.validDays??14,'number','min="1" max="365" step="1"')
      +'<label class="promo-field">Canal previsto<select id="coupon-channel">'
      +[['online','Tienda online'],['mostrador','Mostrador']].map(([id,label])=>'<option value="'+id+'"'+((editing.channel||'online')===id?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'
      +'<label class="promo-checkbox"><input id="coupon-origin" type="checkbox" '+(editing.requiresConfirmedOrigin?'checked':'')+'> Requiere compra anterior confirmada</label>'
      +'<fieldset class="rec-choices"><legend>Productos elegibles para la prueba económica</legend>'
      +catalog(w).map(p=>'<label class="rec-product-check"><input type="checkbox" data-coupon-product="'+esc(p.id)+'"'
        +(Array.isArray(editing.eligibleProductIds)&&editing.eligibleProductIds.includes(p.id)?' checked':'')+'>'+esc(p.name)+'</label>').join('')
      +'</fieldset>'
      +'<small>Elegí los productos a los que aplicará el cupón. Sin productos definidos, no se puede calcular su rentabilidad.</small>'
      +'<p>Guardar desactiva la planificación, no emite códigos ni modifica descuentos públicos.</p>'
      +'<div class="promo-row"><button type="button" data-coupon-save>Guardar borrador</button><button type="button" data-coupon-cancel>Cancelar</button></div></div>':'';
    return '<section class="promo-card"><h3>Cupones y recompensas ('+entries.length+')</h3>'
      +'<p>Métodos elegibles para nuevas promociones: '+esc(Array.isArray(methods)?methods.join(' y '):'sin autorización publicada')+'. El 10% habitual es independiente.</p>'
      +'<div class="promo-draft-list">'+(rows||'<p>No hay programas configurados.</p>')+'</div>'
      +'<button type="button" data-coupon-create '+(canEdit?'':'disabled')+'>+ Crear programa de cupón</button>'+form
      +'<div class="promo-note"><strong>Emisión y canje:</strong> bloqueados hasta completar canje único del checkout. Una reimpresión no emite otro cupón. El switch sólo cambia el borrador.</div></section>';
  }
  function ticketEditor(state,canEdit){
    const server=liveManagement?.ticket||liveTicket?.ticket;
    const ticket=server||state.ticket||{};
    const writable=canOperate()&&!!liveManagement?.ticket&&!liveBusy;
    return '<section class="promo-card promo-ticket-controls"><h3>Publicidad en ticket de cliente · qué significa</h3>'
      +'<p><strong>Publicidad</strong> es un aviso de una oferta para una compra futura. No aplica descuentos, no entrega cupones y no vuelve a anunciar como premio el descuento que se acaba de usar.</p>'
      +'<div class="promo-ticket-option"><label class="promo-checkbox"><input type="checkbox" data-ticket-live="enabled" '
      +(ticket.enabled?'checked':'')+' '+(writable?'':'disabled')+'> <strong>1. Permitir publicidad en tickets de cliente</strong></label>'
      +'<small>Interruptor general: desactivado = no se imprime ninguna campaña ni cupón promocional. Los importes y el QR de Google Reviews permanecen.</small></div>'
      +'<div class="promo-ticket-option"><label class="promo-checkbox"><input type="checkbox" data-ticket-live="advertise" '
      +(ticket.advertise?'checked':'')+' '+(writable?'':'disabled')+'> <strong>2. Incluir anuncios de campañas generales</strong></label>'
      +'<small>Cuando está activado el primero, éste permite rotar anuncios A/B/D de campañas habilitadas. Si se apaga, pueden imprimirse únicamente cupones C auténticos ya emitidos.</small></div>'
      +'<div class="promo-live-facts"><div class="promo-live-fact"><small>Ambos apagados / primero apagado</small><strong>Sin publicidad</strong></div>'
      +'<div class="promo-live-fact"><small>Primero encendido, segundo apagado</small><strong>Solo cupón C emitido</strong></div>'
      +'<div class="promo-live-fact"><small>Ambos encendidos</small><strong>Campaña A/B/D o cupón real C, si corresponde</strong></div></div>'
      +'<p class="promo-note">Los anuncios salen únicamente en el ticket del cliente, no en la comanda de cocina. Que una campaña esté habilitada NO significa que corresponda hoy: se controla el calendario, canal y edición.</p>'
      +'<button type="button" data-ticket-live-save '+(writable?'':'disabled')+'>Guardar opciones en todos los equipos</button>'
      +(liveSaveFeedback?'<p role="status">'+esc(liveSaveFeedback)+'</p>':'')
      +'<p class="promo-overview-foot">'+(server?'Configuración leída de Supabase. Se refleja en los demás equipos y en los tickets nuevos.':'Todavía no se obtuvo configuración publicada; no se pueden guardar cambios locales como si fueran de producción.')+'</p></section>';
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
      [['Pedidos evaluados',r.orders],['Pedidos con promoción',r.promotedOrders],['Pedidos con costos adicionales pendientes',r.provisionalOrders],['Venta bruta evaluada',fmt(r.gross)],['Descuentos otorgados',fmt(r.discount)],['Venta neta de productos',fmt(r.netProducts)]].map(([k,v])=>'<div><span>'+k+'</span><strong>'+v+'</strong></div>').join('')+
      '</div><h4>Por campaña</h4>'+(Object.values(r.byPromotion).length?Object.values(r.byPromotion).map(v=>'<p>'+esc(v.id)+' · '+v.orders+' líneas · '+fmt(v.revenue)+' vendidos</p>').join(''):'<p>Sin operaciones promocionales registradas.</p>')+'</section>';
  }
  // Reconciliación en vivo: misma frecuencia que el menú publicado, sin necesidad de recargar.
  // No se envían cambios al servidor por abrir la pantalla.
  if(typeof w.setInterval==='function')w.setInterval(()=>{
    if(w.currentPanel!=='promociones'||w.document?.visibilityState==='hidden'||liveBusy||!liveApi()?.info?.()?.signedIn)return;
    refreshLive();
  },10000);
  w.addEventListener?.('focus',()=>{
    if(w.currentPanel==='promociones'&&liveApi()?.info?.()?.signedIn)refreshLive();
  });
  // Renderiza al abrir el panel. Los cambios afectan sólo los borradores de este proyecto.
  return {render:()=>{ensureLiveContext();if(localFormDirty||liveEditDirty)return;render();if(!liveLoaded&&!liveBusy&&liveApi()?.info?.()?.signedIn===true)refreshLive();if(!recInitialized&&canOperate()){recInitialized=true;recEditor.refresh();}},get,save};
}
export function register(){onPanelShow('promociones',()=>window.SAHTEN.promotionsEditor?.render());}
