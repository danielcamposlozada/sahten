// ═══════════════════════════════════════════════════════════
// SAHTEN — MENÚ ONLINE ADMIN + DELIVERY TAB
// ═══════════════════════════════════════════════════════════

// ─── Menu Online Config (persisted in localStorage) ───
function _menuConfigDefaults() {
  return {
    enabled: true,
    title: 'Nuestro Menú',
    subtitle: 'Pedí online y te lo preparamos',
    categoryOrder: [],
    hiddenProducts: [],
    hiddenCategories: [],
    showPrices: true,
    showImages: true,
    whatsappNumber: '',
    deliveryNote: '',
  };
}
window._menuConfigDefaults = _menuConfigDefaults;
function _loadMenuConfig() {
  const defaults = _menuConfigDefaults();
  try { const r = localStorage.getItem('sahten_menu_config'); if (r) { const c = {...defaults, ...JSON.parse(r)}; ['hiddenProducts','hiddenCategories','categoryOrder'].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; }); return c; } } catch (e) {}
  return defaults;
}
function _saveMenuConfig() {
  localStorage.setItem('sahten_menu_config', JSON.stringify(MENU_CONFIG));
  if (typeof scheduleSave === 'function') scheduleSave();
}
let MENU_CONFIG = _loadMenuConfig();

// ═══════════════════════════════════════════════════════════
// RENDER ADMIN PAGE
// ═══════════════════════════════════════════════════════════
function renderMenuOnline() {
  const panel = document.getElementById('panel-menuonline');
  if (!panel) return;

  const allProducts = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly) : [];
  const allCats = _getAllCategories(allProducts);
  const orderedCats = _getOrderedCategories(allCats);
  const visibleCount = allProducts.filter(p => !MENU_CONFIG.hiddenProducts.includes(p.id) && !(p.category && MENU_CONFIG.hiddenCategories.includes(p.category))).length;   // lo que realmente se publica

  panel.innerHTML = `
    <div class="info-banner" style="margin-bottom:18px">
      <strong>Menú Online:</strong> Configurá qué productos se muestran en tu menú público. Los clientes pueden hacer pedidos que aparecerán en el Mostrador → Delivery.
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="kpi"><div class="kpi-label">Productos visibles</div><div class="kpi-value good">${visibleCount}</div></div>
      <div class="kpi"><div class="kpi-label">Categorías</div><div class="kpi-value gold">${orderedCats.filter(c => !MENU_CONFIG.hiddenCategories.includes(c)).length}</div></div>
      <div class="kpi"><div class="kpi-label">Total productos</div><div class="kpi-value">${allProducts.length}</div></div>
    </div>

    <!-- TABS -->
    <div class="rep-subtabs" style="margin-bottom:18px">
      <button class="rep-subtab ${_moTab === 'productos' ? 'active' : ''}" onclick="_moTab='productos';renderMenuOnline()">🍽 Productos</button>
      <button class="rep-subtab ${_moTab === 'categorias' ? 'active' : ''}" onclick="_moTab='categorias';renderMenuOnline()">📂 Categorías</button>
      <button class="rep-subtab ${_moTab === 'config' ? 'active' : ''}" onclick="_moTab='config';renderMenuOnline()">⚙ Configuración</button>
    </div>

    <div id="mo-content"></div>
  `;

  if (_moTab === 'productos') _renderMoProductos(allProducts);
  else if (_moTab === 'categorias') _renderMoCategorias(orderedCats, allProducts);
  else _renderMoConfig();
}

let _moTab = 'productos';

// ─── Products tab ─────────────────────────────────────
function _renderMoProductos(allProducts) {
  const c = document.getElementById('mo-content');
  if (!c) return;

  const search = document.getElementById('mo-search')?.value?.toLowerCase() || '';

  let filtered = allProducts;
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <div style="position:relative;flex:1;min-width:200px">
        <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="custom-input" id="mo-search" placeholder="Buscar producto..." value="${_esc(search)}" style="padding-left:36px" oninput="_renderMoProductos(${JSON.stringify(allProducts).length > 100 ? '(typeof PRODUCTS!==\'undefined\'?PRODUCTS.filter(p=>!p.recetaOnly):[])' : '[]'})">
      </div>
      <button class="btn" onclick="_moToggleAll(true)">✅ Mostrar todos</button>
      <button class="btn" onclick="_moToggleAll(false)">🔒 Ocultar todos</button>
    </div>

    <div class="table-wrap"><table class="stock-table">
      <thead><tr><th style="width:40px">Visible</th><th>Producto</th><th>Categoría</th><th style="text-align:right">Precio</th><th style="width:40px"></th></tr></thead>
      <tbody>${filtered.map(p => {
        const visible = !MENU_CONFIG.hiddenProducts.includes(p.id);
        const catHidden = p.category && MENU_CONFIG.hiddenCategories.includes(p.category);
        return `<tr style="${!visible ? 'opacity:0.5' : ''}${catHidden ? ';background:rgba(242,140,0,0.05)' : ''}">
          <td style="text-align:center"><input type="checkbox" ${visible ? 'checked' : ''} onchange="_moToggleProduct('${p.id}',this.checked)" style="width:18px;height:18px;accent-color:var(--accent)"></td>
          <td><strong>${_esc(p.name)}</strong>${p.star ? ' ⭐' : ''}${catHidden ? ' <span style="font-size:10px;color:var(--accent)">(categoría oculta)</span>' : ''}</td>
          <td>${p.category ? '<span style="background:var(--accent);color:#fff;border-radius:99px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-block">' + _esc(p.category) + '</span>' : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
          <td style="text-align:right;font-family:var(--mono,'DM Mono',monospace);font-weight:600">$${_fmtN(_moPrice(p))}</td>
          <td><button class="btn" style="padding:3px 8px;font-size:11px" onclick="_moToggleProduct('${p.id}',${!visible})">${visible ? '🔒' : '✅'}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  `;

  // Re-bind search
  document.getElementById('mo-search')?.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    const prods = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly) : [];
    const f = q ? prods.filter(p => p.name.toLowerCase().includes(q)) : prods;
    _renderMoProductosFiltered(f);
  });
}

function _renderMoProductosFiltered(filtered) {
  const tbody = document.querySelector('#mo-content tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(p => {
    const visible = !MENU_CONFIG.hiddenProducts.includes(p.id);
    const catHidden = p.category && MENU_CONFIG.hiddenCategories.includes(p.category);
    return `<tr style="${!visible ? 'opacity:0.5' : ''}${catHidden ? ';background:rgba(242,140,0,0.05)' : ''}">
      <td style="text-align:center"><input type="checkbox" ${visible ? 'checked' : ''} onchange="_moToggleProduct('${p.id}',this.checked)" style="width:18px;height:18px;accent-color:var(--accent)"></td>
      <td><strong>${_esc(p.name)}</strong>${p.star ? ' ⭐' : ''}${catHidden ? ' <span style="font-size:10px;color:var(--accent)">(categoría oculta)</span>' : ''}</td>
      <td>${p.category ? '<span style="background:var(--accent);color:#fff;border-radius:99px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-block">' + _esc(p.category) + '</span>' : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
      <td style="text-align:right;font-family:var(--mono,'DM Mono',monospace);font-weight:600">$${_fmtN(_moPrice(p))}</td>
      <td><button class="btn" style="padding:3px 8px;font-size:11px" onclick="_moToggleProduct('${p.id}',${!visible})">${visible ? '🔒' : '✅'}</button></td>
    </tr>`;
  }).join('');
}

function _moToggleProduct(id, show) {
  if (show) {
    MENU_CONFIG.hiddenProducts = MENU_CONFIG.hiddenProducts.filter(x => x !== id);
  } else {
    if (!MENU_CONFIG.hiddenProducts.includes(id)) MENU_CONFIG.hiddenProducts.push(id);
  }
  _saveMenuConfig();
  renderMenuOnline();
}

function _moToggleAll(show) {
  if (show) {
    MENU_CONFIG.hiddenProducts = [];
  } else {
    const allProducts = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly) : [];
    MENU_CONFIG.hiddenProducts = allProducts.map(p => p.id);
  }
  _saveMenuConfig();
  renderMenuOnline();
}

// ─── Categories tab ───────────────────────────────────
function _renderMoCategorias(orderedCats, allProducts) {
  const c = document.getElementById('mo-content');
  if (!c) return;

  c.innerHTML = `
    <div class="info-banner" style="margin-bottom:14px">
      <strong>Orden de categorías:</strong> Usá ▲ ▼ para ordenar cómo se muestran en el menú público. Las categorías ocultas no aparecen.
    </div>
    <div id="mo-cat-list" style="display:flex;flex-direction:column;gap:6px">
      ${orderedCats.map((cat, i) => {
        const hidden = MENU_CONFIG.hiddenCategories.includes(cat);
        const count = allProducts.filter(p => p.category === cat && !MENU_CONFIG.hiddenProducts.includes(p.id)).length;
        return `<div class="mo-cat-item" data-cat="${_esc(cat)}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card,white);border:1px solid var(--border);border-radius:12px;${hidden ? 'opacity:0.5;' : ''}">
          
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px;color:var(--ink)">${_esc(cat)}</div>
            <div style="font-size:12px;color:var(--muted)">${count} producto${count !== 1 ? 's' : ''} visible${count !== 1 ? 's' : ''}</div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer">
            <input type="checkbox" ${!hidden ? 'checked' : ''} onchange="_moCatToggle('${_esc(cat)}',this.checked)" style="width:18px;height:18px;accent-color:var(--accent)">
            Visible
          </label>
          <div style="display:flex;gap:4px">
            <button class="btn" style="padding:4px 8px;font-size:14px" onclick="_moCatMove('${_esc(cat)}',-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn" style="padding:4px 8px;font-size:14px" onclick="_moCatMove('${_esc(cat)}',1)" ${i === orderedCats.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${orderedCats.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--muted)">No hay categorías. Asigná categorías a tus productos desde Menú o Costo Receta.</div>' : ''}
  `;
}

function _moCatToggle(cat, show) {
  if (show) {
    MENU_CONFIG.hiddenCategories = MENU_CONFIG.hiddenCategories.filter(x => x !== cat);
  } else {
    if (!MENU_CONFIG.hiddenCategories.includes(cat)) MENU_CONFIG.hiddenCategories.push(cat);
  }
  _saveMenuConfig();
  renderMenuOnline();
}

function _moCatMove(cat, direction) {
  const cats = _getOrderedCategories(_getAllCategories(
    (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly) : []
  ));
  const idx = cats.indexOf(cat);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= cats.length) return;
  cats.splice(idx, 1);
  cats.splice(newIdx, 0, cat);
  MENU_CONFIG.categoryOrder = cats;
  _saveMenuConfig();
  renderMenuOnline();
}

// ─── Config tab ───────────────────────────────────────
function _renderMoConfig() {
  const c = document.getElementById('mo-content');
  if (!c) return;
  setTimeout(() => { try { const el = document.getElementById('mo-publish-problems'); const pr = SAHTEN.online.publish.publishProblems(SAHTEN.online.publish.currentMenu()); if (el) el.innerHTML = pr.map(t => `<div class="info-banner" style="margin-bottom:10px;background:rgba(242,140,0,.1);border-color:rgba(242,140,0,.35)">⚠ ${_esc(t)}</div>`).join(''); } catch (e) {} }, 0);

  c.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:14px">Configuración del menú público</div>
      <div style="display:grid;gap:14px">
        <div class="checkout-field">
          <label>Título del menú</label>
          <input type="text" class="custom-input" value="${_esc(MENU_CONFIG.title)}" oninput="MENU_CONFIG.title=this.value;_saveMenuConfig()">
        </div>
        <div class="checkout-field">
          <label>Subtítulo</label>
          <input type="text" class="custom-input" value="${_esc(MENU_CONFIG.subtitle)}" oninput="MENU_CONFIG.subtitle=this.value;_saveMenuConfig()">
        </div>
        <div class="checkout-field">
          <label>Nota de delivery (aparece en el checkout)</label>
          <textarea class="custom-input" rows="2" style="resize:vertical" oninput="MENU_CONFIG.deliveryNote=this.value;_saveMenuConfig()">${_esc(MENU_CONFIG.deliveryNote)}</textarea>
        </div>
        <div class="checkout-field">
          <label>WhatsApp (para notificaciones de pedido)</label>
          <input type="tel" class="custom-input" placeholder="+54 9 11 1234-5678" value="${_esc(MENU_CONFIG.whatsappNumber)}" oninput="MENU_CONFIG.whatsappNumber=this.value;_saveMenuConfig()">
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" ${MENU_CONFIG.showPrices ? 'checked' : ''} onchange="MENU_CONFIG.showPrices=this.checked;_saveMenuConfig()" style="width:18px;height:18px;accent-color:var(--accent)">
            Mostrar precios
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" ${MENU_CONFIG.showImages ? 'checked' : ''} onchange="MENU_CONFIG.showImages=this.checked;_saveMenuConfig()" style="width:18px;height:18px;accent-color:var(--accent)">
            Mostrar imágenes
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" ${MENU_CONFIG.enabled ? 'checked' : ''} onchange="MENU_CONFIG.enabled=this.checked;_saveMenuConfig()" style="width:18px;height:18px;accent-color:var(--accent)">
            Menú activo
          </label>
        </div>
      </div>
    </div>

    <div class="card" style="padding:20px" id="mo-publish">
      <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:10px">Publicar menú</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.55">
        Genera una carpeta lista para subir a un hosting gratis (Cloudflare Pages, GitHub Pages o Netlify): <strong>index.html</strong>, <strong>menu.json</strong> y las imágenes optimizadas.
        El pedido sale por <strong>WhatsApp</strong> con el detalle, el total, el envío calculado por zona y los datos del cliente. No lleva costos ni márgenes.
      </div>
      <div id="mo-publish-problems"></div>
      <button class="btn btn-accent" onclick="SAHTEN.online.publish.publish().catch(e=>alert('No se pudo publicar: '+e.message))" style="padding:10px 20px;font-size:14px">📤 Publicar menú</button>
      <button class="btn" onclick="SAHTEN.online.publish.preview()" style="padding:10px 20px;font-size:14px;margin-left:8px">👁 Vista previa</button>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">Paso a paso para publicar: docs/PUBLICAR.md. Cada vez que cambies precios o productos, volvé a publicar.</div>
    </div>
  `;
}

// ─── Helpers ──────────────────────────────────────────

function _getAllCategories(products) {
  const cats = new Set();
  products.forEach(p => { if (p.category) cats.add(p.category); });
  return [...cats].sort();
}

function _getOrderedCategories(allCats) {
  const order = MENU_CONFIG.categoryOrder || [];
  const ordered = [];
  // First add in saved order
  order.forEach(c => { if (allCats.includes(c)) ordered.push(c); });
  // Then add any new categories not in saved order
  allCats.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
  return ordered;
}

// Precio que ve el cliente en el menú publicado: el mismo que usa la publicación (precio de Mostrador con tier, recargo y comisión).
function _moPrice(p) { return (typeof mostradorFinalPrice === 'function') ? mostradorFinalPrice(p) : 0; }
function _esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
function _fmtN(n) { return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

// ═══════════════════════════════════════════════════════════
// DELIVERY TAB IN MOSTRADOR
// ═══════════════════════════════════════════════════════════
// Inject a "Delivery" tab into Mostrador
function _injectDeliveryTab() {
  if (window._deliveryTabPatched) return;
  SAHTEN.events.afterRender('renderMostrador', () => _addDeliveryTabBtn());
  window._deliveryTabPatched = true;
}

function _addDeliveryTabBtn() {
  const tabBar = document.querySelector('#panel-mostrador .most-tabs');
  if (!tabBar || tabBar.querySelector('.most-tab-delivery')) return;

  const orders = (typeof SAHTEN_ORDERS !== 'undefined') ? SAHTEN_ORDERS : [];
  const deliveryCount = orders.filter(o => o.source === 'delivery').length;
  const pendingDel = orders.filter(o => o.source === 'delivery' && o.status === 'pendiente').length;

  const btn = document.createElement('button');
  btn.className = 'most-tab most-tab-delivery' + (typeof mostradorTab !== 'undefined' && mostradorTab === 'delivery' ? ' active' : '');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Delivery' +
    (pendingDel > 0 ? ' <span class="most-tab-badge" style="background:var(--red)">' + pendingDel + '</span>' : ' <span class="most-tab-badge">' + deliveryCount + '</span>');
  btn.onclick = function () { mostradorTab = 'delivery'; renderMostrador(); };
  // Insert as 2nd tab (after "Nuevo pedido")
  const firstTab = tabBar.querySelector('.most-tab');
  if (firstTab && firstTab.nextSibling) {
    tabBar.insertBefore(btn, firstTab.nextSibling);
  } else {
    tabBar.appendChild(btn);
  }
}

// Patch mostSetTab to handle delivery
function _patchMostSetTab() {
  if (window._mostSetTabDeliveryPatched) return;
  SAHTEN.events.around('mostSetTab', (next, tab) => {
    if (tab === 'delivery') {
      mostradorTab = 'delivery';
      renderMostrador();
      return;
    }
    return next(tab);
  });
  window._mostSetTabDeliveryPatched = true;
}

// Render delivery content when tab is active
function _patchDeliveryContent() {
  // We'll hook into the tab content rendering
  // Check if delivery tab is active after render
  const observer = new MutationObserver(() => {
    if (typeof mostradorTab !== 'undefined' && mostradorTab === 'delivery') {
      const content = document.getElementById('most-tab-content');
      if (content && !content.querySelector('.delivery-list')) {
        _renderDeliveryTab();
      }
    }
  });

  const panel = document.getElementById('panel-mostrador');
  if (panel) observer.observe(panel, { childList: true, subtree: true });
}

function _renderDeliveryTab() {
  const c = document.getElementById('most-tab-content');
  if (!c) return;

  const orders = (typeof SAHTEN_ORDERS !== 'undefined') ? SAHTEN_ORDERS : [];
  const deliveryOrders = orders.filter(o => o.source === 'delivery' || (o.source === 'pickup' && o.remoteId));
  const pending = deliveryOrders.filter(o => o.status === 'pendiente');
  const prep = deliveryOrders.filter(o => o.status === 'en_preparacion');
  const done = deliveryOrders.filter(o => o.status === 'listo');

  c.innerHTML = `
    <div class="delivery-list">
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;font-size:16px;font-weight:700;color:var(--ink)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Pedidos Online
        </div>
        <button class="btn" onclick="_refreshDelivery()" style="font-size:12px">🔄 Actualizar</button>
      </div>

      ${pending.length > 0 ? `
        <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Pendientes (${pending.length})</div>
        ${pending.map(o => _deliveryCard(o)).join('')}
      ` : ''}

      ${prep.length > 0 ? `
        <div style="font-size:12px;font-weight:700;color:#e67e22;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px">🔥 En preparación (${prep.length})</div>
        ${prep.map(o => _deliveryCard(o)).join('')}
      ` : ''}

      ${done.length > 0 ? `
        <div style="font-size:12px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px">✅ Listos (${done.length})</div>
        ${done.map(o => _deliveryCard(o)).join('')}
      ` : ''}

      ${deliveryOrders.length === 0 ? `
        <div style="text-align:center;padding:40px 20px;color:var(--muted)">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:12px"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Sin pedidos online</div>
          <div style="font-size:13px">Los pedidos hechos desde Sahten Menu aparecerán aquí automáticamente.</div>
        </div>
      ` : ''}
    </div>
  `;
}

function _deliveryCard(o) {
  const num = '#' + String(o.num || 0).padStart(4, '0');
  const date = o.createdAt ? new Date(o.createdAt) : new Date();
  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  const itemCount = (o.items || []).reduce((s, it) => s + (it.qty || 0), 0);
  const statusColors = { pendiente: 'var(--accent)', en_preparacion: '#e67e22', listo: 'var(--green)' };
  const statusLabels = { pendiente: '⏳ Pendiente', en_preparacion: '🔥 Preparando', listo: '✅ Listo' };

  return `
    <div style="background:var(--card-bg, white);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;border-left:4px solid ${statusColors[o.status] || 'var(--border)'}" onclick="openOrderDetail('${o.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-family:var(--mono,'DM Mono',monospace);font-weight:800;font-size:15px;color:var(--primary)">${num}</span>
        <span style="font-size:11px;color:var(--muted)">${dateStr} ${timeStr}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:700;padding:3px 10px;border-radius:8px;background:${statusColors[o.status] || 'var(--sand)'}22;color:${statusColors[o.status] || 'var(--muted)'}">${statusLabels[o.status] || o.status}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--ink)">${_esc(o.customerName || 'Cliente Online')}</div>
          ${o.customerPhone ? '<div style="font-size:11px;color:var(--muted)">📞 ' + _esc(o.customerPhone) + '</div>' : ''}
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
        </div>
        <div style="font-family:var(--mono,'DM Mono',monospace);font-weight:800;font-size:18px;color:var(--accent)">$${_fmtN(o.total)}</div>
      </div>
      ${o.notes ? '<div style="margin-top:8px;font-size:12px;color:var(--muted);font-style:italic;background:var(--sand);padding:6px 10px;border-radius:8px">"' + _esc(o.notes) + '"</div>' : ''}
    </div>
  `;
}

function _refreshDelivery() {
  // Reload orders from localStorage (in case menu page added new ones)
  if (typeof _loadOrders === 'function') {
    SAHTEN_ORDERS = _loadOrders();
  } else {
    try { SAHTEN_ORDERS = JSON.parse(localStorage.getItem('sahten_orders') || '[]'); } catch (e) {}
  }
  _renderDeliveryTab();
  _addDeliveryTabBtn(); // Update badge count
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
(function _initMenuOnline() {
  function patch() {
    if (window._menuOnlineShowPatched) return;
    SAHTEN.events.onPanelShow('menuonline', () => setTimeout(renderMenuOnline, 30));
    window._menuOnlineShowPatched = true;

    // Inject delivery tab
    setTimeout(() => {
      _injectDeliveryTab();
      _patchMostSetTab();
      _patchDeliveryContent();
    }, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
  else patch();
})();

Object.assign(window, {
  renderMenuOnline, MENU_CONFIG, _saveMenuConfig,
  _moToggleProduct, _moToggleAll, _moCatToggle, _moCatMove,
  _renderDeliveryTab, _refreshDelivery,
});
