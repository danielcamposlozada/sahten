import { recommendCartAddons } from '../core/cart-recommendations.js';
import '../styles/live-recommendations.css';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const validProduct=p=>p&&String(p.id||'')&&Number(p.price)>0&&p.salesAvailability?.retired!==true;
const nice=p=>p?.name||p?.id||'Producto';
const format=n=>'$'+Number(n||0).toLocaleString('es-AR');
const types={complement:'Acompañamiento',beverage:'Bebida'};
function catalog(rows){return (rows||[]).filter(validProduct);}
function fromRules(rules){return {complements:clone(rules.complements||[]),beverageContexts:clone(rules.beverageContexts||[])};}
function parseError(e){
  const msg=String(e?.message||'No se pudo guardar la recomendación.');
  if(/revision_conflict/.test(msg))return 'Las recomendaciones cambiaron en otro equipo. Actualizá la lista antes de guardar.';
  if(/forbidden|permission|unauthorized/i.test(msg))return 'Solo dueño o administrador puede modificar las recomendaciones.';
  if(/invalid_|rule|trigger|beverage|product/.test(msg))return 'La regla contiene productos o condiciones no publicados. Revisá la selección. '+msg.slice(0,80);
  return msg.slice(0,200);
}

export function createLiveRecommendationEditor(w,notify) {
  let remote=null,working=null,loading=false,busy=false,error='',message='',editing=null,previewId='';
  const api=()=>w.SAHTEN?.online?.controller;
  const canEdit=()=>!w.SAHTEN?.project?.session?.readOnly
    && ['owner','admin'].includes(w.SAHTEN?.online?.role?.())
    && api()?.info?.()?.signedIn===true;
  const items=()=>[...(remote?.rules?.beverageContexts||[]).map(x=>({...x,kind:'beverage'})),
    ...(remote?.rules?.complements||[]).map(x=>({...x,kind:'complement'}))];
  const products=()=>catalog(remote?.products);
  const label=id=>nice(products().find(x=>x.id===id)||{id});
  const renderCheckList=(source,selected,field)=>source.map(p=>
    '<label class="rec-product-check"><input type="checkbox" data-rec-'+field+'="'+esc(p.id)+'"'
      +((selected||[]).includes(p.id)?' checked':'')+'><span>'+esc(nice(p))+'</span></label>').join('');
  const preview=()=>{
    if(!previewId||!remote)return '';
    const row=items().find(x=>x.id===previewId);
    if(!row)return '';
    const trigger=(row.triggerProductIds||[]).find(id=>products().some(p=>p.id===id));
    if(!trigger)return '<p>No hay un producto disparador publicado para esta regla.</p>';
    const rules=remote.rules;
    const result=recommendCartAddons({products:products(),cart:[{id:trigger,qty:1}],
      policy:{...rules,enabled:true},showPrices:true});
    const shown=result.some(x=>row.kind==='beverage'?x.kind==='beverage':x.id===row.productId);
    return '<section class="rec-preview" aria-label="Vista previa de sugerencia">'
      +'<strong>Vista previa con '+esc(label(trigger))+'</strong>'
      +'<p>Ubicación: primer paso del carrito → «Para completar tu pedido».</p>'
      +(result.length?'<div>'+result.map(x=>'<div class="rec-preview-item">'+esc(x.headline)+' · '
          +esc(x.name)+' · '+esc(format(x.price))+'</div>').join('')+'</div>'
        :'<p>No aparece una sugerencia con este carrito.</p>')
      +'<small>'+(shown?'Esta regla puede mostrarse con este pedido.':'Esta regla no aparece en este ejemplo (prioridad, importe, producto ya agregado o regla pausada).')
      +' El resultado puede variar según el carrito y la disponibilidad.</small></section>';
  };
  const form=()=>{
    if(!editing)return '';
    const e=editing.item,beverage=editing.kind==='beverage',available=products();
    const filtered=available.filter(p=>p.category===(beverage?'Bebidas':'Bebidas')?false:true);
    const food=available.filter(p=>p.category!=='Bebidas');
    const drinks=available.filter(p=>p.category==='Bebidas');
    const check=renderCheckList;
    return '<section class="promo-card rec-edit-form" aria-label="Editar recomendación">'
      +'<div class="promo-row"><h3>'+(editing.creating?'Nueva regla':'Editar '+esc(e.name))+'</h3>'
      +'<button type="button" data-rec-cancel>Cancelar</button></div>'
      +'<p>Las ediciones quedan sin publicar hasta seleccionar «Guardar en la web».</p>'
      +'<label class="promo-field">Nombre visible<input id="rec-edit-name" maxlength="100" value="'+esc(e.name||'')+'"></label>'
      +'<label class="promo-field">Prioridad (0–100)<input id="rec-edit-priority" type="number" min="0" max="100" value="'+esc(e.priority??50)+'"></label>'
      +(beverage?'<fieldset class="rec-choices"><legend>Bebidas disponibles para esta sugerencia</legend><p>Se ofrece la primera disponible según el orden elegido.</p>'
        +check(drinks,e.options,'option')+'</fieldset>'
        +'<div class="promo-grid"><label class="promo-field">Subtotal mínimo<input type="number" id="rec-edit-min" min="0" max="99999999" value="'+esc(e.minEligibleSubtotal??0)+'"></label>'
        +'<label class="promo-field">Subtotal máximo (vacío = sin máximo)<input type="number" id="rec-edit-max" min="0" max="99999999" value="'+esc(e.maxEligibleSubtotal??'')+'"></label></div>'
        :'<label class="promo-field">Producto que se sugiere<select id="rec-edit-product">'
          +food.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===e.productId?' selected':'')+'>'+esc(nice(p))+'</option>').join('')+'</select></label>'
        +'<fieldset class="rec-choices"><legend>No mostrar cuando ya se incluyó</legend>'
        +check(food,e.suppressIfPresent,'exclude')+'</fieldset>')
      +'<fieldset class="rec-choices"><legend>Mostrar si el carrito contiene al menos uno de estos productos</legend>'
      +check(food,e.triggerProductIds,'trigger')+'</fieldset>'
      +'<fieldset class="rec-choices"><legend>¿Dónde aparece?</legend>'
      +'<label><input type="checkbox" checked disabled> Carrito → «Para completar tu pedido»</label>'
      +'<p>Checkout, ficha de producto, menú y ticket no están implementados para estas sugerencias; no se pueden activar todavía.</p></fieldset>'
      +'<div class="promo-row"><button type="button" data-rec-save class="rec-primary">Guardar en la web</button>'
      +'<button type="button" data-rec-cancel>Descartar cambios</button></div></section>';
  };
  function render(){
    if(!remote&&!loading)return '<section class="promo-card"><h3>Recomendaciones publicadas en la web</h3>'
      +'<p>Gestioná aquí los complementos y bebidas que aparecen a precio completo en el carrito. Son distintos de los borradores de descuentos.</p>'
      +'<button data-rec-refresh type="button">Consultar recomendaciones en la web</button>'
      +(error?'<p class="promo-caution" role="alert">'+esc(error)+'</p>':'')+'</section>';
    if(loading)return '<section class="promo-card"><h3>Recomendaciones web</h3><p>Consultando reglas publicadas…</p></section>';
    const all=items(),enabled=all.filter(x=>x.enabled!==false).length;
    return '<section class="promo-card rec-live-editor">'
      +'<div class="promo-row"><div><h3>Recomendaciones publicadas en la web</h3>'
      +'<p>Se muestran solo en el carrito. '+enabled+' de '+all.length+' reglas habilitadas; máximo 1 bebida y 1 acompañamiento por compra.</p></div>'
      +'<button type="button" data-rec-refresh'+(busy?' disabled':'')+'>Actualizar desde la web</button></div>'
      +'<p>El switch de cada regla controla realmente su publicación en la tienda. Todos los productos se ofrecen a precio de lista, incluso con Mercado Pago.</p>'
      +(error?'<p class="promo-caution" role="alert">'+esc(error)+'</p>':'')
      +(message?'<p class="promo-note" role="status">'+esc(message)+'</p>':'')
      +'<div class="rec-actions"><button type="button" data-rec-create="complement"'+(!canEdit()||busy?' disabled':'')+'>+ Nuevo acompañamiento</button>'
      +'<button type="button" data-rec-create="beverage"'+(!canEdit()||busy?' disabled':'')+'>+ Nueva sugerencia de bebida</button></div>'
      +'<div class="promo-draft-list">'+(all.map(x=>{
        const status=x.enabled===false?'Pausada en web':'Habilitada en web';
        const desc=x.kind==='beverage'?(x.options||[]).map(label).join(', '):label(x.productId);
        return '<article class="promo-row promo-draft-item rec-rule" data-rec-rule="'+esc(x.id)+'">'
          +'<div><strong>'+esc(x.name)+'</strong><p>'+esc(types[x.kind])+' · '+esc(desc)+'</p>'
          +'<p>'+esc(status)+' · Se muestra en carrito con '+(x.triggerProductIds||[]).length+' productos disparadores</p>'
          +'</div><div class="rec-rule-controls">'
          +'<button class="promo-live-switch" role="switch" type="button" data-rec-toggle="'+esc(x.id)+'" aria-checked="'+(x.enabled!==false)+'"'
          +(!canEdit()||busy?' disabled':'')+'><span class="promo-live-track"></span><span>'+(x.enabled!==false?'Desactivar':'Activar')+'</span></button>'
          +'<button type="button" data-rec-preview="'+esc(x.id)+'">Ver dónde aparece</button>'
          +'<button type="button" data-rec-edit="'+esc(x.id)+'"'+(!canEdit()||busy?' disabled':'')+'>Editar</button>'
          +'<button type="button" data-rec-duplicate="'+esc(x.id)+'"'+(!canEdit()||busy?' disabled':'')+'>Duplicar</button>'
          +'<button type="button" data-rec-delete="'+esc(x.id)+'"'+(!canEdit()||busy?' disabled':'')+'>Eliminar</button>'
          +'</div></article>';
      }).join('')||'<p>No hay reglas publicadas.</p>')+'</div>'
      +preview()+form()+'</section>';
  }
  async function refresh(){
    if(busy)return;
    loading=true;error='';notify();
    try{
      const result=await api()?.readCartRecommendations?.();
      if(!result?.published||!result.rules)throw Error('No se encontró la configuración publicada en el servidor.');
      remote=clone(result);previewId='';editing=null;message='Reglas cargadas desde sahten.online.';
    }catch(e){error=parseError(e);}
    finally{loading=false;notify();}
  }
  async function commit(next){
    if(!remote||busy||!canEdit())return;
    busy=true;error='';message='Guardando la configuración en el servidor…';notify();
    try{
      const sent=await api().setCartRecommendations(next,remote.revision??null);
      if(!sent?.revision)throw Error('No se confirmó el guardado.');
      const latest=await api().readCartRecommendations();
      if(!latest?.published||latest.revision!==sent.revision)throw Error('No se confirmó la nueva revisión.');
      remote=clone(latest);editing=null;previewId='';message='Guardado y verificado en la web. Los cambios se reflejan al actualizar el menú en vivo.';
    }catch(e){error=parseError(e);message='El cambio no está confirmado como publicado.';}
    finally{busy=false;notify();}
  }
  function create(kind,copy=null){
    const base=kind==='beverage'
      ?{id:'',name:'Nueva sugerencia de bebida',enabled:false,priority:50,triggerProductIds:[],options:[],minEligibleSubtotal:0,maxEligibleSubtotal:null}
      :{id:'',name:'Nuevo acompañamiento',enabled:false,priority:50,productId:products().find(p=>p.category!=='Bebidas')?.id||'',triggerProductIds:[],suppressIfPresent:[]};
    const now=Date.now().toString(36),id=('regla-'+now).slice(0,48);
    editing={kind,creating:true,item:{...clone(copy||base),id,enabled:false,name:copy?'Copia de '+copy.name:base.name}};
    previewId='';notify();
  }
  function collect(root){
    if(!editing)return null;
    const q=s=>root.querySelector(s);
    const checked=which=>[...root.querySelectorAll('[data-rec-'+which+']:checked')].map(x=>x.dataset['rec'+which[0].toUpperCase()+which.slice(1)]);
    const item={...editing.item,name:q('#rec-edit-name')?.value.trim().slice(0,100),
      priority:Number(q('#rec-edit-priority')?.value),triggerProductIds:checked('trigger')};
    if(editing.kind==='beverage'){
      item.options=checked('option');item.minEligibleSubtotal=Number(q('#rec-edit-min')?.value||0);
      item.maxEligibleSubtotal=q('#rec-edit-max')?.value===''?null:Number(q('#rec-edit-max')?.value);
    }else{
      item.productId=q('#rec-edit-product')?.value;
      item.suppressIfPresent=checked('exclude');
    }
    if(!item.name||item.name.length<3||!item.triggerProductIds.length
      ||!Number.isInteger(item.priority)||item.priority<0||item.priority>100
      ||(editing.kind==='beverage'&&!item.options.length)){
      error='Completá el nombre, la prioridad y al menos un disparador y producto disponible.';notify();return null;
    }
    return item;
  }
  function bind(root){
    root.querySelector('[data-rec-refresh]')?.addEventListener('click',refresh);
    root.querySelectorAll('[data-rec-toggle]').forEach(b=>b.addEventListener('click',()=>{
      if(!remote||busy)return;const id=b.dataset.recToggle,copy=fromRules(remote.rules);
      for(const x of [...copy.complements,...copy.beverageContexts])if(x.id===id)x.enabled=x.enabled===false;
      commit(copy);
    }));
    root.querySelectorAll('[data-rec-preview]').forEach(b=>b.addEventListener('click',()=>{previewId=b.dataset.recPreview;editing=null;notify();}));
    root.querySelectorAll('[data-rec-edit]').forEach(b=>b.addEventListener('click',()=>{
      const row=items().find(x=>x.id===b.dataset.recEdit);if(!row)return;
      editing={kind:row.kind,creating:false,item:clone(row)};previewId='';notify();
    }));
    root.querySelectorAll('[data-rec-create]').forEach(b=>b.addEventListener('click',()=>create(b.dataset.recCreate)));
    root.querySelectorAll('[data-rec-duplicate]').forEach(b=>b.addEventListener('click',()=>{
      const row=items().find(x=>x.id===b.dataset.recDuplicate);if(row)create(row.kind,row);
    }));
    root.querySelectorAll('[data-rec-cancel]').forEach(b=>b.addEventListener('click',()=>{editing=null;error='';notify();}));
    root.querySelector('[data-rec-save]')?.addEventListener('click',()=>{
      const row=collect(root);if(!row||!remote||busy)return;
      const copy=fromRules(remote.rules),key=editing.kind==='beverage'?'beverageContexts':'complements';
      const pos=copy[key].findIndex(x=>x.id===row.id);
      if(pos===-1)copy[key].push(row);else copy[key][pos]=row;
      commit(copy);
    });
    root.querySelectorAll('[data-rec-delete]').forEach(b=>b.addEventListener('click',async()=>{
      if(!remote||busy||!canEdit())return;
      const id=b.dataset.recDelete;
      if((await w.sahtenConfirm?.('¿Eliminar esta recomendación de la web? Dejará de ofrecerse en nuevos carritos.',
          {title:'Eliminar recomendación',okLabel:'Eliminar'}))!==true)return;
      const copy=fromRules(remote.rules);
      copy.complements=copy.complements.filter(x=>x.id!==id);
      copy.beverageContexts=copy.beverageContexts.filter(x=>x.id!==id);
      commit(copy);
    }));
  }
  return {render,bind,refresh,get:()=>remote};
}
