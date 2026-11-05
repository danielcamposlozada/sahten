import {kv} from '../project/kv.js';
import {promotionRule,promotionHeadroom,validatePromotionPolicy,promotionPaymentFee} from '../core/promotion-policy.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createPromotionPolicyEditor(w,redraw){
 let data=null,busy=false,message='',generation=0;
 const context=()=>[w.SAHTEN?.project?.session?.id,api()?.info?.()?.storeId].join('|');
 const api=()=>w.SAHTEN?.online?.controller;
 const allowed=()=>!w.SAHTEN?.project?.session?.readOnly&&['owner','admin'].includes(w.SAHTEN?.online?.role?.());
 async function refresh(){if(busy)return;const g=generation;busy=true;try{const result=await api()?.readPromotionPolicy?.();if(g!==generation)return;data=result;message=data?'':'La actualización del servidor todavía no está instalada.';}catch(e){if(g===generation)message=e.message;}finally{if(g===generation){busy=false;redraw();}}}
 function render(){
  if(!data)return '<section class="promo-card"><h3>Reglas de rentabilidad</h3><p>Consultá los márgenes y límites vigentes del servidor. No se modifica ninguna promoción al abrir esta sección.</p><button data-policy-refresh '+(busy?'disabled':'')+'>Consultar reglas</button><p role="status">'+esc(message)+'</p></section>';
  const p=data.policy||{},n=v=>v??'',fee=promotionPaymentFee({commercialPolicy:p,checkoutProFeePercent:data.checkoutProFeePercent});
  return '<section class="promo-card"><h3>Reglas de rentabilidad</h3><p>El descuento es TOTAL, incluido el beneficio por pago. El margen se calcula sobre el ingreso después del descuento y la comisión; no es un recargo sobre el costo. Los costos desconocidos siguen requiriendo revisión.</p>'
   +'<div class="promo-form-grid"><label class="promo-field">Margen general mínimo (%)<input id="policy-margin" type="number" min="0" max="95" step="0.01" value="'+esc(p.minMarginPct??40)+'"></label>'
   +'<label class="promo-field">Descuento total máximo (%)<input id="policy-max" type="number" min="10" max="95" step="0.01" value="'+esc(p.maxTotalPercent??20)+'"></label></div>'
   +'<div class="promo-form-grid"><label class="promo-field">Comisión de Mercado Pago para simulaciones (%)<input id="policy-mp-fee" type="number" min="0" max="99.99" step="0.01" value="'+esc(fee.percent)+'"></label><label class="promo-checkbox"><input id="policy-mp-provisional" type="checkbox"'+(fee.provisional?' checked':'')+'>Es una estimación provisional</label></div><p>Una comisión provisional no equivale a tu tasa real. Se usa para evaluar rentabilidad y queda guardado en cada cotización nueva; no registra un gasto contable ni modifica el importe que paga el cliente. Reemplazalo por tu comisión total verificada cuando la conozcas.</p>'
   +'<p>Las campañas pueden conservar una meta propia. Una excepción por producto tiene prioridad. Un campo vacío hereda la regla general o la meta de la campaña; nunca representa costo cero.</p>'
   +'<div class="promo-economics-table"><table><thead><tr><th>Producto</th><th>Margen mínimo %</th><th>Tope total %</th><th>Efectivo / transferencia</th><th>Mercado Pago · estimado</th><th>Completar</th></tr></thead><tbody>'
   +(data.products||[]).map(product=>{
    const override=p.products?.[product.id]||{},rule=promotionRule({commercialPolicy:p},product.id),h=promotionHeadroom({price:product.price,cost:data.costs?.[product.id],rule}),mp=promotionHeadroom({price:product.price,cost:data.costs?.[product.id],rule,commissionPercent:fee.percent});
    return '<tr><td>'+esc(product.name)+'</td><td><input aria-label="Margen de '+esc(product.name)+'" data-policy-margin="'+esc(product.id)+'" type="number" min="0" max="95" step="0.01" placeholder="Heredar" value="'+esc(n(override.minMarginPct))+'"></td>'
     +'<td><input aria-label="Tope de '+esc(product.name)+'" data-policy-max="'+esc(product.id)+'" type="number" min="10" max="95" step="0.01" placeholder="Heredar" value="'+esc(n(override.maxTotalPercent))+'"></td>'
     +'<td>'+(h.known?'Hasta '+h.maxTotalPercent+'% total estimado':'Costo pendiente')+'</td><td>'+(mp.known?'Hasta '+mp.maxTotalPercent+'% total':'Costo pendiente')+'</td><td><button type="button" data-policy-pricing="'+esc(product.id)+'">Revisar precio y costos</button></td></tr>';
   }).join('')+'</tbody></table></div><p>Los importes estimados no incluyen gastos extra pendientes. Guardar actualiza las reglas para cotizaciones nuevas; las ventas previas conservan su snapshot.</p>'
   +'<button type="button" data-policy-save '+(!allowed()||busy?'disabled':'')+'>Guardar reglas en la web</button><button type="button" data-policy-refresh '+(busy?'disabled':'')+'>Volver a consultar</button><p role="status">'+esc(message)+'</p></section>';
 }
 function bind(root){
  root.querySelector('[data-policy-refresh]')?.addEventListener('click',refresh);
  root.querySelectorAll('[data-policy-pricing]').forEach(b=>b.onclick=()=>w.SAHTEN?.pricing?.open(b.dataset.policyPricing,'online'));
  root.querySelector('[data-policy-save]')?.addEventListener('click',async()=>{
   if(!allowed()||busy)return;
   const policy={minMarginPct:root.querySelector('#policy-margin').value.trim()===''?NaN:Number(root.querySelector('#policy-margin').value),maxTotalPercent:root.querySelector('#policy-max').value.trim()===''?NaN:Number(root.querySelector('#policy-max').value),mercadopagoFeePercent:root.querySelector('#policy-mp-fee').value.trim()===''?NaN:Number(root.querySelector('#policy-mp-fee').value),mercadopagoFeeProvisional:root.querySelector('#policy-mp-provisional').checked,products:{}};
   for(const product of data.products||[]){
    const inputs=[...root.querySelectorAll('[data-policy-margin],[data-policy-max]')].filter(el=>el.dataset.policyMargin===product.id||el.dataset.policyMax===product.id),row={};
    for(const input of inputs)if(input.value.trim()!=='')row[input.dataset.policyMargin?'minMarginPct':'maxTotalPercent']=Number(input.value);
    if(Object.keys(row).length)policy.products[product.id]=row;
   }
   const errors=validatePromotionPolicy(policy);if(errors.length){message=errors.join(' ');root.querySelector('[role="status"]').textContent=message;return;}
   const detail=Object.entries(policy.products).map(([id,r])=>(data.products.find(p=>p.id===id)?.name||id)+': '+(r.minMarginPct==null?'margen heredado':r.minMarginPct+'% margen')+', '+(r.maxTotalPercent==null?'tope heredado':r.maxTotalPercent+'% descuento máximo')).join('\n');
   const actionContext=context();
   if(await w.sahtenConfirm?.('Margen general: '+policy.minMarginPct+'%. Máximo total: '+policy.maxTotalPercent+'%.\nMercado Pago: '+policy.mercadopagoFeePercent+'% ('+(policy.mercadopagoFeeProvisional?'estimación provisional':'tasa indicada por el negocio')+').\n'+(detail||'Sin excepciones por producto.')+'\nEsto cambia las reglas de nuevas cotizaciones. No activa campañas ni modifica ventas anteriores.',{title:'Guardar reglas comerciales',okLabel:'Guardar en web'})!==true)return;
   if(actionContext!==context()){message='Cambió el proyecto. Volvé a consultar las reglas.';redraw(true);return;}
   busy=true;message='Guardando…';redraw(true);
   try{await api().savePromotionPolicy(policy,data.revision||null);data=await api().readPromotionPolicy();const state=kv.json('sahten_promotions',{});state.commercialPolicy={...data.policy,revision:data.revision};kv.set('sahten_promotions',JSON.stringify(state));message='Reglas confirmadas en el servidor.';}catch(e){message=e.message;}finally{busy=false;redraw(true);}
  });
 }
 return {render,bind,refresh,reset(){generation++;busy=false;data=null;message='';}};
}
