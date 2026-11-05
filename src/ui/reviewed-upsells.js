const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('es-AR',{style:'currency',currency:'ARS'});
const problems={upsell_revision_conflict:'Cambió la oferta en otro equipo. Volvé a consultar antes de guardar.',
 upsell_cost_source_changed:'Cambiaron precios o costos. Consultá los valores actuales y repetí la revisión.',
 upsell_discount_limit:'La oferta supera el máximo comercial configurado para ese producto. Revisá Reglas de rentabilidad; la excepción de Fatay conserva su autorización específica.',
 upsell_product_or_cost_unverified:'Falta publicar un producto o registrar sus costos en la app.',
 upsell_exception_acceptance_required:'Confirmá expresamente la escala excepcional antes de publicar.',
 upsell_review_incomplete:'Completá ambos costos y una explicación de al menos 20 caracteres.'};
const errorText=e=>e?.code==='PGRST202'?'Falta actualizar el servidor de promociones. La propuesta sigue guardada localmente.':Object.entries(problems).find(([key])=>String(e?.message).includes(key))?.[1]||String(e?.message||'No se pudo completar la consulta.').slice(0,240);
export function createReviewedUpsellEditor(w,getDrafts,notify){
 let remote=[],context=null,selected='',busy=false,message='',error='',generation=0;
 let fields={incrementalCost:'',orderCost:'',note:'',acceptException:false,deferAdditional:false};
 const api=()=>w.SAHTEN?.online?.controller;
 const allowed=()=>!w.SAHTEN?.project?.session?.readOnly&&['owner','admin'].includes(w.SAHTEN?.online?.role?.())&&api()?.info?.()?.signedIn===true;
 const drafts=()=>getDrafts()||[];
 const current=()=>drafts().find(x=>x.id===selected)||remote.find(x=>x.id===selected)?.definition;
 async function refresh(){
  if(!allowed()||busy||!api()?.readUpsellManagement)return;
  const g=generation;busy=true;error='';notify();
  try{const data=await api().readUpsellManagement();if(g!==generation)return;
   if(data?.source!=='reviewed_upsells'||!Array.isArray(data.offers))throw new Error('El servidor no confirmó el listado de complementos.');
   remote=data.offers;
  }catch(e){if(g===generation)error=errorText(e);}finally{if(g===generation){busy=false;notify();}}
 }
 async function review(id,published=false){
  if(!allowed()||busy)return;
  selected=id;context=null;fields={incrementalCost:'',orderCost:'',note:'',acceptException:false,deferAdditional:false};
  const draft=published?remote.find(x=>x.id===id)?.definition:current();if(!draft)return;
  const g=generation;busy=true;error='';message='';notify();
  try{const data=await api().readUpsellReviewContext(draft);if(g!==generation)return;
   if(!data?.definition||!data.sourceFingerprint||!data.costs)throw new Error('No se recibió una revisión económica completa.');context=data;
  }catch(e){if(g===generation)error=errorText(e);}finally{if(g===generation){busy=false;notify();}}
 }
 function render(){
  const d=!allowed()||busy?' disabled':'';
  const rows=remote.map(r=>'<article class="promo-draft-item"><h4>'+esc(r.definition.name)+'</h4><p>'+(r.requiresReview?'Requiere nueva revisión de costos':r.enabled?'Habilitada · se aplica si el pedido cumple las condiciones':'Publicada en pausa')+'</p>'
   +(r.additionalDeferred?'<p><strong>Provisional · costos adicionales pendientes</strong></p>':'')+'<p>Retiro online · efectivo o transferencia · una unidad adicional</p><button type="button" data-upsell-review="'+esc(r.id)+'" data-upsell-existing'+d+'>'+(r.additionalDeferred?'Completar costos pendientes':'Revisar y editar publicación')+'</button> '
   +'<button type="button" data-upsell-state="'+esc(r.id)+'"'+(d||(!r.enabled&&r.requiresReview)?' disabled':'')+'>'+(r.enabled?'Pausar':'Activar')+'</button></article>').join('');
  let form='';
  if(context){
   const c=context.definition,pid=c.productIds[0],product=context.products.find(p=>p.id===pid),cost=context.costs[pid];
   const totals=c.discountTiers?.length?c.discountTiers.map(t=>t.totalDiscountPercent):[Number(context.paymentPercent||10)+Number(c.extraPercent)];
   const special=totals.some(p=>p>20);
   const ids=[...new Set([...c.productIds,...c.triggerProductIds])];
   form='<section class="promo-card" aria-label="Revisión económica de complemento"><h3>'+esc(c.name)+'</h3>'
    +'<p><strong>'+totals.map(p=>esc(p)+'% total').join(' / ')+'</strong> sobre una unidad adicional. Retiro online con efectivo o transferencia. No se suma un cupón adicional.</p>'
    +(c.discountTiers?.length?'<table><thead><tr><th>Neto elegible de platos (sin complemento ni envío)</th><th>Descuento total de una unidad</th></tr></thead><tbody>'+c.discountTiers.map(t=>'<tr><td>Desde '+fmt(t.minEligibleNetSubtotal)+'</td><td>'+esc(t.totalDiscountPercent)+'%</td></tr>').join('')+'</tbody></table>':'')
    +'<div class="promo-sim-results"><div><span>Precio publicado del complemento</span><strong>'+fmt(product.price)+'</strong></div><div><span>Costo variable registrado</span><strong>'+fmt(cost.directCost)+'</strong></div><div><span>Costo fijo registrado (para evaluar el pedido completo)</span><strong>'+fmt(cost.fixedCost)+'</strong></div></div>'
    +'<p>Revisá el gasto adicional real de agregar esta unidad (envase, trabajo y merma que aún no estén incluidos). No vuelvas a sumar costos que ya están registrados. Un cero debe ser una decisión revisada, no un dato faltante.</p>'
    +'<label class="promo-checkbox"><input type="checkbox" data-upsell-field="deferAdditional"'+(fields.deferAdditional?' checked':'')+d+'>Dejar costos adicionales pendientes y registrar una excepción comercial</label>'
    +(fields.deferAdditional?'<p class="promo-caution">Estimación provisional: se asumirán $0 de gastos adicionales, sin declararlos comprobados. El margen puede quedar sobreestimado. Podrás completar los importes y publicar una revisión nueva después.</p>':'')
    +'<div class="promo-grid"><label class="promo-field">Costo incremental adicional de la unidad ($)<input data-upsell-field="incrementalCost" type="number" min="0" step="0.01" value="'+esc(fields.incrementalCost)+'"'+d+'></label>'
    +'<label class="promo-field">Gasto adicional del pedido de retiro ($)<input data-upsell-field="orderCost" type="number" min="0" step="0.01" value="'+esc(fields.orderCost)+'"'+d+'></label></div>'
    +'<label class="promo-field">Qué costos revisaste y qué incluye cada importe<textarea data-upsell-field="note" minlength="20" maxlength="1000"'+d+'>'+esc(fields.note)+'</textarea></label>'
    +(special?'<label class="promo-checkbox"><input type="checkbox" data-upsell-field="acceptException"'+(fields.acceptException?' checked':'')+d+'>Acepto expresamente la escala excepcional de Fatay hasta '+Math.max(...totals)+'% total. No reduce el piso de margen ni evita la validación de cobro.</label>':'')
    +'<details><summary>Costos registrados de los productos participantes</summary>'+ids.map(id=>{const p=context.products.find(x=>x.id===id),c=context.costs[id];return '<p>'+esc(p?.name||id)+' · variable '+fmt(c.directCost)+' · fijo '+fmt(c.fixedCost)+'</p>';}).join('')+'</details>'
    +'<p>Se conservará esta revisión con autor y fecha. Se publicará <strong>en pausa</strong>. El servidor comprobará los márgenes vigentes en Reglas de rentabilidad para el complemento y el pedido completo.</p>'
    +'<button type="button" data-upsell-publish'+d+'>Guardar revisión y publicar en pausa</button></section>';
  }
  return '<section class="promo-card"><h3>Alta de complementos</h3><p>1. Revisar costos → 2. Publicar en pausa → 3. Activar. Son acciones distintas; no hace falta volver a subir la carpeta de la web para cambiar una oferta ya conectada.</p>'
   +'<button type="button" data-upsell-refresh'+d+'>Consultar publicaciones</button>'
   +(message?'<p role="status" class="promo-note">'+esc(message)+'</p>':'')+(error?'<p role="alert" class="promo-caution">'+esc(error)+'</p>':'')
   +'<h4>Publicadas</h4>'+(rows||'<p>Todavía no se confirmaron complementos publicados con revisión de costos.</p>')
   +'<h4>Propuestas del proyecto</h4><div class="promo-inline">'+drafts().map(x=>'<button type="button" data-upsell-review="'+esc(x.id)+'"'+d+'>'+esc(x.name)+'</button>').join('')+'</div>'
   +(busy?'<p role="status">Consultando el servidor…</p>':'')+'</section>'+form;
 }
 function bind(root){
  root.querySelector('[data-upsell-refresh]')?.addEventListener('click',refresh);
  root.querySelectorAll('[data-upsell-review]').forEach(b=>b.addEventListener('click',()=>review(b.dataset.upsellReview,b.hasAttribute('data-upsell-existing'))));
  root.querySelectorAll('[data-upsell-field]').forEach(input=>input.addEventListener('input',()=>{fields[input.dataset.upsellField]=input.type==='checkbox'?input.checked:input.value;if(input.dataset.upsellField==='deferAdditional')notify();}));
  root.querySelector('[data-upsell-publish]')?.addEventListener('click',async()=>{
   if(!allowed()||busy||!context)return;
   const special=context.definition.discountTiers?.some(t=>t.totalDiscountPercent>20);
   if(!fields.deferAdditional&&(fields.incrementalCost===''||fields.orderCost===''||![fields.incrementalCost,fields.orderCost].every(v=>Number.isFinite(Number(v))&&Number(v)>=0))||fields.note.trim().length<20||special&&!fields.acceptException){error='Completá y revisá los dos importes, la explicación y la aceptación excepcional si corresponde.';notify();return;}
   const ctx=context,snapshot={...fields},g=generation;
   const accepted=await w.sahtenConfirm?.('Publicar «'+ctx.definition.name+'» EN PAUSA. '+(snapshot.deferAdditional?'COSTOS ADICIONALES PENDIENTES: se estimarán $0 de adicionales y el margen puede estar sobreestimado. ':'Costo adicional de la unidad: '+fmt(snapshot.incrementalCost)+'. Gasto adicional por pedido: '+fmt(snapshot.orderCost)+'. ')+'Nota: '+snapshot.note+(special?' Incluye aceptación de la escala excepcional.':''),{title:'Revisar publicación',okLabel:'Publicar en pausa'});
   if(accepted!==true||!allowed()||busy||g!==generation)return;
   busy=true;error='';notify();
   try{const result=await api().publishReviewedUpsell(ctx.definition,{...snapshot,incrementalCost:snapshot.deferAdditional?null:Number(snapshot.incrementalCost),orderCost:snapshot.deferAdditional?null:Number(snapshot.orderCost),sourceFingerprint:ctx.sourceFingerprint,expectedRevision:ctx.existing?.revision??null});
    if(g!==generation)return;
    if(result?.published!==true||result.enabled!==false||result.id!==ctx.definition.id)throw new Error('No se confirmó una publicación pausada.');
    const data=await api().readUpsellManagement();if(g!==generation)return;
    if(!data.offers?.some(r=>r.id===result.id&&r.enabled===false&&r.revision===result.revision))throw new Error('No se pudo confirmar el estado publicado. Consultá antes de reintentar.');
    remote=data.offers;context=null;message='Publicada en pausa. Revisá la oferta y usá Activar cuando corresponda.';
   }catch(e){if(g===generation)error=errorText(e);}finally{if(g===generation){busy=false;notify();}}
  });
  root.querySelectorAll('[data-upsell-state]').forEach(button=>button.addEventListener('click',async()=>{
   const row=remote.find(x=>x.id===button.dataset.upsellState);if(!allowed()||busy||!row||!row.enabled&&row.requiresReview)return;
   const enabled=!row.enabled,g=generation;
   if(await w.sahtenConfirm?.((enabled?'Activar':'Pausar')+' «'+row.definition.name+'» para retiro online con efectivo o transferencia. El checkout solo la aplicará con aceptación y margen comprobados.',{title:'Cambiar estado',okLabel:enabled?'Activar':'Pausar'})!==true)return;
   if(g!==generation||!allowed()||busy)return;busy=true;error='';notify();
   try{const result=await api().setUpsellState(row.id,enabled,row.revision);if(g!==generation)return;
    if(result.id!==row.id||result.enabled!==enabled)throw new Error('El servidor no confirmó el cambio.');
    const data=await api().readUpsellManagement();if(g!==generation)return;
    if(!data.offers?.some(x=>x.id===row.id&&x.enabled===enabled&&x.revision===result.revision))throw new Error('Volvé a consultar el estado de la oferta.');
    remote=data.offers;message=enabled?'Oferta habilitada. Solo se aplica a pedidos que cumplen las condiciones.':'Oferta pausada.';
   }catch(e){if(g===generation)error=errorText(e);}finally{if(g===generation){busy=false;notify();}}
  }));
 }
 return {render,bind,refresh,review,entries:()=>remote,ingest(data){if(data?.source==='reviewed_upsells'&&Array.isArray(data.offers))remote=data.offers;},reset(){generation++;remote=[];context=null;selected='';busy=false;message='';error='';fields={incrementalCost:'',orderCost:'',note:'',acceptException:false,deferAdditional:false};}};
}
