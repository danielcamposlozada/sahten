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
    autoSyncPhotos: false,
    whatsappNumber: '',
    deliveryNote: '',
    site: SAHTEN_SITE.siteDefaults(),
  };
}
function _loadMenuConfig() {
  const defaults = _menuConfigDefaults();
  try { const r = localStorage.getItem('sahten_menu_config'); if (r) { const c = {...defaults, ...JSON.parse(r)}; c.site = SAHTEN_SITE.normalizeSite(c.site); ['hiddenProducts','hiddenCategories','categoryOrder'].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; }); return c; } } catch (e) {}
  return defaults;
}
function _saveMenuConfig() {
  localStorage.setItem('sahten_menu_config', JSON.stringify(MENU_CONFIG));
  if (typeof scheduleSave === 'function') scheduleSave();
}
let MENU_CONFIG = _loadMenuConfig();

// ═══════════════════════════════════════════════════════════
// MENÚ ONLINE — una sola pantalla: estado de publicación, lista por categoría y vista previa en vivo
// ═══════════════════════════════════════════════════════════
const _moUi = { q: '', filter: 'all', collapsed: {}, desc: {}, tab: 'menu', bound: false };
function _moTab(tab) {
  _moUi.tab = tab;
  document.querySelectorAll('.mo-tab').forEach(b => { const on = b.dataset.moTab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const a = document.getElementById('mo-tab-menu'), b = document.getElementById('mo-tab-site'); if (a) a.hidden = tab !== 'menu'; if (b) b.hidden = tab !== 'site';
  if (tab === 'site') _sbRender(); else _moRefresh();
}

function _moSite() { return (MENU_CONFIG.site = SAHTEN_SITE.normalizeSite(MENU_CONFIG.site)); }
function _moProducts() { return (typeof PRODUCTS !== 'undefined') ? PRODUCTS.filter(p => !p.recetaOnly && p.name) : []; }
function _moIsHiddenCat(cat) { return !!cat && MENU_CONFIG.hiddenCategories.includes(cat); }
function _moIsVisible(p) { return !MENU_CONFIG.hiddenProducts.includes(p.id) && !_moIsHiddenCat(p.category); }
function _moImg(p) { return (typeof SAHTEN_IMAGES !== 'undefined' && SAHTEN_IMAGES[p.id]) || null; }
function _moMenu() { try { return SAHTEN.online.publish.currentMenu(); } catch (e) { return null; } }
function _moProblems(menu) { try { return menu ? SAHTEN.online.publish.publishProblems(menu) : []; } catch (e) { return []; } }
// Huella del menú publicable: cambia si cambia algo de lo que ve el cliente (se ignora la fecha de generación).
function _moHash(menu) {
  const m = menu || _moMenu(); if (!m) return '';
  const copy = { ...m }; delete copy.generatedAt;
  const imgs = (typeof SAHTEN_IMAGES !== 'undefined') ? Object.keys(SAHTEN_IMAGES).sort().map(k => k + ':' + String(SAHTEN_IMAGES[k]).length).join(',') : '';
  const str = JSON.stringify(copy) + '|' + imgs; let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}
function _moWarnings(p) {
  const out = [];
  if (MENU_CONFIG.showPrices !== false && !(_moPrice(p) > 0)) out.push({ t: 'Precio $0: no se publica', bad: true });
  if (!p.category) out.push({ t: 'Sin categoría' });
  if (MENU_CONFIG.showImages !== false && !_moImg(p)) out.push({ t: 'Sin foto', soft: true });
  return out;
}

function renderMenuOnline() {
  const panel = document.getElementById('panel-menuonline');
  if (!panel) return;
  panel.innerHTML = `
    <div class="mo">
      <div id="mo-status"></div>
      <div class="mo-tabs" role="tablist"><button class="mo-tab ${_moUi.tab === 'menu' ? 'on' : ''}" role="tab" data-mo-tab="menu" aria-selected="${_moUi.tab === 'menu'}">Menú</button><button class="mo-tab ${_moUi.tab === 'site' ? 'on' : ''}" role="tab" data-mo-tab="site" aria-selected="${_moUi.tab === 'site'}">Sitio web</button></div>
      <div id="mo-tab-site" ${_moUi.tab === 'site' ? '' : 'hidden'}></div>
      <div class="mo-body" id="mo-tab-menu" ${_moUi.tab === 'menu' ? '' : 'hidden'}>
        <div class="mo-main">
          <div class="mo-toolbar">
            <div class="mo-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" class="custom-input" id="mo-search" placeholder="Buscar producto…" aria-label="Buscar producto" value="${_esc(_moUi.q)}">
            </div>
            <div class="mo-chips" id="mo-chips" role="group" aria-label="Filtrar"></div>
            <button class="btn" data-mo="all-on">Mostrar todos</button>
            <button class="btn" data-mo="all-off">Ocultar todos</button>
          </div>
          <p class="mo-availability-help">Estos interruptores muestran u ocultan productos solo en la web. Para pausarlos en Mostrador y web, usá «Pausar ventas» en Productos. Los precios se publican aparte.</p>
          <div id="mo-availability" role="status" aria-live="polite"></div><div id="mo-list"></div>
          <details class="mo-settings" id="mo-settings">
            <summary>Ajustes del menú</summary>
            <div class="mo-fields">
              <label class="f">Título<input type="text" class="custom-input" data-mo-set="title" value="${_esc(MENU_CONFIG.title)}"></label>
              <label class="f">Subtítulo<input type="text" class="custom-input" data-mo-set="subtitle" value="${_esc(MENU_CONFIG.subtitle)}"></label>
              <label class="f">WhatsApp donde llegan los pedidos<input type="tel" class="custom-input" data-mo-set="whatsappNumber" placeholder="+54 9 11 1234-5678" value="${_esc(MENU_CONFIG.whatsappNumber)}"></label>
              <label class="f">Nota de delivery (aparece al pedir)<textarea class="custom-input" rows="2" style="resize:vertical" data-mo-set="deliveryNote">${_esc(MENU_CONFIG.deliveryNote)}</textarea></label>
              <div class="mo-checks">
                <label><span class="mo-sw"><input type="checkbox" data-mo-check="showPrices" ${MENU_CONFIG.showPrices !== false ? 'checked' : ''}><span></span></span>Mostrar precios</label>
                <label><span class="mo-sw"><input type="checkbox" data-mo-check="showImages" ${MENU_CONFIG.showImages !== false ? 'checked' : ''}><span></span></span>Mostrar fotos</label>
                <label><span class="mo-sw"><input type="checkbox" data-mo-check="enabled" ${MENU_CONFIG.enabled !== false ? 'checked' : ''}><span></span></span>Menú activo</label>
              </div>
              <div style="font-size:11.5px;color:var(--muted)">Publicar paso a paso: docs/PUBLICAR.md. El pedido sale por WhatsApp con el precio de Mostrador; no lleva costos ni márgenes.</div>
            </div>
          </details>
        </div>
        <aside class="mo-side" id="mo-side" aria-label="Vista previa del menú"></aside>
      </div>
    </div>`;
  _moBind(panel);
  _moRefresh();
  if (_moUi.tab === 'site') _sbRender();
}

// Estado + lista + vista previa (la barra de búsqueda y los ajustes no se redibujan: se conserva el foco)
function _moRefresh() {
  _moAvailabilityStatus(); _moRenderStatus(); _moRenderChips(); _moRenderList(); _moRenderPreview();
}

function _moRenderStatus() {
  const el = document.getElementById('mo-status'); if (!el) return;
  const menu = _moMenu(); const problems = _moProblems(menu); const last = MENU_CONFIG.lastPublished;
  const prods = _moProducts(); const sinFoto = prods.filter(p => _moIsVisible(p) && MENU_CONFIG.showImages !== false && !_moImg(p)).length;
  let s = 'ok', title, sub;
  if (problems.length) { s = 'problem'; title = 'Falta completar para publicar'; sub = 'Resolvé los avisos de abajo.'; }
  else if (!last) { s = 'dirty'; title = 'Todavía no publicaste este menú'; sub = 'Mirá la vista previa y publicalo cuando estés listo.'; }
  else if (last.hash !== _moHash(menu)) { s = 'dirty'; title = 'Hay cambios sin publicar'; sub = 'Última carpeta generada: ' + _moWhen(last.at) + '. Publicá el catálogo para precios y datos; exportá los archivos para cambios de diseño.'; }
  else { title = 'Menú publicado y al día'; sub = 'Última publicación: ' + _moWhen(last.at) + '.'; }
  const n = menu ? menu.products.length : 0;
  sub += ` · ${n} producto${n !== 1 ? 's' : ''} en el menú` + (sinFoto ? ` · ${sinFoto} sin foto` : '');
  el.innerHTML = `<div class="mo-status" data-s="${s}">
    <span class="mo-st-dot" aria-hidden="true"></span>
    <div class="mo-st-main"><div class="mo-st-title">${title}</div><div class="mo-st-sub">${_esc(sub)}</div></div>
    <div class="mo-st-actions">
      <button class="btn" data-mo="open-site">${_moSite().enabled ? 'Editar el sitio web' : 'Armar el sitio web'}</button>
      <button class="btn" data-mo="preview">Ver vista previa</button>
      <button class="btn btn-accent" data-mo="publish" ${n ? '' : 'disabled'}>Exportar archivos de la web</button>
    </div>
    ${problems.length ? `<div class="mo-problems">${problems.map(t => `<div class="mo-problem">${_esc(t)}${/WhatsApp/.test(t) ? '<button class="btn" data-mo="open-settings">Cargar número</button>' : ''}</div>`).join('')}</div>` : ''}
  </div>`;
}
function _moWhen(iso) {
  try { const d = new Date(iso); return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}

function _moRenderChips() {
  const el = document.getElementById('mo-chips'); if (!el) return;
  const prods = _moProducts();
  const counts = { all: prods.length, warn: prods.filter(p => _moWarnings(p).some(w => !w.soft)).length, nophoto: prods.filter(p => _moWarnings(p).some(w => w.soft)).length, hidden: prods.filter(p => !_moIsVisible(p)).length };
  el.innerHTML = [['all', 'Todos'], ['warn', 'Con avisos'], ['nophoto', 'Sin foto'], ['hidden', 'Ocultos']].filter(([k]) => k !== 'nophoto' || counts.nophoto).map(([k, t]) =>
    `<button class="mo-chip ${_moUi.filter === k ? 'on' : ''}" data-mo-filter="${k}" aria-pressed="${_moUi.filter === k}">${t} ${counts[k]}</button>`).join('');
}

function _moRenderList() {
  const el = document.getElementById('mo-list'); if (!el) return;
  const prods = _moProducts(); const q = _moUi.q.trim().toLowerCase();
  const match = p => (!q || p.name.toLowerCase().includes(q)) &&
    (_moUi.filter === 'all' || (_moUi.filter === 'warn' && _moWarnings(p).some(w => !w.soft)) || (_moUi.filter === 'nophoto' && _moWarnings(p).some(w => w.soft)) || (_moUi.filter === 'hidden' && !_moIsVisible(p)));
  const cats = _getOrderedCategories(_getAllCategories(prods));
  const groups = cats.map(c => ({ cat: c, items: prods.filter(p => p.category === c) }));
  const loose = prods.filter(p => !p.category); if (loose.length) groups.push({ cat: '', items: loose });
  const showImgs = MENU_CONFIG.showImages !== false;
  const html = groups.map((g, gi) => {
    const items = g.items.filter(match); if (!items.length) return '';
    const hiddenCat = _moIsHiddenCat(g.cat); const open = !_moUi.collapsed[g.cat || '∅'];
    const vis = g.items.filter(_moIsVisible).length;
    const head = g.cat
      ? `<div class="mo-cat-head" draggable="true" data-drag-cat="${_esc(g.cat)}">
          <span class="mo-grip" aria-hidden="true">⋮⋮</span>
          <button class="mo-iconbtn" data-mo-collapse="${_esc(g.cat)}" aria-expanded="${open}" aria-label="${open ? 'Plegar' : 'Desplegar'} ${_esc(g.cat)}">${open ? '▾' : '▸'}</button>
          ${showImgs ? SAHTEN.photos.thumb(SAHTEN.photos.categoryKey(g.cat), 'la categoría ' + g.cat, { size: 32 }) : ''}<span class="mo-cat-name">${_esc(g.cat)}</span><span class="mo-cat-count">${vis} de ${g.items.length} visibles</span>
          <button class="mo-iconbtn" data-mo-catmove="-1" data-cat="${_esc(g.cat)}" aria-label="Subir ${_esc(g.cat)}" ${gi === 0 ? 'disabled' : ''}>▲</button>
          <button class="mo-iconbtn" data-mo-catmove="1" data-cat="${_esc(g.cat)}" aria-label="Bajar ${_esc(g.cat)}" ${gi >= cats.length - 1 ? 'disabled' : ''}>▼</button>
          <label class="mo-sw" title="${hiddenCat ? 'Mostrar' : 'Ocultar'} la categoría"><input type="checkbox" data-mo-cat="${_esc(g.cat)}" ${hiddenCat ? '' : 'checked'} aria-label="Categoría ${_esc(g.cat)} visible"><span></span></label>
        </div>`
      : `<div class="mo-cat-head" style="cursor:default"><span class="mo-cat-name">Sin categoría</span><span class="mo-cat-count">${g.items.length} producto${g.items.length !== 1 ? 's' : ''} · asignales una categoría desde Menú</span></div>`;
    const rows = open ? items.map(p => {
      const vis = _moIsVisible(p), price = _moPrice(p), img = _moImg(p), warns = _moWarnings(p);
      return `<div class="mo-prod ${vis ? '' : 'off'} ${SAHTEN.salesAvailability.isPaused(p)?'sales-paused':''}">
        <label class="mo-sw"><input type="checkbox" data-mo-prod="${_esc(p.id)}" ${MENU_CONFIG.hiddenProducts.includes(p.id) ? '' : 'checked'} title="Muestra u oculta solo en la web. No pausa Mostrador ni publica precios pendientes." aria-label="${_esc(p.name)} visible"><span></span></label>
        ${showImgs ? SAHTEN.photos.thumb(p.id, p.name) : '<span></span>'}
        <div style="min-width:0"><div class="mo-pname">${_esc(p.name)}${p.star ? ' ⭐' : ''}${hiddenCat && !MENU_CONFIG.hiddenProducts.includes(p.id) ? ' <span style="font-size:10.5px;color:var(--accent)">(categoría oculta)</span>' : ''}</div>
          ${warns.length ? `<div class="mo-warns">${warns.map(w => `<span class="mo-warn ${w.bad ? 'bad' : ''}">${_esc(w.t)}</span>`).join('')}</div>` : ''}</div>
        <div class="mo-price ${price > 0 ? '' : 'zero'}">$${_fmtN(price)}${SAHTEN.pricing.badge(p,'mostrador')}${SAHTEN.salesAvailability.isPaused(p)?'<span class="sales-state paused">No disponible · ventas pausadas</span>':''}<button class="mo-iconbtn" style="margin-left:8px" data-mo-desc="${_esc(p.id)}" aria-label="Descripción de ${_esc(p.name)}" title="Descripción corta">✎</button>
          <button class="mo-mini" data-mo-recipe="${_esc(p.id)}" aria-label="Editar la receta de ${_esc(p.name)}" title="Editar receta (nombre, categoría, ingredientes y foto)">Receta</button>
          <button class="mo-mini" data-mo-menu="${_esc(p.id)}" aria-label="Ver ${_esc(p.name)} en Productos" title="Ver en Productos (precio, tier y etiquetas)">Precio</button></div>
        ${_moUi.desc[p.id] || p.description ? `<div style="grid-column:2/-1">${_moUi.desc[p.id] ? `<input class="custom-input" style="width:100%" maxlength="220" placeholder="Descripción corta (se muestra en el menú)" data-mo-pdesc="${_esc(p.id)}" value="${_esc(p.description || '')}">` : `<div class="desc" style="font-size:12px;color:var(--muted)">${_esc(p.description)}</div>`}</div>` : ''}
      </div>`;
    }).join('') : '';
    return `<section class="mo-cat ${hiddenCat ? 'off' : ''}" data-cat-block="${_esc(g.cat)}">${head}${rows}</section>`;
  }).join('');
  el.innerHTML = html || `<div class="mo-empty">${prods.length ? 'Ningún producto coincide con tu búsqueda.' : 'No hay productos de venta. Las recetas internas y los borradores no aparecen aquí. Habilitá una receta para venta y después elegí si publicarla.<br><button class="btn btn-accent empty-action" data-panel="costreceta">Ir a Recetas</button>'}</div>`;
}

function _moRenderPreview() {
  const el = document.getElementById('mo-side'); if (!el) return;
  const m = _moMenu();
  if (!m) { el.innerHTML = ''; return; }
  const th = m.theme || {}; const prim = th.primary || '#235328';
  const imgs = (typeof SAHTEN_IMAGES !== 'undefined') ? SAHTEN_IMAGES : {};
  const cats = m.config.categories.slice(); const loose = m.products.filter(p => !p.category);
  const sec = (name, items) => items.length ? `<div class="mo-ph-cat" style="color:${_esc(prim)}">${_esc(name)}</div>` + items.map(p => `<div class="mo-ph-item"><div class="t">${p.image && imgs[p.id] ? `<img src="${_esc(imgs[p.id])}" alt="">` : _esc((p.name || '?').charAt(0).toUpperCase())}</div><div class="n">${_esc(p.name)}</div>${m.config.showPrices ? `<div class="p">$${_fmtN(p.price)}</div>` : ''}</div>`).join('') : '';
  const body = m.config.enabled === false
    ? '<div class="mo-ph-off">El menú está desactivado: los clientes ven un aviso en lugar de la carta.</div>'
    : (m.products.length ? cats.map(c => sec(c, m.products.filter(p => p.category === c))).join('') + sec('Otros', loose) : '<div class="mo-ph-off">Todavía no hay productos visibles.</div>');
  el.innerHTML = `<div class="mo-phone">
      <div class="mo-ph-head" style="background:${_esc(prim)}"><b>${_esc(m.config.title || 'Nuestro Menú')}</b><span>${_esc(m.config.subtitle || '')}</span></div>
      <div class="mo-ph-body">${body}</div>
      <div class="mo-ph-foot">Pedir por WhatsApp</div>
    </div><div class="mo-side-cap">Así lo ve el cliente. Se actualiza solo.</div>`;
}

// ─── Acciones ──────────────────────────────────────────
function _moPersist() { _saveMenuConfig(); _moRefresh(); }
function _moToggleProduct(id, show) {
  const h = MENU_CONFIG.hiddenProducts.filter(x => x !== id);
  MENU_CONFIG.hiddenProducts = show ? h : [...h, id]; _moPersist();
  if (!show || !_moIsHiddenCat(_moProducts().find(p => p.id === id)?.category)) window.dispatchEvent(new CustomEvent('sahten:availability', { detail: { id, available: show } }));
}
function _moToggleAll(show) { MENU_CONFIG.hiddenProducts = show ? [] : _moProducts().map(p => p.id); if (show) MENU_CONFIG.hiddenCategories = []; _moPersist(); _moProducts().forEach(p => window.dispatchEvent(new CustomEvent('sahten:availability', { detail: { id: p.id, available: show } }))); }
function _moCatToggle(cat, show) {
  const h = MENU_CONFIG.hiddenCategories.filter(x => x !== cat);
  MENU_CONFIG.hiddenCategories = show ? h : [...h, cat]; _moPersist();
}
function _moCatMove(cat, direction) {
  const cats = _getOrderedCategories(_getAllCategories(_moProducts()));
  const idx = cats.indexOf(cat); const to = idx + direction;
  if (idx < 0 || to < 0 || to >= cats.length) return;
  cats.splice(idx, 1); cats.splice(to, 0, cat); MENU_CONFIG.categoryOrder = cats; _moPersist();
}
function _moCatMoveTo(cat, target) {   // arrastrar y soltar: la categoría queda en el lugar de la de destino
  const cats = _getOrderedCategories(_getAllCategories(_moProducts()));
  const from = cats.indexOf(cat), to = cats.indexOf(target); if (from < 0 || to < 0 || from === to) return;
  cats.splice(from, 1); cats.splice(to, 0, cat); MENU_CONFIG.categoryOrder = cats; _moPersist();
}
async function _moPublish() {
  try {
    const r = await SAHTEN.online.publish.publish();
    if (r) { MENU_CONFIG.lastPublished = { at: new Date().toISOString(), hash: _moHash() }; _saveMenuConfig(); _moRefresh(); }
  } catch (e) { alert('No se pudo publicar: ' + e.message); }
}
// Vista previa dentro de la app (no depende del navegador ni de permisos del sistema)
let _moPv = { device: 'mobile', prevFocus: null };
function _moPreview() {
  let html; try { html = SAHTEN.online.publish.previewHtml(); } catch (e) { alert('La vista previa no está disponible: ' + e.message); return; }
  _moClosePreview();
  _moPv.prevFocus = document.activeElement;
  const ov = document.createElement('div'); ov.className = 'mo-pv'; ov.id = 'mo-pv';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Vista previa del menú online');
  ov.innerHTML = `<div class="mo-pv-box">
    <div class="mo-pv-bar">
      <b>Vista previa del menú</b>
      <div class="mo-chips" role="group" aria-label="Dispositivo">
        <button class="mo-chip ${_moPv.device === 'mobile' ? 'on' : ''}" data-pv-dev="mobile" aria-pressed="${_moPv.device === 'mobile'}">Celular</button>
        <button class="mo-chip ${_moPv.device === 'desktop' ? 'on' : ''}" data-pv-dev="desktop" aria-pressed="${_moPv.device === 'desktop'}">Escritorio</button>
      </div>
      <span style="flex:1"></span>
      <button class="btn" data-pv="external">Abrir en el navegador</button>
      <button class="btn btn-accent" data-pv="close" autofocus>Cerrar</button>
    </div>
    <div class="mo-pv-stage ${_moPv.device}"><iframe id="mo-pv-frame" title="Vista previa del menú online" sandbox="allow-scripts allow-same-origin"></iframe></div>
    <div class="mo-pv-note">Así se ve la página publicada. Es una vista previa: no se publica nada ni se envían pedidos.</div>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById('mo-pv-frame').srcdoc = html;
  ov.addEventListener('click', e => {
    if (e.target === ov) return _moClosePreview();
    const t = e.target.closest('[data-pv],[data-pv-dev]'); if (!t) return;
    if (t.dataset.pv === 'close') _moClosePreview();
    else if (t.dataset.pv === 'external') _moPreviewExternal();
    else if (t.dataset.pvDev) {
      _moPv.device = t.dataset.pvDev;
      ov.querySelector('.mo-pv-stage').className = 'mo-pv-stage ' + _moPv.device;
      ov.querySelectorAll('[data-pv-dev]').forEach(b => { const on = b.dataset.pvDev === _moPv.device; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    }
  });
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); _moClosePreview(); } });
  const first = ov.querySelector('[data-pv="close"]'); first && first.focus();
}
function _moClosePreview() {
  const ov = document.getElementById('mo-pv'); if (!ov) return;
  ov.remove();
  try { _moPv.prevFocus && _moPv.prevFocus.focus && _moPv.prevFocus.focus(); } catch (e) { /* */ }
}
// Abrir en el navegador del sistema (escritorio) o en pestaña nueva (web); si falla, se avisa en vez de quedar mudo
async function _moPreviewExternal() {
  try { await SAHTEN.online.publish.preview(); }
  catch (e) { alert('No se pudo abrir en el navegador: ' + (e && e.message || e) + '\nPodés usar la vista previa dentro de la app.'); }
}

// Un solo juego de listeners para toda la pantalla (se re-dibuja seguido; no se acumulan)
function _moBind(panel) {
  if (_moUi.bound) return; _moUi.bound = true;
  panel.addEventListener('click', e => {
    const ad = e.target.closest('[data-mo-desc]');
    if (ad && panel.contains(ad)) { _moUi.desc[ad.dataset.moDesc] = !_moUi.desc[ad.dataset.moDesc]; _moRenderList(); const i = panel.querySelector(`[data-mo-pdesc="${CSS.escape(ad.dataset.moDesc)}"]`); i && i.focus(); return; }
    const rc = e.target.closest('[data-mo-recipe]');   // de acá se salta a la receta (nombre, categoría, ingredientes y foto) y al volver se actualiza la lista
    if (rc && panel.contains(rc)) { const i = PRODUCTS.findIndex(x => x.id === rc.dataset.moRecipe); if (i >= 0 && typeof openRecipe === 'function') openRecipe(i); return; }
    const mn = e.target.closest('[data-mo-menu]');    // y de acá al Menú (precio, tier, etiquetas), ya filtrado por ese producto
    if (mn && panel.contains(mn)) { const pr = PRODUCTS.find(x => x.id === mn.dataset.moMenu); if (!pr) return; showPanel('productos'); const q = document.getElementById('prod-search'); if (q) { q.value = pr.name; if (typeof renderProductos === 'function') renderProductos(); } return; }
    const t = e.target.closest('[data-mo],[data-mo-filter],[data-mo-collapse],[data-mo-catmove],[data-mo-tab]'); if (!t || !panel.contains(t)) return;
    if (t.dataset.mo === 'publish') _moPublish();
    else if (t.dataset.mo === 'preview') _moPreview();
    else if (t.dataset.mo === 'preview-ext') _moPreviewExternal();
    else if (t.dataset.mo === 'all-on') _moToggleAll(true);
    else if (t.dataset.mo === 'all-off') _moToggleAll(false);
    else if (t.dataset.mo === 'open-site') _moTab('site');
    else if (t.dataset.moTab) _moTab(t.dataset.moTab);
    else if (t.dataset.mo === 'open-settings') { const d = document.getElementById('mo-settings'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = d.querySelector('[data-mo-set=whatsappNumber]'); i && i.focus(); } }
    else if (t.dataset.moFilter) { _moUi.filter = t.dataset.moFilter; _moRefresh(); }
    else if (t.dataset.moCollapse) { const k = t.dataset.moCollapse; _moUi.collapsed[k] = !_moUi.collapsed[k]; _moRenderList(); }
    else if (t.dataset.moCatmove) _moCatMove(t.dataset.cat, +t.dataset.moCatmove);
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.moProd) _moToggleProduct(t.dataset.moProd, t.checked);
    else if (t.dataset.moCheck) { MENU_CONFIG[t.dataset.moCheck] = t.checked; _moPersist(); }
  });
  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'mo-search') { _moUi.q = t.value; _moRenderList(); }
    else if (t.dataset.moSet) { MENU_CONFIG[t.dataset.moSet] = t.value; _saveMenuConfig(); _moRenderStatus(); _moRenderPreview(); }
    else if (t.dataset.moCat) { _moSite().catering[t.dataset.moCat] = t.value; _saveMenuConfig(); _moRenderStatus(); }
    else if (t.dataset.moPdesc) { const p = _moProducts().find(x => x.id === t.dataset.moPdesc); if (p) { p.description = t.value; if (typeof scheduleSave === 'function') scheduleSave(); _moRenderStatus(); } }
  });
  let dragged = null;
  panel.addEventListener('dragstart', e => { const h = e.target.closest && e.target.closest('[data-drag-cat]'); if (!h) return; dragged = h.dataset.dragCat; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragged); } catch (x) { /* */ } });
  panel.addEventListener('dragover', e => { const b = e.target.closest && e.target.closest('[data-cat-block]'); if (!b || dragged == null || !b.dataset.catBlock) return; e.preventDefault(); b.classList.add('dragover'); });
  panel.addEventListener('dragleave', e => { const b = e.target.closest && e.target.closest('[data-cat-block]'); b && b.classList.remove('dragover'); });
  panel.addEventListener('drop', e => { const b = e.target.closest && e.target.closest('[data-cat-block]'); if (!b || dragged == null) return; e.preventDefault(); const from = dragged; dragged = null; _moCatMoveTo(from, b.dataset.catBlock); });
  panel.addEventListener('dragend', () => { dragged = null; panel.querySelectorAll('.dragover').forEach(x => x.classList.remove('dragover')); });
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
// Pedidos: el origen (web/mostrador) es independiente del tipo de entrega.
// Se conservan las dos columnas en escritorio. En pantallas estrechas se alternan.
let onlineBoardMobileType = 'pickup';
let onlineBoardRecentOpen = true;
const _isOnlineOrder = o => SAHTEN.orderWorkflow.isOnlineOrder(o);
const _activeOnlineOrders = () => SAHTEN.orderWorkflow.activeOnlineOrders(SAHTEN_ORDERS);
function setOnlineOrderFilter(value) {
  onlineBoardMobileType = value === 'delivery' ? 'delivery' : 'pickup';
  _renderDeliveryTab();
}
function toggleOnlineBoardRecent() {
  onlineBoardRecentOpen = !onlineBoardRecentOpen;
  _renderDeliveryTab();
}
function _injectDeliveryTab() {
  if (window._deliveryTabPatched) return;
  SAHTEN.events.afterRender('renderMostrador', () => _addDeliveryTabBtn());
  window._deliveryTabPatched = true;
  _addDeliveryTabBtn();
}

function _addDeliveryTabBtn() {
  const tabBar = document.querySelector('#panel-mostrador .most-tabs');
  if (!tabBar || tabBar.querySelector('.most-tab-delivery')) return;

  const orders = (typeof SAHTEN_ORDERS !== 'undefined') ? SAHTEN_ORDERS : [];
  const deliveryCount = _activeOnlineOrders().length;
  const pendingDel = _activeOnlineOrders().filter(o => o.status === 'pendiente').length;

  const btn = document.createElement('button');
  btn.className = 'most-tab most-tab-delivery' + (typeof mostradorTab !== 'undefined' && mostradorTab === 'delivery' ? ' active' : '');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Pedidos' +
    (pendingDel > 0 ? ' <span class="most-tab-badge" style="background:var(--red)">' + pendingDel + '</span>' : ' <span class="most-tab-badge">' + deliveryCount + '</span>');
  btn.onclick = function () { mostSetTab('online'); };
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
    if (tab === 'delivery' || tab === 'online') {
      mostradorTab = 'delivery';
      _saveTabState('mostrador', 'delivery');
      renderMostrador();
      return;
    }
    return next(tab);
  });
  window._mostSetTabDeliveryPatched = true;
}

// Render delivery content when tab is active
function _patchDeliveryContent() {
  SAHTEN.events.afterRender('renderMostrador', () => {
    if (mostradorTab === 'delivery') _renderDeliveryTab();
  });
  if (mostradorTab === 'delivery') _renderDeliveryTab();
}

function _onlineBoardCard(o, recent = false) {
  const workflow = SAHTEN.orderWorkflow;
  const id = _esc(o.id);
  const date = new Date(o.createdAt || '');
  const time = Number.isNaN(date.getTime()) ? 'Hora sin registrar' : date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const num = '#' + String(o.num || 0).padStart(4, '0');
  const count = workflow.orderUnitCount(o);
  const next = recent ? null : workflow.nextOnlineStatus(o);
  const delivery = workflow.onlineOrderType(o) === 'delivery';
  const online = workflow.isOnlineOrder(o);
  const statusClass = ['pendiente', 'en_preparacion', 'listo', 'enviado', 'retirado', 'entregado', 'cancelado'].includes(o.status) ? o.status : 'pendiente';
  const status = workflow.onlineStatusLabel(o);
  const items = (o.items || []).map(it => '<li>' + _esc(it.qty) + ' × ' + _esc(it.name || 'Producto') + '</li>').join('');
  const phone = String(o.customerPhone || '').trim();
  const dial = phone.replace(/[^0-9+]/g, '');
  const payment = o.paymentStatusLabel || (o.paymentStatus ? 'Estado de pago: ' + o.paymentStatus : 'Cobro sin confirmar');
  const route = !recent ? SAHTEN.delivery.handoff.details(o) : null;
  const paid = ['paid', 'overpaid'].includes(o.paymentStatus);
  const warning = ['rejected', 'partial', 'in_mediation', 'charged_back', 'refunded', 'partially_refunded', 'overpaid'].includes(o.paymentStatus);
  return '<article class="online-board-card online-board-card--' + statusClass + '">' +
    '<div class="online-board-card-top">' +
      '<button type="button" class="online-board-order-link" data-online-action="open" data-id="' + id + '" aria-label="Abrir detalles de la orden ' + _esc(num) + '">' + _esc(num) + '</button>' +
      '<span class="online-board-origin">' + (online ? 'Web' : 'Mostrador') + '</span>' +
      '<span class="online-board-status online-board-status--' + statusClass + '">' + _esc(status) + '</span>' +
    '</div>' +
    '<div class="online-board-name">' + _esc(o.customerName || 'Consumidor Final') + '</div>' +
    '<div class="online-board-card-bottom"><div class="online-board-quantity">' + count + ' ' + (count === 1 ? 'producto' : 'productos') +
      (!recent ? ' <span class="online-board-age" data-order-age="' + id + '">' + _esc(workflow.orderAgeLabel(o)) + '</span>' : '') + '</div><strong class="online-board-total">$' + _fmtN(o.total) + '</strong></div>' +
    (SAHTEN.orderActions.label(o)?'<div class="online-board-estimate">'+_esc(SAHTEN.orderActions.label(o))+'</div>':'') +
    (!recent?'<div class="online-board-contact-actions"><button type="button" class="online-board-detail" data-online-action="confirm" data-id="'+id+'">'+(online?'Confirmar por WhatsApp':'Tiempo y WhatsApp')+'</button><button type="button" class="online-board-detail online-board-cancel" data-online-action="cancel" data-id="'+id+'">Cancelar pedido</button></div>':'') +
    (route ? '<div class="online-board-route-actions" role="group" aria-label="Reparto de la orden '+_esc(num)+'"><button type="button" class="online-board-detail" data-online-action="route-copy" data-id="'+id+'" aria-label="Copiar ruta de la orden '+_esc(num)+'"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>Copiar ruta</button><a class="online-board-detail" href="'+_esc(route.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Abrir ruta de la orden '+_esc(num)+' en Google Maps">Abrir en Maps</a><button type="button" class="online-board-detail" data-online-action="route-share" data-id="'+id+'" aria-label="Compartir ruta de la orden '+_esc(num)+'">Compartir</button>'+(!route.exact?'<small>Destino por dirección: revisá la ubicación en Maps.</small>':'')+'</div>' : '') +
    (o.remoteStatusPending?'<div class="online-board-missing">Estado pendiente de sincronizar <button type="button" class="online-board-detail" data-online-action="sync-status" data-id="'+id+'">Reintentar</button></div>':'') +
    (warning ? '<div class="online-board-payment is-warning"><strong>' + _esc(payment) + '</strong></div>' : '') +
    '<details class="online-board-disclosure" data-order-details="' + id + '"><summary><span class="details-closed">Ver detalles</span><span class="details-open">Ocultar detalles</span><span class="sr-only"> de la orden ' + _esc(num) + '</span></summary><div class="online-board-expanded">' +
    '<div class="online-board-time"><time datetime="' + _esc(o.createdAt || '') + '">Creado ' + _esc(time) + '</time></div>' +
    (items ? '<ul class="online-board-items">' + items + '</ul>' : '') +
    (delivery ? '<div class="online-board-address' + (o.address ? '' : ' online-board-missing') + '"><strong>Entrega</strong><span>' + (SAHTEN.orderDetails.deliveryAddressLines(o).map(_esc).join('<br>') || 'Falta dirección de entrega') + '</span>' +
      ((o.deliveryZone || o._zoneName) ? '<span>Zona: ' + _esc(o.deliveryZone || o._zoneName) + '</span>' : '') + '</div>' : '') +
    (phone ? '<a class="online-board-phone" href="tel:' + _esc(dial) + '">Llamar: ' + _esc(phone) + '</a>' : delivery ? '<div class="online-board-missing">Sin teléfono de contacto</div>' : '') +
    (o.notes ? '<div class="online-board-note"><strong>Indicaciones</strong> ' + _esc(o.notes) + '</div>' : '') +
    '<div class="online-board-payment' + (warning ? ' is-warning' : paid ? ' is-paid' : '') + '"><strong>' + _esc(payment) + '</strong><span>' + _esc(o.paymentName || o.paymentMethod || 'Medio de pago sin especificar') + '</span></div>' +
    (o.paymentMethod==='efectivo'&&o.cashTendered!=null?'<div class="online-board-payment">Paga con: $'+_fmtN(o.cashTendered)+' · Vuelto: $'+_fmtN(o.cashChange)+'</div>':'')+
    (delivery ? '<span class="online-board-shipping">Incluye envío: $' + _fmtN(o.shipping) + '</span>' : '') +
    (o.deliverySnapshot ? '<div>'+_esc(o.deliverySnapshot.effectiveZone?.name||'Delivery')+' · '+Number(o.deliverySnapshot.routeKm).toFixed(2)+' km por calles · Ahorro en envío: $'+_fmtN(o.deliverySnapshot.discount)+(o.deliverySnapshot.authorization?.approved?' · Autorización registrada':'')+'</div>' : '') +
    '<div class="online-board-actions">' +
      '<button type="button" class="online-board-detail" data-online-action="open" data-id="' + id + '">Abrir pedido completo</button>' +
      '<button type="button" class="online-board-detail" data-online-action="print" data-id="' + id + '" aria-label="Imprimir orden ' + _esc(num) + '">Imprimir</button></div></div></details>' +
      (next ? '<button type="button" class="online-board-next" data-online-action="next" data-id="' + id + '">' + _esc(next.label) + '</button>' : '') +
  '</article>';
}

// Solo cambia el texto del tiempo: no reemplaza tarjetas ni interrumpe el foco.
setInterval(() => {
  document.querySelectorAll('[data-order-age]').forEach(el => {
    const order = SAHTEN_ORDERS.find(o => String(o.id) === el.dataset.orderAge);
    if (order) el.textContent = SAHTEN.orderWorkflow.orderAgeLabel(order);
  });
}, 60000);

function _onlineBoardColumn(type, orders) {
  const isPickup = type === 'pickup';
  const entries = orders.filter(o => SAHTEN.orderWorkflow.onlineOrderType(o) === type);
  const label = isPickup ? 'Retiro en local / Mostrador' : 'Delivery';
  return '<section class="online-board-column ' + (onlineBoardMobileType === type ? 'is-selected' : '') + '" aria-label="' + label + '">' +
    '<header class="online-board-column-head"><h3>' + label + '</h3><span class="online-board-count">' + entries.length + '</span></header>' +
    '<div class="online-board-column-cards">' + (entries.length ? entries.map(o => _onlineBoardCard(o)).join('') :
      '<div class="online-board-empty">No hay pedidos activos para ' + (isPickup ? 'retirar' : 'delivery') + '.</div>') + '</div>' +
  '</section>';
}

function _onlineBoardClick(event) {
  const button = event.target.closest('[data-online-action]');
  if (!button) return;
  const action = button.dataset.onlineAction;
  if (action === 'refresh') { _refreshDelivery(); return; }
  if (action === 'history') { mostSetTab('historial'); return; }
  if (action === 'recent') { toggleOnlineBoardRecent(); return; }
  if (action === 'pickup' || action === 'delivery') { setOnlineOrderFilter(action); return; }
  const order = SAHTEN_ORDERS.find(o => String(o.id) === button.dataset.id);
  if (!order) return;
  if (action === 'sync-status') { SAHTEN.online.controller.pushStatus(order).then(ok=>{if(!ok)sahtenToast('No se pudo sincronizar. Revisá la conexión.',{kind:'error'});_renderDeliveryTab();}); return; }
  if (action === 'confirm') { SAHTEN.orderActions.confirm(order.id); return; }
  if (action === 'cancel') { SAHTEN.orderActions.cancel(order.id); return; }
  if (action === 'open') { openOrderDetail(order.id); return; }
  if (action === 'print') { printComanda(order.id); return; }
  if (action === 'route-copy' || action === 'route-share') { button.disabled=true;const task=action==='route-copy'?SAHTEN.delivery.handoff.copy(order.id):SAHTEN.delivery.handoff.share(order.id);Promise.resolve(task).finally(()=>{button.disabled=false;});return; }
  if (action === 'next') {
    const next = SAHTEN.orderWorkflow.nextOnlineStatus(order);
    if (next) {
      orderSetStatus(order.id, next.status);
      const candidates=[...document.querySelectorAll('[data-online-action][data-id]')].filter(el=>el.dataset.id===String(order.id));
      (candidates.find(el=>el.dataset.onlineAction==='next') || candidates.find(el=>el.dataset.onlineAction==='open'))?.focus({preventScroll:true});
    }
  }
}

function _renderDeliveryTab() {
  const c = document.getElementById('most-tab-content');
  if (!c) return;
  const expanded = new Set([...c.querySelectorAll('[data-order-details][open]')].map(el => el.dataset.orderDetails));
  const workflow = SAHTEN.orderWorkflow;
  const active = _activeOnlineOrders().sort(workflow.operationalSort);
  const pickup = active.filter(o => workflow.onlineOrderType(o) === 'pickup').length;
  const delivery = active.length - pickup;
  const pending = active.filter(o => o.status === 'pendiente').length;
  const preparing = active.filter(o => o.status === 'en_preparacion').length;
  const recently = workflow.recentOnlineOrders(SAHTEN_ORDERS).slice(0, 8);

  c.innerHTML = '<div class="delivery-list online-board">' +
    '<header class="online-board-toolbar">' +
      '<div><h2>Pedidos</h2><p>' + active.length + ' ' + (active.length === 1 ? 'pedido activo' : 'pedidos activos') +
      ' · ' + pending + ' pendientes · ' + preparing + ' en preparación</p></div>' +
      '<div class="online-board-toolbar-actions">' +
        '<button type="button" class="online-board-utility" data-online-action="refresh">Actualizar vista</button>' +
        '<button type="button" class="online-board-utility" data-online-action="history">Historial</button>' +
      '</div>' +
    '</header>' +
    '<nav class="online-board-mobile-switch" aria-label="Tipo de entrega">' +
      '<button type="button" data-online-action="pickup" aria-pressed="' + (onlineBoardMobileType === 'pickup') + '">Retiro <span>' + pickup + '</span></button>' +
      '<button type="button" data-online-action="delivery" aria-pressed="' + (onlineBoardMobileType === 'delivery') + '">Delivery <span>' + delivery + '</span></button>' +
    '</nav>' +
    '<div class="online-board-columns">' + _onlineBoardColumn('pickup', active) + _onlineBoardColumn('delivery', active) + '</div>' +
    '<section class="online-board-recent" aria-label="Pedidos completados recientemente">' +
      '<button type="button" class="online-board-recent-toggle" data-online-action="recent" aria-expanded="' + onlineBoardRecentOpen +
        '" aria-controls="online-board-recent-list"><span>Completados recientemente <span class="online-board-count">' + recently.length +
        '</span></span><span aria-hidden="true">' + (onlineBoardRecentOpen ? '−' : '+') + '</span></button>' +
      '<div class="online-board-recent-list" id="online-board-recent-list"' + (onlineBoardRecentOpen ? '' : ' hidden') + '>' +
        (recently.length ? recently.map(o => _onlineBoardCard(o, true)).join('') :
        '<div class="online-board-empty">No hay pedidos finalizados en los últimos 30 minutos.</div>') +
      '</div>' +
    '</section>' +
  '</div>';
  c.querySelectorAll('[data-order-details]').forEach(el => { el.open = expanded.has(el.dataset.orderDetails); });
  c.onclick = _onlineBoardClick;
  // Actualizar contador de la pestaña sin forzar un render completo de Mostrador.
  const badge = document.querySelector('#panel-mostrador .most-tab-delivery .most-tab-badge');
  if (badge) { badge.textContent = pending || active.length; badge.style.background = pending ? 'var(--red)' : ''; }
}

function _refreshDelivery() {
  if (typeof _loadOrders === 'function') SAHTEN_ORDERS = _loadOrders();
  else { try { SAHTEN_ORDERS = JSON.parse(localStorage.getItem('sahten_orders') || '[]'); } catch (e) { /* no reemplazar datos ante error */ } }
  _renderDeliveryTab();
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
    _injectDeliveryTab();
    _patchMostSetTab();
    _patchDeliveryContent();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
  else patch();
})();

Object.assign(window, {
  renderMenuOnline, MENU_CONFIG, _saveMenuConfig,
  _moToggleProduct, _moToggleAll, _moCatToggle, _moCatMove,
  setOnlineOrderFilter, toggleOnlineBoardRecent, _renderDeliveryTab, _refreshDelivery,
});

// Una foto cambió (de donde sea: Menú, Receta, Costo Receta o acá): se actualizan avisos «sin foto», contadores y vista previa.
function _moAfterChange() { if (!document.getElementById('mo-list')) return; _moRenderList(); _moRenderStatus(); _moRenderPreview(); }
window.addEventListener('sahten:photo', _moAfterChange);
window._moAfterRecipe = _moAfterChange;   // al cerrar el modal de receta

function _moAvailabilityStatus() {
  const el = document.getElementById('mo-availability'); if (!el) return;
  const a = SAHTEN.online?.availability?.info();
  if (!SAHTEN_SUPABASE?.storeId) { el.textContent = 'Sin tienda conectada: la disponibilidad se guarda en este proyecto. Publicá la carpeta para actualizar una web sin conexión.'; return; }
  const labels = {'sin cambios':'Visibilidad automática solo en la web',pendiente:'Disponibilidad pendiente',publicando:'Actualizando disponibilidad…',publicado:'Visibilidad actualizada en la tienda','sin conexión':'Sin conexión: se reintentará automáticamente',error:'Hay disponibilidad pendiente de publicar'};
  el.innerHTML = `<span>${_esc(labels[a?.state] || 'Disponibilidad automática')}${a?.pending ? ' · ' + a.pending + ' pendiente(s)' : ''}${a?.error ? ' · ' + _esc(a.error) : ''}</span>${a?.pending ? '<button class="btn" type="button" onclick="SAHTEN.online.availability.flush().catch(()=>{})">Reintentar disponibilidad</button>' : ''}`;
}
window._moAvailabilityStatus = _moAvailabilityStatus;
