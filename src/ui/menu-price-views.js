import { state } from '../core/state.js';
import { channelPriceWithDisc, channelCommission } from '../core/pricing.js';
import { costPerUnit } from '../core/costs.js';
import { gfAssigned } from '../core/gf.js';
import { isPriceFixed } from '../core/price-policy.js';
import { fmt } from '../core/format.js';
import { sahtenConfirm } from './dialog.js';
import './menu-price-views.css';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VIEWS = ['lista', 'lateral', 'tarjetas', 'comparador', 'avanzada'];
export const normalizeMenuView = value => value === 'grilla' ? 'tarjetas' : VIEWS.includes(value) ? value : 'lista';
const lock = fixed => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${fixed ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M8 10V6a4 4 0 0 1 7-2'}"/></svg>`;

/** Las vistas solo presentan el catálogo; todos los cambios usan el editor y núcleo existentes. */
export function installMenuPriceViews(w = window) {
  const d = w.document, container = d.getElementById('prod-views-container');
  let channel = 'mostrador', compared = [], selected = null, inline = null, indices = [], view = 'lista', projectId = null, selection = new Set();
  const enabled = () => state.channels.filter(c => c.enabled);
  const canCost = () => !d.body.classList.contains('role-no-costs');
  const editable = () => canCost() && (!d.body.dataset.role || ['owner', 'admin'].includes(d.body.dataset.role)) && !w.SAHTEN.project.session.readOnly;
  const price = (p, id = channel) => channelPriceWithDisc(state, p, id) || 0;
  const money = n => esc(fmt(state, n));
  const savePreference = (key, value) => w._saveTabState?.(key, value);
  const status = (p, id) => `<span class="mpv-status${isPriceFixed(p, id) ? ' is-fixed' : ''}">${lock(isPriceFixed(p, id))}${isPriceFixed(p, id) ? 'Precio fijado' : 'Automático'}</span>`;
  const selectProduct = i => `<label class="mpv-check"><input type="checkbox" aria-label="Seleccionar ${esc(state.products[i].name)}" data-select-product="${i}" ${selection.has(i) ? 'checked' : ''}></label>`;
  const name = (p, i) => `<div class="mpv-identity">${w.SAHTEN.photos.thumb(p.id, p.name, { size: 36, del: false })}<div>${canCost() ? `<button type="button" class="mpv-name" data-product-detail="${i}">${esc(p.name)}</button>` : `<strong>${esc(p.name)}</strong>`}<span class="mpv-category">${esc(p.category || 'Sin categoría')}</span></div></div>`;
  const edit = (p, id = channel) => canCost() ? `<button type="button" class="mpv-edit" data-edit-price="${esc(p.id)}" data-channel="${esc(id)}">${editable() ? 'Editar precio' : 'Ver detalle'}</button>` : '';

  async function allowChange(action) {
    if (inline?.dirty && !await sahtenConfirm('Hay ajustes sin guardar. ¿Querés descartarlos para cambiar de producto, canal o vista?', { title: 'Ajustes pendientes', okLabel: 'Descartar ajustes', cancelLabel: 'Seguir editando', w })) return false;
    inline?.close('replace'); inline = null; action(); return true;
  }
  function closeInline(reason = 'replace') { inline?.close(reason); inline = null; }
  function mountInline() {
    const host = container.querySelector('[data-menu-editor]'), product = state.products.find(p => p.id === selected);
    if (!host || !product || !canCost() || w.currentPanel !== 'productos') { closeInline(); if (host) host.hidden = true; return; }
    host.hidden = false;
    if (inline?.product === product && inline.projectId === state.project.id && inline.channel === channel && host.contains(d.getElementById('pricing-title'))) return;
    closeInline();
    inline = w.SAHTEN.pricing.open(product.id, channel, { host,
      onClose: reason => { inline = null; if (reason === 'cancel') mountInline(); },
      onChannelChange: id => { channel = id; savePreference('prodPriceChannel', id); w.renderProductos(); },
    });
  }
  function details(p, id) {
    if (!canCost()) return '';
    const variable = costPerUnit(state, p, id), fixed = gfAssigned(state, p, id), fee = price(p, id) * channelCommission(state, p, id);
    return `<details class="mpv-breakdown"><summary>Costos y resultado</summary><dl><div><dt>Costo variable por unidad</dt><dd>${money(variable)}</dd></div><div><dt>Gasto fijo asignado</dt><dd>${money(fixed)}</dd></div><div><dt>Comisión estimada</dt><dd>${money(fee)}</dd></div><div><dt>Resto después de costos</dt><dd>${money(price(p, id) - variable - fixed - fee)}</dd></div></dl><button type="button" class="mpv-edit" data-edit-price="${esc(p.id)}" data-channel="${esc(id)}">Ver desglose e historial</button></details>`;
  }
  function render(nextIndices, nextView, nextSelection = selection) {
    if (!container) return;
    indices = nextIndices; selection = nextSelection; const previousView = view; view = normalizeMenuView(nextView);
    if (projectId !== state.project.id || (inline && (!state.products.includes(inline.product) || !canCost()))) {
      closeInline(); projectId = state.project.id; selected = null;
      channel = w._getSavedTab?.('prodPriceChannel', 'mostrador') || 'mostrador';
      try { compared = JSON.parse(w._getSavedTab?.('prodCompareChannels', '[]') || '[]'); } catch { compared = []; }
    }
    const channels = enabled();
    if (!channels.some(c => c.id === channel)) { closeInline(); channel = channels[0]?.id || 'mostrador'; }
    compared = Array.isArray(compared) ? compared.filter(id => channels.some(c => c.id === id)).slice(0, 3) : [];
    if (!compared.length) compared = channels.slice(0, 3).map(c => c.id);
    const picker = d.getElementById('prod-view-select'); if (picker) picker.value = view;
    const channelSelect = d.getElementById('prod-price-channel');
    channelSelect.innerHTML = channels.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''); channelSelect.value = channel;
    d.getElementById('prod-channel-control').hidden = ['comparador', 'avanzada'].includes(view);
    d.getElementById('prod-compare-controls').hidden = view !== 'comparador';
    d.getElementById('prod-compare-options').innerHTML = channels.map(c => `<label><input type="checkbox" data-compare-channel="${esc(c.id)}" ${compared.includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('');
    d.getElementById('prod-price-count').textContent = `${indices.length} producto${indices.length === 1 ? '' : 's'}`;
    d.getElementById('prod-advanced-table').hidden = view !== 'avanzada';
    d.getElementById('col-toggle-btn').closest('.ptb-col-btn').hidden = view !== 'avanzada';
    if (view !== 'avanzada') d.getElementById('col-panel').style.display = 'none';
    container.hidden = view === 'avanzada'; container.dataset.view = view;
    if (view !== 'lateral' || previousView !== view) closeInline();
    const list = container.querySelector('[data-menu-list]'), host = container.querySelector('[data-menu-editor]');
    host.hidden = view !== 'lateral';
    if (view === 'avanzada') return;
    if (!indices.length) {
      list.innerHTML = `<div class="mpv-empty">${state.products.some(p => !p.recetaOnly) ? 'No hay productos que coincidan con la búsqueda o categoría.' : 'Agregá un producto para empezar a definir sus precios.'}</div>`;
      // No perder un borrador lateral al filtrar temporalmente su producto.
      if (view === 'lateral' && inline?.dirty) mountInline(); else { closeInline(); host.hidden = true; }
      return;
    }
    if (view === 'lista') list.innerHTML = `<div class="mpv-list"><div class="mpv-list-head"><label class="mpv-check"><input type="checkbox" data-select-visible aria-label="Seleccionar productos visibles" ${indices.every(i => selection.has(i)) ? 'checked' : ''}></label><span>Producto</span><span>Precio de venta</span><span>Estado</span><span>Acción</span></div>${indices.map(i => { const p = state.products[i]; return `<article class="mpv-list-row">${selectProduct(i)}${name(p, i)}<strong class="mpv-price">${money(price(p))}</strong>${status(p, channel)}${edit(p)}</article>`; }).join('')}</div>`;
    if (view === 'tarjetas') list.innerHTML = `<div class="mpv-cards">${indices.map(i => { const p = state.products[i]; return `<article class="mpv-card"><div class="mpv-card-heading">${selectProduct(i)}${name(p, i)}</div><div class="mpv-card-price"><strong class="mpv-price">${money(price(p))}</strong>${status(p, channel)}</div>${edit(p)}${details(p, channel)}</article>`; }).join('')}</div>`;
    if (view === 'comparador') {
      const shown = channels.filter(c => compared.includes(c.id));
      list.innerHTML = `<div class="mpv-compare-wrap"><table class="mpv-compare"><thead><tr><th scope="col">Producto</th>${shown.map(c => `<th scope="col">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${indices.map(i => { const p = state.products[i]; return `<tr><th scope="row"><div class="mpv-compare-name">${selectProduct(i)}${name(p, i)}</div></th>${shown.map(c => `<td data-label="${esc(c.name)}">${canCost() ? `<button type="button" class="mpv-cell-price" data-edit-price="${esc(p.id)}" data-channel="${esc(c.id)}" aria-label="${editable() ? 'Editar' : 'Consultar'} precio de ${esc(p.name)} en ${esc(c.name)}"><strong class="mpv-price">${money(price(p, c.id))}</strong>${status(p, c.id)}<span class="mpv-cell-hint">${editable() ? 'Editar precio' : 'Ver detalle'}</span></button>` : `<strong class="mpv-price">${money(price(p, c.id))}</strong>${status(p, c.id)}`}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    }
    if (view === 'lateral') {
      if (!state.products.some(p => p.id === selected) || (!inline?.dirty && !indices.some(i => state.products[i].id === selected))) selected = state.products[indices[0]].id;
      list.innerHTML = `<div class="mpv-master">${indices.map(i => { const p = state.products[i]; return `<div class="mpv-master-row${p.id === selected ? ' is-selected' : ''}">${selectProduct(i)}<button type="button" class="mpv-master-button" data-menu-select="${esc(p.id)}" aria-pressed="${p.id === selected}"><span><strong>${esc(p.name)}</strong><span class="mpv-category">${esc(p.category || 'Sin categoría')}</span>${status(p, channel)}</span><strong class="mpv-price">${money(price(p))}</strong></button></div>`; }).join('')}</div>`;
      mountInline();
    }
  }
  const refresh = () => w.renderProductos();
  d.getElementById('prod-view-select')?.addEventListener('change', async e => {
    const desired = e.target.value; if (!await allowChange(() => w.setProdView(desired))) e.target.value = view;
  });
  d.getElementById('prod-price-channel')?.addEventListener('change', async e => {
    const desired = e.target.value;
    if (!await allowChange(() => { channel = desired; savePreference('prodPriceChannel', channel); refresh(); })) e.target.value = channel;
  });
  d.getElementById('prod-compare-options')?.addEventListener('change', e => {
    const input = e.target.closest('[data-compare-channel]'); if (!input) return;
    const id = input.dataset.compareChannel;
    if (input.checked && compared.length >= 3) { input.checked = false; d.getElementById('prod-view-feedback').textContent = 'Compará hasta 3 canales a la vez. Desmarcá uno para elegir otro.'; return; }
    if (!input.checked && compared.length === 1) { input.checked = true; d.getElementById('prod-view-feedback').textContent = 'Dejá al menos un canal seleccionado.'; return; }
    compared = input.checked ? [...compared, id] : compared.filter(c => c !== id);
    savePreference('prodCompareChannels', JSON.stringify(compared)); d.getElementById('prod-view-feedback').textContent = ''; refresh();
  });
  container?.addEventListener('change', e => {
    const input = e.target.closest('[data-select-product],[data-select-visible]'); if (!input) return;
    if (input.hasAttribute('data-select-visible')) indices.forEach(i => w.toggleProd(i, input.checked)); else w.toggleProd(Number(input.dataset.selectProduct), input.checked);
    refresh();
  });
  container?.addEventListener('click', async e => {
    const button = e.target.closest('[data-edit-price],[data-product-detail],[data-menu-select]'); if (!button) return;
    if (button.hasAttribute('data-menu-select')) { if (button.dataset.menuSelect !== selected) await allowChange(() => { selected = button.dataset.menuSelect; refresh(); }); return; }
    if (button.hasAttribute('data-product-detail')) { if (canCost()) w.openProductDetail(Number(button.dataset.productDetail)); return; }
    if (button.hasAttribute('data-edit-price')) w.SAHTEN.pricing.open(button.dataset.editPrice, button.dataset.channel);
  });
  w.SAHTEN.events.afterRender('showPanel', () => { if (w.currentPanel !== 'productos') closeInline(); });
  return { render, normalize: normalizeMenuView, price, get channel() { return channel; } };
}
