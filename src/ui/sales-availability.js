import { salesPaused, salesPauseLabel, businessDateTime, endOfBusinessDay } from '../core/sales-availability.js';
import '../styles/sales-availability.css';
import { state } from '../core/state.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installSalesAvailability(w=window){
 const canEdit=()=>!w.SAHTEN.project.session.readOnly&&(!w.document.body.dataset.role||['owner','admin'].includes(w.document.body.dataset.role));
 const zone=()=>w._getTiendaConfig?.().deliveryV2?.hours?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const current=()=>w.SAHTEN.project.session.id;
 const refresh=()=>{w.renderProductos?.();if(w.currentPanel==='menuonline')w.renderMenuOnline?.();if(w.currentPanel==='mostrador')w.renderMostrador?.();};
 const save=()=>{w.SAHTEN.project.markDirty();w.scheduleSave?.();refresh();};
 const send=(id,a)=>w.dispatchEvent(new w.CustomEvent('sahten:sales-availability',{detail:{id,available:!a.paused,resumeAt:a.resumeAt||null}}));
 const syncText=id=>{const q=w.SAHTEN.online?.salesPublisher?.info();if(!q?.changes[id])return '';return q.states[id]==='publicando'?'Actualizando en la tienda…':q.states[id]==='sin conexión'?'Sin conexión · pendiente en la tienda':q.states[id]==='error'?'Error · revisá Nube y usuarios':'Pendiente de actualizar en la tienda';};
 const renderStatus=()=>w.document?.querySelectorAll('[data-sales-sync]').forEach(el=>el.textContent=syncText(el.dataset.salesSync));
 function controls(p){
  if(p.recetaOnly)return '';
  const paused=salesPaused(p),label=salesPauseLabel(p,Date.now(),zone());
  return `<div class="sales-availability-controls"><span class="sales-state ${paused?'paused':'active'}">${esc(label)}</span><button type="button" class="btn sales-pause-button" data-sales-pause="${esc(p.id)}" onclick="event.stopPropagation();SAHTEN.salesAvailability.open(this.dataset.salesPause)" ${canEdit()?'':'disabled'}>${paused?'Reactivar ventas':'Pausar ventas'}</button><small data-sales-sync="${esc(p.id)}" role="status">${esc(syncText(p.id))}</small></div>`;
 }
 async function open(id){
  const p=state.products.find(p=>p.id===id);if(!p||p.recetaOnly||!canEdit())return;
  const ctx=current(),before=JSON.stringify(p.salesAvailability||null);
  const valid=()=>!!w.document&&ctx===current()&&state.products.includes(p)&&!p.recetaOnly&&canEdit()&&JSON.stringify(p.salesAvailability||null)===before;
  if(salesPaused(p)){
   if(!await w.sahtenConfirm(`«${p.name}» volverá a venderse en Mostrador y en la tienda si estaba publicado. No cambia sus precios.`,{title:'Reactivar ventas',okLabel:'Reactivar'}))return;
   if(!valid())return;const a={paused:false,resumeAt:null,updatedAt:new Date().toISOString()};p.salesAvailability=a;send(id,a);save();return;
  }
  const tz=zone();
  await w.sahtenDialog({title:'Pausar ventas de '+esc(p.name),width:520,
   body:`<p>Seguirá visible en gris, con «No disponible», tanto en Mostrador como en la tienda si estaba publicado. No cambia su precio ni el stock.</p><fieldset class="sales-pause-options"><legend>¿Cuándo vuelve a estar disponible?</legend><label><input type="radio" name="pause-until" value="today"> Por hoy</label><label><input type="radio" name="pause-until" value="date"> Hasta una fecha y hora</label><label><input type="radio" name="pause-until" value="manual" checked> Hasta que lo vuelva a activar</label></fieldset><label for="sales-pause-date">Fecha y hora del negocio</label><input class="sd-input" id="sales-pause-date" type="datetime-local" disabled><p id="sales-pause-description" role="status" aria-live="polite"></p><small>Zona horaria: ${esc(tz)}. La web y el servidor respetan el vencimiento aunque cierres la app. Sin conexión, el cambio queda pendiente de envío.</small>`,
   actions:[{label:'Volver',value:false},{label:'Pausar ventas',value:true,primary:true}],
   onOpen:api=>{
    const input=api.box.querySelector('#sales-pause-date'),desc=api.box.querySelector('#sales-pause-description');
    const update=()=>{const choice=api.box.querySelector('[name=pause-until]:checked').value;input.disabled=choice!=='date';input.hidden=choice!=='date';api.box.querySelector('label[for=sales-pause-date]').hidden=choice!=='date';const iso=choice==='today'?endOfBusinessDay(tz):choice==='date'?businessDateTime(input.value,tz):null;desc.textContent=choice==='manual'?'Pausa sin vencimiento. Solo vuelve cuando lo reactives.':iso?'Reactivación: '+new Intl.DateTimeFormat('es-AR',{timeZone:tz,dateStyle:'medium',timeStyle:'short',hourCycle:'h23'}).format(new Date(iso))+(choice==='today'?' (comienzo del próximo día).':''):'Elegí una fecha y hora futuras.';};
    api.box.querySelectorAll('[name=pause-until]').forEach(r=>r.addEventListener('change',update));input.addEventListener('input',update);update();
   },
   validate:(_v,api)=>{if(!valid()){api.setError('El proyecto o el producto cambió. Volvé a abrir esta opción.');return false;}const choice=api.box.querySelector('[name=pause-until]:checked').value,resumeAt=choice==='today'?endOfBusinessDay(tz):choice==='date'?businessDateTime(api.box.querySelector('#sales-pause-date').value,tz):null;if(choice!=='manual'&&(!resumeAt||Date.parse(resumeAt)<=Date.now())){api.setError('Elegí una fecha y hora futuras.');return false;}const a={paused:true,resumeAt,updatedAt:new Date().toISOString()};p.salesAvailability=a;send(id,a);save();return true;},
  });
 }
 function setEligibility(p,eligible){
  if(!canEdit()||!p||!state.products.includes(p)||p.recetaOnly===!eligible)return;
  p.recetaOnly=!eligible;
  // Cambiar de nivel nunca abre un canal de venta. Requiere activación posterior.
  p.salesAvailability={paused:true,resumeAt:null,updatedAt:new Date().toISOString()};
  if(w.MENU_CONFIG){w.MENU_CONFIG.hiddenProducts=[...new Set([...(w.MENU_CONFIG.hiddenProducts||[]),p.id])];w._saveMenuConfig?.();}
  send(p.id,p.salesAvailability);
  w.dispatchEvent(new w.CustomEvent('sahten:availability',{detail:{id:p.id,available:false}}));
  save();
 }
 async function toggleEligibility(id){
  const p=state.products.find(p=>p.id===id);if(!p||!canEdit())return;const ctx=current(),eligible=!!p.recetaOnly;
  if(!await w.sahtenConfirm(eligible?'El producto pasará a Productos, con las ventas pausadas y fuera de la tienda. Después podrás activar sus ventas y decidir si publicarlo online.':'La receta volverá a uso interno: se retira de Mostrador y de la lista de Tienda online. Si estaba publicada, su retiro de la web queda pendiente hasta que se confirme en línea.',{title:eligible?'Habilitar como producto de venta':'Volver a receta interna',okLabel:eligible?'Habilitar producto':'Volver a interna'}))return;
  if(ctx!==current()||!state.products.includes(p)||!!p.recetaOnly!==eligible)return;
  setEligibility(p,eligible);w.renderCostReceta?.();
 }
 w.document.addEventListener('click',e=>{const b=e.target.closest('[data-sales-pause],[data-sale-eligibility]');if(!b)return;e.stopPropagation();if(b.dataset.salesPause)open(b.dataset.salesPause);else toggleEligibility(b.dataset.saleEligibility);});
 const fingerprint=()=>state.products.map(p=>p.id+':'+salesPaused(p)).join('|');let last=fingerprint();['renderMostrador','renderProductos','renderMenuOnline'].forEach(name=>w.SAHTEN.events?.afterRender(name,()=>{last=fingerprint();}));const tick=w.setInterval(()=>{if(!w.document)return;const hash=fingerprint();if(hash!==last){if(w.currentPanel==='mostrador')w.renderMostrador?.();if(w.currentPanel==='productos')w.renderProductos?.();if(w.currentPanel==='menuonline')w.renderMenuOnline?.();}last=hash;},15000);w.addEventListener('beforeunload',()=>w.clearInterval(tick));
 return {escape:esc,renderStatus,isPaused:salesPaused,label:p=>salesPauseLabel(p,Date.now(),zone()),controls,open,setEligibility,toggleEligibility,refresh};
}
