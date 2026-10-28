import { state } from '../core/state.js';
import { ingNormalize, ingPxBase, actualCostPerUnit } from '../core/costs.js';
import { around, afterRender } from '../events.js';
import { inventoryEscape as esc, inventorySearch as searchText, inventoryActionMenu, installInventoryMenus } from './inventory-shared.js';
import './inventory-catalog.css';

export function installInventoryCatalog(w) {
  const d = w.document;
  let envView = 'lista';
  const canEdit = () => !w.SAHTEN.project.session.readOnly && (!d.body.dataset.role || ['owner', 'admin'].includes(d.body.dataset.role));
  const canStock = () => !w.SAHTEN.project.session.readOnly && (!d.body.dataset.role || ['owner', 'admin', 'encargado'].includes(d.body.dataset.role));
  const money = value => w.fmt(value);
  const amount = value => new Intl.NumberFormat(state.project.locale || 'es-AR', { maximumFractionDigits: 6 }).format(value);
  const listFor = kind => kind === 'ingredientes' ? state.ingredients : state.packs;
  const field = (kind, item, key, label, type = 'text') => `<label class="merch-field"><span>${label}</span><input class="${key === 'name' ? 'env-name-input' : 'env-input'}" data-inventory-kind="${kind}" data-inventory-id="${esc(item.id)}" data-inventory-field="${key}" type="${type}" value="${esc(item[key])}" ${type === 'number' ? `min="${key === 'cantidad' ? kind === 'envases' || item.unit === 'u' ? 1 : '.001' : 0}" step="${key === 'cantidad' && (kind === 'envases' || item.unit === 'u') ? 1 : 'any'}" required` : 'maxlength="160"'} ${canEdit() ? '' : 'disabled'}></label>`;
  function unitField(item) {
    return `<label class="merch-field"><span>Unidad de compra</span><select data-inventory-kind="ingredientes" data-inventory-id="${esc(item.id)}" data-inventory-field="unit" ${canEdit() ? '' : 'disabled'}>${['g', 'kg', 'ml', 'L', 'u'].map(u => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>`;
  }
  function unitCost(kind, item) {
    const px = kind === 'ingredientes' ? ingPxBase(item) : item.precioPkg / Math.max(1, item.cantidad || 1);
    const unit = kind === 'envases' ? 'u' : item.unit === 'kg' || item.unit === 'g' ? 'kg' : item.unit === 'L' || item.unit === 'ml' ? 'L' : 'u';
    const ref = px * (unit === 'u' ? 1 : 1000);
    return { value: ref, unit, detail: unit === 'u' ? 'por unidad' : `${esc(state.project.currencySymbol || '$')}${amount(px)} por ${unit === 'kg' ? 'g' : 'ml'}` };
  }
  function actions(kind, item) {
    const attrs = `data-inventory-kind="${kind}" data-inventory-id="${esc(item.id)}"`;
    return inventoryActionMenu(item.name, `<button class="btn" ${attrs} data-inventory-action="stock">Ingresar stock</button>${kind === 'ingredientes' && item.unit === 'u' ? `<button class="btn" ${attrs} data-inventory-action="move">Mover a Mercadería</button>` : ''}<button class="btn btn-danger" ${attrs} data-inventory-action="delete">Eliminar</button>`);
  }
  function render(kind) {
    const ing = kind === 'ingredientes', prefix = ing ? 'ing' : 'env';
    const grid = d.getElementById(prefix + '-grid'), list = d.getElementById(prefix + '-list');
    if (!grid || !list) return;
    const view = ing ? d.getElementById('iv-lista')?.getAttribute('aria-pressed') === 'true' ? 'lista' : 'grilla' : envView;
    const query = searchText(d.getElementById(prefix + '-search')?.value);
    const sort = d.getElementById(prefix + '-sort')?.value || '';
    const all = listFor(kind); if (ing) all.forEach(ingNormalize);
    const items = all.filter(item => searchText([item.name, item.proveedor].join(' ')).includes(query));
    if (sort.startsWith('name')) items.sort((a, b) => a.name.localeCompare(b.name, 'es') * (sort === 'name-desc' ? -1 : 1));
    else if (sort.startsWith('price')) items.sort((a, b) => (unitCost(kind, a).value - unitCost(kind, b).value) * (sort === 'price-desc' ? -1 : 1));
    d.getElementById(prefix + '-count').textContent = `${items.length} de ${all.length} ${ing ? 'ingredientes' : 'envases'}`;
    grid.hidden = view !== 'grilla'; grid.style.display = view === 'grilla' ? '' : 'none';
    list.hidden = view !== 'lista'; list.style.display = view === 'lista' ? '' : 'none';
    ['grilla', 'lista'].forEach(v => { const btn = d.getElementById((ing ? 'iv-' : 'ev-') + v); btn?.classList.toggle('active', view === v); btn?.setAttribute('aria-pressed', String(view === v)); });
    const fields = item => `${field(kind, item, 'cantidad', ing ? 'Cantidad del paquete' : 'Unidades por paquete', 'number')}${ing ? unitField(item) : ''}${field(kind, item, 'precioPkg', 'Costo del paquete', 'number')}${field(kind, item, 'proveedor', 'Proveedor (opcional)')}`;
    const empty = `<div class="merch-empty"><h3>${all.length ? 'Sin resultados' : ing ? 'Cargá tus ingredientes' : 'Cargá tus envases'}</h3><p>${all.length ? 'Probá con otro nombre o proveedor.' : 'Agregá un artículo y su presentación de compra para calcular su costo.'}</p></div>`;
    grid.innerHTML = items.length ? items.map(item => { const cost = unitCost(kind, item); return `<article class="ing-card merch-card inventory-catalog-card">${field(kind, item, 'name', ing ? 'Nombre del ingrediente' : 'Nombre del envase')}<div class="merch-fields">${fields(item)}</div><div class="merch-cost"><span>Costo por ${cost.unit === 'u' ? 'unidad' : cost.unit}</span><strong>${money(cost.value)}</strong></div><p class="merch-hint">${cost.detail}</p>${actions(kind, item)}</article>`; }).join('') : empty;
    list.innerHTML = items.length ? `<div class="table-wrap"><table class="env-table inventory-catalog-table"><thead><tr><th>Artículo / proveedor</th><th>Presentación de compra</th><th>Costo del paquete</th><th>Costo de referencia</th><th>Acciones</th></tr></thead><tbody>${items.map(item => { const cost = unitCost(kind, item); return `<tr><td>${field(kind, item, 'name', 'Nombre')}<details class="inventory-secondary"><summary>${esc(item.proveedor || 'Agregar proveedor')}</summary>${field(kind, item, 'proveedor', 'Proveedor (opcional)')}</details></td><td><div class="inventory-quantity">${field(kind, item, 'cantidad', ing ? 'Cantidad del paquete' : 'Unidades por paquete', 'number')}${ing ? unitField(item) : '<span>u</span>'}</div></td><td>${field(kind, item, 'precioPkg', 'Costo del paquete', 'number')}</td><td><strong class="merch-unit-cost">${money(cost.value)}</strong><small>por ${cost.unit === 'u' ? 'unidad' : cost.unit}</small>${cost.unit === 'u' ? '' : `<small>${cost.detail}</small>`}</td><td>${actions(kind, item)}</td></tr>`; }).join('')}</tbody></table></div>` : empty;
  }
  function stockRows() {
    const category = w._getSavedTab('stockCat', 'ingredientes');
    const all = category === 'ingredientes' ? state.ingredients : category === 'envases' ? state.packs : category === 'mercaderia' ? state.merchandise : state.products.filter(p => !p.recetaOnly && p.productType !== 'resale');
    const status = item => { const stock = state.stock[item.id] || {}; return stock.actual <= 0 ? 'out' : stock.actual < stock.minimo ? 'low' : 'ok'; };
    const unit = item => category === 'ingredientes' ? ['g', 'kg'].includes(item.unit || 'g') ? 'g' : ['L', 'ml'].includes(item.unit) ? 'ml' : 'u' : 'u';
    const price = item => category === 'ingredientes' ? ingPxBase(item) : category === 'productos' ? actualCostPerUnit(state, item) : item.precioPkg / Math.max(1, item.cantidad || 1);
    const query = searchText(d.getElementById('stock-search')?.value), filter = d.getElementById('stock-filter')?.value || 'all';
    const items = all.filter(item => searchText(item.name).includes(query) && (filter === 'all' || status(item) === filter));
    return { category, all, items, status, unit, price };
  }
  function renderStock() {
    const root = d.getElementById('stock-content'); if (!root) return;
    const { all, items, status, unit, price } = stockRows();
    const badge = item => `<span class="inventory-state ${status(item)}">${{ out: 'Sin stock', low: 'Stock bajo', ok: 'Stock OK' }[status(item)]}</span>`;
    const stockField = (item, key, label) => `<label class="merch-field"><span>${label} (${unit(item)})</span><input class="stock-input" type="number" min="0" step="any" value="${state.stock[item.id]?.[key] || 0}" data-inventory-stock="${esc(item.id)}" data-stock-field="${key}" ${canStock() ? '' : 'disabled'}></label>`;
    const menu = item => inventoryActionMenu(item.name, `<button class="btn" data-inventory-stock-action="ingreso" data-inventory-id="${esc(item.id)}">Registrar ingreso</button><button class="btn" data-inventory-stock-action="egreso" data-inventory-id="${esc(item.id)}">Registrar retiro</button>`);
    const val = all.reduce((sum, item) => sum + Math.max(0, state.stock[item.id]?.actual || 0) * price(item), 0);
    const valueKpi = [...d.querySelectorAll('#stock-kpis .kpi')].find(el => el.textContent.includes('Valor del stock'));
    if (valueKpi) { valueKpi.dataset.sec = 'costs'; valueKpi.querySelector('.kpi-value').textContent = money(val); valueKpi.title = 'Existencias × costo de compra o producción. No es el precio de venta.'; }
    const count = d.getElementById('s2-item-count'); if (count) count.textContent = `${items.length} de ${all.length} artículos`;
    if (!items.length) { root.innerHTML = '<div class="card merch-empty"><h3>Sin artículos con estos filtros</h3><p>Revisá la categoría, el buscador o el estado seleccionado.</p></div>'; return; }
    const view = w._getSavedTab('stockView', 'tabla');
    if (view === 'grilla') root.innerHTML = `<div class="ing-grid merch-grid">${items.map(item => `<article class="ing-card merch-card"><header class="inventory-stock-heading"><strong>${esc(item.name)}</strong>${badge(item)}</header><div class="merch-fields">${stockField(item, 'actual', 'Existencias')}${stockField(item, 'minimo', 'Mínimo')}</div><div class="merch-cost" data-sec="costs"><span>Valor al costo</span><strong>${money((state.stock[item.id]?.actual || 0) * price(item))}</strong></div>${menu(item)}</article>`).join('')}</div>`;
    else root.innerHTML = `<div class="card"><div class="table-wrap"><table class="stock-table inventory-catalog-table"><thead><tr><th>Artículo</th><th>Existencias</th><th>Mínimo</th><th>Estado</th><th data-sec="costs">Valor al costo</th><th>Acciones</th></tr></thead><tbody>${items.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${stockField(item, 'actual', 'Existencias')}</td><td>${stockField(item, 'minimo', 'Mínimo')}</td><td>${badge(item)}</td><td data-sec="costs"><strong>${money((state.stock[item.id]?.actual || 0) * price(item))}</strong><small>${esc(state.project.currencySymbol || '$')}${amount(price(item))}/${unit(item)}</small></td><td>${menu(item)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  installInventoryMenus(w);
  around('renderIngredientes', () => render('ingredientes'));
  around('renderEnvases', () => render('envases'));
  afterRender('renderStock', renderStock);
  afterRender('applyData', data => { envView = data.envView === 'grilla' ? 'grilla' : 'lista'; ['grilla','lista'].forEach(v => d.getElementById('iv-'+v)?.setAttribute('aria-pressed', String((data.ingView || 'grilla') === v))); });
  d.addEventListener('click', e => {
    const view = e.target.closest('[data-env-view]'); if (view) { envView = view.dataset.envView; render('envases'); return; }
    const action = e.target.closest('[data-inventory-action]');
    if (action && canEdit()) {
      const kind = action.dataset.inventoryKind, item = listFor(kind).find(i => i.id === action.dataset.inventoryId); if (!item) return;
      if (action.dataset.inventoryAction === 'stock') w.quickMov(item.id, '', 'ingreso');
      else if (action.dataset.inventoryAction === 'move') w.SAHTEN.merchandise.moveIngredient(item.id);
      else if (action.dataset.inventoryAction === 'delete') {
        const uses = state.products.filter(p => (p[kind === 'ingredientes' ? 'ingredients' : 'packaging'] || []).some(r => r[kind === 'ingredientes' ? 'ingId' : 'envId'] === item.id));
        if (uses.length) return w.alert('Se usa en: ' + uses.map(p => p.name).join(', ') + '. Quitá esas referencias antes de eliminarlo.');
        if ((state.stock[item.id]?.actual || 0) > 0) return w.alert('Registrá la salida o ajuste del stock antes de eliminar este artículo.');
        w.showConfirm('Eliminar artículo', `¿Eliminar «${item.name}»? Se conservan los movimientos y las ventas anteriores.`, () => { const list = listFor(kind); if (!canEdit() || !list.includes(item)) return; list.splice(list.indexOf(item), 1); delete state.stock[item.id]; w.recalcAll(); });
      }
    }
    const stockAction = e.target.closest('[data-inventory-stock-action]'); if (stockAction && canStock()) w.quickMov(stockAction.dataset.inventoryId, '', stockAction.dataset.inventoryStockAction);
  });
  d.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('[data-inventory-field]') && canEdit()) {
      const kind = el.dataset.inventoryKind, item = listFor(kind).find(i => i.id === el.dataset.inventoryId); if (!item) return;
      el.setCustomValidity('');
      if (el.type === 'number' && (el.value === '' || !el.checkValidity() || !Number.isFinite(Number(el.value)))) { el.reportValidity(); return; }
      if (el.dataset.inventoryField === 'name' && !el.value.trim()) { el.setCustomValidity('Ingresá un nombre.'); el.reportValidity(); return; }
      item[el.dataset.inventoryField] = el.type === 'number' ? Number(el.value) : el.value.trim();
      if (kind === 'ingredientes') ingNormalize(item);
      w.scheduleSave(); w.recalcAll(); render(kind);
    } else if (el.matches('[data-inventory-stock]') && canStock()) {
      if (el.value === '' || !el.checkValidity() || !Number.isFinite(Number(el.value))) { el.reportValidity(); return; }
      const stock = state.stock[el.dataset.inventoryStock]; if (!stock) return;
      stock[el.dataset.stockField] = Number(el.value); w.scheduleSave(); w.renderStock();
    }
  });
  return { preferences: () => ({ envView }), render, renderStock };
}
