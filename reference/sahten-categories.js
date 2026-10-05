// ═══════════════════════════════════════════════════════════
// SAHTEN — COSTO RECETA MULTI-SELECT + CATEGORY PILLS
// ═══════════════════════════════════════════════════════════

// ─── Multi-select state ──────────────────────────────
let crSelectedSet = new Set();

// ─── Inject checkboxes + floating bar into Costo Receta ──
function _patchCostReceta() {
  const _orig = window.renderCostReceta;
  if (typeof _orig !== 'function' || window._crPatchedMulti) return;
  window.renderCostReceta = function () {
    _orig();
    _injectCRCheckboxes();
    _updateCRBulkBar();
  };
  window._crPatchedMulti = true;
}

function _injectCRCheckboxes() {
  const cards = document.querySelectorAll('#cr-tabla-container .cr-product-card');
  cards.forEach(card => {
    const header = card.querySelector('.cr-product-header');
    if (!header || header.querySelector('.cr-checkbox')) return;

    // Get product ID from the onclick
    const onclickAttr = header.getAttribute('onclick') || '';
    const match = onclickAttr.match(/crToggle\('([^']+)'\)/);
    if (!match) return;
    const prodId = match[1];

    // Add checkbox at the start
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cr-checkbox';
    cb.checked = crSelectedSet.has(prodId);
    cb.dataset.prodId = prodId;
    cb.onclick = function (e) {
      e.stopPropagation();
      if (this.checked) crSelectedSet.add(prodId);
      else crSelectedSet.delete(prodId);
      card.classList.toggle('cr-selected', this.checked);
      _updateCRBulkBar();
    };

    // Insert before first child
    const firstChild = header.firstElementChild;
    if (firstChild) {
      firstChild.style.display = 'flex';
      firstChild.style.alignItems = 'flex-start';
      firstChild.insertBefore(cb, firstChild.firstChild);
    }

    // Mark selected
    if (crSelectedSet.has(prodId)) card.classList.add('cr-selected');
  });
}

function _updateCRBulkBar() {
  let bar = document.getElementById('cr-bulk-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'cr-bulk-bar';
    bar.className = 'cr-bulk-bar';
    document.body.appendChild(bar);
  }

  const count = crSelectedSet.size;
  if (count === 0) {
    bar.classList.remove('visible');
    return;
  }

  bar.classList.add('visible');
  bar.innerHTML =
    '<span class="cr-bulk-count">' + count + '</span>' +
    '<span>' + count + ' seleccionado' + (count > 1 ? 's' : '') + '</span>' +
    '<button class="cr-bulk-btn" onclick="crBulkStar()" title="Estrella">⭐</button>' +
    '<button class="cr-bulk-btn" onclick="crBulkToggleMenu(true)" title="Mostrar en menú">📋 Menú</button>' +
    '<button class="cr-bulk-btn" onclick="crBulkToggleMenu(false)" title="Solo receta interna">🔒 Interna</button>' +
    '<button class="cr-bulk-btn" onclick="crBulkSetCategory()" title="Categoría">📂 Categoría</button>' +
    '<button class="cr-bulk-btn danger" onclick="crBulkDelete()" title="Eliminar">🗑</button>' +
    '<button class="cr-bulk-close" onclick="crClearSelection()">✕</button>';
}

function crClearSelection() {
  crSelectedSet.clear();
  document.querySelectorAll('.cr-product-card.cr-selected').forEach(el => el.classList.remove('cr-selected'));
  document.querySelectorAll('.cr-checkbox').forEach(cb => cb.checked = false);
  _updateCRBulkBar();
}

function crBulkStar() {
  const prods = _getSelectedProducts();
  const allStarred = prods.every(p => p.star);
  prods.forEach(p => { p.star = !allStarred; });
  if (typeof scheduleSave === 'function') scheduleSave();
  renderCostReceta();
}

function crBulkToggleMenu(showInMenu) {
  const prods = _getSelectedProducts();
  prods.forEach(p => { p.recetaOnly = !showInMenu; });
  if (typeof scheduleSave === 'function') scheduleSave();
  crClearSelection();
  renderCostReceta();
  if (typeof renderProductos === 'function') renderProductos();
}

function crBulkDelete() {
  const count = crSelectedSet.size;
  if (!confirm('¿Eliminar ' + count + ' receta' + (count > 1 ? 's' : '') + '? Esta acción no se puede deshacer.')) return;
  const ids = new Set(crSelectedSet);
  // Remove from PRODUCTS array (by id, backwards to avoid index shift)
  for (let i = PRODUCTS.length - 1; i >= 0; i--) {
    if (ids.has(PRODUCTS[i].id)) PRODUCTS.splice(i, 1);
  }
  if (typeof scheduleSave === 'function') scheduleSave();
  crClearSelection();
  renderCostReceta();
  if (typeof renderProductos === 'function') renderProductos();
}

function crBulkSetCategory() {
  const prods = _getSelectedProducts();
  // Show a simple prompt with category options
  const existing = _getAllProductCategories();
  const current = prods.length === 1 ? (prods[0].category || '') : '';
  const msg = 'Categoría para ' + prods.length + ' producto' + (prods.length > 1 ? 's' : '') +
    (existing.length ? '\n\nExistentes: ' + existing.join(', ') : '') +
    '\n\n(Dejar vacío para quitar categoría)';
  const val = prompt(msg, current);
  if (val === null) return;
  prods.forEach(p => { p.category = val.trim() || ''; });
  if (typeof scheduleSave === 'function') scheduleSave();
  renderCostReceta();
  if (typeof renderProductos === 'function') renderProductos();
}

function _getSelectedProducts() {
  return [...crSelectedSet].map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
}

function _getAllProductCategories() {
  const cats = new Set();
  if (typeof PRODUCTS !== 'undefined') PRODUCTS.forEach(p => { if (p.category) cats.add(p.category); });
  return [...cats].sort();
}

// ═══════════════════════════════════════════════════════════
// CATEGORY PILL EDITOR — reusable across Menu, Recetas, etc.
// ═══════════════════════════════════════════════════════════
let _catEditPopup = null;

function openCategoryEditor(productIdx, anchorEl) {
  closeCategoryEditor();
  const p = PRODUCTS[productIdx];
  if (!p) return;

  const popup = document.createElement('div');
  popup.className = 'cat-edit-popup';
  popup.id = 'cat-edit-popup';

  const existing = _getAllProductCategories();
  const current = p.category || '';

  popup.innerHTML =
    '<div class="cat-edit-title">Categoría del producto</div>' +
    '<input type="text" class="cat-edit-input" id="cat-edit-input" value="' + _escAttr(current) + '" placeholder="Escribí una categoría..." list="cat-edit-datalist">' +
    '<datalist id="cat-edit-datalist">' + existing.map(c => '<option value="' + _escAttr(c) + '">').join('') + '</datalist>' +
    (existing.length ? '<div class="cat-edit-suggestions">' +
      existing.map(c => '<button class="cat-edit-sug" onclick="setCategoryFromSug(' + productIdx + ',\'' + _escAttr(c) + '\')">' + _esc(c) + '</button>').join('') +
      '</div>' : '<div style="font-size:12px;color:var(--muted)">Escribí para crear una nueva categoría.</div>') +
    '<div style="display:flex;gap:6px;margin-top:10px">' +
    '<button class="btn btn-accent" style="flex:1;font-size:12px;padding:6px" onclick="saveCategoryEdit(' + productIdx + ')">Guardar</button>' +
    '<button class="btn" style="font-size:12px;padding:6px" onclick="setCategoryFromSug(' + productIdx + ',\'\')">Quitar</button>' +
    '</div>';

  document.body.appendChild(popup);
  _catEditPopup = popup;

  // Position near anchor
  const rect = anchorEl.getBoundingClientRect();
  const popW = 260;
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
  if (top + 200 > window.innerHeight) top = rect.top - 210;
  popup.style.left = Math.max(8, left) + 'px';
  popup.style.top = top + 'px';

  // Focus input
  setTimeout(() => {
    const input = document.getElementById('cat-edit-input');
    if (input) { input.focus(); input.select(); }
  }, 50);

  // Enter key
  popup.querySelector('.cat-edit-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { saveCategoryEdit(productIdx); }
    if (e.key === 'Escape') { closeCategoryEditor(); }
  });

  // Click outside to close
  setTimeout(() => {
    document.addEventListener('click', _catEditOutsideClick);
  }, 100);
}

function _catEditOutsideClick(e) {
  const popup = document.getElementById('cat-edit-popup');
  if (popup && !popup.contains(e.target) && !e.target.closest('.cat-pill')) {
    closeCategoryEditor();
  }
}

function closeCategoryEditor() {
  const popup = document.getElementById('cat-edit-popup');
  if (popup) popup.remove();
  _catEditPopup = null;
  document.removeEventListener('click', _catEditOutsideClick);
}

function saveCategoryEdit(productIdx) {
  const input = document.getElementById('cat-edit-input');
  if (!input) return;
  const val = input.value.trim();
  PRODUCTS[productIdx].category = val || '';
  if (typeof scheduleSave === 'function') scheduleSave();
  closeCategoryEditor();
  // Re-render whichever page is active
  if (typeof renderCostReceta === 'function') renderCostReceta();
  if (typeof renderProductos === 'function') renderProductos();
}

function setCategoryFromSug(productIdx, cat) {
  PRODUCTS[productIdx].category = cat;
  if (typeof scheduleSave === 'function') scheduleSave();
  closeCategoryEditor();
  if (typeof renderCostReceta === 'function') renderCostReceta();
  if (typeof renderProductos === 'function') renderProductos();
}

// ═══════════════════════════════════════════════════════════
// INJECT CATEGORY PILLS INTO MENU TABLE
// ═══════════════════════════════════════════════════════════
function _patchMenuCategoryPills() {
  const _orig = window.renderProductos;
  if (typeof _orig !== 'function' || window._menuCatPillsPatched) return;
  window.renderProductos = function () {
    _orig();
    _injectMenuCatPills();
  };
  window._menuCatPillsPatched = true;
}

function _injectMenuCatPills() {
  // For table view: find the name cell and append a pill after the name
  const rows = document.querySelectorAll('#panel-productos tbody tr');
  rows.forEach(tr => {
    const nameCell = tr.querySelector('td:first-child');
    if (!nameCell || nameCell.querySelector('.cat-pill')) return;
    // Find product index from the row
    const starBtn = tr.querySelector('.star-toggle-btn');
    if (!starBtn) return;
    const onclickStr = starBtn.getAttribute('onclick') || '';
    const match = onclickStr.match(/PRODUCTS\[(\d+)\]/);
    if (!match) return;
    const idx = parseInt(match[1]);
    const p = PRODUCTS[idx];
    if (!p) return;

    const pill = document.createElement('span');
    pill.className = 'cat-pill' + (p.category ? '' : ' empty');
    pill.textContent = p.category || '+ categoría';
    pill.style.marginLeft = '6px';
    pill.onclick = function (e) {
      e.stopPropagation();
      openCategoryEditor(idx, this);
    };
    nameCell.querySelector('.inline-edit')?.parentNode?.appendChild(pill);
  });

  // For grid view: inject into each grid card
  const gridCards = document.querySelectorAll('#panel-productos .prod-grid .prod-card, #panel-productos .prod-grid > div');
  gridCards.forEach(card => {
    if (card.querySelector('.cat-pill')) return;
    // Find product index from card content
    const detailBtn = card.querySelector('[onclick*="openProductDetail"]');
    if (!detailBtn) return;
    const match = (detailBtn.getAttribute('onclick') || '').match(/openProductDetail\((\d+)\)/);
    if (!match) return;
    const idx = parseInt(match[1]);
    const p = PRODUCTS[idx];
    if (!p) return;

    const pill = document.createElement('span');
    pill.className = 'cat-pill' + (p.category ? '' : ' empty');
    pill.textContent = p.category || '+ categoría';
    pill.style.marginTop = '4px';
    pill.style.display = 'inline-block';
    pill.onclick = function (e) {
      e.stopPropagation();
      openCategoryEditor(idx, this);
    };
    // Insert after the product name
    const nameEl = card.querySelector('strong') || card.querySelector('[style*="font-weight:700"]');
    if (nameEl) nameEl.parentNode.insertBefore(pill, nameEl.nextSibling);
  });
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function _esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
function _escAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    _patchCostReceta();
    _patchMenuCategoryPills();
  }, 200);
});

Object.assign(window, {
  crSelectedSet, crClearSelection,
  crBulkStar, crBulkToggleMenu, crBulkDelete, crBulkSetCategory,
  openCategoryEditor, closeCategoryEditor, saveCategoryEdit, setCategoryFromSug,
  _getAllProductCategories,
});
