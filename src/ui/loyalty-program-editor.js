import {promotionRule,promotionHeadroom,promotionPaymentFee} from '../core/promotion-policy.js';
import {couponTerms} from '../core/coupon-terms.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLoyaltyProgramEditor(w,get,redraw,saveLocal=()=>{}){
 let rows=[],loaded=false,busy=false,message='',generation=0,paymentBase=null;
 const drafts=new Map();
 const context=()=>[w.SAHTEN?.project?.session?.id,api()?.info?.()?.storeId].join('|');
 const api=()=>w.SAHTEN?.online?.controller;
 const allowed=()=>!w.SAHTEN?.project?.session?.readOnly&&['owner','admin'].includes(w.SAHTEN?.online?.role?.());
 async function refresh(){if(busy)return;const g=generation;busy=true;try{const [result,policy]=await Promise.all([api()?.readLoyaltyPrograms?.()||[],api()?.readPromotionPolicy?.().catch(()=>null)||null]);if(g!==generation)return;rows=result;paymentBase=policy?.paymentPercent??paymentBase;loaded=!!api()?.readLoyaltyPrograms;message=loaded?'':'Falta instalar la actualización del servidor.';}catch(e){if(g===generation)message=e.message;}finally{if(g===generation){busy=false;redraw();}}}
 function render(){
  const base=Number(paymentBase??get().paymentPercent??10),products=(w.PRODUCTS||[]).filter(p=>!p.recetaOnly);
  return '<section class="promo-card"><h3>Primera y segunda compra online</h3><p>Se reconoce el teléfono sin código de verificación. El beneficio de segunda compra se emite una vez, después de confirmar y cobrar la primera compra web. Cancelar o reembolsar la compra invalida el beneficio sin utilizar.</p>'
  +['first_online','second_online'].map(id=>{
   const server=rows.find(r=>r.id===id),p=drafts.get(id)||server?.terms||get().couponPrograms?.[id]||{},label=id==='first_online'?'Primera compra':'Segunda compra';
   const input=(field,name,type='number',value=p[field]??'',extra='')=>'<label class="promo-field">'+name+'<input type="'+type+'" data-loyalty-field="'+field+'" value="'+esc(value)+'" '+extra+'></label>';
   return '<details class="promo-note" data-view-key="loyalty-'+id+'"><summary>'+label+' · '+(server?.enabled?'Activa en web':server?'Pausada en web':'Sin publicar')+'</summary><form data-loyalty-program="'+id+'"><div class="promo-form-grid">'
    +input('name','Nombre','text',p.name||label,'required maxlength="100"')
    +input('totalPercent','Descuento TOTAL (%)','number',p.totalPercent??base+Number(p.extraPercent??0),'required min="10.01" max="95" step="0.01"')
    +input('minEligibleSubtotal','Mínimo de productos participantes','number',p.minEligibleSubtotal??0,'required min="0" step="0.01"')
    +input('maxExtraAmount','Tope del descuento ADICIONAL ($, vacío = sin tope)','number',p.maxExtraAmount??'','min="0.01" step="0.01"')
    +input('validDays','Duración de cada cupón desde su emisión (días)','number',p.validDays??14,'required min="1" max="365" step="1"')
    +input('startsOn','Inicio del programa (opcional)','date',p.startsOn||'')+input('endsOn','Fin del programa (vacío = permanente)','date',p.endsOn||'')+'</div>'
    +'<fieldset class="promo-note"><legend>Cupones de Sahten pagando con Mercado Pago</legend><label class="promo-checkbox"><input type="checkbox" data-loyalty-mp="enabled"'+(p.mercadopago?.enabled===true?' checked':'')+'>Habilitar este beneficio con Mercado Pago</label><div class="promo-form-grid"><label class="promo-field">Descuento TOTAL (%)<input type="number" data-loyalty-mp="totalPercent" min="0.01" max="95" step="0.01" value="'+esc(p.mercadopago?.totalPercent??(id==='first_online'?5:10))+'"></label><label class="promo-field">Mínimo en productos ($)<input type="number" data-loyalty-mp="minEligibleSubtotal" min="0" step="0.01" value="'+esc(p.mercadopago?.minEligibleSubtotal??(id==='second_online'?40000:0))+'"></label><label class="promo-field">Tope ($, vacío = sin tope)<input type="number" data-loyalty-mp="maxExtraAmount" min="0.01" step="0.01" value="'+esc(p.mercadopago?.maxExtraAmount??'')+'"></label></div><p>Es un descuento propio del negocio: Sahten calcula el total y Mercado Pago lo cobra. No se suma al beneficio de efectivo/transferencia. Comparte los productos seleccionados abajo; el envío no tiene descuento.</p></fieldset>'
    +'<button type="button" data-loyalty-safe '+(!allowed()?'disabled':'')+'>Sugerir productos que cumplen el descuento</button><button type="button" data-promo-show-rules>Revisar reglas de rentabilidad</button>'
    +'<fieldset><legend>Productos participantes</legend>'+products.map(product=>'<label class="promo-checkbox"><input type="checkbox" data-loyalty-product="'+esc(product.id)+'"'+(p.eligibleProductIds?.includes(product.id)?' checked':'')+'>'+esc(product.name)+' <button type="button" data-loyalty-cost="'+esc(product.id)+'">Precio y costos</button></label>').join('')+'</fieldset>'
    +'<p>La sugerencia consulta los costos actuales del servidor. Los productos sin costo o sin margen suficiente quedan pendientes; podés corregirlos individualmente y volver a consultar.</p>'
    +'<p>El total incluye '+base+'% habitual con efectivo/transferencia. Si el margen no alcanza, el servidor indicará el producto para corregirlo desde Precio y costos o Reglas de rentabilidad. No se cambia el precio del producto al publicar.</p>'
    +'<button type="submit" data-loyalty-draft '+(!allowed()?'disabled':'')+'>Guardar borrador</button>'
    +'<button type="submit" '+(!allowed()||!loaded||busy?'disabled':'')+'>Revisar y publicar '+label.toLowerCase()+'</button>'
    +(server?'<button type="button" data-loyalty-toggle="'+id+'" '+(!allowed()||busy?'disabled':'')+'>'+(server.enabled?'Pausar nuevas emisiones':'Activar programa')+'</button>':'')+'</form></details>';
  }).join('')+'<button data-loyalty-refresh '+(busy?'disabled':'')+'>Consultar programas del servidor</button><p role="status" data-loyalty-status>'+esc(message)+'</p></section>';
 }
 function bind(root){
  root.querySelector('[data-loyalty-refresh]')?.addEventListener('click',refresh);
  root.querySelectorAll('[data-loyalty-safe]').forEach(b=>b.onclick=async()=>{
    if(!allowed())return;const form=b.closest('form');b.disabled=true;
    try{const data=await api().readPromotionPolicy();if(!form.isConnected)return;const percent=Number(form.querySelector('[data-loyalty-field="totalPercent"]').value),mpEnabled=form.querySelector('[data-loyalty-mp="enabled"]').checked,mpPercent=Number(form.querySelector('[data-loyalty-mp="totalPercent"]').value),fee=promotionPaymentFee({commercialPolicy:data.policy,checkoutProFeePercent:data.checkoutProFeePercent}),skipped=[];let selected=0;
      for(const input of form.querySelectorAll('[data-loyalty-product]')){const id=input.dataset.loyaltyProduct,p=data.products?.find(p=>p.id===id),h=promotionHeadroom({price:p?.price,cost:data.costs?.[id],rule:promotionRule({commercialPolicy:data.policy},id)});const mpHeadroom=promotionHeadroom({price:p?.price,cost:data.costs?.[id],rule:promotionRule({commercialPolicy:data.policy},id),commissionPercent:fee.percent});input.checked=h.known&&h.maxTotalPercent>=percent&&(!mpEnabled||mpHeadroom.known&&mpHeadroom.maxTotalPercent>=mpPercent);if(input.checked)selected++;else skipped.push((p?.name||(w.PRODUCTS||[]).find(p=>p.id===id)?.name||id)+': '+(!h.known?'completar precio/costo':'capacidad estimada '+h.maxTotalPercent+'% total'));}
      form.querySelector('[data-loyalty-product]')?.dispatchEvent(new w.Event('input',{bubbles:true}));
      root.querySelector('[data-loyalty-status]').textContent=selected+' productos seleccionados con datos actuales, antes de gastos extra pendientes. '+(skipped.length?'Por revisar: '+skipped.join('; '):'');
    }catch(e){root.querySelector('[data-loyalty-status]').textContent=e.message;}finally{if(b.isConnected)b.disabled=false;}
  });
  root.querySelectorAll('[data-loyalty-cost]').forEach(b=>b.onclick=()=>w.SAHTEN?.pricing?.open(b.dataset.loyaltyCost,'online'));
  async function publish(id,terms,enabled){
   const row=rows.find(r=>r.id===id);
   if(!allowed()||busy)return;
   const actionContext=context();
   if(await w.sahtenConfirm?.((enabled?'Publicar y habilitar':'Pausar nuevas emisiones de')+' «'+terms.name+'».\n'+couponTerms({...terms,paymentPercent:get().paymentPercent??10})+'\nCada cupón dura '+terms.validDays+' días. Programa: '+(terms.startsOn||'desde ahora')+' a '+(terms.endsOn||'sin fecha final')+'. Los cupones emitidos conservan sus condiciones.',{title:'Confirmar programa de beneficios',okLabel:enabled?'Publicar en web':'Pausar programa'})!==true)return;
   if(actionContext!==context()){message='Cambió el proyecto. Volvé a abrir el programa.';redraw(true);return;}
   drafts.set(id,terms);busy=true;message='Verificando condiciones y costos…';redraw(true);
   try{await api().saveLoyaltyProgram(id,terms,enabled,row?.revision||null);rows=await api().readLoyaltyPrograms();drafts.delete(id);message='Programa confirmado en el servidor.';}catch(e){
    message=e.message;const match=String(e.message).match(/(?:missing|minimum|published|limit):([a-zA-Z0-9_-]+)/);
    if(match){const p=(w.PRODUCTS||[]).find(p=>p.id===match[1]);message+=' Producto: '+(p?.name||match[1])+'. Abrí Precio y costos de ese producto, o ajustá su regla de rentabilidad; luego volvé a publicar.';}
   }finally{busy=false;redraw(true);}
  }
  root.querySelectorAll('[data-loyalty-program]').forEach(form=>form.addEventListener('submit',e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const value=k=>form.querySelector('[data-loyalty-field="'+k+'"]').value;
   const terms={name:value('name').trim(),paymentPercent:Number(paymentBase??get().paymentPercent??10),totalPercent:Number(value('totalPercent')),extraPercent:Math.round((Number(value('totalPercent'))-Number(paymentBase??get().paymentPercent??10))*100)/100,minEligibleSubtotal:Number(value('minEligibleSubtotal')),maxExtraAmount:value('maxExtraAmount')===''?null:Number(value('maxExtraAmount')),validDays:Number(value('validDays')),eligibleProductIds:[...form.querySelectorAll('[data-loyalty-product]:checked')].map(x=>x.dataset.loyaltyProduct)};
   const mpValue=k=>form.querySelector('[data-loyalty-mp="'+k+'"]').value;terms.mercadopago={enabled:form.querySelector('[data-loyalty-mp="enabled"]').checked,totalPercent:Number(mpValue('totalPercent')),minEligibleSubtotal:Number(mpValue('minEligibleSubtotal')),maxExtraAmount:mpValue('maxExtraAmount')===''?null:Number(mpValue('maxExtraAmount'))};
   if(value('startsOn'))terms.startsOn=value('startsOn');if(value('endsOn'))terms.endsOn=value('endsOn');
   if(!terms.eligibleProductIds.length||terms.extraPercent<=0||terms.startsOn&&terms.endsOn&&terms.endsOn<terms.startsOn){root.querySelector('[data-loyalty-status]').textContent='Revisá el descuento, las fechas y seleccioná productos participantes.';return;}
   if(e.submitter?.dataset?.loyaltyDraft!==undefined){saveLocal(form.dataset.loyaltyProgram,terms);root.querySelector('[data-loyalty-status]').textContent='Borrador guardado; todavía no se publicó.';return;}
   publish(form.dataset.loyaltyProgram,terms,true);
  }));
  root.querySelectorAll('[data-loyalty-toggle]').forEach(b=>b.onclick=()=>{const r=rows.find(r=>r.id===b.dataset.loyaltyToggle);if(r)publish(r.id,r.terms,!r.enabled);});
 }
 return {render,bind,refresh,entries:()=>rows,ingest(value){if(Array.isArray(value)){rows=value;loaded=true;}},reset(){generation++;busy=false;rows=[];loaded=false;message='';paymentBase=null;drafts.clear();}};
}
