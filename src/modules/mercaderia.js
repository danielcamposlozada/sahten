import { onPanelShow, onDataChanged, afterRender } from '../events.js';
import { state } from '../core/state.js';
import { merchandiseUnitCost, calcMerchandiseCost, merchandiseCost, packCost, totalCost } from '../core/costs.js';
import { createResaleProduct, merchandiseUsages, moveIngredientToMerchandise } from '../core/merchandise.js';
import '../styles/mercaderia.css';
import { inventoryActionMenu } from '../ui/inventory-shared.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const uid = prefix => prefix + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
let prefs = { merchandiseView: 'grilla', merchandiseSearch: '', merchandiseSort: 'name-asc' };
const mayEdit = () => !window.SAHTEN.project.session.readOnly && !document.body.classList.contains('role-no-costs') && !document.body.classList.contains('role-readonly') && (!document.body.dataset.role || ['owner', 'admin'].includes(document.body.dataset.role));
const fmt = value => window.fmt(value);
const input = (item, key, label, type = 'text') => `<label class="merch-field"><span>${label}</span><input type="${type}" data-merch-id="${escape(item.id)}" data-merch-field="${key}" value="${escape(item[key])}" ${type === 'number' ? `min="${key === 'cantidad' ? 1 : 0}" step="${key === 'cantidad' ? 1 : '0.01'}" required` : 'maxlength="160"'}></label>`;
const resaleOf = item => state.products.find(p => p.productType === 'resale' && p.merchandise?.length === 1 && p.merchandise[0].merchId === item.id);

function actions(item) {
  const sale = resaleOf(item);
  return inventoryActionMenu(item.name, `
    <button class="btn" data-merch-action="sell" data-merch-id="${escape(item.id)}">${sale ? 'Ver producto de venta' : 'Crear producto de venta'}</button>
    <button class="btn" data-merch-action="purchase" data-merch-id="${escape(item.id)}">Ingresar stock</button>
    <button class="btn btn-danger" data-merch-action="delete" data-merch-id="${escape(item.id)}" aria-label="Eliminar ${escape(item.name)}">Eliminar</button>
  `);
}

export function renderMerchandise() {
  const container = document.getElementById('merch-content');
  if (!container) return;
  document.getElementById('merch-search').value = prefs.merchandiseSearch;
  document.getElementById('merch-sort').value = prefs.merchandiseSort;
  document.querySelectorAll('[data-merch-view]').forEach(btn => {
    const active = btn.dataset.merchView === prefs.merchandiseView;
    btn.classList.toggle('active', active); btn.setAttribute('aria-pressed', String(active));
  });
  const query = normalize(prefs.merchandiseSearch);
  const items = state.merchandise.filter(item => normalize([item.name, item.proveedor, item.presentacion].join(' ')).includes(query));
  const sort = prefs.merchandiseSort;
  items.sort((a, b) => sort.startsWith('price') ? (merchandiseUnitCost(a) - merchandiseUnitCost(b)) * (sort === 'price-desc' ? -1 : 1) : a.name.localeCompare(b.name, 'es') * (sort === 'name-desc' ? -1 : 1));
  document.getElementById('merch-count').textContent = `${items.length} de ${state.merchandise.length} artículos`;
  if (!items.length) {
    container.innerHTML = `<div class="merch-empty"><h3>${query ? 'No encontramos artículos' : 'Tu mercadería, separada de los ingredientes'}</h3><p>${query ? 'Probá con otro nombre o proveedor.' : 'Cargá gaseosas, agua u otros productos terminados. Definí la presentación de compra y calcularemos el costo por unidad.'}</p>${query ? '' : '<button class="btn btn-accent" data-merch-action="new">Agregar mercadería</button>'}</div>`;
    return;
  }
  if (prefs.merchandiseView === 'lista') {
    container.innerHTML = `<div class="table-wrap"><table class="env-table merch-table"><thead><tr><th>Artículo / proveedor</th><th>Presentación de compra</th><th>Costo del paquete</th><th>Costo / unidad</th><th>Acciones</th></tr></thead><tbody>${items.map(item => `<tr>
      <td>${input(item, 'name', 'Nombre')}<details class="inventory-secondary"><summary>${escape(item.proveedor || 'Agregar proveedor')}</summary>${input(item, 'proveedor', 'Proveedor (opcional)')}</details></td>
      <td>${input(item, 'cantidad', 'Unidades por paquete', 'number')}<details class="inventory-secondary"><summary>${escape(item.presentacion || 'Presentación')}</summary>${input(item, 'presentacion', 'Presentación')}</details></td>
      <td>${input(item, 'precioPkg', 'Costo del paquete', 'number')}</td>
      <td><strong class="merch-unit-cost">${fmt(merchandiseUnitCost(item))}</strong><small>por unidad</small></td>
      <td>${actions(item)}</td></tr>`).join('')}</tbody></table></div>`;
  } else {
    container.innerHTML = `<div class="ing-grid merch-grid">${items.map(item => `<article class="ing-card merch-card">
      ${input(item, 'name', 'Nombre del artículo')}
      <div class="merch-fields">${input(item, 'presentacion', 'Presentación de compra')}${input(item, 'cantidad', 'Unidades por paquete', 'number')}${input(item, 'precioPkg', 'Costo del paquete', 'number')}${input(item, 'proveedor', 'Proveedor (opcional)')}</div>
      <div class="merch-cost"><span>Costo por unidad</span><strong class="merch-unit-cost">${fmt(merchandiseUnitCost(item))}</strong></div>
      <p class="merch-hint">${escape(item.cantidad)} unidades · Stock: ${state.stock[item.id]?.actual || 0} u · ${merchandiseUsages(state, item.id).length} productos vinculados</p>
      ${actions(item)}</article>`).join('')}</div>`;
  }
}

function changed() {
  window.initStock();
  window.scheduleSave();
  window.recalcAll();
  renderMerchandise();
}

function sell(id) {
  const existing = resaleOf(state.merchandise.find(m => m.id === id));
  const p = createResaleProduct(state, id, uid('reventa_'));
  if (!existing) {
    // Conserva las dos decisiones: crear el producto no habilita sus ventas ni lo publica.
    const config = window.MENU_CONFIG;
    if (config) { config.hiddenProducts = [...new Set([...(config.hiddenProducts || []), p.id])]; window._saveMenuConfig?.(); }
    changed();
  }
  window.openRecipe(state.products.indexOf(p));
}

function remove(id) {
  const item = state.merchandise.find(m => m.id === id); if (!item) return;
  const uses = merchandiseUsages(state, id);
  if (uses.length) return window.alert('Este artículo está vinculado a: ' + uses.map(p => p.name).join(', ') + '. Quitalo de esos productos antes de eliminarlo.');
  if ((state.stock[id]?.actual || 0) > 0) return window.alert('Este artículo tiene stock. Registrá su salida o ajuste antes de eliminarlo.');
  window.showConfirm('Eliminar mercadería', `¿Eliminar «${item.name}»? Se conservan los movimientos y las ventas anteriores.`, () => {
    if (!mayEdit() || !state.merchandise.includes(item)) return;
    state.merchandise.splice(state.merchandise.indexOf(item), 1); delete state.stock[id]; changed();
  });
}

function moveIngredient(id) {
  if (!mayEdit()) return;
  const item = state.ingredients.find(m => m.id === id); if (!item) return;
  if (item.unit !== 'u') return window.alert('Para moverlo a Mercadería debe estar cargado en unidades (u). No cambiamos automáticamente kilos o litros por unidades.');
  window.showConfirm('Mover a Mercadería', `«${item.name}» dejará Ingredientes. Conservaremos su costo, stock y uso en las recetas. No se publicará como producto automáticamente.`, () => {
    if (!mayEdit() || !state.ingredients.includes(item)) return;
    try { moveIngredientToMerchandise(state, id); changed(); window.renderIngredientes(); }
    catch (error) { window.alert(error.message); }
  });
}

export function recipeSection(p, index) {
  const rows = p.merchandise || [];
  return `<section class="merch-recipe" data-merch-product="${escape(p.id)}"><div class="merch-section-title"><h3>Mercadería</h3><button class="btn" data-merch-action="add-component" data-product-index="${index}">Agregar mercadería</button></div>
    <p class="merch-hint">Productos de proveedores que forman parte de esta preparación o combo.</p>
    ${rows.map((row, j) => `<div class="merch-component">
      <label class="merch-field"><span>Artículo</span><select data-product-index="${index}" data-merch-row="${j}" data-merch-component-field="merchId"><option value="">Seleccionar mercadería</option>${state.merchandise.map(item => `<option value="${escape(item.id)}" ${row.merchId === item.id ? 'selected' : ''}>${escape(item.name)} · ${fmt(merchandiseUnitCost(item))}/u</option>`).join('')}</select></label>
      <label class="merch-field"><span>Unidades</span><input type="number" min="0" step="any" value="${Number(row.qty) || 0}" data-product-index="${index}" data-merch-row="${j}" data-merch-component-field="qty"></label>
      <strong>${fmt(calcMerchandiseCost(state, row))}</strong><button class="btn btn-danger" aria-label="Quitar mercadería de este producto" data-merch-action="remove-component" data-product-index="${index}" data-merch-row="${j}">Quitar</button>
    </div>`).join('') || '<p class="merch-hint">Sin mercadería agregada.</p>'}
    ${!state.merchandise.length ? '<button class="btn" data-merch-action="go-merchandise">Cargar artículos en Mercadería</button>' : ''}
  </section>`;
}

export function resaleEditor(p, index) {
  const item = state.merchandise.find(m => m.id === p.merchandise?.[0]?.merchId);
  return `<div class="merch-resale" data-merch-product="${escape(p.id)}">
    <div class="info-banner"><strong>Producto de reventa</strong> · Sin receta. El costo se toma de Mercadería y el stock se descuenta del mismo artículo.</div>
    <div class="merch-fields">
      <label class="merch-field"><span>Nombre de venta</span><input data-product-index="${index}" data-merch-product-field="name" value="${escape(p.name)}" maxlength="160" required></label>
      <label class="merch-field"><span>Categoría de venta</span><input data-product-index="${index}" data-merch-product-field="category" value="${escape(p.category)}" placeholder="Ej.: Bebidas" maxlength="100"></label>
      <label class="merch-field"><span>Unidades por venta</span><input type="number" min="1" step="1" required data-product-index="${index}" data-merch-sale-qty value="${Number(p.merchandise?.[0]?.qty) || 1}"></label>
    </div>
    <div class="merch-cost"><span>${escape(item?.name || 'Artículo no encontrado')} · Costo de mercadería</span><strong>${fmt(merchandiseCost(state, p))}</strong></div>
    <section class="merch-recipe"><div class="merch-section-title"><h3>Envases adicionales</h3><button class="btn" data-merch-action="add-pack" data-product-index="${index}">Agregar envase</button></div>
      ${(p.packaging || []).map((row, j) => `<div class="merch-component">
        <label class="merch-field"><span>Envase</span><select data-product-index="${index}" data-merch-pack="${j}" data-merch-pack-field="envId"><option value="">Seleccionar envase</option>${state.packs.map(env => `<option value="${escape(env.id)}" ${row.envId === env.id ? 'selected' : ''}>${escape(env.name)}</option>`).join('')}</select></label>
        <label class="merch-field"><span>Unidades</span><input type="number" min="1" step="1" value="${row.qty || 1}" data-product-index="${index}" data-merch-pack="${j}" data-merch-pack-field="qty"></label>
        <button class="btn btn-danger" data-merch-action="remove-pack" data-product-index="${index}" data-merch-pack="${j}">Quitar</button></div>`).join('') || '<p class="merch-hint">El artículo ya viene terminado. Agregá una bolsa u otro envase solo si corresponde.</p>'}
    </section>
    <div class="merch-cost"><span>Costo variable total por venta</span><strong>${fmt(totalCost(state, p))}</strong></div>
    <p class="merch-hint">Mercadería ${fmt(merchandiseCost(state, p))} + envases ${fmt(packCost(state, p))}. Los precios por canal y los gastos fijos se ajustan en Productos.</p>
    <div class="merch-actions">
      <button class="btn btn-primary" data-merch-action="price" data-product-index="${index}">Ajustar precio por canal</button>
      <button class="btn" data-sale-eligibility="${escape(p.id)}">${p.recetaOnly ? 'Uso interno · habilitar para venta' : 'Producto de venta · volver a interno'}</button>
      <button class="btn" data-merch-action="go-merchandise">Ver Mercadería</button>
      <button class="btn" onclick="closeRecipe()">Cerrar</button>
    </div>
    <p class="merch-hint">Los productos nuevos comienzan pausados y ocultos en la tienda. Revisá el precio y activá sus ventas en Productos; después elegí si lo mostrás en Tienda online.</p>
  </div>`;
}

export function register() {
  window.SAHTEN.merchandise = { render: renderMerchandise, recipeSection, resaleEditor, moveIngredient, preferences: () => ({ ...prefs }) };
  onPanelShow('mercaderia', renderMerchandise);
  onDataChanged(() => { if (window.currentPanel === 'mercaderia') renderMerchandise(); });
  afterRender('applyData', data => {
    prefs = { merchandiseView: data.merchandiseView === 'lista' ? 'lista' : 'grilla', merchandiseSearch: data.merchandiseSearch || '', merchandiseSort: data.merchandiseSort || 'name-asc' };
  });
  const search = document.getElementById('merch-search');
  search.addEventListener('input', () => { prefs.merchandiseSearch = search.value; renderMerchandise(); });
  document.getElementById('merch-sort').addEventListener('change', e => { prefs.merchandiseSort = e.target.value; renderMerchandise(); });
  document.addEventListener('click', e => {
    const view = e.target.closest('[data-merch-view]');
    if (view) { prefs.merchandiseView = view.dataset.merchView; renderMerchandise(); return; }
    const btn = e.target.closest('[data-merch-action]'); if (!btn || !mayEdit()) return;
    const action = btn.dataset.merchAction, id = btn.dataset.merchId;
    const p = state.products[Number(btn.dataset.productIndex)];
    if (action === 'new') {
      const item = { id: uid('merch_'), name: 'Nuevo artículo', presentacion: 'Paquete', cantidad: 1, unit: 'u', precioPkg: 0, proveedor: '' };
      state.merchandise.push(item); prefs.merchandiseSearch = ''; changed();
      const field = [...document.querySelectorAll('[data-merch-field="name"]')].find(el => el.dataset.merchId === item.id); field?.focus(); field?.select();
    } else if (action === 'sell') sell(id);
    else if (action === 'delete') remove(id);
    else if (action === 'purchase') window.quickMov(id, state.merchandise.find(m => m.id === id)?.name || '', 'ingreso');
    else if (action === 'go-merchandise') { window.closeRecipe(); window.showPanel('mercaderia'); }
    else if (action === 'price') { window.closeRecipe(); window.SAHTEN.pricing.open(p.id); }
    else if (p && action === 'add-component') { (p.merchandise ||= []).push({ merchId: '', qty: 1 }); window.recalcAndRender(state.products.indexOf(p)); }
    else if (p && action === 'remove-component') { p.merchandise.splice(Number(btn.dataset.merchRow), 1); window.recalcAndRender(state.products.indexOf(p)); }
    else if (p && action === 'add-pack') { (p.packaging ||= []).push({ envId: '', qty: 1, unit: 'u' }); window.recalcAndRender(state.products.indexOf(p)); }
    else if (p && action === 'remove-pack') { p.packaging.splice(Number(btn.dataset.merchPack), 1); window.recalcAndRender(state.products.indexOf(p)); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (!mayEdit()) return;
    if (el.matches('[data-merch-field]')) {
      const item = state.merchandise.find(m => m.id === el.dataset.merchId); if (!item) return;
      const key = el.dataset.merchField;
      el.setCustomValidity('');
      if (el.type === 'number' && (!Number.isFinite(Number(el.value)) || el.value === '' || Number(el.value) < (key === 'cantidad' ? 1 : 0) || (key === 'cantidad' && !Number.isInteger(Number(el.value))))) {
        el.setCustomValidity(key === 'cantidad' ? 'Ingresá una cantidad entera mayor a cero.' : 'Ingresá un costo válido, mayor o igual a cero.'); el.reportValidity(); return;
      }
      if (key === 'name' && !el.value.trim()) { el.setCustomValidity('Ingresá el nombre del artículo.'); el.reportValidity(); return; }
      item[key] = el.type === 'number' ? Number(el.value) : el.value.trim(); changed(); return;
    }
    if (!el.matches('[data-merch-component-field], [data-merch-product-field], [data-merch-sale-qty], [data-merch-pack-field]')) return;
    el.setCustomValidity('');
    if (el.type === 'number' && (el.value === '' || !el.checkValidity() || !Number.isFinite(Number(el.value)))) { el.reportValidity(); return; }
    const p = state.products[Number(el.dataset.productIndex)]; if (!p) return;
    if (el.dataset.merchProductField) {
      if (el.dataset.merchProductField === 'name' && !el.value.trim()) { el.setCustomValidity('Ingresá un nombre.'); el.reportValidity(); return; }
      p[el.dataset.merchProductField] = el.value.trim();
    } else if (el.hasAttribute('data-merch-sale-qty')) p.merchandise[0].qty = Number(el.value);
    else if (el.dataset.merchComponentField) p.merchandise[Number(el.dataset.merchRow)][el.dataset.merchComponentField] = el.type === 'number' ? Number(el.value) : el.value;
    else p.packaging[Number(el.dataset.merchPack)][el.dataset.merchPackField] = el.type === 'number' ? Number(el.value) : el.value;
    window.recalcAndRender(state.products.indexOf(p));
  });
}
