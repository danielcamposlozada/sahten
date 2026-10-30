// ═══════════════════════════════════════════════════════════
// SAHTEN — MOSTRADOR (POS) v2
// Images, Categories, Cart, Orders, Customers, Comanda
// ═══════════════════════════════════════════════════════════

// ─── Imágenes de producto: viven dentro del proyecto (.sahten, sección images), no en el navegador ───
function _imgKey(pid) { return pid; }
async function saveProductImage(pid, dataUrl) { if(!pid||!dataUrl) return; window.SAHTEN_IMAGES[pid]=dataUrl; SAHTEN.project.markDirty(); }
async function getProductImage(pid) { if(!pid) return null; return window.SAHTEN_IMAGES[pid]||null; }
async function deleteProductImage(pid) { if(!pid) return; delete window.SAHTEN_IMAGES[pid]; SAHTEN.project.markDirty(); }
function _resizeImageFile(file, maxDim=500, quality=0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => { const img = new Image(); img.onload = () => { const s=Math.min(1,maxDim/Math.max(img.width,img.height)); const w=Math.round(img.width*s),h=Math.round(img.height*s); const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=e.target.result; };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}
const _imgCache = new Map();
async function getProductImageCached(pid) { const k=_imgKey(pid); if(_imgCache.has(k)) return _imgCache.get(k); const d=await getProductImage(pid); _imgCache.set(k,d); return d; }
function _invalidateImgCache(pid) { _imgCache.delete(_imgKey(pid)); }

// ─── Image upload — direct (for CR cards) ────────────────
async function directUploadImage(productId) { return SAHTEN.photos.pick(productId); }
async function _directUploadImageOld(productId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Seleccioná una imagen válida.'); return; }
    try {
      const dataUrl = await _resizeImageFile(file, 500, 0.82);
      await saveProductImage(productId, dataUrl);
      _invalidateImgCache(productId);
      if (typeof renderCostReceta === 'function') renderCostReceta();
      if (typeof renderMostrador === 'function') renderMostrador();
    } catch(e) { alert('Error: ' + e.message); }
  };
  input.click();
}

// ─── Image UI in recipe modal ────────────────────────────
function _injectProductImageUI() {
  if (window._renderRecipeBodyPatched) return;
  SAHTEN.events.afterRender('renderRecipeBody', () => _renderProductImageRow());
  window._renderRecipeBodyPatched = true;
}
async function _renderProductImageRow() {
  const idx = (typeof recipeIdx !== 'undefined') ? recipeIdx : -1;
  if (idx < 0 || !PRODUCTS[idx]) return;
  const p = PRODUCTS[idx];
  const body = document.getElementById('recipe-body');
  if (!body) return;
  let existing = body.querySelector('.prod-img-row');
  if (existing) existing.remove();
  const row = document.createElement('div'); row.className = 'prod-img-row';
  row.innerHTML = `
    ${SAHTEN.photos.thumb(p.id, p.name, { size: 96 })}
    <div class="prod-img-meta">
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">
        <div><label style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">Nombre de la receta</label>
        <input type="text" class="custom-input" value="${_esc(p.name)}" style="font-size:15px;font-weight:600" oninput="PRODUCTS[recipeIdx].name=this.value.trim();if(typeof scheduleSave==='function')scheduleSave()" id="recipe-name-input"></div>
        <div><label style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">Categoría</label>
        <input type="text" class="custom-input" value="${_esc(p.category||'')}" placeholder="ej. Sandwiches, Bebidas..." list="cat-datalist" style="font-size:13px" oninput="PRODUCTS[recipeIdx].category=this.value.trim();if(typeof scheduleSave==='function')scheduleSave()" id="recipe-cat-input">
        <datalist id="cat-datalist">${_getProductCategories().map(c=>'<option value="'+_esc(c)+'">').join('')}</datalist></div>
      </div>
      <div class="prod-img-actions"><button class="btn" data-photo-pick="${p.id}">📷 Subir o cambiar foto</button><span style="font-size:11px;color:var(--muted)">También podés arrastrar una imagen sobre la foto.</span></div>
    </div>`;
  if (p.productType === 'resale') row.querySelector('.prod-img-meta > div:first-child')?.remove();
  body.insertBefore(row, body.firstChild);
}
async function _handleProductImageUpload(ev, pid) {
  const file = ev.target.files?.[0]; ev.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const dataUrl = await _resizeImageFile(file, 500, 0.82);
    await saveProductImage(pid, dataUrl); _invalidateImgCache(pid);
    const thumb=document.getElementById('prod-img-thumb');
    if(thumb){thumb.classList.remove('empty');thumb.innerHTML='<img src="'+dataUrl+'" alt="">';}
    const rm=document.getElementById('prod-img-remove-btn'); if(rm) rm.style.display='inline-flex';
    if(typeof renderMostrador==='function') renderMostrador();
  } catch(e){ alert('Error: '+e.message); }
}
async function _removeProductImage() {
  const idx=(typeof recipeIdx!=='undefined')?recipeIdx:-1; if(idx<0||!PRODUCTS[idx]) return;
  const p=PRODUCTS[idx]; if(!(await sahtenConfirm('¿Quitar la foto de "'+p.name+'"?', { okLabel: 'Quitar', danger: true }))) return;
  await deleteProductImage(p.id); _invalidateImgCache(p.id);
  const thumb=document.getElementById('prod-img-thumb');
  if(thumb){thumb.classList.add('empty');thumb.innerHTML='<div class="prod-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Sin foto</div>';}
  const rm=document.getElementById('prod-img-remove-btn'); if(rm) rm.style.display='none';
  if(typeof renderMostrador==='function') renderMostrador();
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let mostradorCart = [];
let _mostCartFocusCleanup = null;
let mostradorSearch = '';
let mostradorView = 'grid';
try { mostradorView = localStorage.getItem('sahten-pos-view') === 'list' ? 'list' : 'grid'; } catch (e) {}
let mostradorCategory = 'all';
let mostradorTab = 'pedido'; // 'pedido' | 'historial'
let _mostBannerDismissed = false;
function mostradorDismissBanner() {
  _mostBannerDismissed = true;
  const banner = document.querySelector('#panel-mostrador .most-alpha-banner');
  if (banner) banner.hidden = true;
  document.querySelector('#panel-mostrador .most-tab.active')?.focus({preventScroll:true});
}

// Discounts
function _loadDiscounts(){ try{ const r=localStorage.getItem('sahten_mostrador_discounts'); if(r) return JSON.parse(r); }catch(e){} return [{id:'d1',name:'10% off',type:'pct',value:10},{id:'d2',name:'Empleado',type:'pct',value:15},{id:'d3',name:'$500 off',type:'amount',value:500}]; }
function _saveDiscounts(){ localStorage.setItem('sahten_mostrador_discounts',JSON.stringify(MOSTRADOR_DISCOUNTS)); }
let MOSTRADOR_DISCOUNTS = _loadDiscounts();
let mostradorActiveDiscountId = null;
let mostradorShipping = 0;

// Payment methods
function _loadPayments(){ try{ const r=localStorage.getItem('sahten_mostrador_payments'); if(r) return JSON.parse(r); }catch(e){} return []; }
function _savePayments(){ localStorage.setItem('sahten_mostrador_payments',JSON.stringify(MOSTRADOR_PAYMENTS)); }
let MOSTRADOR_PAYMENTS = _loadPayments();
let mostradorActivePaymentId = null;

// Customers
function _loadCustomers(){ try{ const r=localStorage.getItem('sahten_customers'); if(r) return JSON.parse(r); }catch(e){} return []; }
function _saveCustomers(){ localStorage.setItem('sahten_customers',JSON.stringify(SAHTEN_CUSTOMERS)); }
let SAHTEN_CUSTOMERS = _loadCustomers();
window.sahtenCustomers = () => SAHTEN_CUSTOMERS;
let mostradorActiveCustomerId = null; // null = Consumidor Final

// Orders
function _loadOrders(){ try{ const r=localStorage.getItem('sahten_orders'); if(r) return JSON.parse(r); }catch(e){} return []; }
function _saveOrders(){ localStorage.setItem('sahten_orders',JSON.stringify(SAHTEN_ORDERS)); }
let SAHTEN_ORDERS = _loadOrders();
window.sahtenOrders = () => SAHTEN_ORDERS;   // acceso desde src/online (la variable es privada del script)
// v3: tipo de pedido + delivery local
let mostradorOrderType = 'retiro'; // retiro | delivery
let mostradorCashTendered = '';
let mostradorEstimate = '', mostradorEstimateProject = null;
function _mostEstimateValue(){const id=SAHTEN.project.session.id;if(mostradorEstimateProject!==id){mostradorEstimate='';mostradorEstimateProject=id;}return mostradorEstimate;}
function mostradorSetEstimate(value){mostradorEstimateProject=SAHTEN.project.session.id;mostradorEstimate=value;_renderCartTotals();}
function _mostEstimateHtml(){return '<label for="most-estimate-minutes">Tiempo estimado (opcional)</label><div class="most-estimate-field"><input id="most-estimate-minutes" class="most-ship-input" type="number" inputmode="numeric" min="1" max="1440" step="1" placeholder="Minutos" value="'+_esc(_mostEstimateValue())+'" oninput="mostradorSetEstimate(this.value)"><span>'+ (mostradorOrderType==='delivery'?'Hasta la entrega':'Hasta estar listo para retirar')+'</span></div>';}
let mostradorDelivery = null;     // {address, note, lat, lng, distKm, zone, out}
let mostradorShipManual = false;
let _mostDelMap = null, _mostAddrTimer = null, _mostAddrSugs = [], _mostAddrAbort = null, _mostAddrGeneration = 0;
function _nextOrderNum(){ const max = SAHTEN_ORDERS.reduce((m,o)=>Math.max(m,o.num||0),0); return max+1; }

// ═══════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════
function _getProductCategories() {
  const cats = new Set();
  if (typeof PRODUCTS !== 'undefined') PRODUCTS.forEach(p => { if (p.category && !p.recetaOnly) cats.add(p.category); });
  return [...cats].sort();
}

// ═══════════════════════════════════════════════════════════
// RENDER MOSTRADOR — with tabs
// ═══════════════════════════════════════════════════════════
function renderMostrador() {
  mostradorSetCartOpen(false, false);
  const panel = document.getElementById('panel-mostrador');
  if (!panel) return;
  panel.dataset.mostTab = mostradorTab;
  // Always rebuild to ensure tab content is fresh
  panel.innerHTML = `
    <div class="most-heading">
    <div class="most-alpha-banner" ${_mostBannerDismissed?'hidden':''}>
      <div class="most-alpha-icon">ALPHA</div>
      <div class="most-alpha-text"><strong>Mostrador está en modo de prueba.</strong> Sirve para armar pedidos, calcular totales, y llevar historial. Puede tener fallas. Tu feedback ayuda a mejorarlo.</div>
      <button type="button" class="most-alpha-close" aria-label="Ocultar aviso de prueba" onclick="mostradorDismissBanner()">×</button>
    </div>
    <div class="most-tabs">
      <button class="most-tab ${mostradorTab==='pedido'?'active':''}" onclick="mostSetTab('pedido')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Nuevo pedido
      </button>
      <button class="most-tab ${mostradorTab==='historial'?'active':''}" onclick="mostSetTab('historial')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
        Historial <span class="most-tab-badge">${SAHTEN_ORDERS.length}</span>
      </button>
      <button class="most-tab ${mostradorTab==='clientes'?'active':''}" onclick="mostSetTab('clientes')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Clientes <span class="most-tab-badge">${SAHTEN_CUSTOMERS.length}</span>
      </button>
    </div>
    </div>
    <div id="most-tab-content"></div>`;
  if (mostradorTab === 'pedido') _renderPedidoTab();
  else if (mostradorTab === 'historial') _renderHistorialTab();
  else if (mostradorTab === 'clientes') _renderClientesTab();
}
function mostSetTab(t) { mostradorTab = t; _saveTabState('mostrador', t); renderMostrador(); }

// ═══════════════════════════════════════════════════════════
// TAB: NUEVO PEDIDO
// ═══════════════════════════════════════════════════════════
function _renderPedidoTab() {
  const c = document.getElementById('most-tab-content');
  if (!c) return;
  c.innerHTML = `
    <div class="most-layout">
      <div class="panel-content">
        <div class="most-toolbar">
          <div class="most-catalog-tools">
          <div class="most-search-field"><label for="most-search-input">Buscar productos</label><div class="most-search-wrap">
            <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" class="most-search" id="most-search-input" placeholder="Nombre o categoría…" value="${_esc(mostradorSearch)}" oninput="mostradorOnSearch(this.value)">
          </div></div>
          <div class="most-view-switch" role="group" aria-label="Vista de productos">
            <button type="button" data-most-view="grid" aria-pressed="${mostradorView==='grid'}" onclick="mostradorSetView('grid')">▦ Grilla</button>
            <button type="button" data-most-view="list" aria-pressed="${mostradorView==='list'}" onclick="mostradorSetView('list')">☰ Lista</button>
          </div></div>
          <div id="most-result-count" class="most-result-count" role="status" aria-live="polite"></div>
          <div class="most-cats" id="most-cats"></div>
        </div>
        <div class="most-product-grid" id="most-product-grid"></div>
      </div>
      <button type="button" class="most-cart-open" id="most-cart-open" onclick="mostradorSetCartOpen(true)" aria-controls="most-cart" aria-expanded="false"><span>Ver pedido <span id="most-cart-open-count">0</span></span><strong id="most-cart-open-total">$0</strong></button>
      <button type="button" class="most-cart-backdrop" id="most-cart-backdrop" onclick="mostradorSetCartOpen(false)" tabindex="-1" aria-label="Cerrar pedido" hidden></button>
      <section class="most-cart" id="most-cart" role="region" aria-labelledby="most-cart-title" tabindex="-1">
        <div class="most-cart-header">
          <h2 class="most-cart-title" id="most-cart-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Pedido <span class="most-cart-count" id="most-cart-count">0</span>
          </h2>
          <div class="most-cart-actions"><button class="most-cart-clear" onclick="mostradorClearCart()">Vaciar</button><button type="button" class="most-cart-close" onclick="mostradorSetCartOpen(false)" aria-label="Cerrar pedido">×</button></div>
        </div>
        <div class="most-cart-body"><div class="most-cart-items" id="most-cart-items"></div>
        <div class="most-cart-extras" id="most-cart-extras"></div></div>
        <div class="most-cart-totals" id="most-cart-totals"></div>
      </section>
      <span class="sr-only" id="most-cart-announcement" role="status" aria-live="polite"></span>
    </div>`;
  _renderCats();
  _renderMostradorGrid();
  _renderCartExtras();
  _renderCartItems();
  _renderCartTotals();
  _mostSyncCartMode();
}

function _renderCats() {
  const wrap = document.getElementById('most-cats'); if (!wrap) return;
  const cats = _getProductCategories();
  // Los niveles de precio siguen en el proyecto; no son categorías de platos.
  if (mostradorCategory.startsWith('tier:')) mostradorCategory = 'all';
  wrap.innerHTML =
    '<button class="most-cat-chip '+(mostradorCategory==='all'?'active':'')+'" onclick="mostradorSetCategory(\'all\')">Todos</button>' +
    '<button class="most-cat-chip '+(mostradorCategory==='star'?'active':'')+'" onclick="mostradorSetCategory(\'star\')">⭐</button>' +
    cats.map(c => '<button class="most-cat-chip '+(mostradorCategory==='cat:'+c?'active':'')+'" onclick="mostradorSetCategory(\'cat:'+_esc(c)+'\')">' + _esc(c) + '</button>').join('');
}

function _visibleProducts() {
  const q = mostradorSearch.toLowerCase().trim();
  return (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).filter(p => {
    if (p.recetaOnly) return false;
    if (mostradorCategory === 'star' && !p.star) return false;
    if (mostradorCategory.startsWith('cat:') && p.category !== mostradorCategory.slice(4)) return false;
    if (mostradorCategory.startsWith('tier:') && p.tier !== mostradorCategory.slice(5)) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.category||'').toLowerCase().includes(q)) return false;
    return true;
  });
}

// Precio que se cobra en el Mostrador: el mismo que muestra el panel Menú para el canal Mostrador (incluye el descuento del canal o del producto).
function _mostPrice(p) {
  if (typeof channelPriceWithDisc === 'function') { const v = channelPriceWithDisc(p, 'mostrador'); if (v) return v; }
  return (typeof mostradorFinalPrice === 'function') ? mostradorFinalPrice(p) : 0;
}
function _renderMostradorGrid() {
  const grid = document.getElementById('most-product-grid'); if (!grid) return;
  grid.classList.toggle('most-product-list', mostradorView === 'list');
  document.querySelectorAll('[data-most-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mostView === mostradorView)));
  const visible = _visibleProducts();
  const count = document.getElementById('most-result-count');
  if (count) count.textContent = visible.length + (visible.length === 1 ? ' producto' : ' productos');
  if (visible.length === 0) {
    grid.innerHTML = '<div class="most-empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:64px;height:64px;opacity:0.3;margin-bottom:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><div>Sin productos' + (mostradorSearch ? ' para "'+_esc(mostradorSearch)+'"' : '') + '</div></div>';
    return;
  }
  grid.innerHTML = visible.map(p => {
    const paused=SAHTEN.salesAvailability.isPaused(p);
    const price = _mostPrice(p);
    const initial = (p.name||'?').trim().charAt(0).toUpperCase();
    const catBadge = p.category ? '<span class="most-product-cat">'+_esc(p.category)+'</span>' : '';
    return '<div class="most-product '+(paused?'sales-paused':'')+'" data-id="'+p.id+'" onclick="mostradorAddToCart(\''+p.id+'\',this)">' +
      '<div class="most-product-img" id="most-img-'+p.id+'"><span class="most-product-img-placeholder">'+initial+'</span>' +
      (p.star ? '<div class="most-product-star">⭐</div>' : '') +
      catBadge + '</div>' +
      '<div class="most-product-body"><div class="most-product-label"><div class="most-product-name">'+_esc(p.name)+'</div><div class="most-list-category">'+_esc(p.category||'')+'</div></div>' +
      (paused?'<div class="sales-state paused">'+_esc(SAHTEN.salesAvailability.label(p))+'</div>':'')+'<div class="most-product-price">$'+_fmt(price)+SAHTEN.pricing.badge(p,'mostrador')+'</div></div>' +
      '<button '+(paused?'disabled ':'')+'class="most-product-add" aria-label="Agregar '+_esc(p.name)+' al pedido" onclick="event.stopPropagation();mostradorAddToCart(\''+p.id+'\',this.parentNode)">+</button></div>';
  }).join('');
  visible.forEach(async p => {
    const data = await getProductImageCached(p.id);
    if (!data) return;
    const slot = document.getElementById('most-img-' + p.id);
    if (slot) { const catBadge = p.category ? '<span class="most-product-cat">'+_esc(p.category)+'</span>' : ''; slot.innerHTML = '<img src="'+data+'" alt="">'+(p.star?'<div class="most-product-star">⭐</div>':'')+catBadge; }
  });
}

function mostradorSetView(view) {
  mostradorView = view === 'list' ? 'list' : 'grid';
  try { localStorage.setItem('sahten-pos-view', mostradorView); } catch (e) {}
  _renderMostradorGrid();
}
function mostradorOnSearch(v) { mostradorSearch = v; _renderMostradorGrid(); }
function mostradorSetCategory(cat) { mostradorCategory = cat; _renderCats(); _renderMostradorGrid(); }

// ═══════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════
function mostradorAddToCart(pid, cardEl) {
  const p=PRODUCTS.find(p=>p.id===pid);if(!p||p.recetaOnly||SAHTEN.salesAvailability.isPaused(p)){sahtenToast('Este producto no está disponible para vender.');return;}
  const ex = mostradorCart.find(it => it.productId === pid);
  if (ex) ex.qty++; else mostradorCart.push({ productId: pid, qty: 1 });
  _renderCartItems(); _renderCartTotals();
  if (cardEl) { cardEl.classList.remove('added'); void cardEl.offsetWidth; cardEl.classList.add('added'); }
  const status = document.getElementById('most-cart-announcement');
  if (status) status.textContent = 'Producto agregado. '+_cartItemsWithPrice().reduce((s,it)=>s+it.qty,0)+' en el pedido.';
}
function mostradorRemoveItem(pid) { mostradorCart = mostradorCart.filter(it=>it.productId!==pid); _renderCartItems(); _renderCartTotals(); }
function mostradorChangeQty(pid, delta) { const p=PRODUCTS.find(p=>p.id===pid);if(delta>0&&(!p||p.recetaOnly||SAHTEN.salesAvailability.isPaused(p)))return;const it=mostradorCart.find(x=>x.productId===pid); if(!it) return; it.qty+=delta; if(it.qty<=0) mostradorRemoveItem(pid); else { _renderCartItems(); _renderCartTotals(); } }
function mostradorClearCart() { if(!mostradorCart.length) return; SAHTEN.customerPicker.reset();mostradorCashTendered='';mostradorEstimate='';mostradorCart=[]; mostradorActiveDiscountId=null; mostradorActiveCustomerId=null; mostradorShipping=0; mostradorShipManual=false; mostradorDelivery=null; mostradorOrderType='retiro'; _renderCartExtras(); _renderCartItems(); _renderCartExtras(); _renderCartTotals(); }
function mostradorToggleCart() { const c=document.getElementById('most-cart'); if(c) mostradorSetCartOpen(!c.classList.contains('expanded')); }
function _mostCartIsOverlay() { return document.documentElement.dataset.orderLayout === 'overlay'; }
function mostradorSetCartOpen(open, restoreFocus=true) {
  const cart=document.getElementById('most-cart'), trigger=document.getElementById('most-cart-open');
  if (!cart) return;
  open=!!open && _mostCartIsOverlay();
  if (!open && _mostCartFocusCleanup) { _mostCartFocusCleanup({restoreFocus}); _mostCartFocusCleanup=null; }
  cart.classList.toggle('expanded',open);
  cart.inert=_mostCartIsOverlay()&&!open;
  cart.setAttribute('aria-hidden',String(cart.inert));
  cart.setAttribute('role',open?'dialog':'region');
  if(open) cart.setAttribute('aria-modal','true'); else cart.removeAttribute('aria-modal');
  trigger?.setAttribute('aria-expanded',String(open));
  const backdrop=document.getElementById('most-cart-backdrop'); if(backdrop) backdrop.hidden=!open;
  if (open && !_mostCartFocusCleanup) _mostCartFocusCleanup=SAHTEN.bindModalFocus({panel:cart,trigger,background:[document.querySelector('.most-heading'),document.querySelector('.topbar'),document.querySelector('.sidebar'),document.getElementById('bottom-nav'),document.querySelector('#most-tab-content .panel-content')],close:()=>mostradorSetCartOpen(false)});
}
function _mostSyncCartMode() {
  const c=document.getElementById('most-cart'); if(c) mostradorSetCartOpen(c.classList.contains('expanded'),false);
}
window.addEventListener('sahten:layout',_mostSyncCartMode);

function _cartItemsWithPrice() {
  return mostradorCart.map(it => { const p=(typeof PRODUCTS!=='undefined'?PRODUCTS:[]).find(x=>x.id===it.productId); if(!p) return null; const price=_mostPrice(p); return {product:p,qty:it.qty,unitPrice:price,lineTotal:price*it.qty}; }).filter(Boolean);
}
function _calcCartTotals() {
  const items=_cartItemsWithPrice(); const subtotal=items.reduce((s,it)=>s+it.lineTotal,0);
  const manual=MOSTRADOR_DISCOUNTS.find(d=>d.id===mostradorActiveDiscountId);
  const benefit=SAHTEN.paymentChoices.quote(subtotal,_mostSelectedPayment()?.method,_mostTiendaCfg().paymentBenefit,'mostrador',manual);
  const discount=benefit.amount, disc=discount?{name:benefit.label}:null;
  let shipping=0, freeShip=false, deliveryQuote=null;
  if(mostradorOrderType==='delivery'){
    const cfg=_mostTiendaCfg();
    if(cfg.deliveryEnabled===false||cfg.deliveryV2?.active){deliveryQuote=SAHTEN.core.shippingFor(cfg,mostradorDelivery?.lat,mostradorDelivery?.lng,subtotal-discount,{route:mostradorDelivery?.route,authorization:mostradorDelivery?.authorization,now:Date.now()+(mostradorDelivery?.serverOffset||0),hasPaymentDiscount:!!benefit.paymentDiscount});shipping=deliveryQuote.cost;freeShip=deliveryQuote.free;}
    else if(mostradorShipManual) shipping=Math.max(0,mostradorShipping||0);
    else if(mostradorDelivery && mostradorDelivery.zone){ const cfg=_mostTiendaCfg(); freeShip=!!(cfg.freeShippingMin && (subtotal-(benefit.paymentDiscount?0:discount))>=cfg.freeShippingMin); shipping=freeShip?0:(mostradorDelivery.zone.baseCost||0); }
  }
  const total=Math.round((subtotal-discount+shipping)*100)/100;
  return {items,subtotal,discount,shipping,total,disc,freeShip,paymentDiscount:benefit.paymentDiscount,deliveryQuote};
}

function _mostPaymentOptions() {
  const labels={efectivo:'Efectivo',transferencia:'Transferencia',mercadopago:'Mercado Pago',tarjeta:'Tarjeta'};
  const normalize=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const options=MOSTRADOR_PAYMENTS.map(p=>({id:p.id,label:p.name,method:p.method||({efectivo:'efectivo',transferencia:'transferencia','mercado pago':'mercadopago',mercadopago:'mercadopago',tarjeta:'tarjeta'})[normalize(p.name)]||'other'}));
  Object.entries(_mostTiendaCfg().paymentMethods||{efectivo:true}).forEach(([method,enabled])=>{if(enabled&&!options.some(o=>o.method===method))options.push({id:'standard:'+method,method,label:labels[method]||method});});
  const priority={efectivo:0,transferencia:1,mercadopago:2,tarjeta:3,qr:4,other:5};
  return options.sort((a,b)=>(priority[a.method]??5)-(priority[b.method]??5));
}
function _mostSelectedPayment(){return _mostPaymentOptions().find(p=>p.id===mostradorActivePaymentId);}
function mostradorSetPayment(id){mostradorActivePaymentId=id||null;if(_mostSelectedPayment()?.method!=='efectivo')mostradorCashTendered='';_renderCartExtras();_renderCartTotals();const b=[...document.querySelectorAll('#most-cart-extras [data-payment-choice]')].find(b=>b.dataset.paymentChoice===id);b?.focus({preventScroll:true});}

function _renderCartItems() {
  const focused=document.activeElement, pid=focused?.dataset.productId, action=focused?.dataset.cartAction;
  const t = _calcCartTotals();
  const cb = document.getElementById('most-cart-count'); if(cb) cb.textContent = t.items.reduce((s,it)=>s+it.qty,0);
  const list = document.getElementById('most-cart-items'); if(!list) return;
  if (t.items.length === 0) {
    list.innerHTML = '<div class="most-cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3;margin:0 auto 12px;display:block"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Tocá un producto para agregarlo</div>';
  } else {
    list.innerHTML = t.items.map(it => '<div class="most-cart-item"><div><div class="most-cart-item-name">'+_esc(it.product.name)+'</div><div class="most-cart-item-controls"><button class="most-cart-qty-btn" data-product-id="'+_esc(it.product.id)+'" data-cart-action="decrease" aria-label="Quitar una unidad de '+_esc(it.product.name)+'" onclick="mostradorChangeQty(\''+it.product.id+'\', -1)">−</button><span class="most-cart-qty">'+it.qty+'</span><button class="most-cart-qty-btn" data-product-id="'+_esc(it.product.id)+'" data-cart-action="increase" aria-label="Agregar una unidad de '+_esc(it.product.name)+'" onclick="mostradorChangeQty(\''+it.product.id+'\', 1)">+</button><button class="most-cart-item-remove" data-product-id="'+_esc(it.product.id)+'" data-cart-action="remove" aria-label="Quitar '+_esc(it.product.name)+' del pedido" onclick="mostradorRemoveItem(\''+it.product.id+'\')">×</button></div></div><div class="most-cart-item-price">$'+_fmt(it.lineTotal)+'</div></div>').join('');
  }
  if(pid && action) ([...list.querySelectorAll('[data-cart-action]')].find(el=>el.dataset.productId===pid&&el.dataset.cartAction===action)||list.querySelector('button')||document.querySelector('.most-cart-close'))?.focus({preventScroll:true});
}

// Extras (selectors) — rendered once, NOT on every keystroke
function _renderCartExtras() {
  const f = document.getElementById('most-cart-extras'); if(!f) return;
  if (_mostDelMap) { try { _mostDelMap.remove(); } catch(e) {} _mostDelMap = null; }
  const discOpts = MOSTRADOR_DISCOUNTS.map(d => { const l=d.type==='pct'?d.name+' ('+d.value+'%)':d.name+' (-$'+_fmt(d.value)+')'; return '<option value="'+d.id+'" '+(d.id===mostradorActiveDiscountId?'selected':'')+'>'+_esc(l)+'</option>'; }).join('');
  const payPolicy=SAHTEN.paymentChoices.policy(_mostTiendaCfg().paymentBenefit);
  f.innerHTML = '<div class="most-extras">' +
    '<div id="most-opening-hours-notice">'+SAHTEN.delivery.hours.posNotice()+'</div>' +
    '<div id="most-customer-picker" class="most-customer-picker"></div>' +
    '<div class="most-extras-row"><label for="most-discount">Descuento</label><select id="most-discount" class="most-disc-select" onchange="mostradorSetDiscount(this.value)"><option value="">Sin descuento</option>'+discOpts+'</select><button class="most-add-btn" onclick="openDiscountManager()" title="Gestionar descuentos">+</button></div>' +
    _mostDeliveryExtrasHtml() + _mostEstimateHtml() +
    SAHTEN.paymentChoices.html({methods:_mostPaymentOptions(),selected:mostradorActivePaymentId,percent:payPolicy.enabled&&payPolicy.channels.mostrador?payPolicy.percent:0,compact:true})+_mostCashHtml()+'<button class="btn" type="button" onclick="openPaymentManager()">Gestionar métodos de pago</button>' +
    '</div>';
  SAHTEN.customerPicker.mount(f.querySelector('#most-customer-picker'),{list:()=>SAHTEN_CUSTOMERS,selected:()=>mostradorActiveCustomerId,select:id=>{mostradorActiveCustomerId=id;_renderCartTotals();},create:seed=>mostQuickAddClient(seed)});
  f.querySelectorAll('[data-payment-choice]').forEach(b=>b.addEventListener('click',()=>mostradorSetPayment(b.dataset.paymentChoice)));
  if (mostradorOrderType==='delivery' && mostradorDelivery && mostradorDelivery.lat!=null) setTimeout(_mostInitDelMap, 30);
}

// Totals — lightweight, called on every change
function _mostCashHtml(){return _mostSelectedPayment()?.method==='efectivo'?'<label for="most-cash-tendered">Con cuánto paga (opcional)</label><input id="most-cash-tendered" class="most-ship-input" type="number" inputmode="decimal" min="0" max="100000000" step="0.01" value="'+_esc(mostradorCashTendered)+'" oninput="mostradorSetCash(this.value)"><p id="most-cash-change" role="status"></p>':'';}
function mostradorSetCash(value){mostradorCashTendered=value;_renderCartTotals();}
function _mostDeliveryField(key,value){mostradorDelivery ||= {address:'',note:'',lat:null,lng:null,zone:null};mostradorDelivery[key]=value;}
function _renderCartTotals() {
  const f = document.getElementById('most-cart-totals'); if(!f) return;
  const t = _calcCartTotals();
  const count=document.getElementById('most-cart-open-count'), total=document.getElementById('most-cart-open-total');
  if(count) count.textContent=t.items.reduce((s,it)=>s+it.qty,0);
  if(total) total.textContent='$'+_fmt(t.total);
  const cash=SAHTEN.orderDetails.cashChangeQuote(t.total,mostradorCashTendered,_mostSelectedPayment()?.method);
  const cashStatus=document.getElementById('most-cash-change');if(cashStatus){cashStatus.textContent=!cash.specified?'Sin importe indicado':cash.valid?'Vuelto: $'+_fmt(cash.change):cash.shortfall?'Faltan $'+_fmt(cash.shortfall):'Revisá el importe';cashStatus.style.color=cash.valid?'var(--green)':'var(--red)';}
  const totalsHtml =
    '<div class="most-cart-row"><span>Subtotal</span><span class="val">$'+_fmt(t.subtotal)+'</span></div>' +
    (t.discount > 0 ? '<div class="most-cart-row discount"><span>'+_esc(t.disc?.name||'Descuento')+'</span><span class="val">−$'+_fmt(t.discount)+'</span></div>' : '') +
    (t.shipping > 0 ? '<div class="most-cart-row"><span>Envío</span><span class="val">$'+_fmt(t.shipping)+'</span></div>' : (t.freeShip ? '<div class="most-cart-row"><span>Envío</span><span class="val" style="color:var(--green)">Gratis</span></div>' : '')) +
    '<div class="most-cart-row total"><span>Total</span><span class="val">$'+_fmt(t.total)+'</span></div>' +
    '<button class="most-checkout" '+(t.items.length===0||!cash.valid||(t.deliveryQuote&&!t.deliveryQuote.ok)||mostradorDelivery?.routeLoading?'disabled':'')+' onclick="mostradorCheckout()">Cobrar · $'+_fmt(t.total)+'</button>';
  if(f._totalsMarkup!==totalsHtml){f.innerHTML=totalsHtml;f._totalsMarkup=totalsHtml;}
  const incentive=document.getElementById('most-delivery-incentive');
  if(incentive){const html=SAHTEN.delivery.incentive(mostradorDelivery?.routeLoading?{status:'loading'}:t.deliveryQuote,{pos:true})+(mostradorDelivery?.routeError?'<p role="status">'+_esc(mostradorDelivery.routeError)+'</p><button class="btn" onclick="SAHTEN.delivery.refreshPos()">Reintentar ruta</button>':'')+(t.deliveryQuote?.status==='authorization_required'&&(!document.body.dataset.role||['owner','admin'].includes(document.body.dataset.role))?'<button class="btn" onclick="SAHTEN.delivery.authorizePos()">Autorizar esta entrega</button>':'');if(incentive._deliveryMarkup!==html){const open=incentive.querySelector('details')?.open;incentive.innerHTML=html;incentive._deliveryMarkup=html;if(open&&incentive.querySelector('details'))incentive.querySelector('details').open=true;}}
}

function mostradorSetDiscount(id) { mostradorActiveDiscountId = id || null; _renderCartTotals(); }
function mostradorSetShipping(v) { if(_mostTiendaCfg().deliveryV2?.active)return; if (v === '' || v == null) { mostradorShipManual = false; mostradorShipping = 0; } else { mostradorShipManual = true; mostradorShipping = parseFloat(v) || 0; } _renderCartTotals(); }

// ═══════════════════════════════════════════════════════════
// DELIVERY LOCAL (v3) — dirección con sugerencias + zonas de envío
// ═══════════════════════════════════════════════════════════
function _mostTiendaCfg(){ try { return (typeof _getTiendaConfig==='function') ? _getTiendaConfig() : {}; } catch(e){ return {}; } }
function _mostZoneFor(lat,lng){const cfg=_mostTiendaCfg();if(cfg.deliveryV2?.active){const p=cfg.deliveryV2,zone=p.zones.find(z=>SAHTEN.core.zoneContains(p.center,z,{lat,lng}));return {zone,distKm:SAHTEN.core.haversineKm(p.center.lat,p.center.lng,lat,lng),out:!zone};} return SAHTEN.core.zoneFor(cfg,lat,lng); }
function _mostShortAddr(d){ const a=d.address||{}; const street=[a.road||a.pedestrian||a.footway, a.house_number].filter(Boolean).join(' '); const area=a.suburb||a.neighbourhood||a.city_district||a.town||a.city||a.village||''; return [street||(d.display_name||'').split(',').slice(0,2).join(','), area].filter(Boolean).join(', '); }
function mostradorSetOrderType(t){ mostradorOrderType=t; if(t!=='delivery'){ mostradorShipManual=false; mostradorShipping=0; } _renderCartExtras(); _renderCartTotals(); if(t==='delivery' && !mostradorDelivery) setTimeout(()=>document.getElementById('most-addr-input')?.focus(),50); }
function _mostDeliveryExtrasHtml(){
  const seg=['retiro','delivery'].map(k=>'<button type="button" onclick="mostradorSetOrderType(\''+k+'\')" style="flex:1;padding:6px 4px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;background:'+(mostradorOrderType===k?'var(--accent)':'transparent')+';color:'+(mostradorOrderType===k?'var(--on-accent)':'var(--ink)')+'">'+({retiro:'🛍️ Retiro',delivery:'🛵 Delivery'})[k]+'</button>').join('');
  let h='<div class="most-extras-row"><label>Tipo</label><div style="flex:1;display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--sand2)">'+seg+'</div></div>';
  if(mostradorOrderType!=='delivery') return h;
  const d=mostradorDelivery; const cfg=_mostTiendaCfg(); const t=_calcCartTotals();
  if(cfg.deliveryEnabled===false)return h+'<div class="info-banner" role="status">Delivery pausado. Podés tomar pedidos de retiro en local.</div>';
  if(cfg.deliveryV2?.active) h+='<div id="most-delivery-incentive"></div>';
  else h+='<div id="most-delivery-hours-notice">'+(!SAHTEN.delivery.hours.deliveryStatus().open?'<div class="info-banner" role="status">'+_esc(SAHTEN.delivery.hours.deliveryNotice())+'</div>':'')+'</div>';
  let info='';
  if(typeof sahtenOfflineNotice==='function') info+=sahtenOfflineNotice();
  if(d && d.zone){ info='<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-top:6px;flex-wrap:wrap"><span style="width:9px;height:9px;border-radius:50%;background:'+(d.zone.color||'var(--green)')+'"></span><strong>'+_esc(d.zone.name)+'</strong><span style="color:var(--muted)">· '+d.distKm.toFixed(1)+' km · '+(t.freeShip?'<span style="color:var(--green);font-weight:600">Envío gratis</span>':'$'+_fmt(d.zone.baseCost||0))+'</span></div>'; }
  else if(d && d.out){ info='<div style="font-size:11px;margin-top:6px;color:var(--red);font-weight:600">Fuera de las zonas de envío ('+d.distKm.toFixed(1)+' km). Cargá el envío a mano.</div>'; }
  if(d && cfg.deliveryMinOrder && t.subtotal < cfg.deliveryMinOrder) info+='<div style="font-size:11px;margin-top:4px;color:var(--accent)">Pedido mínimo para delivery: $'+_fmt(cfg.deliveryMinOrder)+'</div>';
  h+='<div style="padding:4px 0 6px">' +
    '<div style="position:relative"><input type="text" id="most-addr-input" aria-label="Dirección de entrega" autocomplete="off" placeholder="Dirección de entrega…" value="'+_esc(d?d.address:'')+'" oninput="_mostAddrInput(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_mostPickSug(0);}" onblur="setTimeout(()=>{const b=document.getElementById(\'most-addr-sugs\');if(b)b.style.display=\'none\';},200)" style="width:100%;border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;background:var(--card,#fff);color:var(--ink);outline:none">' +
    '<div id="most-addr-sugs" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:40;background:var(--card,#fff);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden"></div></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'+['addressFloor','addressApartment'].map((key,i)=>'<label style="min-width:0">'+(i?'Departamento':'Piso')+'<input class="custom-input" style="width:100%" aria-label="'+(i?'Departamento':'Piso')+'" maxlength="30" value="'+_esc(d?.[key]||'')+'" oninput="_mostDeliveryField(\''+key+'\',this.value)"></label>').join('')+'</div><label>Referencia de entrega<input class="custom-input" aria-label="Referencia de entrega" maxlength="200" value="'+_esc(d?.deliveryReference||'')+'" oninput="_mostDeliveryField(\'deliveryReference\',this.value)"></label><label>Notas del pedido<input class="custom-input" aria-label="Notas del pedido" maxlength="1000" value="'+_esc(d?.note||'')+'" oninput="_mostDeliveryField(\'note\',this.value)"></label>' +
    '<button class="btn" id="most-addr-retry" type="button" hidden style="display:none" onclick="_mostAddrInput(document.getElementById(\'most-addr-input\').value,true)">Buscar de otra forma</button>'+(cfg.deliveryV2?.active?'':info) +
    (d&&d.lat!=null?'<div id="most-del-map" style="height:150px;border-radius:10px;overflow:hidden;margin-top:8px;border:1px solid var(--border);position:relative;z-index:1"></div><div style="font-size:10px;color:var(--muted);margin-top:3px">'+(cfg.deliveryV2?.active?'La ubicación corresponde a la dirección elegida en Buscar dirección.':'Podés mover el pin para ajustar la ubicación.')+'</div>':'') +
    '</div>' +
    (cfg.deliveryV2?.active?'':'<div class="most-extras-row"><label for="most-ship-val">Envío</label><input type="number" class="most-ship-input" id="most-ship-val" min="0" step="1" placeholder="'+(t.shipping||t.freeShip?'Auto: $'+_fmt(t.shipping):'0')+'" value="'+(mostradorShipManual?(mostradorShipping||0):'')+'" oninput="mostradorSetShipping(this.value)"></div>');
  return h;
}
function _mostAddressFallback(visible){const b=document.getElementById('most-addr-retry');if(b){b.hidden=!visible;b.style.display=visible?'inline-flex':'none';}}
function _mostAddrInput(v,explicit=false){
  clearTimeout(_mostAddrTimer);
  if(_mostAddrAbort)_mostAddrAbort.abort();_mostAddrAbort=new AbortController();
  const signal=_mostAddrAbort.signal,generation=++_mostAddrGeneration,project=SAHTEN.project?.session.id;
  // Una dirección editada nunca conserva la ubicación ni la tarifa automática de la anterior.
  mostradorDelivery={...SAHTEN.orderDetails.deliveryDetails(mostradorDelivery,'delivery'),address:String(v||'').trim(),note:mostradorDelivery?.note||'',lat:null,lng:null,zone:null};
  _mostAddrSugs=[];
  _renderCartTotals();
  _mostAddressFallback(false);
  const shipping=document.getElementById('most-ship-val'); if(shipping&&!mostradorShipManual) shipping.placeholder='Indicá el envío manual';
  const box=document.getElementById('most-addr-sugs');
  if(box) box.style.display='none';
  if(!v || v.trim().length<4){ if(box) box.style.display='none'; return; }
  if(!explicit&&!/\d/.test(v))return;
  if(box){box.innerHTML='<div role="status" style="padding:10px 12px;font-size:12px">Buscando dirección…</div>';box.style.display='block';}
  _mostAddrTimer=setTimeout(async()=>{
    const cfg=_mostTiendaCfg(); const lat=cfg.lat||-34.6037, lng=cfg.lng||-58.3816;
    const vb=[lng-0.3,lat+0.3,lng+0.3,lat-0.3].join(',');
    try{
      const data=!explicit?await SAHTEN.delivery.client.suggest(v,cfg.deliveryV2?.center||{lat,lng},{signal}):cfg.deliveryV2?.active?await SAHTEN.delivery.client.geocode(v):await (await fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ar&accept-language=es&viewbox='+vb+'&q='+encodeURIComponent(v))).json();
      if(generation!==_mostAddrGeneration||project!==SAHTEN.project?.session.id||document.getElementById('most-addr-input')?.value!==v) return;
      _mostAddrSugs=(data||[]).map(x=>({label:_mostShortAddr(x),full:x.display_name,lat:+x.lat,lng:+x.lon}));
      const b=document.getElementById('most-addr-sugs'); if(!b) return;
      if(!_mostAddrSugs.length){ b.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Agregá la localidad o probá otra búsqueda.</div>'; b.style.display='block'; _mostAddressFallback(true); return; }
      b.innerHTML=_mostAddrSugs.map((s,i)=>{ const z=_mostZoneFor(s.lat,s.lng); return '<div onmousedown="_mostPickSug('+i+')" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:8px;align-items:center" onmouseover="this.style.background=\'var(--sand)\'" onmouseout="this.style.background=\'\'"><div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(s.label)+'</div><div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(s.full)+'</div></div><div style="font-size:11px;font-weight:600;white-space:nowrap;color:'+(z.zone?'var(--green)':'var(--red)')+'">'+(z.zone?'$'+_fmt(z.zone.baseCost||0):'Fuera')+'</div></div>'; }).join('');
      b.style.display='block';
      if(data.some(x=>x.provider==='georef'))b.innerHTML+='<div style="padding:5px 12px;font-size:10px;color:var(--muted)">Direcciones: Georef · Revisá calle, altura y localidad.</div>';
    }catch(e){if(e.name==='AbortError'||generation!==_mostAddrGeneration||project!==SAHTEN.project?.session.id)return;_mostAddressFallback(true);const b=document.getElementById('most-addr-sugs'); if(b){ b.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--muted)">'+_esc(e.message||'No se pudo buscar la dirección. Reintentá o elegí retiro.')+'</div>'; b.style.display='block'; } }
  },explicit?0:350);
}
function _mostSetDeliveryPoint(lat,lng,address){
  const z=_mostZoneFor(lat,lng);
  mostradorDelivery={ ...SAHTEN.orderDetails.deliveryDetails(mostradorDelivery,'delivery'), address: address!=null?address:(mostradorDelivery?mostradorDelivery.address:''), note: mostradorDelivery?mostradorDelivery.note:'', lat, lng, distKm:z.distKm, zone:z.zone, out:!!z.out };
  mostradorShipManual=false;
  if(_mostTiendaCfg().deliveryV2?.active)SAHTEN.delivery.refreshPos();
}
window.mostradorDeliveryValue=()=>mostradorDelivery;
function _mostDeliveryRequest(){const t=_calcCartTotals(),p=_mostSelectedPayment()||_mostPaymentOptions()[0];return {...SAHTEN.orderDetails.deliveryDetails(mostradorDelivery,'delivery'),cashTendered:mostradorCashTendered,notes:mostradorDelivery?.note||'',source:'delivery',items:t.items.map(it=>({productId:it.product.id,qty:it.qty})),lat:mostradorDelivery?.lat,lng:mostradorDelivery?.lng,address:mostradorDelivery?.address||'',customerName:SAHTEN_CUSTOMERS.find(c=>c.id===mostradorActiveCustomerId)?.name||'Consumidor Final',customerPhone:SAHTEN_CUSTOMERS.find(c=>c.id===mostradorActiveCustomerId)?.phone||'',paymentMethod:p?.method||'efectivo',total:t.total,deliveryQuoteId:mostradorDelivery?.quoteId,manualDiscountId:mostradorActiveDiscountId};}
function _mostPickSug(i){ const s=_mostAddrSugs[i]; if(!s) return; _mostSetDeliveryPoint(s.lat,s.lng,s.label); _renderCartExtras(); _renderCartTotals(); }
function _mostInitDelMap(){
  const el=document.getElementById('most-del-map'); if(!el||!mostradorDelivery) return;
  const go=()=>{
    const el2=document.getElementById('most-del-map'); if(!el2||!window.L) return;
    if(_mostDelMap){ try{_mostDelMap.remove();}catch(e){} _mostDelMap=null; }
    const cfg=_mostTiendaCfg(),modern=cfg.deliveryV2?.active,center=modern?cfg.deliveryV2.center:cfg; const sLat=center.lat??-34.6037, sLng=center.lng??-58.3816; const d=mostradorDelivery;
    _mostDelMap=L.map(el2,{zoomControl:false,attributionControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(_mostDelMap);
    if(modern)[...cfg.deliveryV2.zones].sort((a,b)=>b.radiusKm-a.radiusKm).forEach(z=>L.polygon(SAHTEN.delivery.rings(center,z),{color:z.color,weight:1,fillOpacity:z.enabled ? 0.08 : 0.02}).addTo(_mostDelMap));
    else (cfg.zones||[]).forEach(z=>{ const st={color:z.color||'#4CAF50',weight:1,fillOpacity:0.08}; if(z.type==='polygon'&&(z.points||[]).length>=3) L.polygon(z.points,st).addTo(_mostDelMap); else if(z.radiusKm) L.circle([sLat,sLng],{...st,radius:z.radiusKm*1000}).addTo(_mostDelMap); });
    const storeIcon=L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;background:#235328;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg></div>',iconSize:[22,22],iconAnchor:[11,11]});
    const pinIcon=L.divIcon({className:'',html:'<svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));display:block"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.4 15 39 15 39s14-13.6 14-24.1C29 7.2 22.7 1 15 1z" fill="#F28C00" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>',iconSize:[30,40],iconAnchor:[15,39]});
    L.marker([sLat,sLng],{icon:storeIcon,interactive:false}).addTo(_mostDelMap);
    const mk=L.marker([d.lat,d.lng],{draggable:!modern,icon:pinIcon}).addTo(_mostDelMap);
    const moveTo=async(ll)=>{ _mostSetDeliveryPoint(ll.lat,ll.lng,null); try{ const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=es&lat='+ll.lat+'&lon='+ll.lng); const j=await r.json(); if(j) mostradorDelivery.address=_mostShortAddr(j); }catch(e){} _renderCartExtras(); _renderCartTotals(); };
    if(!modern){mk.on('dragend',()=>moveTo(mk.getLatLng()));_mostDelMap.on('click',e=>moveTo(e.latlng));}
    _mostDelMap.fitBounds(L.latLngBounds([[sLat,sLng],[d.lat,d.lng]]).pad(0.35));
    setTimeout(()=>_mostDelMap&&_mostDelMap.invalidateSize(),150);
  };
  if(window.L) go(); else if(typeof _loadLeaflet==='function') _loadLeaflet(go);
}

// ═══════════════════════════════════════════════════════════
// CHECKOUT → CREATE ORDER
// ═══════════════════════════════════════════════════════════
let _deliveryChecking=false;
async function mostradorCheckout() {
  if(_deliveryChecking)return;
  const t = _calcCartTotals(); if (t.items.length === 0) return;
  if(!SAHTEN.customerPicker.valid())return;
  if(mostradorCart.some(it=>{const p=PRODUCTS.find(p=>p.id===it.productId);return !p||p.recetaOnly||SAHTEN.salesAvailability.isPaused(p);})){alert('Hay productos internos o no disponibles en el pedido. Quitalos antes de confirmar.');return;}
  if(!SAHTEN.orderDetails.cashChangeQuote(t.total,mostradorCashTendered,_mostSelectedPayment()?.method).valid){alert('El efectivo indicado no alcanza el total.');return;}
  if(_mostEstimateValue()!==''&&!SAHTEN.orderActions.minutes(_mostEstimateValue())){alert('Indicá un tiempo estimado de 1 a 1440 minutos, sin decimales.');return;}
  const localOrderId='ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  let deliverySnapshot=null,deliveryValidationId=null,validatedItems=null;
  if(mostradorOrderType==='delivery'&&_mostTiendaCfg().deliveryEnabled===false){alert('El delivery está pausado. Reactivalo en Ajustes › Negocio › Horarios y delivery o elegí retiro.');return;}
  if(mostradorOrderType==='delivery'&&!SAHTEN.delivery.hours.deliveryStatus().open){alert(SAHTEN.delivery.hours.deliveryNotice());return;}
  if(_mostTiendaCfg().deliveryV2?.active&&mostradorOrderType==='delivery'){
    if(!_mostSelectedPayment()){alert('Elegí un medio de pago antes de confirmar el delivery.');return;}
    const fingerprint=JSON.stringify(_mostDeliveryRequest());_deliveryChecking=true;
    try{const result=await SAHTEN.delivery.client.validate({..._mostDeliveryRequest(),localOrderId});if(fingerprint!==JSON.stringify(_mostDeliveryRequest())){alert('El pedido cambió durante la validación. Revisá el total y volvé a confirmar.');return;}deliverySnapshot=result.order.deliverySnapshot;deliveryValidationId=result.validationId;validatedItems=result.order.items;}
    catch(e){alert(e.message);return;}finally{_deliveryChecking=false;}
  }
  const benefitPolicy=SAHTEN.paymentChoices.policy(_mostTiendaCfg().paymentBenefit);
  if(benefitPolicy.enabled&&benefitPolicy.channels.mostrador&&!_mostSelectedPayment()){alert('Elegí cómo se paga para calcular el descuento correcto.');document.querySelector('#most-cart-extras [data-payment-choice]')?.focus();return;}
  if (mostradorOrderType === 'delivery' && !(mostradorDelivery && mostradorDelivery.address)) { alert('Cargá la dirección de entrega para el delivery.'); document.getElementById('most-addr-input')?.focus(); return; }
  if (mostradorOrderType === 'delivery' && !_mostTiendaCfg().deliveryV2?.active && !mostradorDelivery.zone && !mostradorShipManual) { alert('Seleccioná una dirección sugerida o indicá el envío manual (0 si es gratis).'); document.getElementById('most-ship-val')?.focus(); return; }
  const pay = _mostSelectedPayment();
  const cust = SAHTEN_CUSTOMERS.find(c => c.id === mostradorActiveCustomerId);
  const del = mostradorOrderType === 'delivery' ? mostradorDelivery : null;
  const order = {
    ...(del?SAHTEN.orderDetails.deliveryDetails(del,'delivery'):{}),
    ...SAHTEN.orderDetails.cashOrderFields(t.total,mostradorCashTendered,pay?.method),
    ...(_mostEstimateValue()!==''?{fulfillmentEstimate:SAHTEN.orderActions.snapshot(_mostEstimateValue())}:{}),
    id: localOrderId,
    num: _nextOrderNum(),
    items: validatedItems || t.items.map(it => ({ productId: it.product.id, name: it.product.name, qty: it.qty, unitPrice: it.unitPrice, lineTotal: it.lineTotal, ...(SAHTEN.pricing.quoteIds(it.product).mostrador ? { priceRevision: SAHTEN.pricing.quoteIds(it.product).mostrador } : {}) })),
    customerId: mostradorActiveCustomerId || null,
    customerName: cust ? cust.name : 'Consumidor Final',
    customerPhone: cust ? cust.phone || '' : '',
    origin: 'mostrador',
    discountId: t.paymentDiscount ? 'cash-transfer' : mostradorActiveDiscountId || null,
    discountName: t.disc ? t.disc.name : null,
    discountAmount: t.discount,
    discount: t.discount,
    paymentDiscount: t.paymentDiscount,
    shipping: t.shipping,
    ...(deliverySnapshot?{deliverySnapshot,deliveryValidationId}:{}),
    paymentId: mostradorActivePaymentId || null,
    paymentName: pay ? pay.label : null,
    paymentMethod: pay ? pay.method : null,
    ...(pay?.method==='mercadopago'?{paymentStatus:'unverified',paymentStatusLabel:'Sin pago verificado'}:{}),
    subtotal: t.subtotal,
    total: t.total,
    status: 'pendiente', // pendiente | en_preparacion | listo
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: del && del.note ? del.note : '',
    orderType: mostradorOrderType,
    ...(del ? { source: 'delivery', address: del.address, lat: del.lat, lng: del.lng, distKm: del.distKm, deliveryZone: deliverySnapshot?.effectiveZone?.name || (del.zone ? del.zone.name : null) } : {}),
  };
  SAHTEN.pricing?.capture(order);
  SAHTEN_ORDERS.unshift(order); _saveOrders();
  SAHTEN.receipts.enqueue(order,{origin:'local'});
  // Reset cart
  mostradorCashTendered=''; mostradorEstimate=''; mostradorCart = []; mostradorActiveDiscountId = null; mostradorActiveCustomerId = null; mostradorActivePaymentId = null; mostradorShipping = 0;
  mostradorShipManual = false; mostradorDelivery = null; mostradorOrderType = 'retiro';
  // El pedido creado entra en la misma cola operativa que los de la web.
  _posToast('Orden #' + String(order.num).padStart(4,'0') + ' creada · $' + _fmt(order.total));
  mostSetTab('online');
}

// ═══════════════════════════════════════════════════════════
// TAB: HISTORIAL
// ═══════════════════════════════════════════════════════════
let historialFilter = 'all'; // all | pendiente | en_preparacion | listo
function _renderHistorialTab() {
  const c = document.getElementById('most-tab-content'); if (!c) return;
  const pending = SAHTEN_ORDERS.filter(o=>o.status==='pendiente').length;
  const prep = SAHTEN_ORDERS.filter(o=>o.status==='en_preparacion').length;
  const done = SAHTEN_ORDERS.filter(o=>o.status==='listo').length;
  const filtered = historialFilter === 'all' ? SAHTEN_ORDERS : SAHTEN_ORDERS.filter(o=>o.status===historialFilter);
  c.innerHTML = '<div class="hist-toolbar">' +
    '<div class="hist-filters">' +
    '<button class="most-cat-chip '+(historialFilter==='all'?'active':'')+'" onclick="historialFilter=\'all\';_renderHistorialTab()">Todos ('+SAHTEN_ORDERS.length+')</button>' +
    '<button class="most-cat-chip hist-pending '+(historialFilter==='pendiente'?'active':'')+'" onclick="historialFilter=\'pendiente\';_renderHistorialTab()">⏳ Pendiente ('+pending+')</button>' +
    '<button class="most-cat-chip hist-prep '+(historialFilter==='en_preparacion'?'active':'')+'" onclick="historialFilter=\'en_preparacion\';_renderHistorialTab()">🔥 En preparación ('+prep+')</button>' +
    '<button class="most-cat-chip hist-done '+(historialFilter==='listo'?'active':'')+'" onclick="historialFilter=\'listo\';_renderHistorialTab()">✅ Listo ('+done+')</button>' +
    '</div></div>' +
    (filtered.length === 0 ?
      '<div class="most-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:64px;height:64px;opacity:0.3;margin-bottom:16px"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg><div>No hay órdenes'+(historialFilter!=='all'?' con este estado':'')+'.</div></div>' :
      '<div class="hist-list">'+filtered.map(o => _renderOrderCard(o)).join('')+'</div>'
    );
}

function _renderOrderCard(o) {
  const statusMap = { pendiente: {label:'Pendiente',cls:'pending',icon:'⏳'}, en_preparacion: {label:'En preparación',cls:'prep',icon:'🔥'}, listo: {label:'Listo',cls:'done',icon:'✅'}, enviado:{label:'En camino',cls:'prep',icon:'→'}, retirado:{label:'Retirado',cls:'done',icon:'✓'}, entregado:{label:'Entregado',cls:'done',icon:'✓'}, cancelado:{label:'Cancelado',cls:'pending',icon:'×'} };
  const s = statusMap[o.status] || statusMap.pendiente;
  const date = new Date(o.createdAt);
  const dateStr = date.toLocaleDateString('es-AR',{day:'2-digit',month:'short'}) + ' ' + date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const itemsSummary = o.items.slice(0,3).map(it => it.qty + '× ' + it.name).join(', ') + (o.items.length > 3 ? ' +' + (o.items.length-3) + ' más' : '');
  return '<div class="hist-card" onclick="openOrderDetail(\''+o.id+'\')">' +
    '<div class="hist-card-top"><div class="hist-card-num">#'+String(o.num).padStart(4,'0')+'</div>'+(o.source==='delivery'?'<span style="background:rgba(242,140,0,0.12);color:#F28C00;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px">🛵 Delivery</span>':o.source==='pickup'?'<span style="background:rgba(35,83,40,0.1);color:var(--primary);font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px">🏠 Tienda Online</span>':'')+'<span class="hist-status hist-status-'+s.cls+'">'+s.icon+' '+s.label+'</span></div>' +
    '<div class="hist-card-meta"><span>'+dateStr+'</span><span>'+_esc(o.customerName||'Consumidor Final')+'</span></div>' +
    '<div class="hist-card-items">'+_esc(itemsSummary)+'</div>' +
    (o.stockDeducted?'<div style="font-size:10px;color:var(--green);font-weight:600;margin-top:4px">📦 Stock descontado</div>':'') +
    '<div class="hist-card-bottom"><span class="hist-card-total">$'+_fmt(o.total)+'</span>' +
    '<div class="hist-card-actions">' +
    (o.status==='pendiente'?'<button class="hist-act-btn" onclick="event.stopPropagation();orderSetStatus(\''+o.id+'\',\'en_preparacion\')">🔥 Preparar</button>':'') +
    (o.status==='en_preparacion'?'<button class="hist-act-btn hist-act-done" onclick="event.stopPropagation();orderSetStatus(\''+o.id+'\',\'listo\')">✅ Listo</button>':'') +
    '<button class="hist-act-btn" onclick="event.stopPropagation();printComanda(\''+o.id+'\')">🖨️</button>' +
    '</div></div></div>';
}

function orderSetStatus(orderId, status) {
  const o = SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o) return;
  const allowed = window.SAHTEN?.orderWorkflow?.allowedStatuses(o) || ['pendiente','en_preparacion','listo','cancelado'];
  if (!allowed.includes(status)) return;
  const previous = o.status;
  if (previous === status) return;
  o.status = status;
  o.updatedAt = new Date().toISOString();
  const final = ['retirado', 'entregado', 'cancelado'];
  if (final.includes(status)) o.completedAt = o.updatedAt;
  else delete o.completedAt;
  _saveOrders();
  if (mostradorTab === 'delivery' && typeof _renderDeliveryTab === 'function') _renderDeliveryTab();
  else if (mostradorTab === 'historial') _renderHistorialTab();
}

// ═══════════════════════════════════════════════════════════
// ORDER DETAIL MODAL
// ═══════════════════════════════════════════════════════════
function openOrderDetail(orderId) {
  const o = SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o) return;
  let ov = document.getElementById('order-detail-overlay'); if(ov) ov.remove();
  ov = document.createElement('div'); ov.id='order-detail-overlay'; ov.className='modal-overlay open';
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  const statusMap = {pendiente:{label:'Pendiente',cls:'pending'},en_preparacion:{label:'En preparación',cls:'prep'},listo:{label:'Listo',cls:'done'},enviado:{label:'En camino',cls:'prep'},retirado:{label:'Retirado',cls:'done'},entregado:{label:'Entregado',cls:'done'},cancelado:{label:'Cancelado',cls:'pending'}};
  const s = statusMap[o.status]||statusMap.pendiente;
  const date = new Date(o.createdAt);
  const dateStr = date.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) + ' · ' + date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  ov.innerHTML = '<div class="modal" style="max-width:600px">' +
    '<div class="modal-header"><div class="modal-title">Orden #'+String(o.num).padStart(4,'0')+'</div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div>' +
    '<div class="modal-body">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
    '<div><div style="font-size:12px;color:var(--muted)">'+dateStr+'</div><div style="font-size:14px;font-weight:600;margin-top:4px">'+_esc(o.customerName||'Consumidor Final')+'</div>'+(o.customerPhone?'<div style="font-size:12px;color:var(--muted);margin-top:2px">📞 '+_esc(o.customerPhone)+'</div>':'')+(o.customerEmail?'<div style="font-size:12px;color:var(--muted);margin-top:1px">✉️ '+_esc(o.customerEmail)+'</div>':'')+(o.address&&o.source==='delivery'?'<div style="font-size:12px;color:var(--muted);margin-top:1px">📍 '+SAHTEN.orderDetails.deliveryAddressLines(o).map(_esc).join('<br>')+'</div>':'')+(o.source==='delivery'?'<span style="display:inline-block;margin-top:4px;background:rgba(242,140,0,0.12);color:#F28C00;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px">🛵 Delivery</span>':o.source==='pickup'?'<span style="display:inline-block;margin-top:4px;background:rgba(35,83,40,0.1);color:var(--primary);font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px">🏠 Tienda Online</span>':'')+'</div>' +
    '<select class="most-disc-select" style="width:auto" aria-label="Estado del pedido" data-order-status="'+_esc(o.id)+'">' +
    (window.SAHTEN.orderWorkflow.allowedStatuses(o).map(value => '<option value="'+value+'" '+(o.status===value?'selected':'')+'>'+_esc(window.SAHTEN.orderWorkflow.onlineStatusLabel({...o,status:value}))+'</option>').join('')) + '</select></div>' +
    (SAHTEN.orderActions.label(o)?'<p>'+_esc(SAHTEN.orderActions.label(o))+'</p>':'') +
    (o.cancellation?'<p>Cancelado'+(o.cancellation.reason?': '+_esc(o.cancellation.reason):'')+'</p>':'') +
    (['pendiente','en_preparacion','listo','enviado'].includes(o.status)?'<div class="order-detail-contact-actions"><button class="btn" data-order-command="confirm" data-id="'+_esc(o.id)+'">Tiempo y WhatsApp</button><button class="btn" data-order-command="cancel" data-id="'+_esc(o.id)+'">Cancelar pedido</button></div>':'') +
    '<table class="order-detail-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>' +
    o.items.map(it => '<tr><td>'+_esc(it.name)+'</td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right;font-family:DM Mono,monospace">$'+_fmt(it.unitPrice)+'</td><td style="text-align:right;font-family:DM Mono,monospace;font-weight:600">$'+_fmt(it.lineTotal)+'</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="order-summary">' +
    '<div class="most-cart-row"><span>Subtotal</span><span class="val">$'+_fmt(o.subtotal)+'</span></div>' +
    (o.discountAmount>0?'<div class="most-cart-row discount"><span>'+_esc(o.discountName||'Descuento')+'</span><span class="val">−$'+_fmt(o.discountAmount)+'</span></div>':'') +
    (o.shipping>0?'<div class="most-cart-row"><span>Envío</span><span class="val">$'+_fmt(o.shipping)+'</span></div>':'') +
    (o.deliverySnapshot?'<div class="most-cart-row"><span>'+_esc(o.deliverySnapshot.effectiveZone?.name||'Delivery')+' · '+Number(o.deliverySnapshot.routeKm).toFixed(2)+' km por calles</span><span class="val">Ahorro $'+_fmt(o.deliverySnapshot.discount)+'</span></div><div style="font-size:12px">Tarifa: '+_esc(o.deliverySnapshot.revision)+(o.deliverySnapshot.authorization?.approved?' · Autorizada: '+_esc(o.deliverySnapshot.authorization.reason):'')+'</div>':'') +
    '<div class="most-cart-row total"><span>Total</span><span class="val">$'+_fmt(o.total)+'</span></div>' +
    (o.paymentName?'<div style="font-size:12px;color:var(--muted);margin-top:6px">Pago: '+_esc(o.paymentName)+'</div>':'') +
    (o.paymentStatusLabel?'<div style="font-size:13px;font-weight:600;margin-top:8px" role="status">Mercado Pago: '+_esc(o.paymentStatusLabel)+'</div>':'') +
    '</div>' +
    (o.paymentMethod==='efectivo'&&o.cashTendered!=null?'<p>Paga con: $'+_fmt(o.cashTendered)+' · Vuelto: $'+_fmt(o.cashChange)+'</p>':'')+
    SAHTEN.pricing.orderDetail(o) +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">' +
    (o.stockDeducted?'<button class="btn" onclick="orderRestoreStock(\''+o.id+'\');openOrderDetail(\''+o.id+'\')" title="Devuelve al stock lo descontado por esta orden">↩ Revertir stock</button>':'<button class="btn" onclick="orderDeductStock(\''+o.id+'\');openOrderDetail(\''+o.id+'\')" title="Descuenta ingredientes y envases según las recetas">📦 Descontar stock</button>') +
    '<button class="btn btn-primary" onclick="printComanda(\''+o.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir comanda</button>' +
    '<button class="btn" onclick="orderReopen(\''+o.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar (reabrir)</button>' +
    '<button class="btn" style="color:var(--red);border-color:var(--red)" onclick="orderDelete(\''+o.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg> Eliminar</button>' +
    '</div></div></div>';
  document.body.appendChild(ov);
}

async function orderReopen(orderId) {
  const o = SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o) return;
  if(!(await sahtenConfirm('¿Reabrir la orden #'+String(o.num).padStart(4,'0')+' y cargarla en el carrito? La orden original se eliminará.', { okLabel: 'Reabrir' }))) return;
  mostradorCart = o.items.map(it => ({productId:it.productId, qty:it.qty}));
  mostradorActiveDiscountId = o.discountId; mostradorActiveCustomerId = o.customerId;
  mostradorCashTendered=o.cashTendered??'';
  mostradorSetEstimate(o.fulfillmentEstimate?.minutes??'');
  mostradorShipping = o.shipping||0; mostradorActivePaymentId = o.paymentId;
  mostradorOrderType = o.orderType || (o.source==='delivery' ? 'delivery' : 'retiro');
  mostradorDelivery = (mostradorOrderType==='delivery' && o.lat!=null) ? (()=>{ const z=_mostZoneFor(o.lat,o.lng); return {...SAHTEN.orderDetails.deliveryDetails(o),address:o.address||'',note:o.notes||'',lat:o.lat,lng:o.lng,distKm:z.distKm,zone:z.zone,out:!!z.out}; })() : (mostradorOrderType==='delivery' ? {...SAHTEN.orderDetails.deliveryDetails(o),address:o.address||'',note:o.notes||'',lat:null,lng:null,distKm:0,zone:null,out:false} : null);
  mostradorShipManual = mostradorOrderType==='delivery';
  if (o.stockDeducted) orderRestoreStock(orderId, true);
  SAHTEN_ORDERS = SAHTEN_ORDERS.filter(x=>x.id!==orderId); _saveOrders();
  document.getElementById('order-detail-overlay')?.remove();
  mostradorTab = 'pedido'; renderMostrador();
}

async function orderDelete(orderId) {
  const o = SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o) return;
  if(o.remoteStatusPending){alert('Este pedido tiene un estado pendiente de sincronizar con la tienda. Sincronizalo antes de eliminar el registro.');return;}
  if(!(await sahtenConfirm('¿Eliminar la orden #'+String(o.num).padStart(4,'0')+'? Esta acción no se puede deshacer.', { okLabel: 'Eliminar', danger: true }))) return;
  if (o.stockDeducted && (await sahtenConfirm('Esta orden descontó stock. ¿Devolver el stock?', { okLabel: 'Devolver stock', cancelLabel: 'No devolver' }))) orderRestoreStock(orderId, true);
  SAHTEN_ORDERS = SAHTEN_ORDERS.filter(x=>x.id!==orderId); _saveOrders();
  document.getElementById('order-detail-overlay')?.remove();
  _renderHistorialTab();
}

// ═══════════════════════════════════════════════════════════
// COMANDA PRINTING
// ═══════════════════════════════════════════════════════════
function printComanda(orderId, options = {}) {
  const o = SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o) return;

  // ── Resolve logo for printing ──
  // Priority: 1) Custom B&W logo  2) Custom uploaded logo (grayscaled)  3) Text  4) Default SVG in black
  let logoHtml = '';
  const _custData = (typeof _cust !== 'undefined') ? _cust : {};

  if (_custData.bwLogoData) {
    // User uploaded a specific B&W logo for printing
    logoHtml = '<div class="logo-wrap"><img src="' + _custData.bwLogoData + '" class="logo-img"></div>';
  } else {
    const slot = document.getElementById('brand-logo-slot');
    if (slot) {
      const img = slot.querySelector('img.brand-logo-img');
      const textLogo = slot.querySelector('.brand-text-logo');
      const svg = slot.querySelector('svg');
      if (img) {
        // Custom uploaded logo — apply grayscale via CSS
        logoHtml = '<div class="logo-wrap"><img src="' + img.src + '" class="logo-img" style="filter:grayscale(1) contrast(1.3)"></div>';
      } else if (textLogo) {
        logoHtml = '<div class="brand">' + _esc(textLogo.textContent) + '</div>';
      } else if (svg) {
        // Default Sahten SVG — make it black with white outline on Arabic letters
        const clone = svg.cloneNode(true);
        clone.setAttribute('class', 'logo-svg');
        // Make all paths black
        clone.querySelectorAll('path').forEach((el, i) => {
          el.setAttribute('fill', '#000000');
          el.removeAttribute('opacity');
          // Add white outline/stroke so Arabic & Latin letters are distinguishable
          el.setAttribute('stroke', '#ffffff');
          el.setAttribute('stroke-width', '8');
          el.setAttribute('paint-order', 'stroke');
        });
        logoHtml = '<div class="logo-wrap">' + clone.outerHTML + '</div>';
      }
    }
  }
  if (!logoHtml) {
    const brandName = _custData.brandName || 'Sahten';
    logoHtml = '<div class="brand">' + _esc(brandName) + '</div>';
  }

  const paper = SAHTEN.receiptPaper.current();
  const html = SAHTEN.receipts.html(o, {paper, logoHtml, reviewHtml:SAHTEN.receiptReviews.footer(_custData)});
  const printing = options.direct ? SAHTEN.directPrinting.print(html, {paperWidthMm:paper.paperMm}) : SAHTEN.printDocument(html, {paperWidthMm:paper.paperMm});
  return printing.then(()=>{if(options.direct){try{pushNotification({type:'system',title:'Comanda enviada a la impresora',body:'Orden #'+String(o.num).padStart(4,'0')+'. Revisá la impresora si no sale el ticket.'});}catch{/* El aviso no cambia el resultado del envío. */}}return true;}).catch(e=>{ if(options.automatic)throw e;alert('No se pudo imprimir la comanda. '+(e.message || 'Volvé a intentarlo.')); return false; });
}

// ═══════════════════════════════════════════════════════════
// TAB: CLIENTES
// ═══════════════════════════════════════════════════════════
function _renderClientesTab() {
  const c = document.getElementById('most-tab-content'); if (!c) return;
  c.innerHTML = '<div class="card"><div class="card-header"><div class="card-title">Clientes</div></div><div class="card-body">' +
    '<button type="button" class="btn btn-primary" style="margin-bottom:14px;min-height:44px" onclick="SAHTEN.customersImport.open()">Importar CSV / Excel</button>' +
    '<div class="info-banner" style="margin-bottom:14px"><strong>Clientes:</strong> Datos básicos opcionales. Si no asignás un cliente al pedido, se usa "Consumidor Final" por defecto.</div>' +
    '<div class="disc-list" id="cust-list"></div>' +
    '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin:16px 0 8px">Agregar cliente</div>' +
    '<div class="cust-form">' +
    '<div class="disc-form-field"><label>Nombre</label><input type="text" class="disc-form-input" id="cust-new-name" placeholder="Nombre (opcional)"></div>' +
    '<div class="disc-form-field"><label>Teléfono</label><input type="tel" class="disc-form-input" id="cust-new-phone" placeholder="+54 9..."></div>' +
    '<div class="disc-form-field"><label>Email</label><input type="email" class="disc-form-input" id="cust-new-email" placeholder="email@..."></div>' +
    '<div class="disc-form-field"><label>Dirección</label><input type="text" class="disc-form-input" id="cust-new-addr" placeholder="Dirección (opcional)"></div>' +
    '<button class="disc-form-add" onclick="custAddNew()">+ Agregar</button>' +
    '</div></div></div>';
  _renderCustList();
}
function _renderCustList() {
  const list = document.getElementById('cust-list'); if(!list) return;
  if (SAHTEN_CUSTOMERS.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:14px;text-align:center">No hay clientes guardados. "Consumidor Final" se usa por defecto.</div>'; return; }
  list.innerHTML = SAHTEN_CUSTOMERS.map(c =>
    '<div class="disc-list-item" style="grid-template-columns:1fr auto"><div><div class="disc-list-item-name">'+_esc(c.name||'Sin nombre')+'</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:2px">'+(c.phone?'📱 '+_esc(c.phone):'')+(c.email?' · ✉️ '+_esc(c.email):'')+(c.address?' · 📍 '+_esc(c.address):'')+((!c.phone&&!c.email&&!c.address)?'Sin datos de contacto':'')+'</div>' +
    (c.importPhoneOriginal?'<p style="font-size:13px">Teléfono por revisar: '+_esc(c.importPhoneOriginal)+'</p>':'')+
    (c.addresses?.length ? '<details style="font-size:13px;margin-top:8px"><summary>'+c.addresses.length+' dirección(es) guardada(s)</summary>'+c.addresses.map(a=>'<p>'+_esc(SAHTEN.core.addressText(a))+(a.isPrimary?' · Principal':'')+(a.reference?'<br>'+_esc(a.reference):'')+'</p>').join('')+'</details>' : '')+
    '</div><div class="disc-list-item-actions">' +
    '<button class="disc-action-btn" title="Editar" onclick="custEdit(\''+c.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
    '<button class="disc-action-btn danger" title="Eliminar" onclick="custDeleteClient(\''+c.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
    '</div></div>'
  ).join('');
}
function custAddNew() {
  const name = (document.getElementById('cust-new-name')?.value||'').trim();
  const phone = (document.getElementById('cust-new-phone')?.value||'').trim();
  const email = (document.getElementById('cust-new-email')?.value||'').trim();
  if (!name && !phone && !email) { alert('Completá al menos un campo.'); return; }
  const id = 'cust_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  SAHTEN_CUSTOMERS.push({ id, name: name || 'Sin nombre', phone, email, address: (document.getElementById('cust-new-addr')?.value||'').trim() });
  _saveCustomers();
  ['cust-new-name','cust-new-phone','cust-new-email','cust-new-addr'].forEach(x => { const el=document.getElementById(x); if(el) el.value=''; });
  _renderCustList();
}
async function custEdit(id) {
  const c = SAHTEN_CUSTOMERS.find(x=>x.id===id); if(!c) return;
  const name = await sahtenAsk('Nombre:', c.name); if(name===null) return;
  const phone = await sahtenAsk('Teléfono:', c.phone||''); if(phone===null) return;
  const email = await sahtenAsk('Email:', c.email||''); if(email===null) return;
  let address = await sahtenAsk('Dirección:', c.address||''); if(address===null) return;
  if (c.addresses?.length && address.trim() !== (c.address || '')) {
    const primary = c.addresses.find(a=>a.isPrimary) || c.addresses[0];
    if (!address.trim()) {
      c.addresses = c.addresses.filter(a=>a!==primary);
      c.addresses.forEach((a,i)=>{a.isPrimary=i===0;});
      address = c.addresses.length ? SAHTEN.core.addressText(c.addresses[0]) : '';
    } else Object.assign(primary,{address:address.trim(),street:'',number:'',floor:'',city:'',source:'Manual'});
  }
  c.name = name.trim()||c.name; c.phone = phone.trim(); c.email = email.trim(); c.address = address.trim();
  _saveCustomers(); _renderCustList();
}
async function custDeleteClient(id) {
  const c = SAHTEN_CUSTOMERS.find(x=>x.id===id); if(!c) return;
  if(!(await sahtenConfirm('¿Eliminar el cliente "'+c.name+'"?', { okLabel: 'Eliminar', danger: true }))) return;
  SAHTEN_CUSTOMERS = SAHTEN_CUSTOMERS.filter(x=>x.id!==id);
  if(mostradorActiveCustomerId===id) mostradorActiveCustomerId=null;
  _saveCustomers(); _renderCustList();
}

// ═══════════════════════════════════════════════════════════
// DISCOUNT MANAGER MODAL
// ═══════════════════════════════════════════════════════════
function openDiscountManager() {
  let ov=document.getElementById('disc-mgr-overlay'); if(ov)ov.remove();
  ov=document.createElement('div'); ov.id='disc-mgr-overlay'; ov.className='modal-overlay open';
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  ov.innerHTML='<div class="modal" style="max-width:560px"><div class="modal-header"><div class="modal-title">Gestionar descuentos</div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal-body">' +
    '<div class="info-banner" style="margin-bottom:14px"><strong>Descuentos guardados:</strong> creá tipos reutilizables. Aplicalos en el carrito.</div>' +
    '<div class="disc-list" id="disc-list"></div>' +
    '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px">Crear nuevo</div>' +
    '<div class="disc-form"><div class="disc-form-field"><label>Nombre</label><input type="text" class="disc-form-input" id="disc-new-name" placeholder="ej. Empleado"></div>' +
    '<div class="disc-form-field"><label>Tipo</label><select class="disc-form-input" id="disc-new-type"><option value="pct">% Porcentaje</option><option value="amount">$ Monto</option></select></div>' +
    '<div class="disc-form-field"><label>Valor</label><input type="number" class="disc-form-input" id="disc-new-value" placeholder="10" min="0" step="0.01"></div>' +
    '<button class="disc-form-add" onclick="discAddNew()">+ Agregar</button></div></div></div>';
  document.body.appendChild(ov); _renderDiscList();
}
function _renderDiscList() {
  const list=document.getElementById('disc-list'); if(!list) return;
  if(!MOSTRADOR_DISCOUNTS.length){list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:14px;text-align:center">No hay descuentos.</div>';return;}
  list.innerHTML=MOSTRADOR_DISCOUNTS.map(d=>{const l=d.type==='pct'?d.value+'%':'$'+_fmt(d.value);return'<div class="disc-list-item"><div><div class="disc-list-item-name">'+_esc(d.name)+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+(d.type==='pct'?'Porcentaje':'Monto fijo')+'</div></div><div class="disc-list-item-value">−'+l+'</div><div class="disc-list-item-actions"><button class="disc-action-btn" onclick="discEdit(\''+d.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="disc-action-btn danger" onclick="discDelete(\''+d.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></div></div>';}).join('');
}
function discAddNew(){const n=(document.getElementById('disc-new-name')?.value||'').trim(),t=document.getElementById('disc-new-type')?.value||'pct',v=parseFloat(document.getElementById('disc-new-value')?.value);if(!n){alert('Poné un nombre.');return;}if(isNaN(v)||v<=0){alert('Valor > 0.');return;}if(t==='pct'&&v>100){alert('Máx 100%.');return;}const id='d_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);MOSTRADOR_DISCOUNTS.push({id,name:n,type:t,value:v});_saveDiscounts();document.getElementById('disc-new-name').value='';document.getElementById('disc-new-value').value='';_renderDiscList();_renderCartExtras();}
async function discEdit(id){const d=MOSTRADOR_DISCOUNTS.find(x=>x.id===id);if(!d)return;const n=await sahtenAsk('Nombre:',d.name);if(n===null)return;const v=await sahtenAsk('Valor'+(d.type==='pct'?' (%)':' ($)')+':',d.value);if(v===null)return;const vn=parseFloat(v);if(isNaN(vn)||vn<=0){alert('Inválido.');return;}d.name=n.trim()||d.name;d.value=vn;_saveDiscounts();_renderDiscList();_renderCartExtras();}
async function discDelete(id){const d=MOSTRADOR_DISCOUNTS.find(x=>x.id===id);if(!d)return;if(!(await sahtenConfirm('¿Eliminar "'+d.name+'"?', { okLabel: 'Eliminar', danger: true })))return;MOSTRADOR_DISCOUNTS=MOSTRADOR_DISCOUNTS.filter(x=>x.id!==id);if(mostradorActiveDiscountId===id)mostradorActiveDiscountId=null;_saveDiscounts();_renderDiscList();_renderCartExtras();_renderCartTotals();}

// ═══════════════════════════════════════════════════════════
// PAYMENT METHODS MANAGER MODAL
// ═══════════════════════════════════════════════════════════
function openPaymentManager(){let ov=document.getElementById('pay-mgr-overlay');if(ov)ov.remove();ov=document.createElement('div');ov.id='pay-mgr-overlay';ov.className='modal-overlay open';ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
ov.innerHTML='<div class="modal" style="max-width:500px"><div class="modal-header"><div class="modal-title">Métodos de pago</div><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal-body">' +
'<div class="info-banner" style="margin-bottom:14px"><strong>Métodos de Mostrador:</strong> agregá QR, débito u otros. Cada uno aparecerá como una opción junto a los demás. Elegirlo registra el medio; no acredita automáticamente un cobro. El descuento configurado solo corresponde a efectivo o transferencia si el beneficio está activo.</div><div class="disc-list" id="pay-list"></div>' +
'<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px">Crear nuevo</div>' +
'<div class="disc-form" style="grid-template-columns:1fr auto"><div class="disc-form-field"><label for="pay-new-name">Nombre</label><input type="text" class="disc-form-input" id="pay-new-name" placeholder="ej. QR, Débito, Cuenta corriente…"><label for="pay-new-method">Tipo de pago</label><select id="pay-new-method" class="disc-form-input"><option value="other">Otro (sin beneficio por pago)</option><option value="qr">QR (sin beneficio por pago)</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="mercadopago">Mercado Pago</option></select></div><button class="disc-form-add" onclick="payAddNew()">+ Agregar</button></div></div></div>';
document.body.appendChild(ov);_renderPayList();}
function _renderPayList(){const l=document.getElementById('pay-list');if(!l)return;if(!MOSTRADOR_PAYMENTS.length){l.innerHTML='<div style="color:var(--muted);font-size:13px;padding:14px;text-align:center">No hay métodos.</div>';return;}
l.innerHTML=MOSTRADOR_PAYMENTS.map(p=>'<div class="disc-list-item" style="grid-template-columns:1fr auto"><div class="disc-list-item-name">'+_esc(p.name)+'</div><div class="disc-list-item-actions"><button class="disc-action-btn" onclick="payEdit(\''+p.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="disc-action-btn danger" onclick="payDelete(\''+p.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></div></div>').join('');}
function payAddNew(){const n=(document.getElementById('pay-new-name')?.value||'').trim();if(!n){alert('Poné un nombre.');return;}const id='pay_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);MOSTRADOR_PAYMENTS.push({id,name:n,method:document.getElementById('pay-new-method')?.value||'other'});_savePayments();document.getElementById('pay-new-name').value='';_renderPayList();_renderCartExtras();}
async function payEdit(id){const p=MOSTRADOR_PAYMENTS.find(x=>x.id===id);if(!p)return;const n=await sahtenAsk('Nombre:',p.name);if(n===null)return;p.name=n.trim()||p.name;_savePayments();_renderPayList();_renderCartExtras();}
async function payDelete(id){const p=MOSTRADOR_PAYMENTS.find(x=>x.id===id);if(!p)return;if(!(await sahtenConfirm('¿Eliminar "'+p.name+'"?', { okLabel: 'Eliminar', danger: true })))return;MOSTRADOR_PAYMENTS=MOSTRADOR_PAYMENTS.filter(x=>x.id!==id);if(mostradorActivePaymentId===id)mostradorActivePaymentId=null;_savePayments();_renderPayList();_renderCartExtras();}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function _esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function _fmt(n){return Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2});}
function _posToast(msg){const t=document.createElement('div');t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.25);z-index:10000;opacity:0;transition:opacity 0.2s,transform 0.2s;display:flex;align-items:center;gap:10px';t.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> '+msg;document.body.appendChild(t);requestAnimationFrame(()=>{t.style.opacity='1';});setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(8px)';setTimeout(()=>t.remove(),250);},2800);}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
(function(){
  function patch(){
    if(window._mostradorShowPanelPatched) return;
    SAHTEN.events.onPanelShow('mostrador',()=>{ _mostBannerDismissed=false; setTimeout(renderMostrador,30); });
    window._mostradorShowPanelPatched=true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch); else patch();
})();
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(_injectProductImageUI, 100);
  if(typeof currentPanel!=='undefined'&&currentPanel==='mostrador') renderMostrador();
});

// Preview comanda from Settings — uses dummy order data
function previewComandaFromSettings() {
  const dummyOrder = {
    id: 'preview', source:'delivery', orderType:'delivery',address:'Calle de ejemplo 1234, Ciudad',addressFloor:'2',addressApartment:'B',deliveryReference:'Tocar timbre 2B',customerPhone:'Teléfono de ejemplo',paymentMethod:'efectivo',cashTendered:40000,cashChange:9115,
    num: 1234,
    items: [
      { productId: 'demo1', name: 'Pizza Muzzarella', qty: 2, unitPrice: 9550, lineTotal: 19100 },
      { productId: 'demo2', name: 'Empanadas Jamón y Queso (x6)', qty: 1, unitPrice: 8300, lineTotal: 8300 },
      { productId: 'demo3', name: 'Gaseosa 1,5 L', qty: 1, unitPrice: 5250, lineTotal: 5250 },
    ],
    customerId: null,
    customerName: 'Juan Pérez',
    discountId: null,
    discountName: '10% off',
    discountAmount: 3265,
    shipping: 1500,
    paymentId: null,
    paymentName: 'Efectivo',
    subtotal: 32650,
    total: 30885,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: '',
  };
  SAHTEN_ORDERS.push(dummyOrder);
  printComanda('preview');
  SAHTEN_ORDERS = SAHTEN_ORDERS.filter(x => x.id !== 'preview');
}

// Quick inline client creation from Mostrador cart
let _quickCustomerCleanup=null,_quickCustomerContext=null;
function mostQuickAddClientClose(){document.getElementById('quick-client-overlay')?.remove();if(_quickCustomerCleanup){_quickCustomerCleanup();_quickCustomerCleanup=null;}}
function mostQuickAddClient(seed = {}) {
  let ov = document.getElementById('quick-client-overlay');
  if (ov) mostQuickAddClientClose();
  _quickCustomerContext={project:SAHTEN.project.session.id,list:SAHTEN_CUSTOMERS};
  ov = document.createElement('div');
  ov.id = 'quick-client-overlay';
  ov.className = 'modal-overlay open';ov.tabIndex=-1;ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','quick-customer-title');
  ov.addEventListener('click', e => { if (e.target === ov) mostQuickAddClientClose(); });
  ov.innerHTML = '<div class="modal" style="max-width:420px"><div class="modal-header"><div class="modal-title" id="quick-customer-title">Nuevo cliente</div><button class="modal-close" onclick="mostQuickAddClientClose()">×</button></div><div class="modal-body"><div style="display:flex;flex-direction:column;gap:12px"><div class="disc-form-field"><label for="qc-name">Nombre</label><input type="text" class="disc-form-input" id="qc-name" placeholder="Nombre del cliente" autofocus></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="disc-form-field"><label for="qc-phone">Teléfono</label><input type="tel" class="disc-form-input" id="qc-phone" placeholder="+54 9..."></div><div class="disc-form-field"><label for="qc-email">Email (opcional)</label><input type="email" class="disc-form-input" id="qc-email" placeholder="email@..."></div></div><div class="disc-form-field"><label for="qc-addr">Dirección (opcional)</label><input type="text" class="disc-form-input" id="qc-addr" placeholder="Dirección"></div><button class="most-checkout" style="margin-top:4px" onclick="mostQuickAddClientSave()">Crear y asignar al pedido</button></div></div></div>';
  document.body.appendChild(ov);
  _quickCustomerCleanup=SAHTEN.bindModalFocus({panel:ov,close:mostQuickAddClientClose});
  document.getElementById('qc-name').value=seed.name||'';document.getElementById('qc-phone').value=seed.phone||'';
  setTimeout(() => document.getElementById(seed.phone?'qc-phone':'qc-name')?.focus(), 100);
}

function mostQuickAddClientSave() {
  if(!_quickCustomerContext||_quickCustomerContext.project!==SAHTEN.project.session.id||_quickCustomerContext.list!==SAHTEN_CUSTOMERS){mostQuickAddClientClose();alert('El proyecto cambió. Volvé a crear el cliente en el proyecto correcto.');return;}
  const name = (document.getElementById('qc-name')?.value || '').trim();
  const phone = (document.getElementById('qc-phone')?.value || '').trim();
  const email = (document.getElementById('qc-email')?.value || '').trim();
  if (!name && !phone) { alert('Poné al menos un nombre o teléfono.'); return; }
  const id = 'cust_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  SAHTEN_CUSTOMERS.push({ id, name: name || 'Sin nombre', phone, email, address: (document.getElementById('qc-addr')?.value||'').trim() });
  _saveCustomers();
  mostradorActiveCustomerId = id;
  mostQuickAddClientClose();
  _renderCartExtras();
  _posToast('Cliente "' + (name || phone) + '" creado y asignado');
}

// Expose everything
Object.assign(window, {
  renderMostrador, mostSetTab, mostradorDismissBanner, mostradorOnSearch, mostradorSetCategory,
  mostradorAddToCart, mostradorRemoveItem, mostradorChangeQty, mostradorClearCart, mostradorToggleCart,
  mostradorSetDiscount, mostradorSetPayment, mostradorSetShipping, mostradorCheckout,
  openDiscountManager, discAddNew, discEdit, discDelete,
  openPaymentManager, payAddNew, payEdit, payDelete,
  mostradorSetView, openOrderDetail, orderSetStatus, orderReopen, orderDelete, printComanda,
  custAddNew, custEdit, custDeleteClient,
  _handleProductImageUpload, _removeProductImage, directUploadImage,
  getProductImage, getProductImageCached, saveProductImage, deleteProductImage,
  _getProductCategories, historialFilter, _renderHistorialTab,
  previewComandaFromSettings,
  mostQuickAddClient, mostQuickAddClientSave,
});


// ═══════════════════════════════════════════════════════════
// DESCUENTO MANUAL DE STOCK POR ORDEN (v3)
// Cantidades en unidad base: g/ml para ingredientes, u para envases y productos sin receta
// ═══════════════════════════════════════════════════════════
// La cuenta de consumo y el descuento viven en src/core/stock.js
function orderDeductStock(orderId){
  const o=SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o||o.stockDeducted) return;
  const r=SAHTEN.core.deductOrderStock(SAHTEN.state,o);
  if(!r.ok){ if(r.reason==='sin-receta') alert('Los productos de esta orden no tienen ingredientes ni envases vinculados.'); return; }
  _saveOrders();
  if(typeof scheduleSave==='function') scheduleSave();
  if(typeof _posToast==='function') _posToast('Stock descontado · #'+String(o.num).padStart(4,'0'));
}
function orderRestoreStock(orderId, silent){
  const o=SAHTEN_ORDERS.find(x=>x.id===orderId); if(!o||!o.stockDeducted) return;
  SAHTEN.core.restoreOrderStock(SAHTEN.state,o);
  _saveOrders();
  if(typeof scheduleSave==='function') scheduleSave();
  if(!silent && typeof _posToast==='function') _posToast('Stock devuelto · #'+String(o.num).padStart(4,'0'));
}

// Una foto cambió: el Mostrador (que guarda fotos en caché) y Costo Receta se vuelven a dibujar.
window.addEventListener('sahten:photo', ev => {
  const k = ev.detail && ev.detail.key; if (k) _invalidateImgCache(k);
  try { if (window.currentPanel === 'mostrador' && typeof renderMostrador === 'function') renderMostrador(); } catch (e) { /* */ }
});
