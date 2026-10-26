import { estimateMinutes, estimateSnapshot, estimateLabel, whatsappPhone, confirmationMessage } from '../core/order-confirmation.js';

export function installOrderActions(w = window) {
  const active = o => o && ['pendiente', 'en_preparacion', 'listo', 'enviado'].includes(o.status);
  const find = id => w.sahtenOrders().find(o => String(o.id) === String(id));
  const save = () => { w._saveOrders(); w.SAHTEN.project.markDirty(); };
  const refresh = () => { if (w.currentPanel === 'mostrador') w.renderMostrador(); };
  const same = (o, project) => !!w.document && find(o.id) === o && w.SAHTEN.project.session.id === project;
  const number = o => '#' + String(o.num || 0).padStart(4, '0');
  function store() { try { return w.SAHTEN.online.publish.currentMenu().store || {}; } catch { return {}; } }
  const el = (tag, text) => { const node = w.document.createElement(tag); if (text) node.textContent = text; return node; };
  function field(body, label, type, value = '') {
    const wrapper = el('label', label), input = el('input'); input.type = type; input.value = value; wrapper.append(input); body.append(wrapper); return input;
  }
  async function confirm(id) {
    const order = find(id); if (!active(order) || w.SAHTEN.project.session.readOnly) return;
    const project = w.SAHTEN.project.session.id, business = store();
    const body = el('div'); body.className = 'order-contact-form';
    body.append(el('p', 'Prepará la confirmación para el cliente. El tiempo de retiro o entrega se cuenta desde este nuevo aviso.'));
    const minutes = field(body, 'Tiempo estimado (minutos)', 'number', order.fulfillmentEstimate?.minutes || '');
    minutes.min = '1'; minutes.max = '1440'; minutes.step = '1'; minutes.inputMode = 'numeric';
    const quick = el('div'); quick.className = 'order-estimate-options'; quick.setAttribute('role', 'group'); quick.setAttribute('aria-label', 'Tiempos frecuentes');
    for (const n of [15, 30, 45, 60]) { const b = el('button', n + ' min'); b.type = 'button'; b.onclick = () => { minutes.value = n; update(); }; quick.append(b); }
    body.append(quick);
    const phone = field(body, 'WhatsApp del cliente', 'tel', order.customerPhone || ''); phone.autocomplete = 'tel'; phone.maxLength = 80;
    body.append(el('small', 'Revisá el código de país. El teléfono se guarda solo en este pedido. Podés guardar el tiempo sin enviar un mensaje.'));
    const preview = el('textarea'); preview.readOnly = true; preview.rows = 8; preview.setAttribute('aria-label', 'Vista previa de la confirmación'); body.append(preview);
    body.append(el('small', 'El botón abre WhatsApp con el texto listo. El envío lo confirmás allí; abrirlo no acredita un pago ni cambia el estado de preparación.'));
    function update() {
      preview.value = confirmationMessage(order, { store: business, minutes: minutes.value });
      quick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(parseInt(b.textContent) === Number(minutes.value))));
    }
    minutes.oninput = update; update();
    async function commit(open, api) {
      if (!same(order, project) || (!active(order) || w.SAHTEN.project.session.readOnly)) { api.setError('El pedido o el proyecto cambió. Cerrá esta ventana y revisalo.'); return false; }
      const estimate = estimateSnapshot(minutes.value);
      if (!estimate) { api.setError('Indicá un tiempo de 1 a 1440 minutos, sin decimales.'); return false; }
      const rawPhone = phone.value.trim(), normalized = whatsappPhone(rawPhone, business.whatsapp);
      if (open && !normalized) { api.setError('Revisá el teléfono e incluí el código de país para abrir WhatsApp.'); return false; }
      let opened = false;
      if (open) {
        const url = 'https://wa.me/' + normalized + '?text=' + encodeURIComponent(confirmationMessage(order, { store: business, minutes: estimate.minutes }));
        api.busy(true, 'Abriendo WhatsApp…');
        try {
          if (w.SAHTEN.desktop) { await w.SAHTEN.desktop.openExternal(url); opened = true; }
          else { const tab = w.open(url, '_blank'); if (tab) { try { tab.opener = null; } catch {} opened = true; } }
        } catch { /* Conservar el formulario para reintentar. */ }
        api.busy(false);
        if (!opened) { api.setError('No se pudo abrir WhatsApp. Permití la apertura de esa ventana o guardá el tiempo y reintentá.'); return false; }
      }
      if (!same(order, project) || !active(order)) return false;
      const history = order.fulfillmentEstimateHistory || (order.fulfillmentEstimate ? [{ ...order.fulfillmentEstimate }] : []);
      order.fulfillmentEstimate = estimate;
      order.fulfillmentEstimateHistory = [...history, { ...estimate }];
      order.customerPhone = rawPhone;
      if (opened) order.whatsappConfirmation = { openedAt: estimate.updatedAt, minutes: estimate.minutes };
      order.updatedAt = estimate.updatedAt; save(); refresh();
      if (w.document.getElementById('order-detail-overlay')) w.openOrderDetail(order.id);
      w.sahtenToast(opened ? 'WhatsApp abierto con la confirmación. Enviá el mensaje allí.' : 'Tiempo estimado guardado.');
      api.close(true); return true;
    }
    return w.sahtenDialog({ title: 'Confirmación ' + number(order), body, width: 560,
      onOpen: api => api.box.classList.add('order-actions-dialog'),
      actions: [{ label: 'Volver', value: null }, { label: 'Guardar tiempo', keepOpen: true, onClick: api => commit(false, api) }, { label: 'Guardar y abrir WhatsApp', primary: true, keepOpen: true, onClick: api => commit(true, api) }],
    });
  }
  async function cancel(id) {
    const order = find(id); if (!active(order) || w.SAHTEN.project.session.readOnly) return;
    const project = w.SAHTEN.project.session.id, body = el('div'); body.className = 'order-contact-form';
    body.append(el('p', 'El pedido saldrá de la cola activa y quedará en Historial como Cancelado.'));
    if (order.paymentProvider === 'mercadopago' || ['paid', 'partial', 'overpaid'].includes(order.paymentStatus)) body.append(el('p', 'Cancelar el pedido no anula ni reembolsa el pago. Revisá el cobro por separado.'));
    const reason = field(body, 'Motivo (opcional)', 'text'); reason.maxLength = 200;
    let restore;
    if (order.stockDeducted) { restore = field(body, 'Devolver al stock los ingredientes y envases descontados', 'checkbox'); body.append(el('small', 'Marcá esta opción solo si los insumos siguen disponibles.')); }
    return w.sahtenDialog({ title: 'Cancelar pedido ' + number(order), body,
      onOpen: api => api.box.classList.add('order-actions-dialog'),
      actions: [{ label: 'Conservar pedido', value: false }, { label: 'Cancelar pedido', primary: true, danger: true, value: true }],
      validate(value, api) {
        if (!same(order, project) || (!active(order) || w.SAHTEN.project.session.readOnly)) { api.setError('El pedido o el proyecto cambió. Revisalo antes de continuar.'); return false; }
        const restored = !!restore?.checked && !!order.stockDeducted;
        if (restored) w.orderRestoreStock(order.id, true);
        order.cancellation = { at: new Date().toISOString(), reason: reason.value.trim(), stockRestored: restored };
        w.orderSetStatus(order.id, 'cancelado');
        if (w.document.getElementById('order-detail-overlay')) w.openOrderDetail(order.id);
        w.sahtenToast('Pedido cancelado. Se conserva en Historial.'); return true;
      },
    });
  }
  w.document.addEventListener('click', event => { const b = event.target.closest('[data-order-command]'); if (!b) return; if (b.dataset.orderCommand === 'confirm') confirm(b.dataset.id); else if (b.dataset.orderCommand === 'cancel') cancel(b.dataset.id); });
  w.document.addEventListener('change', event => { const select = event.target.closest('[data-order-status]'); if (!select) return; const o = find(select.dataset.orderStatus); if (!o || w.SAHTEN.project.session.readOnly) return; if (select.value === 'cancelado') { select.value = o.status; cancel(o.id); } else { w.orderSetStatus(o.id, select.value); w.openOrderDetail(o.id); } });
  return { confirm, cancel, minutes: estimateMinutes, snapshot: estimateSnapshot, label: estimateLabel };
}
