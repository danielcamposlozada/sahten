// ═══════════════════════════════════════════════════════════
// Usuario en la barra superior: muestra a qué tienda y con qué cuenta está conectada la app,
// e inicia/cierra sesión sin pedir la URL ni la clave cada vez.
//   · sin configurar → «Conectar tienda» (se configura una vez: se puede pegar un código de conexión)
//   · configurada, sin sesión → «Iniciar sesión» (solo email y contraseña)
//   · con sesión → menú con tienda, cuenta, rol, sincronización y «Cerrar sesión»
// La marca de cada tienda (nombre y color) sale del proyecto abierto, así dos tiendas nunca se confunden.
// ═══════════════════════════════════════════════════════════
import { sahtenDialog } from '../ui/dialog.js';
import { ROLE_LABEL } from './roles.js';
import { encodeConnection, decodeConnection } from './supabase.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const hostOf = u => { try { return new URL(u).host; } catch (e) { return String(u || ''); } };

export function brandOf(w = window) {
  let c = {}; try { c = JSON.parse(w.localStorage.getItem('sahten-customization') || '{}') || {}; } catch (e) { /* */ }
  const cs = w.getComputedStyle ? w.getComputedStyle(w.document.documentElement) : null;
  const color = (cs && cs.getPropertyValue('--primary').trim()) || '#235328';
  const accent = (cs && cs.getPropertyValue('--accent').trim()) || '#F28C00';
  return { name: (c.brandName || '').trim(), color, accent, logo: c.logoStyle === 'upload' && c.logoData ? c.logoData : null };
}
export const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';

export function createUserMenu({ online, project, w = window }) {
  const d = w.document;
  const conn = () => online.conn();
  const emailKey = () => 'online-email:' + (project.session.id || 'x');
  let open = false;

  function state() {
    const c = online.controller.info();
    if (!online.enabled) return { kind: 'off' };
    if (!c.configured) return { kind: 'setup', c };
    if (!c.signedIn) return { kind: 'login', c };
    return { kind: 'in', c };
  }
  function identity() {
    const b = brandOf(w), slug = conn().slug || '';
    const name = b.name || (project.session.info && project.session.info().name) || slug || 'Mi tienda';
    return { b, slug, name };
  }

  // ── botón en la barra superior ──
  function button(st) {
    const { b, slug, name } = identity();
    if (st.kind === 'off') return '';
    const label = st.kind === 'setup' ? 'Conectar tienda' : st.kind === 'login' ? 'Iniciar sesión' : name;
    const sub = st.kind === 'in' ? (st.c.email || '') : st.kind === 'login' ? name : 'Sin conexión';
    const av = st.kind === 'in' || st.kind === 'login'
      ? `<span class="um-av" style="background:${esc(b.color)};color:#fff" aria-hidden="true">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : esc(initials(name))}</span>`
      : '<span class="um-av um-av-off" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>';
    const dot = st.kind === 'in' ? `<span class="um-dot ok" title="Conectada" aria-hidden="true"></span>` : st.kind === 'login' ? '<span class="um-dot warn" aria-hidden="true"></span>' : '';
    return `<button type="button" class="um-btn" data-um="toggle" aria-haspopup="${st.kind === 'in' ? 'menu' : 'dialog'}" aria-expanded="${open && st.kind === 'in'}" aria-label="${esc(st.kind === 'in' ? 'Cuenta: ' + name + ' · ' + (st.c.email || '') : label)}">${av}<span class="um-txt"><span class="um-name">${esc(label)}</span><span class="um-sub">${esc(sub)}</span></span>${dot}</button>`;
  }
  function panel(st) {
    if (st.kind !== 'in' || !open) return '';
    const { b, slug, name } = identity(); const sy = online.syncInfo(), role = online.role();
    const stateTxt = { 'al día': 'Al día', sincronizando: 'Sincronizando…', conflicto: 'Hay un conflicto', 'sin conexión': 'Sin conexión (pendiente)', error: 'Error al sincronizar', 'sin vincular': 'Todavía no está en la nube' }[sy.state] || sy.state;
    const it = (act, label, icon) => `<button type="button" role="menuitem" class="um-item" data-um="${act}">${icon || ''}<span>${label}</span></button>`;
    return `<div class="um-menu" role="menu" aria-label="Cuenta y tienda">
      <div class="um-head"><span class="um-av big" style="background:${esc(b.color)};color:#fff" aria-hidden="true">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : esc(initials(name))}</span>
        <div class="um-hd"><div class="um-hname">${esc(name)}</div><div class="um-hsub">${slug ? esc(slug) + ' · ' : ''}${esc(hostOf(conn().url))}</div><div class="um-hsub">${esc(st.c.email || '')}</div></div></div>
      <div class="um-meta">${role ? `<span class="um-pill">${esc(ROLE_LABEL[role] || role)}</span>` : ''}<span class="um-pill ${sy.state === 'al día' ? 'ok' : ''}">${esc(stateTxt)}</span></div>
      <div class="um-sep"></div>
      ${it(sy.linked ? 'sync' : 'menu', sy.linked ? 'Sincronizar ahora' : 'Sincronizar menú')}
      ${it('remote', 'Abrir proyecto de la nube…')}
      ${it('code', 'Copiar código de conexión')}
      ${it('panel', 'Nube y usuarios')}
      ${it('switch', 'Cambiar de proyecto')}
      <div class="um-sep"></div>
      ${it('logout', 'Cerrar sesión')}
    </div>`;
  }

  function render() {
    const st = state();
    d.querySelectorAll('[data-user-slot]').forEach(slot => { slot.innerHTML = st.kind === 'off' ? '' : `<div class="um-wrap">${button(st)}${panel(st)}</div>`; });
  }
  const close = () => { if (open) { open = false; render(); } };

  // ── diálogos ──
  const field = (id, label, o = {}) => `<div class="sd-field"><label for="${id}">${label}</label><input id="${id}" class="sd-input" type="${o.type || 'text'}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} value="${esc(o.v || '')}" autocomplete="${o.ac || 'off'}" ${o.ro ? 'readonly' : ''} ${o.af ? 'autofocus' : ''}></div>`;
  const val = (box, id) => (box.querySelector('#' + id) || {}).value || '';

  async function login() {
    const { name, slug } = identity();
    let wantsSetup = false;
    const body = `<p class="sd-text">Tienda: <b>${esc(name)}</b>${slug ? ` <span class="sd-mute">(${esc(slug)})</span>` : ''}</p>
      ${field('um-mail', 'Email', { type: 'email', v: project.config.get(emailKey(), '') || '', ac: 'username', af: true })}
      <div class="sd-field"><label for="um-pass">Contraseña</label><div class="sd-pw"><input id="um-pass" class="sd-input" type="password" autocomplete="current-password"><button type="button" class="sd-eye" aria-label="Mostrar contraseña" aria-pressed="false">Ver</button></div></div>
      <div class="sd-row"><button type="button" class="sd-linkbtn" data-sd="forgot">Olvidé mi contraseña</button><button type="button" class="sd-linkbtn" data-sd="setup">Usar otra tienda</button></div>`;
    await sahtenDialog({
      title: 'Iniciar sesión', body, w, width: 420,
      actions: [{ label: 'Cancelar', value: false }, { label: 'Entrar', value: true, primary: true }],
      onOpen: api => {
        const pass = api.box.querySelector('#um-pass'), eye = api.box.querySelector('.sd-eye');
        eye.onclick = () => { const show = pass.type === 'password'; pass.type = show ? 'text' : 'password'; eye.textContent = show ? 'Ocultar' : 'Ver'; eye.setAttribute('aria-pressed', show); eye.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); };
        api.box.querySelector('[data-sd="setup"]').onclick = () => { wantsSetup = true; api.close(false); };
        api.box.querySelector('[data-sd="forgot"]').onclick = async () => {
          const em = val(api.box, 'um-mail').trim(); if (!em) return api.setError('Escribí tu email y volvé a tocar «Olvidé mi contraseña».');
          try { await online.controller.recover(em); api.setError(''); w.sahtenToast('Te mandamos un email para elegir una contraseña nueva.'); } catch (e) { api.setError(e.message || String(e)); }
        };
      },
      validate: async (_v, api) => {
        const em = val(api.box, 'um-mail').trim(), pw = val(api.box, 'um-pass');
        if (!em || !pw) { api.setError('Completá el email y la contraseña.'); return false; }
        api.setError(''); api.busy(true, 'Entrando…');
        try { await online.signIn(em, pw); project.config.set(emailKey(), em); render(); w.sahtenToast('Sesión iniciada en ' + name); return true; }
        catch (e) { api.busy(false); api.setError(e.message || String(e)); return false; }
      },
    });
    if (wantsSetup) return setup();
  }

  async function setup() {
    const cur = conn();
    const body = `<p class="sd-text">Se configura <b>una sola vez</b> por tienda. Si ya la usás en otro equipo, pegá el código de conexión.</p>
      <div class="sd-field"><label for="um-code">Código de conexión <span class="sd-mute">(opcional)</span></label><input id="um-code" class="sd-input" placeholder="sahten:…" autocomplete="off"></div>
      ${field('um-url', 'URL del proyecto de Supabase', { type: 'url', ph: 'https://abcd1234.supabase.co', v: cur.url })}
      ${field('um-key', 'Clave pública (anon / publishable)', { ph: 'sb_publishable_… o eyJ…', v: cur.anonKey })}
      ${field('um-slug', 'Nombre de la tienda en la web', { ph: 'mi-local', v: cur.slug })}
      ${field('um-mail2', 'Email', { type: 'email', ac: 'username', v: project.config.get(emailKey(), '') })}
      <div class="sd-field"><label for="um-pass2">Contraseña</label><input id="um-pass2" class="sd-input" type="password" autocomplete="current-password"></div>
      <label class="sd-check"><input id="um-new" type="checkbox"> Crear una cuenta nueva con este email</label>
      <p class="sd-mute sd-small">Nunca pegues la clave <b>service_role</b> ni <b>secret</b>: la app la rechaza. La contraseña no se guarda.</p>`;
    await sahtenDialog({
      title: 'Conectar tienda', body, w, width: 480,
      actions: [{ label: 'Cancelar', value: false }, { label: 'Conectar', value: true, primary: true }],
      onOpen: api => {
        api.box.querySelector('#um-code').addEventListener('input', e => {
          const c = decodeConnection(e.target.value); if (!c) return;
          api.box.querySelector('#um-url').value = c.url; api.box.querySelector('#um-key').value = c.anonKey; api.box.querySelector('#um-slug').value = c.slug;
          api.setError(''); api.box.querySelector('#um-mail2').focus();
        });
      },
      validate: async (_v, api) => {
        const o = { url: val(api.box, 'um-url').trim(), anonKey: val(api.box, 'um-key').trim(), slug: val(api.box, 'um-slug').trim(), email: val(api.box, 'um-mail2').trim(), password: val(api.box, 'um-pass2'), signUp: api.box.querySelector('#um-new').checked };
        if (!o.email || !o.password) { api.setError('Completá el email y la contraseña.'); return false; }
        api.setError(''); api.busy(true, 'Conectando…');
        try {
          const r = await online.connect(o);
          if (r && r.pendingConfirmation) { api.busy(false); api.setError('Te mandamos un email para confirmar la cuenta. Confirmalo y volvé a conectar.'); return false; }
          project.config.set(emailKey(), o.email); render(); w.sahtenToast('Tienda conectada'); return true;
        } catch (e) { api.busy(false); api.setError(e.message || String(e)); return false; }
      },
    });
  }

  const handlers = {
    async toggle() { const st = state(); if (st.kind === 'in') { open = !open; render(); if (open) [...d.querySelectorAll('.um-menu [role="menuitem"]')].find(x => x.offsetParent !== null)?.focus(); } else if (st.kind === 'login') await login(); else if (st.kind === 'setup') await setup(); },
    async sync() { close(); try { const r = await online.syncNow(); w.sahtenToast({ noop: 'Todo al día.', push: 'Cambios subidos.', pull: 'Cambios de la nube descargados.', conflict: 'Hay un conflicto: resolvelo en Nube y usuarios.' }[r && r.action || r] || 'Sincronizado.'); } catch (e) { w.sahtenAlert(e.message || String(e)); } render(); },
    async menu() {
      close();
      try { const n = await online.controller.syncMenu(); w.sahtenToast(`Menú actualizado en línea (${n} productos).`); }
      catch (e) {
        if (e && e.code === 'menu_shrinks' && await w.sahtenConfirm(e.message, { title: '¿Reemplazar el menú publicado?', okLabel: 'Reemplazar', cancelLabel: 'No, cancelar', danger: true })) {
          try { const n = await online.controller.syncMenu({ force: true }); w.sahtenToast(`Menú actualizado en línea (${n} productos).`); } catch (e2) { w.sahtenAlert(e2.message || String(e2)); }
        } else if (!(e && e.code === 'menu_shrinks')) w.sahtenAlert(e.message || String(e));
      }
    },
    remote() { close(); w.showPanel('nube'); setTimeout(() => { try { online.ui.listRemote(); } catch (e) { /* */ } }, 50); },
    panel() { close(); w.showPanel('nube'); },
    switch() { close(); try { w.SAHTEN.projectUi.showProjects(); } catch (e) { /* */ } },
    async code() {
      const c = conn(); const text = encodeConnection({ url: c.url, anonKey: c.anonKey, slug: c.slug }); close();
      try { await w.navigator.clipboard.writeText(text); w.sahtenToast('Código copiado. Pegalo en «Conectar tienda» en otro equipo (no incluye la contraseña).'); }
      catch (e) { await sahtenDialog({ title: 'Código de conexión', body: `<p class="sd-text">Copialo y pegalo en «Conectar tienda» en otro equipo. No incluye la contraseña.</p><input class="sd-input" readonly value="${esc(text)}" onfocus="this.select()" autofocus>`, actions: [{ label: 'Listo', value: true, primary: true }], w }); }
    },
    logout() { close(); online.signOut(); w.sahtenToast('Sesión cerrada. La tienda sigue configurada: solo falta tu email y contraseña.'); render(); },
  };

  d.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-um]');
    if (t) { e.preventDefault(); const h = handlers[t.dataset.um]; if (h) h(); return; }
    if (open && !(e.target.closest && e.target.closest('.um-wrap'))) close();
  });
  d.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { close(); [...d.querySelectorAll('.um-btn')].find(x => x.offsetParent !== null)?.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...d.querySelectorAll('.um-menu [role="menuitem"]')].filter(x => x.offsetParent !== null); if (!items.length) return;
      const i = items.indexOf(d.activeElement); e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  });

  online.controller.onChange(render);
  w.addEventListener('sahten:brand', () => { if (!open) render(); });
  project.session.onChange(() => { if (!open) render(); });
  render();
  return { render, login, setup, state, close };
}
