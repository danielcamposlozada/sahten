// Diálogos y avisos propios de la app (reemplazan a alert/confirm, que bloquean y se ven distinto en cada sistema).
//   await sahtenDialog({ title, body, actions })   → valor de la acción elegida, o null si se cierra
//   await sahtenConfirm('¿Seguro?', { okLabel, danger })  → true / false
//   sahtenAlert('Algo pasó')                       → aviso (no bloquea)
//   sahtenToast('Guardado')                         → aviso breve, anunciado a lectores de pantalla
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let seq = 0;

export function sahtenDialog({ title = '', body = '', actions = [{ label: 'Aceptar', value: true, primary: true }], dismissible = true, width = 440, onOpen = null, validate = null, w = window } = {}) {
  const d = w.document;
  return new Promise(resolve => {
    const prev = d.activeElement;
    const id = 'sd-' + (++seq);
    const ov = d.createElement('div'); ov.className = 'sd-overlay';
    const box = d.createElement('div'); box.className = 'sd-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (title) box.setAttribute('aria-labelledby', id + '-t'); box.style.maxWidth = width + 'px';
    const head = title ? `<div class="sd-title" id="${id}-t">${title}</div>` : '';
    box.innerHTML = `${head}<div class="sd-body" id="${id}-b">${typeof body === 'string' ? body : ''}</div><div class="sd-actions"></div>`;
    if (body && typeof body !== 'string') box.querySelector('.sd-body').appendChild(body);
    box.setAttribute('aria-describedby', id + '-b');
    const row = box.querySelector('.sd-actions');
    let closed = false;
    const done = v => { if (closed) return; closed = true; d.removeEventListener('keydown', onKey, true); ov.remove(); try { prev && prev.focus && prev.focus(); } catch (e) { /* */ } resolve(v); };
    const buttons = actions.map(a => {
      const b = d.createElement('button'); b.type = 'button'; b.textContent = a.label;
      b.className = 'sd-btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : '') + (a.link ? ' link' : '');
      b.addEventListener('click', async () => {
        if (a.keepOpen && typeof a.onClick === 'function') { await a.onClick(api); return; }
        if (validate && a.primary) { const ok = await validate(a.value, api); if (ok === false) return; }
        done(a.value);
      });
      row.appendChild(b); return b;
    });
    function onKey(e) {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); e.preventDefault(); done(null); return; }
      if (e.key === 'Tab') {
        const f = [...box.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === d.activeElement);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!box.contains(d.activeElement)) { e.preventDefault(); first.focus(); }
      } else if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
        const p = buttons.find((b, i) => actions[i].primary); if (p) { e.preventDefault(); p.click(); }
      }
    }
    const api = { box, close: done, button: i => buttons[i], setError(msg) { let el = box.querySelector('.sd-error'); if (!el) { el = d.createElement('div'); el.className = 'sd-error'; el.setAttribute('role', 'alert'); box.querySelector('.sd-actions').before(el); } el.textContent = msg || ''; el.hidden = !msg; }, busy(on, label) { buttons.forEach((b, i) => { b.disabled = !!on; if (on && actions[i].primary && label) { b.dataset.l = b.textContent; b.textContent = label; } else if (!on && b.dataset.l) { b.textContent = b.dataset.l; delete b.dataset.l; } }); } };
    ov.addEventListener('mousedown', e => { if (e.target === ov && dismissible) done(null); });
    ov.appendChild(box); d.body.appendChild(ov); d.addEventListener('keydown', onKey, true);
    if (typeof onOpen === 'function') onOpen(api);
    const auto = box.querySelector('[autofocus]') || box.querySelector('input:not([type=hidden]),textarea,select') || buttons.find((b, i) => actions[i].primary) || buttons[0];
    setTimeout(() => { try { auto && auto.focus(); } catch (e) { /* */ } }, 0);
  });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

export async function sahtenConfirm(message, { title = '', okLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false, w = window } = {}) {
  const r = await sahtenDialog({ title: esc(title), body: `<p class="sd-text">${esc(message)}</p>`, w,
    actions: [{ label: cancelLabel, value: false }, { label: okLabel, value: true, primary: true, danger }] });
  return r === true;
}

export function sahtenAlert(message, { title = '', w = window } = {}) {
  return sahtenDialog({ title: esc(title), body: `<p class="sd-text">${esc(message)}</p>`, actions: [{ label: 'Entendido', value: true, primary: true }], w });
}

export function sahtenToast(message, { kind = 'info', ms = 4200, w = window } = {}) {
  const d = w.document;
  let host = d.getElementById('sahten-toasts');
  if (!host) { host = d.createElement('div'); host.id = 'sahten-toasts'; host.className = 'st-host'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); d.body.appendChild(host); }
  const t = d.createElement('div'); t.className = 'st-toast ' + kind; t.textContent = message; host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
  return t;
}

/** Hace que alert() y los mensajes viejos usen el aviso propio (no bloquea y funciona igual en escritorio, web y celular). */
export function installDialogs(w = window) {
  w.sahtenDialog = (o = {}) => sahtenDialog({ ...o, w }); w.sahtenConfirm = (m, o = {}) => sahtenConfirm(m, { ...o, w }); w.sahtenAlert = (m, o = {}) => sahtenAlert(m, { ...o, w }); w.sahtenToast = (m, o = {}) => sahtenToast(m, { ...o, w });
  w.alert = m => { sahtenAlert(String(m ?? ''), { w }); };
  // Una acción asíncrona que falla nunca queda muda: se avisa (antes un permiso denegado «no hacía nada»).
  w.addEventListener('unhandledrejection', e => {
    const r = e && e.reason; const msg = String((r && (r.message || r)) || '');
    if (!msg || (r && (r.name === 'AbortError' || r.offline)) || /^(cancel|abort)/i.test(msg)) return;
    try { console.error(r); } catch (err) { /* */ }
    sahtenToast('Algo no salió bien: ' + msg.slice(0, 160), { kind: 'error', w });
  });
  /** Envuelve una acción de botón: si falla, avisa con el mensaje en lugar de quedar muda. */
  w.safeAction = fn => async (...a) => { try { return await fn(...a); } catch (err) { sahtenToast(String((err && err.message) || err), { kind: 'error', w }); return undefined; } };
}
