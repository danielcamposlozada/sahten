import { state } from '../core/state.js';
import { policyFor, isPriceFixed, savePricePolicy } from '../core/price-policy.js';
import { channelPriceWithDisc, channelCommission } from '../core/pricing.js';
import { costPerUnit, actualCostPerUnit } from '../core/costs.js';
import { gfAssigned, actualGfAssigned } from '../core/gf.js';
import { captureSaleCosts, summarizeSaleCosts, preparePricingQuotes, pricingQuoteIds } from '../core/sale-costs.js';
import { fmt } from '../core/format.js';
import { bindModalFocus } from './workspace.js';
import './pricing-editor.css';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = v => JSON.parse(JSON.stringify(v));
const lockIcon = locked => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="${locked ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M8 10V6a4 4 0 0 1 7.5-2'}"/></svg>`;
const fields = [['price', 'Precio de venta', 'importe final por unidad'], ['variableCost', 'Costo variable', 'receta, envases y subrecetas por unidad'], ['fixedCost', 'Gasto fijo asignado', 'importe por unidad'], ['commissionRate', 'Comisión del canal', 'porcentaje estimado del importe vendido']];

export function installPricing(w = window) {
  const d = w.document, money = n => fmt(state, n);
  const canEdit = () => !d.body.dataset.role || ['owner', 'admin'].includes(d.body.dataset.role);
  const canCost = () => !d.body.classList.contains('role-no-costs');
  const capture = (order, options) => canCost() && captureSaleCosts(state, order, options);
  const badge = (p, channel) => {
    const ids = channel ? [channel] : [...new Set([...Object.keys(p.pricingPolicies || {}), ...(p.priceFixedChannels || [])])];
    const fixed = ids.filter(id => isPriceFixed(p, id));
    if (!fixed.length) return '';
    const title = 'Precio fijado · ' + fixed.map(id => state.channels.find(c => c.id === id)?.name || id).join(', ');
    if (!canCost()) return `<span class="price-fixed-badge" title="${esc(title)}">Precio fijado</span>`;
    return `<button type="button" class="price-fixed-badge" data-price-product="${esc(p.id)}" data-price-channel="${esc(fixed[0])}" onclick="event.stopPropagation();SAHTEN.pricing.open(this.dataset.priceProduct,this.dataset.priceChannel)" title="${esc(title)}" aria-label="${esc(title + ' de ' + p.name)}">Precio fijado</button>`;
  };
  let closeCurrent = null;
  function open(id, initialChannel = 'mostrador', options = {}) {
    const product = state.products.find(p => p.id === id);
    if (!product || !canCost()) return;
    closeCurrent?.('replace');
    const projectId = state.project.id;
    const embedded = !!options.host;
    const ov = d.createElement('div'); ov.className = embedded ? 'pricing-embedded' : 'pricing-overlay';
    const box = d.createElement('section'); box.className = 'pricing-dialog' + (embedded ? ' pricing-inline' : ''); box.tabIndex = -1;
    box.setAttribute('role', embedded ? 'region' : 'dialog');
    if (!embedded) box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'pricing-title');
    ov.append(box); (options.host || d.body).append(ov);
    const drafts = {}, originals = clone(product.pricingPolicies || {});
    const channels = state.channels.filter(c => c.enabled);
    if (!channels.length) channels.push({ id: 'mostrador', name: 'Mostrador' });
    let channel = channels.some(c => c.id === initialChannel) ? initialChannel : channels[0].id, reason = '';
    let release = () => {};
    const close = (reason = 'cancel') => { release(); ov.remove(); if (closeCurrent === close) closeCurrent = null; options.onClose?.(typeof reason === 'string' ? reason : 'cancel'); };
    closeCurrent = close;
    if (!embedded) {
      release = bindModalFocus(box, { w, close, background: [d.querySelector('.app-shell'), d.querySelector('.main'), d.querySelector('.sidebar')] });
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
    }
    const draft = () => drafts[channel] ||= clone(policyFor(product, channel));
    const proposed = () => ({ ...product, pricingPolicies: { ...product.pricingPolicies, [channel]: draft() } });
    const automaticValues = () => ({
      price: channelPriceWithDisc(state, { ...proposed(), pricingPolicies: { ...product.pricingPolicies, [channel]: { ...draft(), price: null } } }, channel) || 0,
      variableCost: actualCostPerUnit(state, product), fixedCost: actualGfAssigned(state, product),
      commissionRate: state.channels.find(c => c.id === channel)?.commission || 0,
    });
    function preview() {
      const p = proposed(), price = channelPriceWithDisc(state, p, channel) || 0;
      const variable = costPerUnit(state, p, channel), fixed = gfAssigned(state, p, channel);
      const fee = price * channelCommission(state, p, channel);
      const remaining = price - variable - fixed - fee;
      const result = box.querySelector('[data-price-preview]');
      const pinned = draft().price != null;
      result.innerHTML = `<div class="pricing-result-title">Resultado por unidad · ${pinned ? 'precio fijado' : 'precio automático'}</div><dl class="pricing-breakdown"><div><dt>Precio de venta</dt><dd data-result="price">${money(price)}</dd></div><div><dt>− Costo variable</dt><dd data-result="variable">${money(variable)}</dd></div><div><dt>− Gasto fijo asignado</dt><dd data-result="fixed">${money(fixed)}</dd></div><div><dt>− Comisión estimada (${(channelCommission(state, p, channel) * 100).toFixed(2)} %)</dt><dd data-result="fee">${money(fee)}</dd></div><div class="pricing-remainder"><dt>Resto después de costos</dt><dd data-result="remaining">${money(remaining)} <small>(${price ? (remaining / price * 100).toFixed(1) : '0'} %)</small></dd></div></dl><p data-formula-note>${pinned ? 'El precio está fijado: cambiar costos o comisión modifica el resto disponible, sin cambiar el precio de venta.' : 'El precio se recalcula con los costos asignados y las reglas de este canal. La comisión estimada se descuenta del ingreso; no aumenta el precio.'}</p>${remaining < 0 ? '<span role="status">El precio no cubre los costos asignados.</span>' : ''}`;
      box.querySelector('[data-live-result]').innerHTML = `<span><small>Precio ${pinned ? 'fijado' : 'automático'}</small><strong>${money(price)}</strong></span><span><small>Resto por unidad</small><strong>${money(remaining)}</strong></span>`;
      const automatic = automaticValues();
      fields.forEach(([key]) => {
        const input = box.querySelector(`[data-value="${key}"]`), range = box.querySelector(`[data-range="${key}"]`);
        if (draft()[key] == null) {
          const value = automatic[key] * (key === 'commissionRate' ? 100 : 1);
          input.value = Number(value.toFixed(2));
          if (Number(range.max) < value) range.max = String(Math.ceil(value * 2));
          range.value = value;
        }
        const out = box.querySelector(`[data-share="${key}"]`);
        if (key !== 'commissionRate') out.textContent = price ? `${(Number(input.value) / price * 100).toFixed(1)} % del precio` : '';
      });
    }
    function render() {
      const values = draft();
      const automatic = automaticValues();
      const editable = canEdit() && !w.SAHTEN.project.session.readOnly;
      box.innerHTML = `<div class="pricing-heading"><div><h2 id="pricing-title">Ajustar precio de venta</h2><p>${esc(product.name)}</p></div><button type="button" data-close aria-label="Cerrar editor de precio">×</button></div>
        <label for="pricing-channel">Canal de venta</label><select id="pricing-channel">${channels.map(c => `<option value="${esc(c.id)}" ${channel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <details class="pricing-help"><summary>Cómo funcionan los bloqueos</summary><p>Bloqueá un importe para conservarlo aunque cambien los valores generales. Cada canal tiene sus propios bloqueos. El precio fijado es final; reemplaza recargos y descuentos automáticos del producto y canal.</p></details>
        <div class="pricing-fields">${fields.map(([key, label, help]) => {
          const locked = values[key] != null, percentage = key === 'commissionRate';
          const v = (locked ? values[key] : automatic[key]) * (percentage ? 100 : 1);
          return `<fieldset class="${key === 'price' ? 'pricing-primary' : 'pricing-secondary'}" data-field="${key}" data-mode="${locked ? 'fixed' : 'auto'}"><legend>${label}</legend><div class="pricing-mode">${lockIcon(locked)}<strong>${locked ? (key === 'price' ? 'Precio fijado' : 'Valor bloqueado') : 'Automático'}</strong></div><p>${locked ? 'Conserva este valor aunque cambien los valores generales.' : key === 'price' ? 'Se recalcula con los costos y las reglas de este canal.' : 'Usa el valor actual del proyecto.'} ${key === 'price' ? '' : help + '.'}</p><button type="button" data-lock="${key}" aria-pressed="${locked}" ${editable ? '' : 'disabled'} aria-controls="pricing-${key}">${lockIcon(!locked)}${locked ? 'Volver a automático' : key === 'price' ? 'Fijar precio para editar' : 'Bloquear y editar'}</button><label class="pricing-sr" for="pricing-${key}">${label}${percentage ? ' en porcentaje' : ' por unidad'}</label><div class="pricing-controls"><input type="range" aria-label="Ajustar ${label}" data-range="${key}" min="0" max="${percentage ? 100 : Math.max(1000, Math.ceil(v * 2))}" step="${percentage ? '.01' : '1'}" value="${v}" ${locked && editable ? '' : 'disabled'}><input id="pricing-${key}" type="number" data-value="${key}" min="${key === 'price' ? '.01' : '0'}" ${percentage ? 'max="100"' : ''} step=".01" value="${Number(v.toFixed(2))}" ${locked && editable ? '' : 'disabled'}></div><small data-share="${key}"></small></fieldset>`;
        }).join('')}</div><div class="pricing-preview" data-price-preview></div>
        <details class="pricing-help"><summary>Costos asignados y gastos reales</summary><p>El costo asignado bloqueado se conserva por unidad. Los costos de receta actuales y los gastos mensuales se registran por separado; el GF no se resta dos veces en la proyección.</p></details>
        <label for="pricing-reason">Motivo del ajuste (opcional)</label><input id="pricing-reason" maxlength="300" value="${esc(reason)}" placeholder="Por ejemplo: nueva carta de precios">
        <details class="pricing-history"><summary>Historial de ajustes (${(product.pricingHistory || []).length})</summary>${[...(product.pricingHistory || [])].reverse().map(h => `<article><strong>${esc(state.channels.find(c => c.id === h.channel)?.name || h.channel)}</strong> · ${esc(new Date(h.effectiveAt).toLocaleString('es-AR'))}<p>${fields.map(([key, label]) => `${label}: ${h.before[key] == null ? 'automático' : key === 'commissionRate' ? (h.before[key] * 100).toFixed(2) + ' %' : money(h.before[key])} → ${h.after[key] == null ? 'automático' : key === 'commissionRate' ? (h.after[key] * 100).toFixed(2) + ' %' : money(h.after[key])}`).map(esc).join('<br>')}</p>${h.reason ? `<p>${esc(h.reason)}</p>` : ''}<small>${esc(h.actor)}</small></article>`).join('') || '<p>Todavía no hay ajustes guardados.</p>'}</details>
        <p class="pricing-help">Vigencia: desde que guardás. Las ventas anteriores conservan sus valores. El menú público requiere sincronizar o publicar.</p><p class="pricing-error" role="alert"></p><div class="pricing-actions"><div class="pricing-live-result" data-live-result aria-live="polite"></div><button type="button" data-close>Cancelar</button>${editable ? '<button type="button" class="btn-primary" data-save>Guardar ajustes</button>' : '<span>Consulta de solo lectura</span>'}</div>`;
      if (embedded) {
        const costs = d.createElement('details'); costs.className = 'pricing-inline-costs';
        costs.innerHTML = '<summary>Costos y bloqueos</summary><div class="pricing-fields"></div>';
        box.querySelectorAll('.pricing-secondary').forEach(field => costs.querySelector('.pricing-fields').append(field));
        box.querySelector('.pricing-fields').append(costs);
        const breakdown = d.createElement('details'); breakdown.className = 'pricing-help';
        breakdown.innerHTML = '<summary>Desglose del resultado</summary>';
        box.querySelector('.pricing-preview').before(breakdown); breakdown.append(box.querySelector('.pricing-preview'));
      }
      box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
      box.querySelector('#pricing-reason').addEventListener('input', e => { reason = e.target.value; });
      box.querySelector('#pricing-channel').addEventListener('change', e => { channel = e.target.value; render(); options.onChannelChange?.(channel); });
      box.querySelectorAll('[data-lock]').forEach(b => b.addEventListener('click', () => {
        const key = b.dataset.lock; const focusKey = key;
        values[key] = values[key] == null ? automaticValues()[key] : null;
        render(); box.querySelector(`[data-lock="${focusKey}"]`).focus();
      }));
      box.querySelectorAll('[data-value],[data-range]').forEach(input => input.addEventListener('input', () => {
        const key = input.dataset.value || input.dataset.range, n = Number(input.value);
        if (!Number.isFinite(n) || input.value === '') { values[key] = NaN; return; }
        values[key] = n / (key === 'commissionRate' ? 100 : 1);
        const number = box.querySelector(`[data-value="${key}"]`), range = box.querySelector(`[data-range="${key}"]`);
        if (input !== number) number.value = input.value;
        if (Number(range.max) < n) range.max = String(Math.ceil(n * 2));
        range.value = input.value; preview();
      }));
      box.querySelector('[data-save]')?.addEventListener('click', async e => {
        const error = box.querySelector('.pricing-error');
        if (!canEdit() || w.SAHTEN.project.session.readOnly || state.project.id !== projectId || !state.products.includes(product)) { error.textContent = 'Cambió el proyecto o el permiso. Cerrá y abrí el editor.'; return; }
        if (JSON.stringify(product.pricingPolicies || {}) !== JSON.stringify(originals)) { error.textContent = 'Los precios cambiaron mientras editabas. Cerrá y volvé a abrir para revisar.'; return; }
        const staged = clone(product), now = new Date();
        try {
          // Validar todos los canales antes de modificar el producto vivo.
          for (const [id, data] of Object.entries(drafts)) savePricePolicy(staged, id, data, { now, actor: d.body.dataset.role || 'local', reason: box.querySelector('#pricing-reason').value });
          e.target.disabled = true;
          product.pricingPolicies = staged.pricingPolicies; product.pricingHistory = staged.pricingHistory;
          close('saved');
          w.SAHTEN.project.markDirty(); w.scheduleSave(); w.recalcAll();
          if (w.currentPanel === 'menuonline') w.renderMenuOnline?.();
          if (w.currentPanel === 'mostrador') w.renderMostrador();
        } catch (err) { error.textContent = err.message; e.target.disabled = false; }
      });
      preview();
    }
    render();
    return { close, product, projectId, get channel() { return channel; }, get dirty() {
      return Object.entries(drafts).some(([id, values]) => fields.some(([key]) => (values[key] ?? null) !== (originals[id]?.[key] ?? null))) || !!reason.trim();
    } };
  }
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-price-product]');
    if (!b) return;
    e.stopPropagation(); open(b.dataset.priceProduct, b.dataset.priceChannel);
  });
  const prepare = () => {
    if (!canCost()) return false;
    const changed = preparePricingQuotes(state);
    for (const o of w.sahtenOrders?.() || []) captureSaleCosts(state, o, { basis: 'from-quote' });
    return changed;
  };
  const orderDetail = order => {
    if (!canCost()) return '';
    const entry = state.saleCosts[order.id];
    if (!entry) return '<p class="pricing-help">Sin desglose histórico de costos para esta orden.</p>';
    const historicalMoney = n => fmt({ project: entry.currency || state.project }, n);
    return `<details class="pricing-history"><summary>Costos guardados de esta orden</summary><p class="pricing-help">Desglose privado · ${entry.basis === 'at-sale' ? 'registrado al crear la orden' : 'versión del precio publicado'}. No acredita el cobro.</p>${entry.items.map(it => `<article><strong>${esc(it.name)}</strong><p>Costo variable por unidad: ${esc(historicalMoney(it.unitVariable))}<br>GF asignado por unidad: ${esc(historicalMoney(it.unitFixed))}<br>Comisión estimada: ${(it.commissionRate * 100).toFixed(2)} %</p><small>Revisión: ${esc(it.revision || 'Cálculo automático al vender')}</small></article>`).join('')}</details>`;
  };
  return { open, badge, capture, prepare, orderDetail, quoteIds: p => pricingQuoteIds(state, p), summary: orders => { prepare(); return summarizeSaleCosts(orders, state.saleCosts); } };
}
