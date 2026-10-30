import { prepareDeliveryConfig, sahtenDeliveryPolicy } from './preset.js';
import { zoneRings, toPolygon, validateDeliveryPolicy } from './geometry.js';
import './admin.css';
import { zoneStateFlags, zoneStateKey } from './zone-operation.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=v=>JSON.parse(JSON.stringify(v));
export function installDeliveryAdmin(w,client){
 const d=w.document;let host,map,layers=[],draft,saved,baseRevision=null,index=0,ringIndex=0,vertex=0,drawing=false,mapGeneration=0;
 const canEdit=()=>!w.SAHTEN.project.session.readOnly&&(!d.body.dataset.role||['owner','admin'].includes(d.body.dataset.role));
 const field=(key,label,value,type='number',extra='')=>`<label>${label}<input data-df="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
 const message=(text,error=false)=>{const el=host?.querySelector('[data-message]');if(el){el.textContent=text;el.classList.toggle('delivery-admin-error',error);}};
 const zone=()=>draft.zones[index];
 function refreshOperational(){
  if(!host?.isConnected||!draft)return;
  const cfg=w._getTiendaConfig(),q=w.SAHTEN.online?.zonePublisher?.info(),connected=!!w.SAHTEN.online?.conn()?.storeId;
  for(const local of cfg.deliveryV2?.zones||[]){
   for(const p of [draft,saved]){const z=p?.zones.find(z=>z.id===local.id);if(z)for(const flag of zoneStateFlags)z[flag]=local[flag];}
  }
  const z=zone();if(!z)return;
  for(const flag of zoneStateFlags){const el=host.querySelector('[data-zoneflag="'+flag+'"]');if(el)el.checked=!!z[flag];}
  const pending=zoneStateFlags.some(flag=>q?.changes[zoneStateKey(z.id,flag)]);
  const status=host.querySelector('[data-zone-live-status]');
  if(status)status.textContent=!connected?'Solo en este proyecto: conectá la tienda para enviar estos estados.':pending?q.error?'No llegó a la web: '+q.error:q.state==='publicando'?'Actualizando la web…':'Cambio pendiente de enviar a la web.':q?.state==='publicado'?'Estados confirmados en la web.':'Al cambiar estos controles se actualizan Mostrador y la web conectada, sin publicar el catálogo.';
  const retry=host.querySelector('[data-zone-retry]');if(retry)retry.hidden=!pending;
  host.querySelectorAll('[data-zone]').forEach(b=>{const a=draft.zones[Number(b.dataset.zone)];b.textContent=a.name+(a.enabled?'':' · pausada');});
  draw();
 }
 function dispose(){mapGeneration++;if(map){map.remove();map=null;}layers=[];}
 function mount(){
  host=d.getElementById('delivery-admin');if(!host)return;dispose();
  const cfg=w._getTiendaConfig();const c=prepareDeliveryConfig(cfg,w.SAHTEN.online.conn().slug);if(!c.deliveryV2){host.innerHTML='';return;}
  baseRevision=w.SAHTEN.delivery?.configuration?.revision()??null;saved=copy({...c.deliveryV2,hours:c.deliveryHours??c.deliveryV2.hours});draft=copy(saved);draft.hours??={enabled:false,timeZone:'America/Argentina/Buenos_Aires',weekly:Array.from({length:7},()=>[]),exceptions:[]};index=0;render();
 }
 function render(){
  if(!host?.isConnected)return;
  const z=zone(),editable=canEdit();if(!z){host.textContent='La configuración no tiene zonas válidas. Restaurá una copia del proyecto antes de activar el delivery.';return;}
  host.innerHTML=`<section class="card delivery-admin"><div class="card-header"><h3>Delivery geográfico e incentivos</h3></div><div class="card-body">
   <p>Configuración ${draft.active?'activa en este proyecto':'preparada, sin activar'}. Zona habilitada y Requiere autorización se envían automáticamente al cambiarlos. Tarifas, mínimos, cobertura y beneficios se aplican en la web al guardar, sin subir archivos. Los horarios se guardan por separado en las tarjetas de arriba y se actualizan automáticamente en la web.</p>
   <div class="delivery-admin-fields"><label class="delivery-switch"><input type="checkbox" data-policy="active" ${draft.active?'checked':''}> Usar nuevas zonas en este proyecto</label><label class="delivery-switch"><input type="checkbox" data-policy="promotionsEnabled" ${draft.promotionsEnabled?'checked':''}> Activar beneficios de envío</label><label class="delivery-switch"><input type="checkbox" data-policy="stackWithPayment" ${draft.stackWithPayment?'checked':''}> Combinar beneficio de envío con descuento por pago</label></div>
   <details><summary>Ubicación y protección operativa</summary><div class="delivery-admin-fields">${field('center.address','Dirección del local',draft.center.address||'','text','maxlength="300"')}${field('center.lat','Latitud del local',draft.center.lat)}${field('center.lng','Longitud del local',draft.center.lng)}${field('regularMaxKm','Máximo regular (km)',draft.regularMaxKm,'number','min="0.1" max="8" step="0.1"')}${field('maxRouteKm','Máximo excepcional (km)',draft.maxRouteKm,'number','min="0.1" max="8.5" step="0.1"')}</div><label class="delivery-switch"><input data-center-verified type="checkbox" ${draft.center.verifiedAt?'checked':''}> Verifiqué el punto exacto del local</label><p>${esc(draft.center.address||w._getTiendaConfig().address)} · <a href="${esc(draft.center.source||'https://www.openstreetmap.org/')}" target="_blank" rel="noopener">Fuente del punto</a></p></details>
   <div class="delivery-zone-picker" role="group" aria-label="Seleccionar zona">${draft.zones.map((a,i)=>`<button type="button" class="btn" data-zone="${i}" aria-pressed="${i===index}" style="--zone-color:${esc(a.color)}">${esc(a.name)}${a.enabled?'':' · pausada'}</button>`).join('')}</div>
   <div class="delivery-admin-layout"><div><div id="delivery-admin-map" class="delivery-admin-map" role="region" aria-label="Mapa de cobertura"></div><p>Elegí una zona. En modo polígono, arrastrá sus vértices o editalos por coordenadas. El color no reemplaza el nombre de la zona.</p></div><div>
   <div class="delivery-admin-fields">${field('name','Nombre',z.name,'text','maxlength="80"')}${field('color','Color',z.color,'color')}${field('innerRadiusKm','Límite inferior tarifario (km)',z.innerRadiusKm,'number','min="0" step="0.1"')}${field('radiusKm','Límite superior tarifario (km)',z.radiusKm,'number','min="0.1" max="8.5" step="0.1"')}${field('baseCost','Tarifa normal ($)',z.baseCost,'number','min="0" step="10"')}${field('minOrder','Pedido mínimo ($)',z.minOrder,'number','min="0" step="100"')}</div>
   <fieldset class="delivery-zone-live"><legend>Controles en vivo</legend><label class="delivery-switch"><input type="checkbox" data-zoneflag="enabled" ${z.enabled?'checked':''}> Zona habilitada</label><label class="delivery-switch"><input type="checkbox" data-zoneflag="requiresAuthorization" ${z.requiresAuthorization?'checked':''}> Requiere autorización</label><p data-zone-live-status role="status" aria-live="polite"></p><button type="button" class="btn" data-zone-retry hidden>Reintentar envío</button><small>No cambian tarifas ni mínimos. Cancelar cambios no revierte estos controles. Quitar la autorización de la zona no elimina el control por recorrido excepcional.</small></fieldset>
   <details open><summary>Beneficios por subtotal neto de productos</summary><div>${(z.benefits||[]).map((b,i)=>`<div class="delivery-benefit-row"><label>Desde ($)<input type="number" data-benefit="${i}" data-bkey="threshold" min="1" value="${b.threshold}"></label><label>Envío ($)<input type="number" data-benefit="${i}" data-bkey="cost" min="0" value="${b.cost}"></label><button class="btn" data-remove-benefit="${i}" aria-label="Quitar beneficio ${i+1}">Quitar</button></div>`).join('')}</div><button class="btn" data-action="add-benefit">Agregar beneficio</button><p>Envío 0 = gratis. Se aplica el mejor beneficio de envío. El 10 % por efectivo/transferencia sigue siendo un descuento sobre productos; los umbrales usan el subtotal después de descuentos.</p></details>
   <div class="delivery-admin-actions"><button class="btn" data-action="convert">${z.type==='polygon'?'Restablecer esta zona radial':'Convertir este anillo a polígono'}</button><button class="btn" data-action="undo-zone">Revertir esta zona</button></div>
   ${z.type==='polygon'?`<details open><summary>Editar contorno y vértices</summary><label>Contorno<select data-ring>${[z.points,...(z.holes||[])].map((r,i)=>`<option value="${i}" ${i===ringIndex?'selected':''}>${i?'Hueco interior '+i:'Contorno exterior'} (${r.length} vértices)</option>`).join('')}</select></label><label>Vértice<select data-vertex>${(ringIndex?z.holes[ringIndex-1]:z.points).map((v,i)=>`<option value="${i}" ${i===vertex?'selected':''}>${i+1}: ${v[0].toFixed(5)}, ${v[1].toFixed(5)}</option>`).join('')}</select></label><div class="delivery-admin-fields"><label>Latitud del vértice<input data-vcoord="0" type="number" step="any" value="${(ringIndex?z.holes[ringIndex-1]:z.points)[vertex]?.[0]??''}"></label><label>Longitud del vértice<input data-vcoord="1" type="number" step="any" value="${(ringIndex?z.holes[ringIndex-1]:z.points)[vertex]?.[1]??''}"></label></div><div class="delivery-admin-actions"><button class="btn" data-action="add-vertex">Agregar vértice intermedio</button><button class="btn" data-action="remove-vertex">Eliminar vértice</button><button class="btn" data-action="draw">${drawing?'Terminar dibujo':'Dibujar contorno nuevo'}</button></div><p>${drawing?'Hacé clic en el mapa para agregar puntos; terminá con al menos tres.':'Los huecos interiores evitan superponer el anillo con las zonas más cercanas.'}</p></details>`:''}
   </div></div>
   <div class="delivery-admin-actions"><button class="btn" data-action="preview">Previsualizar y validar</button><button class="btn btn-accent" data-action="save">Guardar y aplicar en la web</button><button class="btn" data-action="cancel">Cancelar cambios</button><button class="btn" data-action="reset">Restablecer geometrías radiales iniciales</button></div>
   <p role="status" aria-live="polite" data-delivery-config-status></p><button type="button" class="btn" data-delivery-config-retry hidden>Reintentar</button><button type="button" class="btn" data-delivery-config-reload hidden>Usar configuración de la web</button><label class="delivery-switch"><input data-accept-gaps type="checkbox"> Acepto los sectores sin cobertura advertidos en la vista previa</label><div class="delivery-admin-message" data-message role="status"></div>
   <details><summary>Servicio de rutas por calles</summary><p>openrouteservice, plan Standard gratuito con cuota. La clave se guarda cifrada en el servidor; nunca viaja al menú ni al archivo del proyecto. No hay un servicio pago contratado.</p><form data-routing-form><label>Clave API de openrouteservice<input name="routing-key" type="password" autocomplete="new-password" required minlength="20"></label><button class="btn" type="submit">Guardar conexión segura</button></form><p data-routing-status role="status">Consultando conexión…</p></details>
   </div></section>`;
  if(!editable)host.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
  host.onchange=e=>{
   const el=e.target;if(!canEdit())return;
   if(el.dataset.policy){draft[el.dataset.policy]=el.checked;return;}
   if(el.dataset.zoneflag){w.SAHTEN.delivery.zoneOperation.set(z.id,el.dataset.zoneflag,el.checked);return;}
   if(el.hasAttribute('data-center-verified')){draft.center.verifiedAt=el.checked?new Date().toISOString():null;return;}
   if(el.dataset.df){const k=el.dataset.df,v=['name','color','center.address'].includes(k)?el.value:Number(el.value);if(k.startsWith('center.')){draft.center[k.split('.')[1]]=v;draft.center.verifiedAt=null;host.querySelector('[data-center-verified]').checked=false;render();return;}else if(['maxRouteKm','regularMaxKm'].includes(k))draft[k]=v;else z[k]=v;draw();return;}
   if(el.dataset.benefit!==undefined){z.benefits[Number(el.dataset.benefit)][el.dataset.bkey]=Number(el.value);return;}
   if(el.hasAttribute('data-ring')){ringIndex=Number(el.value);vertex=0;render();return;}
   if(el.hasAttribute('data-vertex')){vertex=Number(el.value);render();return;}
   if(el.dataset.vcoord!==undefined){const r=ringIndex?z.holes[ringIndex-1]:z.points;if(r[vertex])r[vertex][Number(el.dataset.vcoord)]=Number(el.value);draw();}
  };
  host.onclick=async e=>{
   const b=e.target.closest('button');if(!b||!canEdit())return;
   if(b.hasAttribute('data-delivery-config-retry')){w.SAHTEN.online.configurationPublisher.flush().catch(()=>{});return;}
   if(b.hasAttribute('data-delivery-config-reload')){w.SAHTEN.delivery.configuration.reload().catch(err=>message(err.message,true));return;}
   if(b.hasAttribute('data-zone-retry')){w.SAHTEN.online.zonePublisher.flush().catch(()=>{});return;}
   if(b.dataset.zone!==undefined){index=Number(b.dataset.zone);ringIndex=vertex=0;drawing=false;render();return;}
   if(b.dataset.removeBenefit!==undefined){z.benefits.splice(Number(b.dataset.removeBenefit),1);render();return;}
   const action=b.dataset.action;if(!action)return;
   if(action==='add-benefit'){if(z.benefits.length<10)z.benefits.push({threshold:z.minOrder||15000,cost:0});render();}
   else if(action==='convert'){if(z.type==='polygon'){z.type='circle';z.points=[];z.holes=[];}else draft.zones[index]=toPolygon(draft.center,z);ringIndex=vertex=0;render();}
   else if(action==='undo-zone'){draft.zones[index]=copy(saved.zones.find(a=>a.id===z.id));ringIndex=vertex=0;drawing=false;render();}
   else if(action==='cancel'){draft=copy(saved);ringIndex=vertex=0;drawing=false;render();message('Cambios descartados.');}
   else if(action==='reset'){const initial=sahtenDeliveryPolicy();draft.zones.forEach(a=>{const orig=initial.zones.find(o=>o.id===a.id);if(orig)Object.assign(a,{type:'circle',radiusKm:orig.radiusKm,innerRadiusKm:orig.innerRadiusKm,points:[],holes:[]});});ringIndex=vertex=0;render();message('Radios iniciales preparados. Las tarifas se conservaron. Revisá antes de guardar.');}
   else if(action==='draw'){if(!drawing){z.points=[];z.holes=[];ringIndex=vertex=0;}drawing=!drawing;render();}
   else if(action==='add-vertex'||action==='remove-vertex'){const r=ringIndex?z.holes[ringIndex-1]:z.points;if(action==='remove-vertex'){if(r.length<=3){message('Un contorno necesita al menos tres vértices.',true);return;}r.splice(vertex,1);vertex=Math.max(0,vertex-1);}else if(r.length<256){if(!r.length){message('Dibujá primero el contorno en el mapa.',true);return;}const a=r[vertex],next=r[(vertex+1)%r.length];r.splice(vertex+1,0,[(a[0]+next[0])/2,(a[1]+next[1])/2]);vertex++;}render();}
   else if(action==='preview'||action==='save'){
    draft.hours=copy(w._getTiendaConfig().deliveryHours??w._getTiendaConfig().deliveryV2?.hours??draft.hours);const check=validateDeliveryPolicy(draft);if(check.errors.length){message(check.errors.join(' '),true);return;}
    if(action==='preview'){draw();message(check.warnings.join(' ')||'Vista previa válida: sin superposiciones ni huecos detectados.');return;}
    if(check.warnings.length&&!host.querySelector('[data-accept-gaps]').checked){message(check.warnings.join(' ')+' Confirmá la advertencia antes de guardar.',true);return;}
    if(draft.active&&!saved.active){try{const status=await client.provider();if(!status.configured){message('Conectá el servicio de rutas antes de activar la configuración.',true);return;}}catch(err){message(err.message,true);return;}}
    const current=w._getTiendaConfig();draft.hours=copy(current.deliveryHours??current.deliveryV2?.hours??draft.hours);current.lat=draft.center.lat;current.lng=draft.center.lng;current.address=draft.center.address;current.deliveryV2=copy(draft);if(w.SAHTEN.delivery.configuration.save(current,baseRevision)){saved=copy(w._getTiendaConfig().deliveryV2);draft=copy(saved);message('Configuración guardada. Revisá la confirmación de aplicación en la web.');}
   }
  };
  host.querySelector('[data-routing-form]').onsubmit=async e=>{e.preventDefault();if(!canEdit())return;const input=e.target.elements['routing-key'],key=input.value;input.value='';const status=host.querySelector('[data-routing-status]');try{await client.saveProvider(key);status.textContent='Clave guardada cifrada. La siguiente consulta comprobará la ruta.';}catch(err){status.textContent=err.message;}};
  const statusEl=host.querySelector('[data-routing-status]');client.provider().then(v=>{if(statusEl.isConnected)statusEl.textContent=v.configured?'Conexión guardada.':'Sin clave: no se confirmarán envíos con el motor nuevo.';}).catch(err=>{if(statusEl.isConnected)statusEl.textContent=err.message;});
  refreshOperational();w.SAHTEN.delivery.configuration.refreshStatus();initMap();
 }
 function syncVertices(){
  if(zone().type!=='polygon')return;
  const r=ringIndex?zone().holes[ringIndex-1]:zone().points,select=host.querySelector('[data-vertex]');
  if(select)select.innerHTML=r.map((p,i)=>`<option value="${i}" ${i===vertex?'selected':''}>${i+1}: ${p[0].toFixed(5)}, ${p[1].toFixed(5)}</option>`).join('');
  host.querySelectorAll('[data-vcoord]').forEach(el=>el.value=r[vertex]?.[Number(el.dataset.vcoord)]??'');
  const outer=host.querySelector('[data-ring] option[value="0"]');if(outer)outer.textContent='Contorno exterior ('+zone().points.length+' vértices)';
 }
 async function initMap(){
  dispose();const generation=mapGeneration,el=host.querySelector('#delivery-admin-map');
  try{await w.SAHTEN.libs.leaflet();if(generation!==mapGeneration||!el.isConnected)return;const L=w.L;map=L.map(el).setView([draft.center.lat,draft.center.lng],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);L.marker([draft.center.lat,draft.center.lng]).bindPopup('Local: '+esc(draft.center.address||'')).addTo(map);map.on('click',e=>{if(drawing&&zone().points.length<256){zone().points.push([e.latlng.lat,e.latlng.lng]);vertex=zone().points.length-1;draw();syncVertices();}});draw();}catch{message('No se pudo cargar el mapa. Podés editar valores y coordenadas; no se inventó una ubicación.',true);}
 }
 function draw(){
  if(!map)return;const L=w.L;layers.forEach(l=>map.removeLayer(l));layers=[];
  // Las zonas más grandes van detrás; los huecos de cada anillo dejan seleccionar los interiores.
  draft.zones.map((z,i)=>({z,i})).sort((a,b)=>b.z.radiusKm-a.z.radiusKm).forEach(({z,i})=>{const rings=zoneRings(draft.center,z);if(rings[0].length<3||rings.some(r=>r.some(p=>!p.every(Number.isFinite))))return;const l=L.polygon(rings,{color:z.color,fillOpacity:z.enabled ? .1 : .025,weight:i===index?3:1.5,dashArray:z.requiresAuthorization?'6 4':null}).bindTooltip(esc(z.name));l.on('click',e=>{if(drawing)return;L.DomEvent.stopPropagation(e);index=i;ringIndex=vertex=0;render();});l.addTo(map);layers.push(l);});
  if(zone().type==='polygon'){const r=ringIndex?zone().holes[ringIndex-1]:zone().points;r.forEach((p,i)=>{const m=L.marker(p,{draggable:canEdit(),icon:L.divIcon({className:'delivery-vertex',iconSize:[12,12]})}).addTo(map);m.bindTooltip('Vértice '+(i+1));m.on('dragend',()=>{const v=m.getLatLng();r[i]=[v.lat,v.lng];vertex=i;draw();syncVertices();});layers.push(m);});}
 }
 function configurationChanged(){if(!host?.isConnected)return;const clean=p=>JSON.stringify(p,(k,v)=>['hours','enabled','requiresAuthorization','revision','effectiveAt'].includes(k)?undefined:v);if(clean(draft)===clean(saved)){mount();}else w.SAHTEN.delivery.configuration.refreshStatus();}
 return {mount,dispose,refreshOperational,configurationChanged,edit:i=>{index=i;render();}};
}
