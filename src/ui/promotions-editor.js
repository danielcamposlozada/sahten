import { kv } from '../project/kv.js';
import { onPanelShow } from '../events.js';
import { initialPromotionConfig, quotePromotions, localDateParts, scheduleMatches, expiryLabel } from '../core/promotions.js';
import { promotionReport } from '../core/promotions-report.js';
import { promotionOverview, filterPromotionOverview } from '../core/promotion-overview.js';
import { createLiveRecommendationEditor } from './live-cart-recommendations.js';
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
  let draftEditing=null;
  const recEditor=createLiveRecommendationEditor(w,()=>render());
  let live={published:false,campaigns:[]},liveLoaded=false,liveBusy=false,liveError='',liveContext='',lastLiveAt=0;
  const liveApi=()=>w.SAHTEN?.online?.controller;
  const currentLiveContext=()=>[w.SAHTEN?.project?.session?.id||'',w.SAHTEN?.online?.conn?.()?.storeId||'',w.SAHTEN?.online?.conn?.()?.url||''].join('|');
  function ensureLiveContext(){
    const key=currentLiveContext();
    if(liveContext!==key){liveContext=key;liveLoaded=false;liveError='';live={published:false,campaigns:[]};}
  }
  const canOperate=()=>!w.SAHTEN?.project?.session?.readOnly
    && ['owner','admin'].includes(w.SAHTEN?.online?.role?.())
    && w.SAHTEN?.online?.controller?.info?.()?.signedIn===true;
  async function refreshLive(){
    ensureLiveContext();
    if(liveBusy)return;
    const context=liveContext;
    liveBusy=true;liveError='';
    try{
      const result=await liveApi()?.readPromotionCampaignStates?.();
      if(context!==currentLiveContext())return;
      live=result&&Array.isArray(result.campaigns)?result:{published:false,campaigns:[]};
      liveLoaded=true;lastLiveAt=Date.now();
    }catch(err){
      if(context===currentLiveContext()){
        liveError=String(err?.message||'No se pudo leer el estado de la tienda.').slice(0,250);liveLoaded=true;lastLiveAt=0;
      }
    }finally{liveBusy=false;render();}
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
    return '<button type="button" class="promo-live-switch promo-draft-switch" role="switch" aria-label="'+esc((item.enabled?'Quitar':'Incluir')+' en planificación local '+(item.name||item.id))+'"'
      +' aria-checked="'+!!item.enabled+'" data-draft-toggle="'+esc(key)+'" data-draft-id="'+esc(item.id)+'"'+(editable?'':' disabled')+'>'
      +'<span class="promo-live-track"></span><span>'+(item.enabled?'En planificación':'Fuera de planificación')+'</span></button>';
  }
  function liveEditor(){
    const banner=!liveLoaded?'Estado de promociones aún no consultado.'
      :!live.published?'El motor promocional no está publicado. No puede activarse desde este panel.'
      :'Solo afecta a nuevos pedidos. No modifica pedidos ya confirmados.';
    const rows=(live.campaigns||[]).map(row=>{
      const record=get().campaigns?.find(c=>c.id===row.id);
      return '<div class="promo-row" data-live-campaign="'+esc(row.id)+'"><div><strong>'
        +esc(record?.name||row.id)+'</strong><p role="status">'+(row.enabled?'Activa en web':'Pausada en web')
        +'</p></div>'+liveSwitch(row.id)+'</div>';
    }).join('');
    return '<section class="promo-card"><h3>Campañas publicadas · control en vivo</h3>'
      +'<p>'+esc(banner)+'</p>'
      +'<p>El switch cambia el estado del servidor y lo vuelve a consultar. La tienda recibe cambios del menú en su refresco de hasta 10 segundos. No habilita campañas que todavía no se publicaron.</p>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<button type="button" data-live-refresh'+(liveBusy?' disabled':'')+'>'
      +(liveBusy?'Consultando…':'Actualizar estado desde la web')+'</button>'
      +(rows||'<p>No hay campañas publicadas para controlar.</p>')+'</section>';
  }
  function overviewEditor(state){
    const overview=promotionOverview(state,{now:new Date(),live:liveLoaded&&!liveError?live:null});
    const visible=filterPromotionOverview(overview.items,overviewFilter);
    const badges={active:'Activa ahora',inactive:'Pausada en web',scheduled:'Programada · espera calendario',pending:'Borrador habilitado · sin publicar',draft:'Borrador sin publicar'};
    const canSync=canOperate()&&!!w.SAHTEN?.online?.conn?.()?.projectId&&w.SAHTEN?.project?.session?.info?.()?.hasFile===true;
    const cards=visible.map(item=>{
      const next=item.type==='campaigns'?'campaigns':item.type==='upsells'?'extras'
        :item.type==='crossSells'?'recommendations':item.type==='productUpgrades'?'upgrades':'coupons';
      return '<article class="promo-overview-card"><span class="promo-overview-category">'+esc(item.label)+'</span>'
        +'<span class="promo-overview-status is-'+esc(item.status)+'">'+esc(badges[item.status]||'Inactiva')+'</span>'
        +'<strong>'+esc(item.name)+'</strong>'
        +'<span class="promo-overview-detail">'+esc(item.detail)+'</span>'
        +'<span class="promo-overview-foot">'+(item.type==='campaigns'&&live.campaigns?.some(r=>r.id===item.id)?'Estado del servidor · calendario independiente':item.localEnabled?'Planificación local · NO publicada':'Borrador · NO publicado')+'</span>'
        +'<div class="promo-overview-actions">'+(item.type==='campaigns'?liveSwitch(item.id):draftSwitch(({upsells:'upsells',crossSells:'crossSells',productUpgrades:'productUpgrades',couponPrograms:'couponPrograms'})[item.type]||({extras:'upsells',recommendations:'crossSells',upgrades:'productUpgrades',coupons:'couponPrograms'})[item.type]||item.type,{id:item.id,name:item.name,enabled:item.localEnabled}))+'</div>'
        +'<button type="button" class="promo-open" data-open-promo="'+esc(item.id)+'" data-open-type="'+esc(next)+'">Editar propuesta</button></article>';
    }).join('');
    return '<section class="promo-card"><div class="promo-row"><div><h3>Vista general · Promociones</h3>'
      +'<p>«Programada» significa que espera su día u horario. «Borrador» significa que todavía no está publicado. Los switches de borrador NO activan descuentos.</p></div>'
      +'<button type="button" data-live-refresh '+(liveBusy?'disabled':'')+'>Actualizar estado web</button></div>'
      +'<div class="promo-overview-summary"><span><strong>'+overview.items.length+'</strong> propuestas locales</span>'
      +'<span><strong>'+overview.active+'</strong> activas verificadas</span>'
      +'<span><strong>'+overview.pending+'</strong> pendientes/programadas</span>'
      +'<span><strong>'+overview.inactive+'</strong> pausadas / borradores</span></div>'
      +'<div class="promo-overview-toolbar" role="group" aria-label="Filtrar promociones">'
      +[['all','Todas'],['active','Activas'],['inactive','No activas']].map(([id,label])=>'<button type="button" data-promo-filter="'+id+'" aria-pressed="'+(overviewFilter===id)+'">'+label+'</button>').join('')
      +'</div>'
      +(liveError?'<p class="promo-caution" role="alert">'+esc(liveError)+'</p>':'')
      +'<div class="promo-overview-grid">'+(cards||'<p class="promo-overview-empty">No hay promociones en este filtro.</p>')+'</div>'
      +'<div class="promo-row"><button type="button" data-promo-create>+ Crear campaña</button><button type="button" data-rec-open>Gestionar recomendaciones publicadas</button></div>'
      +'<div class="promo-note">Activa = campaña confirmada por el servidor, motor habilitado y calendario vigente. Las sugerencias y los cupones sin validación de emisión no se anuncian como ofertas disponibles.</div>'
      +'<div class="promo-row"><div><strong>Proyecto local y nube</strong>'
      +'<p>Para traer las últimas promociones sin reemplazar pedidos, stock ni catálogo, usá la actualización selectiva. El archivo local conserva un respaldo previo.</p>'
      +(syncFeedback?'<p role="status">'+esc(syncFeedback)+'</p>':'')+'</div>'
      +'<button type="button" data-promo-sync '+(canSync?'':'disabled')+'>Actualizar promociones desde la nube</button></div>'
      +'</section>';
  }
  function render() {
    ensureLiveContext();
    const root=w.document?.getElementById?.('promotions-editor');if(!root)return;
    const state=get(), campaigns=state.campaigns||[], c=campaigns.find(x=>x.id===selected)||campaigns[0];
    if(c)selected=c.id;
    const canEdit=!w.document.body.classList.contains('role-no-costs')&&!w.SAHTEN?.project?.session?.readOnly;
    const active=promotionOverview(state,{live:liveLoaded&&!liveError?live:null,now:new Date()}).active;
    const publishedLabel=liveError?'Estado web no verificado'
      :!liveApi()?.info?.()?.signedIn?'Conectá la tienda para ver el estado'
      :!liveLoaded?'Consultando estado de la tienda…'
      :live.published?'Motor promocional publicado':'Campañas sin publicar en la web';
    root.innerHTML='<div class="promo-heading"><div><h2>Centro de Promociones</h2><p>Campañas, calendario, cupones, tickets y rentabilidad · SAHTEN</p></div>'
      +'<span class="promo-pill" role="status">'+esc(publishedLabel)+'</span></div>'
      +'<div class="promo-metrics"><div><strong>'+campaigns.length+'</strong><small>Campañas configuradas</small></div><div><strong>'+active+'</strong><small>Activas verificadas</small></div><div><strong>'+(state.upsells||[]).length+'</strong><small>Complementos</small></div></div>'
      +'<nav class="promo-tabs" aria-label="Gestión de promociones">'+[['overview','Vista general'],['campaigns','Campañas'],['publishedRecs','Recomendaciones web'],['extras','Complementos'],['recommendations','Sugerencias'],['upgrades','Mejoras'],['live','En vivo'],['calendar','Calendario'],['coupons','Cupones'],['tickets','Tickets'],['sim','Simulador'],['report','Resultados']].map(([k,t])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(k===tab)+'">'+t+'</button>').join('')+'</nav>'
      + (tab==='overview'?overviewEditor(state):tab==='campaigns' ? campaignEditor(state,c,canEdit) : tab==='publishedRecs'?recEditor.render():tab==='extras'?draftItemsEditor(state,'upsells','Complementos con descuento') : tab==='recommendations'?draftItemsEditor(state,'crossSells','Recomendaciones sin rebaja') : tab==='upgrades'?draftItemsEditor(state,'productUpgrades','Mejoras de producto') : tab==='live'?liveEditor() : tab==='calendar'?calendarEditor(state):tab==='coupons'?couponEditor(state):tab==='tickets'?ticketEditor(state,canEdit):tab==='sim'?simEditor(state,w):reportEditor(w))
      + '<p class="promo-caution">Borradores guardados dentro del proyecto .sahten. La publicación online y el canje definitivo requieren validación del servidor. No se ejecutan desde esta pantalla.</p>';
    recEditor.bind(root);
    root.querySelectorAll('[data-rec-open]').forEach(btn=>btn.addEventListener('click',()=>{tab='publishedRecs';render();recEditor.refresh();}));
    root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();if(tab==='live')refreshLive();if(tab==='publishedRecs')recEditor.refresh();}));
    root.querySelector('[data-live-refresh]')?.addEventListener('click',()=>refreshLive());
    root.querySelector('[data-promo-create]')?.addEventListener('click',()=>{tab='campaigns';render();root.querySelector('[data-promo-new]')?.focus();});
    root.querySelectorAll('[data-promo-filter]').forEach(b=>b.addEventListener('click',()=>{overviewFilter=b.dataset.promoFilter;render();}));
    root.querySelectorAll('[data-open-promo]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.openType;
      if(tab==='campaigns')selected=b.dataset.openPromo;render();}));
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
    if(!c)return '<section class="promo-card"><h3>No hay campañas</h3><button type="button" data-promo-new>+ Nueva campaña</button></section>';
    const disabled=canEdit?'':'disabled';
    const schedule=c.schedule||{type:'weekly',weekdays:[]};
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
      +'<label class="promo-field">Editando<select data-promo-campaign>'+state.campaigns.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===c.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'
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
        +'<p>'+esc(item.id)+' · '+(item.enabled?'Marcada en borrador':'Desactivada')+'</p>'
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
        +'</div><div class="rec-rule-controls">'+draftSwitch(key,item)
        +'<button type="button" data-draft-edit="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Editar</button>'
        +'<button type="button" data-draft-duplicate="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Duplicar</button>'
        +'<button type="button" data-draft-delete="'+esc(item.id)+'" data-draft-group="'+esc(key)+'">Eliminar</button></div></article>';
    }).join('');
    return '<section class="promo-card"><h3>'+esc(title)+' ('+items.length+')</h3>'
      +'<p>Estos son BORRADORES del proyecto, no las recomendaciones publicadas. El switch cambia solo la planificación, NO activa descuentos.</p>'
      +'<div class="promo-draft-list">'+(cards||'<p>No hay propuestas configuradas.</p>')+'</div>'
      +'<div class="promo-row"><button type="button" data-draft-create="'+esc(key)+'">+ Crear borrador</button><button type="button" data-rec-open>Gestionar recomendaciones publicadas</button></div>'
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
    const rows=entries.map(([id,program])=>'<article class="promo-row promo-draft-item"><div><strong>'+esc(program.name||id)+'</strong>'
      +'<p>'+esc(id)+' · '+(program.enabled?'Marcado en borrador':'Desactivado')+'</p>'
      +'<p>'+esc(program.extraPercent??0)+' puntos adicionales · Compra mínima '+fmt(program.minEligibleSubtotal)
      +(program.maxExtraAmount!=null?' · Tope '+fmt(program.maxExtraAmount):'')
      +' · Vigencia '+esc(program.validDays??'?')+' días</p>'
      +'<small>Canal: '+esc(program.channel||'online')+(program.requiresConfirmedOrigin?' · Requiere compra anterior confirmada':'')+'</small>'
      +'</div>'+draftSwitch('couponPrograms',{...program,id})+'</article>').join('');
    const methods=state.activationPolicy?.allowedPromotionPaymentMethods;
    return '<section class="promo-card"><h3>Cupones y recompensas ('+entries.length+')</h3>'
      +'<p>Métodos elegibles para promociones nuevas: '+esc(Array.isArray(methods)?methods.join(' y '):'sin autorización publicada')+'. El 10% habitual es independiente.</p>'
      +'<div class="promo-draft-list">'+(rows||'<p>No hay programas configurados.</p>')+'</div>'
      +'<div class="promo-note"><strong>Emisión y canje:</strong> requieren servidor, cliente identificado, rentabilidad verificada y confirmación de la compra. Una reimpresión conserva el cupón original; nunca crea otro. Esta pantalla no emite códigos utilizables.</div></section>';
  }
  function ticketEditor(state,canEdit){
    return '<section class="promo-card"><h3>Publicidad en el ticket del cliente</h3><p>El ticket incluye importes, QR de reseñas y, cuando corresponda, una campaña A/B/D o cupón C. La comanda de cocina jamás incluye publicidad.</p>'
      +'<label class="promo-checkbox"><input data-field="ticketEnabled" type="checkbox" '+(state.ticket?.enabled?'checked':'')+' '+(canEdit?'':'disabled')+'> Mostrar publicidad en el ticket del cliente</label>'
      +'<label class="promo-checkbox"><input data-field="ticketAdvertise" type="checkbox" '+(state.ticket?.advertise?'checked':'')+' '+(canEdit?'':'disabled')+'> Anunciar campañas generales además de cupones</label>'
      +'<div class="promo-note">Esta opción no crea promociones ni descuentos: solo permite imprimir beneficios válidos y publicados. Los cupones se emiten únicamente desde el servidor.</div></section>';
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
  return {render:()=>{render();if(!liveLoaded&&!liveBusy&&liveApi()?.info?.()?.signedIn===true)refreshLive();},get,save};
}
export function register(){onPanelShow('promociones',()=>window.SAHTEN.promotionsEditor?.render());}
