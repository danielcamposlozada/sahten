import { state } from '../core/state.js';
import { channelPriceWithDisc, channelNetReceivedWithDisc } from '../core/pricing.js';
import { isPriceFixed } from '../core/price-policy.js';
import { costPerUnit } from '../core/costs.js';
import { gfAssigned } from '../core/gf.js';
import { salesPaused } from '../core/sales-availability.js';
import { fmt } from '../core/format.js';
import { contrastText } from './contrast.js';
import './product-views.css';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views=['lista','lateral','tarjetas','comparador'];
export function installProductViews(w){
 const d=w.document;let channel='mostrador',selected=null,onlyFavorites=false,selections=new Set(),colorFor=()=>({bg:'#888888'});
 const canCost=()=>!d.body.classList.contains('role-no-costs');
 const canEdit=()=>!w.SAHTEN.project.session.readOnly&&(!d.body.dataset.role||['owner','admin'].includes(d.body.dataset.role));
 const money=n=>fmt(state,n);
 const price=(p,id)=>channelPriceWithDisc(state,p,id)||0;
 const channels=()=>state.channels.filter(c=>c.enabled);
 const chip=c=>{const color=colorFor(c.id);return '<span class="product-channel" style="--channel-color:'+esc(color.bg)+';--channel-text:'+contrastText(color.bg)+'">'+esc(c.name)+'</span>';};
 const status=(p,id)=>'<span class="product-price-mode">'+(isPriceFixed(p,id)?'🔒 Precio fijado':'Automático')+'</span>';
 function favorite(p){return '<label class="product-selection"><input type="checkbox" data-product-selection="'+esc(p.id)+'" aria-label="Seleccionar '+esc(p.name)+'" '+(selections.has(state.products.indexOf(p))?'checked':'')+'></label><button type="button" class="product-favorite '+(p.star?'on':'')+'" data-product-favorite="'+esc(p.id)+'" aria-label="'+(p.star?'Quitar de favoritos: ':'Agregar a favoritos: ')+esc(p.name)+'" aria-pressed="'+!!p.star+'" '+(canEdit()?'':'disabled')+'>'+(p.star?'★':'☆')+'</button>';}
 function name(p){return w.SAHTEN.photos.thumb(p.id,p.name,{size:44,del:false})+'<div class="product-identity"><strong>'+esc(p.name)+'</strong><small>'+esc(p.category||'Sin categoría')+'</small>'+(salesPaused(p)?'<span class="sales-state paused">Ventas pausadas</span>':'')+'</div>';}
 function edit(p,id){return '<button type="button" class="btn" data-product-edit="'+esc(p.id)+'" data-product-channel="'+esc(id)+'">'+(canEdit()?'Ajustar precio':'Ver precio')+'</button>';}
 function details(p,id){return '<details class="product-more"><summary>Más detalles de '+esc(p.name)+'</summary><div class="product-more-body">'+(canCost()?'<dl><div><dt>Costo variable por unidad</dt><dd>'+money(costPerUnit(state,p,id))+'</dd></div><div><dt>Gasto fijo por unidad</dt><dd>'+money(gfAssigned(state,p,id))+'</dd></div><div><dt>Neto del canal</dt><dd>'+money(channelNetReceivedWithDisc(state,p,id))+'</dd></div></dl>':'')+'<div class="product-detail-actions"><button type="button" class="btn" data-product-recipe="'+esc(p.id)+'">'+(p.productType==='resale'?'Ver producto de reventa':'Ver receta')+'</button>'+w.SAHTEN.salesAvailability.controls(p)+'</div></div></details>';}
 function render(indices,view,selection=new Set(),channelColor){
  selections=selection;if(channelColor)colorFor=channelColor;
  const selector=d.getElementById('product-view-select');if(selector)selector.value=views.includes(view)||['tabla','grilla'].includes(view)?view:'lista';
  const oldButtons=d.querySelector('#panel-productos .ptb-view-group');if(oldButtons)oldButtons.hidden=true;
  const advanced=d.getElementById('col-toggle-btn');if(advanced)advanced.parentElement.hidden=view!=='tabla';
  const root=d.getElementById('prod-grid-container');if(!root)return false;
  const inline=view==='lateral'&&(!root.clientWidth||root.clientWidth>=900);
  const active=d.activeElement,focusLabel=root.contains(active)?active.getAttribute('aria-label'):null;
  root.classList.toggle('product-views',views.includes(view));
  if(!views.includes(view))return false;
  const table=d.querySelector('#panel-productos .card');if(table)table.style.display='none';root.style.display='block';
  const allChannels=channels();if(!allChannels.some(c=>c.id===channel))channel=allChannels[0]?.id||'mostrador';
  const current=allChannels.find(c=>c.id===channel)||{id:'mostrador',name:'Mostrador'};
  const products=indices.map(i=>state.products[i]).filter(p=>!onlyFavorites||p.star);
  if(!products.some(p=>p.id===selected))selected=products[0]?.id;
  const toolbar='<div class="product-view-tools"><label>Canal de venta<select data-product-channel-select aria-label="Canal de venta">'+allChannels.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===channel?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'+chip(current)+'<button type="button" class="btn" data-product-favorites aria-pressed="'+onlyFavorites+'">★ '+(onlyFavorites?'Solo favoritos':'Ver favoritos')+'</button><span>'+products.length+' producto(s)</span></div>';
  let body='';
  if(view==='comparador')body='<div class="product-comparison"><table><caption>Precios por canal. Pulsá un precio para ver o ajustar su detalle.</caption><thead><tr><th scope="col">Producto</th>'+allChannels.map(c=>'<th scope="col">'+chip(c)+'</th>').join('')+'</tr></thead><tbody>'+products.map(p=>'<tr><th scope="row"><div class="product-list-name">'+favorite(p)+name(p)+'</div></th>'+allChannels.map(c=>'<td><button type="button" class="product-cell-price" data-product-edit="'+esc(p.id)+'" data-product-channel="'+esc(c.id)+'" aria-label="Precio de '+esc(p.name)+' en '+esc(c.name)+'"><strong>'+money(price(p,c.id))+'</strong>'+status(p,c.id)+'</button></td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  else if(view==='tarjetas')body='<div class="product-clean-grid">'+products.map(p=>'<article class="product-clean-card"><div class="product-list-name">'+favorite(p)+name(p)+'</div><div class="product-main-price">'+money(price(p,channel))+'</div>'+status(p,channel)+edit(p,channel)+details(p,channel)+'</article>').join('')+'</div>';
  else body='<div class="'+(inline?'product-split':'')+'"><div class="product-clean-list">'+products.map(p=>'<article class="product-list-row '+(selected===p.id&&view==='lateral'?'is-selected':'')+'"><div class="product-list-main"><div class="product-list-name">'+favorite(p)+name(p)+'</div><div class="product-list-price"><strong>'+money(price(p,channel))+'</strong>'+status(p,channel)+'</div>'+(view==='lateral'?'<button type="button" class="btn" data-product-select="'+esc(p.id)+'" aria-pressed="'+(selected===p.id)+'">'+(selected===p.id?'Seleccionado':'Editar')+'</button>':edit(p,channel))+'</div>'+details(p,channel)+'</article>').join('')+'</div>'+(inline?'<aside data-product-editor aria-label="Editor lateral de precio"></aside>':'')+'</div>';
  root.innerHTML=toolbar+(products.length?body:'<div class="product-empty" role="status">No hay productos con estos filtros. Probá otra búsqueda o quitá el filtro de favoritos.</div>');
  root.onchange=e=>{if(e.target.dataset.productSelection){const p=state.products.find(p=>p.id===e.target.dataset.productSelection);if(p)w.toggleProd(state.products.indexOf(p),e.target.checked);return;}if(e.target.hasAttribute('data-product-channel-select')){channel=e.target.value;w.renderProductos();}};
  root.onclick=e=>{
   const b=e.target.closest('[data-product-favorite],[data-product-favorites],[data-product-select],[data-product-edit],[data-product-recipe]');if(!b)return;e.stopPropagation();
   if(b.hasAttribute('data-product-favorites')){onlyFavorites=!onlyFavorites;w.renderProductos();return;}
   const id=b.dataset.productFavorite||b.dataset.productSelect||b.dataset.productEdit||b.dataset.productRecipe,p=state.products.find(p=>p.id===id);if(!p)return;
   if(b.dataset.productFavorite){if(!canEdit())return;p.star=!p.star;w.SAHTEN.project.markDirty();w.scheduleSave?.();w.renderProductos();return;}
   if(b.dataset.productSelect){selected=id;if(inline)w.renderProductos();else w.SAHTEN.pricing.open(id,channel);return;}
   if(b.dataset.productRecipe){w.openRecipe(state.products.indexOf(p));return;}
   if(b.dataset.productEdit)w.SAHTEN.pricing.open(id,b.dataset.productChannel);
  };
  if(inline&&selected&&canCost())w.SAHTEN.pricing.open(selected,channel,root.querySelector('[data-product-editor]'));
  if(focusLabel&&!d.contains(active)){const target=[...root.querySelectorAll('[aria-label]')].find(el=>el.getAttribute('aria-label')===focusLabel);target?.focus({preventScroll:true});}
  return true;
 }
 return {render,channel:()=>channel};
}
