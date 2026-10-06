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
    site: _menuSiteDefaults(),
  };
}
// Portada y secciones del sitio publicado (opcional: apagado, se publica solo el menú)
function _menuSiteDefaults() {
  return { enabled: false, heroTitle: '', heroSubtitle: '', ctaLabel: 'Armá tu pedido', highlights: [], favoritesTitle: 'Nuestros favoritos', aboutTitle: '', aboutText: '', hours: '', instagram: '', reviews: [], catering: { enabled: false, title: '', text: '', zone: '', notice: '' }, faq: [] };
}
window._menuConfigDefaults = _menuConfigDefaults;
function _loadMenuConfig() {
  const defaults = _menuConfigDefaults();
  try { const r = localStorage.getItem('sahten_menu_config'); if (r) { const c = {...defaults, ...JSON.parse(r)}; c.site = {..._menuSiteDefaults(), ...(c.site || {})}; c.site.catering = {..._menuSiteDefaults().catering, ...(c.site.catering || {})}; ['hiddenProducts','hiddenCategories','categoryOrder'].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; }); return c; } } catch (e) {}
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
const _moUi = { q: '', filter: 'all', collapsed: {}, desc: {}, bound: false };

function _moSite() {
  const d = _menuSiteDefaults(); const c = MENU_CONFIG.site = { ...d, ...(MENU_CONFIG.site || {}) }; c.catering = { ...d.catering, ...(c.catering || {}) };
  ['highlights', 'reviews', 'faq'].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; });
  return c;
}
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
      <div class="mo-body">
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
          <div id="mo-list"></div>
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
          <details class="mo-settings" id="mo-site"><summary>Sitio web: portada y secciones</summary><div class="mo-fields" id="mo-site-body"></div></details>
        </div>
        <aside class="mo-side" id="mo-side" aria-label="Vista previa del menú"></aside>
      </div>
    </div>`;
  _moBind(panel);
  _moRenderSite();
  _moRefresh();
}

// Estado + lista + vista previa (la barra de búsqueda y los ajustes no se redibujan: se conserva el foco)
function _moRefresh() {
  _moRenderStatus(); _moRenderChips(); _moRenderList(); _moRenderPreview();
}

function _moRenderStatus() {
  const el = document.getElementById('mo-status'); if (!el) return;
  const menu = _moMenu(); const problems = _moProblems(menu); const last = MENU_CONFIG.lastPublished;
  const prods = _moProducts(); const sinFoto = prods.filter(p => _moIsVisible(p) && MENU_CONFIG.showImages !== false && !_moImg(p)).length;
  let s = 'ok', title, sub;
  if (problems.length) { s = 'problem'; title = 'Falta completar para publicar'; sub = 'Resolvé los avisos de abajo.'; }
  else if (!last) { s = 'dirty'; title = 'Todavía no publicaste este menú'; sub = 'Mirá la vista previa y publicalo cuando estés listo.'; }
  else if (last.hash !== _moHash(menu)) { s = 'dirty'; title = 'Hay cambios sin publicar'; sub = 'Última publicación: ' + _moWhen(last.at) + '. Volvé a publicar para que los clientes los vean.'; }
  else { title = 'Menú publicado y al día'; sub = 'Última publicación: ' + _moWhen(last.at) + '.'; }
  const n = menu ? menu.products.length : 0;
  sub += ` · ${n} producto${n !== 1 ? 's' : ''} en el menú` + (sinFoto ? ` · ${sinFoto} sin foto` : '');
  el.innerHTML = `<div class="mo-status" data-s="${s}">
    <span class="mo-st-dot" aria-hidden="true"></span>
    <div class="mo-st-main"><div class="mo-st-title">${title}</div><div class="mo-st-sub">${_esc(sub)}</div></div>
    <div class="mo-st-actions">
      <button class="btn" data-mo="preview">Vista previa en pestaña</button>
      <button class="btn btn-accent" data-mo="publish" ${n ? '' : 'disabled'}>Publicar menú</button>
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
          <span class="mo-cat-name">${_esc(g.cat)}</span><span class="mo-cat-count">${vis} de ${g.items.length} visibles</span>
          <button class="mo-iconbtn" data-mo-catmove="-1" data-cat="${_esc(g.cat)}" aria-label="Subir ${_esc(g.cat)}" ${gi === 0 ? 'disabled' : ''}>▲</button>
          <button class="mo-iconbtn" data-mo-catmove="1" data-cat="${_esc(g.cat)}" aria-label="Bajar ${_esc(g.cat)}" ${gi >= cats.length - 1 ? 'disabled' : ''}>▼</button>
          <label class="mo-sw" title="${hiddenCat ? 'Mostrar' : 'Ocultar'} la categoría"><input type="checkbox" data-mo-cat="${_esc(g.cat)}" ${hiddenCat ? '' : 'checked'} aria-label="Categoría ${_esc(g.cat)} visible"><span></span></label>
        </div>`
      : `<div class="mo-cat-head" style="cursor:default"><span class="mo-cat-name">Sin categoría</span><span class="mo-cat-count">${g.items.length} producto${g.items.length !== 1 ? 's' : ''} · asignales una categoría desde Menú</span></div>`;
    const rows = open ? items.map(p => {
      const vis = _moIsVisible(p), price = _moPrice(p), img = _moImg(p), warns = _moWarnings(p);
      return `<div class="mo-prod ${vis ? '' : 'off'}">
        <label class="mo-sw"><input type="checkbox" data-mo-prod="${_esc(p.id)}" ${MENU_CONFIG.hiddenProducts.includes(p.id) ? '' : 'checked'} aria-label="${_esc(p.name)} visible"><span></span></label>
        ${showImgs ? `<div class="mo-thumb">${img ? `<img src="${_esc(img)}" alt="">` : _esc((p.name || '?').trim().charAt(0).toUpperCase())}</div>` : '<span></span>'}
        <div style="min-width:0"><div class="mo-pname">${_esc(p.name)}${p.star ? ' ⭐' : ''}${hiddenCat && !MENU_CONFIG.hiddenProducts.includes(p.id) ? ' <span style="font-size:10.5px;color:var(--accent)">(categoría oculta)</span>' : ''}</div>
          ${warns.length ? `<div class="mo-warns">${warns.map(w => `<span class="mo-warn ${w.bad ? 'bad' : ''}">${_esc(w.t)}</span>`).join('')}</div>` : ''}</div>
        <div class="mo-price ${price > 0 ? '' : 'zero'}">$${_fmtN(price)}<button class="mo-iconbtn" style="margin-left:8px" data-mo-desc="${_esc(p.id)}" aria-label="Descripción de ${_esc(p.name)}" title="Descripción corta">✎</button></div>
        ${_moUi.desc[p.id] || p.description ? `<div style="grid-column:2/-1">${_moUi.desc[p.id] ? `<input class="custom-input" style="width:100%" maxlength="220" placeholder="Descripción corta (se muestra en el menú)" data-mo-pdesc="${_esc(p.id)}" value="${_esc(p.description || '')}">` : `<div class="desc" style="font-size:12px;color:var(--muted)">${_esc(p.description)}</div>`}</div>` : ''}
      </div>`;
    }).join('') : '';
    return `<section class="mo-cat ${hiddenCat ? 'off' : ''}" data-cat-block="${_esc(g.cat)}">${head}${rows}</section>`;
  }).join('');
  el.innerHTML = html || `<div class="mo-empty">${prods.length ? 'Ningún producto coincide con tu búsqueda.' : 'Todavía no hay productos. Cargalos desde Costo Receta y Menú: acá aparecen solos.'}</div>`;
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

function _moRenderSite() {
  const el = document.getElementById('mo-site-body'); if (!el) return;
  const S = _moSite();
  const f = (label, key, ph, area) => `<label class="f">${label}${area ? `<textarea class="custom-input" rows="${area}" style="resize:vertical" data-mo-site="${key}" placeholder="${_esc(ph || '')}">${_esc(S[key])}</textarea>` : `<input type="text" class="custom-input" data-mo-site="${key}" placeholder="${_esc(ph || '')}" value="${_esc(S[key])}">`}</label>`;
  const hl = [0, 1, 2, 3].map(i => { const h = S.highlights[i] || {}; return `<div style="display:grid;grid-template-columns:56px 1fr 1.4fr;gap:8px"><input class="custom-input" placeholder="🍕" aria-label="Ícono ${i + 1}" data-mo-list="highlights" data-i="${i}" data-f="icon" value="${_esc(h.icon)}"><input class="custom-input" placeholder="Título" aria-label="Título ${i + 1}" data-mo-list="highlights" data-i="${i}" data-f="title" value="${_esc(h.title)}"><input class="custom-input" placeholder="Detalle" aria-label="Detalle ${i + 1}" data-mo-list="highlights" data-i="${i}" data-f="text" value="${_esc(h.text)}"></div>`; }).join('');
  const rows = (key, fields, ph) => S[key].map((it, i) => `<div style="display:grid;gap:6px;padding:10px;border:1px solid var(--border);border-radius:10px">${fields.map(([fk, label, area]) => area ? `<textarea class="custom-input" rows="2" style="resize:vertical" placeholder="${_esc(label)}" aria-label="${_esc(label)}" data-mo-list="${key}" data-i="${i}" data-f="${fk}">${_esc(it[fk])}</textarea>` : `<input class="custom-input" placeholder="${_esc(label)}" aria-label="${_esc(label)}" data-mo-list="${key}" data-i="${i}" data-f="${fk}" value="${_esc(it[fk])}">`).join('')}<div><button class="btn" data-mo-del="${key}" data-i="${i}">Quitar</button></div></div>`).join('');
  el.innerHTML = `
    <div class="mo-checks"><label><span class="mo-sw"><input type="checkbox" data-mo-site-check="enabled" ${S.enabled ? 'checked' : ''}><span></span></span>Publicar portada y secciones junto al menú</label></div>
    <div style="font-size:12px;color:var(--muted)">Apagado, se publica solo el menú de productos. Encendido, tu página suma portada, favoritos (los productos con ⭐), cómo funciona, tu historia, reseñas, catering, delivery y preguntas.</div>
    ${f('Título de la portada', 'heroTitle', 'Ej: Las mejores pizzas del barrio')}
    ${f('Subtítulo', 'heroSubtitle', 'Ej: Masa madre, ingredientes frescos y delivery en el día')}
    <div style="font-size:12px;font-weight:700;color:var(--muted)">Destacados de la portada (hasta 4)</div>${hl}
    ${f('Título de tu historia', 'aboutTitle', 'Ej: Nuestra historia')}
    ${f('Tu historia (separá los párrafos con una línea en blanco)', 'aboutText', '', 5)}
    ${f('Horarios de delivery', 'hours', 'Lun a Jue 18:00 a 22:00\nVie y Sáb 18:00 a 23:00', 3)}
    ${f('Instagram (usuario)', 'instagram', 'tu_usuario')}
    <div class="mo-checks"><label><span class="mo-sw"><input type="checkbox" data-mo-cat-check="enabled" ${S.catering.enabled ? 'checked' : ''}><span></span></span>Mostrar catering y eventos</label></div>
    ${S.catering.enabled ? ['title:Título:Catering y eventos', 'text:Descripción', 'zone:Zona de cobertura', 'notice:Anticipación (ej. mínimo 48 horas)'].map(x => { const [k, l, ph] = x.split(':'); return `<label class="f">${l}<input type="text" class="custom-input" data-mo-cat="${k}" placeholder="${_esc(ph || '')}" value="${_esc(S.catering[k])}"></label>`; }).join('') : ''}
    <div style="font-size:12px;font-weight:700;color:var(--muted)">Reseñas (hasta 9)</div>${rows('reviews', [['text', 'Lo que dijo el cliente', 1], ['author', 'Nombre'], ['source', 'Dónde lo dijo (Google, Instagram…)']])}
    <div><button class="btn" data-mo-add="reviews" ${S.reviews.length >= 9 ? 'disabled' : ''}>+ Agregar reseña</button></div>
    <div style="font-size:12px;font-weight:700;color:var(--muted)">Preguntas frecuentes (hasta 12)</div>${rows('faq', [['q', 'Pregunta'], ['a', 'Respuesta', 1]])}
    <div><button class="btn" data-mo-add="faq" ${S.faq.length >= 12 ? 'disabled' : ''}>+ Agregar pregunta</button></div>`;
}

// ─── Acciones ──────────────────────────────────────────
function _moPersist() { _saveMenuConfig(); _moRefresh(); }
function _moToggleProduct(id, show) {
  const h = MENU_CONFIG.hiddenProducts.filter(x => x !== id);
  MENU_CONFIG.hiddenProducts = show ? h : [...h, id]; _moPersist();
}
function _moToggleAll(show) { MENU_CONFIG.hiddenProducts = show ? [] : _moProducts().map(p => p.id); if (show) MENU_CONFIG.hiddenCategories = []; _moPersist(); }
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
function _moPreview() { try { SAHTEN.online.publish.preview(); } catch (e) { alert('La vista previa no está disponible: ' + e.message); } }

// Un solo juego de listeners para toda la pantalla (se re-dibuja seguido; no se acumulan)
function _moBind(panel) {
  if (_moUi.bound) return; _moUi.bound = true;
  panel.addEventListener('click', e => {
    const ad = e.target.closest('[data-mo-add],[data-mo-del],[data-mo-desc]');
    if (ad && panel.contains(ad)) {
      if (ad.dataset.moDesc) { _moUi.desc[ad.dataset.moDesc] = !_moUi.desc[ad.dataset.moDesc]; _moRenderList(); const i = panel.querySelector(`[data-mo-pdesc="${CSS.escape(ad.dataset.moDesc)}"]`); i && i.focus(); return; }
      const S = _moSite(); const k = ad.dataset.moAdd || ad.dataset.moDel;
      if (ad.dataset.moAdd) S[k].push(k === 'reviews' ? { text: '', author: '', source: '' } : { q: '', a: '' }); else S[k].splice(+ad.dataset.i, 1);
      _saveMenuConfig(); _moRenderSite(); _moRenderStatus(); return;
    }
    const t = e.target.closest('[data-mo],[data-mo-filter],[data-mo-collapse],[data-mo-catmove]'); if (!t || !panel.contains(t)) return;
    if (t.dataset.mo === 'publish') _moPublish();
    else if (t.dataset.mo === 'preview') _moPreview();
    else if (t.dataset.mo === 'all-on') _moToggleAll(true);
    else if (t.dataset.mo === 'all-off') _moToggleAll(false);
    else if (t.dataset.mo === 'open-settings') { const d = document.getElementById('mo-settings'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = d.querySelector('[data-mo-set=whatsappNumber]'); i && i.focus(); } }
    else if (t.dataset.moFilter) { _moUi.filter = t.dataset.moFilter; _moRefresh(); }
    else if (t.dataset.moCollapse) { const k = t.dataset.moCollapse; _moUi.collapsed[k] = !_moUi.collapsed[k]; _moRenderList(); }
    else if (t.dataset.moCatmove) _moCatMove(t.dataset.cat, +t.dataset.moCatmove);
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.moProd) _moToggleProduct(t.dataset.moProd, t.checked);
    else if (t.dataset.moCat) _moCatToggle(t.dataset.moCat, t.checked);
    else if (t.dataset.moCheck) { MENU_CONFIG[t.dataset.moCheck] = t.checked; _moPersist(); }
    else if (t.dataset.moSiteCheck) { _moSite()[t.dataset.moSiteCheck] = t.checked; _saveMenuConfig(); _moRenderStatus(); }
    else if (t.dataset.moCatCheck) { _moSite().catering[t.dataset.moCatCheck] = t.checked; _saveMenuConfig(); _moRenderSite(); _moRenderStatus(); }
  });
  panel.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'mo-search') { _moUi.q = t.value; _moRenderList(); }
    else if (t.dataset.moSet) { MENU_CONFIG[t.dataset.moSet] = t.value; _saveMenuConfig(); _moRenderStatus(); _moRenderPreview(); }
    else if (t.dataset.moSite) { _moSite()[t.dataset.moSite] = t.value; _saveMenuConfig(); _moRenderStatus(); }
    else if (t.dataset.moCat) { _moSite().catering[t.dataset.moCat] = t.value; _saveMenuConfig(); _moRenderStatus(); }
    else if (t.dataset.moList) { const L = _moSite()[t.dataset.moList]; const i = +t.dataset.i; while (L.length <= i) L.push({}); L[i][t.dataset.f] = t.value; _saveMenuConfig(); _moRenderStatus(); }
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
