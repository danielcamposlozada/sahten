import { state } from '../core/state.js';
import { afterRender } from '../events.js';
import { fixedPriceAudit,normalizeFixedPrices } from '../core/price-normalization.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2});
export function installPriceNormalization(w=window) {
  const d=w.document;
  const allowed=()=>!d.body.classList.contains('role-no-costs')&&(!d.body.dataset.role||['owner','admin'].includes(d.body.dataset.role))
    && w.SAHTEN?.project?.session?.readOnly!==true;
  function modal(){
    if(!allowed())return;
    const audit=fixedPriceAudit(state), preview=normalizeFixedPrices(state,{dryRun:true});
    const ov=d.createElement('div');ov.className='pricing-overlay';ov.id='normalization-preview';
    const box=d.createElement('section');box.className='pricing-dialog';box.style.maxWidth='800px';box.setAttribute('role','dialog');
    box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Normalizar precios comerciales');
    ov.append(box);d.body.append(ov);
    const release=w.SAHTEN.bindModalFocus?.({panel:box,close:()=>{ov.remove()},background:[d.querySelector('.sidebar'),d.querySelector('.main')]})||(()=>{});
    const close=()=>{release();ov.remove();};
    box.innerHTML='<div class="pricing-heading"><div><h2>Normalizar precios de venta</h2><p>Convertir importes fijados en precios finales comerciales.</p></div><button type="button" data-close aria-label="Cerrar">×</button></div>'
      +'<p><strong>'+preview.products+' productos preparados</strong> · '+audit.length+' precios por canal revisados · '+preview.skipped.length+' con alertas.</p>'
      +'<p>Se mantiene exactamente cada precio cobrado y el gasto fijo actual por unidad. No se modifica el porcentaje de tier compartido con otros productos. Se registra un factor de ajuste individual y un respaldo reversible.</p>'
      +'<div style="overflow:auto;max-height:42vh"><table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr><th>Producto</th><th>Canal</th><th>Precio actual</th><th>GF por unidad</th><th>Resto estimado</th></tr></thead><tbody>'
      +audit.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.channel)+'</td><td>'+money(r.oldPrice)+'</td><td>'+money(r.fixedCost)+'</td><td>'+money(r.contribution)+'</td></tr>').join('')
      +'</tbody></table></div>'
      +(preview.skipped.length?'<p role="status">Se omitirán algunos productos: '+esc(preview.skipped.map(x=>x.productId+' ('+x.reason+')').join('; '))+'</p>':'')
      +'<p>Las ventas anteriores mantienen su historial. Después de aplicar, será necesario volver a publicar el menú web para sincronizar los precios.</p>'
      +'<div class="pricing-actions"><button type="button" data-close>Cancelar</button><button class="btn-primary" type="button" data-apply '+(preview.products?'':'disabled')+'>Normalizar conservando todos los precios</button></div>';
    box.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
    box.querySelector('[data-apply]')?.addEventListener('click',()=>{
      if(!allowed())return;
      const result=normalizeFixedPrices(state,{actor:d.body.dataset.role||'owner'});
      w.SAHTEN.project.markDirty();
      w.scheduleSave?.();w.recalcAll?.();close();
      w._posToast?.('Precios normalizados: '+result.products+' productos. Todos los importes conservados.');
    });
    box.focus();
  }
  function mount(){
    const panel=d.getElementById('panel-productos');
    if(!panel||!allowed()||panel.querySelector('[data-normalize-prices]'))return;
    const count=fixedPriceAudit(state).length;if(!count)return;
    const bar=d.createElement('div');bar.className='promo-caution';bar.style.margin='0 0 16px';bar.innerHTML='<strong>Precios finales:</strong> '+count+' importes están fijados y pueden normalizarse sin modificar sus valores de venta. '
      +'<button class="btn" type="button" data-normalize-prices>Revisar y normalizar precios</button>';
    bar.querySelector('[data-normalize-prices]').addEventListener('click',modal);
    panel.prepend(bar);
  }
  afterRender('renderProductos',mount);
  return {audit:()=>fixedPriceAudit(state),preview:()=>normalizeFixedPrices(state,{dryRun:true}),open:modal};
}
