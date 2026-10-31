import { installDeliveryConfiguration } from './configuration.js';
import { installServiceHours } from './hours.js';
import { installDeliveryOperation } from './operation.js';
import { installZoneOperation } from './zone-operation.js';
import { installDeliveryHandoff } from './handoff.js';
import { createDeliveryClient } from './client.js';
import { zoneRings } from './geometry.js';
import { installDeliveryAdmin } from './admin.js';
import { prepareDeliveryConfig } from './preset.js';
import { deliveryIncentiveHtml } from './incentive.js';
import { deliverySnapshot } from '../core/delivery.js';
import './incentive.css';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installDelivery(w){
 const client=createDeliveryClient(w),admin=installDeliveryAdmin(w,client),d=w.document;let posGeneration=0;
 const api={client,admin,configuration:installDeliveryConfiguration(w),hours:installServiceHours(w),operation:installDeliveryOperation(w),zoneOperation:installZoneOperation(w),handoff:installDeliveryHandoff(w),rings:zoneRings,prepare:prepareDeliveryConfig,incentive:deliveryIncentiveHtml,snapshot:deliverySnapshot,
  async refreshPos(){const dest=w.mostradorDeliveryValue?.();if(!dest||dest.lat==null)return;const generation=++posGeneration,context=w.SAHTEN.project.session.id,body=w._mostDeliveryRequest();dest.routeLoading=true;dest.routeError='';w._renderCartTotals();
   try{const v=await client.quote(body);if(generation!==posGeneration||context!==w.SAHTEN.project.session.id||w.mostradorDeliveryValue()!==dest)return;Object.assign(dest,{route:v.route,quoteId:v.quoteId,authorization:v.authorization,serverOffset:Number.isFinite(v.serverNow)?v.serverNow-Date.now():0});}
   catch(e){if(generation===posGeneration&&w.mostradorDeliveryValue()===dest)dest.routeError=e.message;}
   finally{if(generation===posGeneration&&w.mostradorDeliveryValue()===dest){dest.routeLoading=false;w._renderCartTotals();}}
  },
  async authorizePos(){const dest=w.mostradorDeliveryValue?.();if(!dest?.quoteId)return;const reason=await w.sahtenAsk('Motivo de la autorización de entrega excepcional:','');if(!reason)return;try{await client.authorize(dest.quoteId,reason);await api.refreshPos();}catch(e){w.alert(e.message);}},
  async requests(){
   if(!w._mostTiendaCfg?.().deliveryV2?.active||w.currentPanel!=='mostrador')return;
   const parent=d.querySelector('.online-board');if(!parent)return;
   const project=w.SAHTEN.project.session.id;let rows;try{rows=await client.requests();}catch{return;}if(!parent.isConnected||project!==w.SAHTEN.project.session.id)return;let old=d.getElementById('delivery-approval-requests');if(!rows?.length){old?.remove();return;}if(old?.contains(d.activeElement))return;const canManage=!d.body.dataset.role||['owner','admin'].includes(d.body.dataset.role);
   let host=d.getElementById('delivery-approval-requests');if(!host){host=d.createElement('details');host.id='delivery-approval-requests';host.className='delivery-requests';parent.prepend(host);}
   host.innerHTML='<summary>Autorizaciones de delivery ('+rows.length+')</summary>'+rows.map((r,i)=>'<article><strong>'+esc(r.payload.customerName||'Cliente')+'</strong> · '+esc(r.payload.customerPhone||'')+'<div>'+esc(r.payload.address)+' · '+esc(r.result.effectiveZone?.name)+' · '+esc(r.result.routeKm?.toFixed(2))+' km por calles</div>'+(canManage?'<label>Motivo de autorización<input data-approval-reason="'+i+'" maxlength="300"></label><label><input type="checkbox" data-approval-tariff="'+i+'"> Excepción registrada: usar tarifa de la zona geográfica</label><button class="btn" data-approve="'+i+'">Autorizar entrega</button><div role="status" data-approval-msg="'+i+'"></div>':'<p>Solo el dueño o un administrador puede autorizar esta entrega.</p>')+'</article>').join('');
   host.onclick=async e=>{const b=e.target.closest('[data-approve]');if(!b)return;const i=Number(b.dataset.approve),msg=host.querySelector('[data-approval-msg="'+i+'"]');b.disabled=true;try{await client.authorize(rows[i].id,host.querySelector('[data-approval-reason="'+i+'"]').value,host.querySelector('[data-approval-tariff="'+i+'"]').checked);msg.textContent='Entrega autorizada. El cliente debe volver a consultar el envío antes de confirmar.';}catch(err){msg.textContent=err.message;}finally{b.disabled=false;}};
  },
 };
 w.setInterval(()=>{if(d.hidden)return;if(w.currentPanel==='mostrador'){if(w._mostTiendaCfg?.().deliveryV2?.active)w._renderCartTotals?.();api.hours.refreshPosNotice();api.requests();}},20000);
 w.SAHTEN.events.afterRender('renderMostrador',()=>{api.hours.refreshPosNotice();api.requests();});
 return api;
}
