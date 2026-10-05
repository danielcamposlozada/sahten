// ═══════════════════════════════════════════════════════════
// Panel «Nube y usuarios»: conexión con Supabase, sincronización, usuarios, auditoría y vista remota.
// ═══════════════════════════════════════════════════════════
import { ROLE_LABEL, ROLE_DESC, INVITABLE, canManageUsers } from './roles.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const ACTION = { create: 'Creó el proyecto', save: 'Guardó cambios', invite: 'Invitó a', join: 'Se unió como', role: 'Cambió un rol a', remove: 'Quitó a un usuario' };

export function createOnlineUi({ online, w = window }) {
  const d = w.document;
  const $ = id => d.getElementById(id);
  const root = () => $('panel-nube');
  const val = id => ($(id) ? $(id).value.trim() : '');
  const say = (id, msg, err) => { const el = $(id); if (el) el.innerHTML = msg ? `<div class="info-banner" style="margin:10px 0;${err ? 'background:rgba(192,57,43,.1);border-color:rgba(192,57,43,.35)' : ''}">${esc(msg)}</div>` : ''; };
  const run = async (slot, fn, ok) => { try { say(slot, 'Un momento…'); const r = await fn(); say(slot, ok ? (typeof ok === 'function' ? ok(r) : ok) : ''); ui.render(); return r; } catch (e) { say(slot, e.message || String(e), true); } };

  const ui = {
    async render() {
      const el = root(); if (!el) return;
      if (!online.enabled) { el.innerHTML = '<div class="card" style="padding:24px;text-align:center"><div style="font-size:16px;font-weight:700;margin-bottom:6px">No disponible en esta versión</div><div style="font-size:13px;color:var(--muted)">Esta versión de Sahten se armó sin conexión online. Tus proyectos .sahten son los mismos y se pueden abrir en la versión con online sin perder nada.</div></div>'; return; }
      const c = online.controller.info(), sy = online.syncInfo(), role = online.role();
      el.innerHTML = `
        <div class="info-banner" style="margin-bottom:16px"><strong>Opcional · cuesta $0.</strong> Conectá el proyecto a tu cuenta gratis de Supabase para recibir pedidos en tiempo real, mantener el menú actualizado sin republicar y compartir el proyecto con tu equipo. Sin esto, todo funciona igual con el archivo .sahten. Paso a paso: docs/SUPABASE.md.</div>
        ${connectCard(c)}
        ${c.signedIn ? syncCard(sy, role) : ''}
        <div id="nube-users"></div><div id="nube-audit"></div>`;
      if (c.signedIn && sy.linked && canManageUsers(role)) ui.renderUsers();
      if (c.signedIn && sy.linked && ['owner', 'admin'].includes(role)) ui.renderAudit();
    },

    async connect() {
      await run('nube-msg', () => online.connect({ url: val('nb-url'), anonKey: val('nb-key'), slug: val('nb-slug'), email: val('nb-mail'), password: $('nb-pass').value, signUp: $('nb-new').checked }),
        r => r && r.pendingConfirmation ? 'Te mandamos un email para confirmar la cuenta. Confirmalo y volvé a conectar.' : 'Conectado. Los pedidos nuevos van a aparecer en Mostrador › Delivery.');
    },
    async signIn() { await run('nube-msg', () => online.controller.signIn(val('nb-mail'), $('nb-pass').value), 'Sesión iniciada.'); },
    disconnect() { if (w.confirm('¿Desconectar este proyecto de la nube? Los datos locales no se tocan.')) { online.controller.disconnect(); ui.render(); } },
    async syncMenu() { await run('nube-msg', () => online.controller.syncMenu(), n => `Menú actualizado en línea (${n} productos).`); },
    async link() { await run('nube-msg', () => online.linkProject(), 'Proyecto subido a la nube.'); },
    async syncNow() { const r = await run('nube-msg', () => online.syncNow(), r => ({ noop: 'Todo al día.', push: 'Cambios subidos.', pull: 'Cambios de la nube descargados.', conflict: 'Hay un conflicto: elegí qué versión conservar.', offline: 'Sin conexión: queda pendiente y se reintenta solo.' }[r.action] || 'Listo.')); return r; },
    async resolve(choice) { await run('nube-msg', () => online.resolve(choice), 'Conflicto resuelto.'); },
    async openRemote(id, roleName) { await run('nube-msg', () => online.openRemote(id, roleName), 'Proyecto abierto.'); },
    async listRemote() {
      await run('nube-remote', async () => { const rows = await online.listRemote(); $('nube-remote').innerHTML = rows.length ? rows.map(r => `<div class="backup-row"><div><div class="backup-row-title">${esc(r.name || 'Proyecto')}</div><div class="backup-row-desc">${esc(ROLE_LABEL[r.role] || r.role)} · versión ${r.version}</div></div><button class="btn" onclick="SAHTEN.online.ui.openRemote('${r.id}','${r.role}')">Abrir</button></div>`).join('') : '<div class="info-banner">No tenés proyectos en la nube todavía.</div>'; });
    },
    async renderUsers() {
      const host = $('nube-users'); if (!host) return;
      try {
        const members = await online.listMembers();
        host.innerHTML = `<div class="card" style="padding:20px;margin-bottom:16px"><div style="font-size:15px;font-weight:700;margin-bottom:4px">Usuarios</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Invitá a tu equipo con su email. La persona crea su cuenta con ese email, inicia sesión desde «Abrir proyecto de la nube» y entra con el rol que le diste.</div>
          ${members.map(m => `<div class="backup-row"><div><div class="backup-row-title">${esc(m.email)}</div><div class="backup-row-desc">${esc(ROLE_DESC[m.role] || '')}</div></div>
            ${m.role === 'owner' ? '<span style="font-size:12px;font-weight:700">Dueño</span>' : `<div style="display:flex;gap:8px"><select class="custom-input" style="width:auto" onchange="SAHTEN.online.ui.setRole('${m.user_id}',this.value)">${INVITABLE.map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select><button class="btn" onclick="SAHTEN.online.ui.removeMember('${m.user_id}')">Quitar</button></div>`}</div>`).join('')}
          <div class="backup-divider"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="nb-inv-mail" class="custom-input" type="email" placeholder="email@ejemplo.com" style="flex:1;min-width:200px"><select id="nb-inv-role" class="custom-input" style="width:auto">${INVITABLE.map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}</select><button class="btn btn-accent" onclick="SAHTEN.online.ui.invite()">Invitar</button></div><div id="nube-users-msg"></div></div>`;
      } catch (e) { host.innerHTML = ''; }
    },
    async invite() { await run('nube-users-msg', () => online.invite(val('nb-inv-mail'), val('nb-inv-role')), 'Invitación creada. Avisale a la persona que cree su cuenta con ese email.'); ui.renderUsers(); },
    async setRole(uid, role) { try { await online.setMemberRole(uid, role); } catch (e) { w.alert(e.message); } ui.renderUsers(); ui.renderAudit(); },
    async removeMember(uid) { if (!w.confirm('¿Quitar a este usuario del proyecto?')) return; try { await online.removeMember(uid); } catch (e) { w.alert(e.message); } ui.renderUsers(); ui.renderAudit(); },
    async renderAudit() {
      const host = $('nube-audit'); if (!host) return;
      try {
        const rows = await online.audit(40);
        host.innerHTML = `<div class="card" style="padding:20px"><div style="font-size:15px;font-weight:700;margin-bottom:10px">Registro de auditoría</div>${rows.length ? rows.map(r => `<div style="display:flex;gap:10px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted);font-family:'DM Mono',monospace;min-width:110px">${new Date(r.at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(ACTION[r.action] || r.action)} ${esc(r.detail && (r.detail.email || r.detail.role || (r.detail.version ? 'versión ' + r.detail.version : '')) || '')}</span></div>`).join('') : '<div style="font-size:13px;color:var(--muted)">Sin movimientos.</div>'}</div>`;
      } catch (e) { host.innerHTML = ''; }
    },
    async remoteView() { await run('nube-msg', () => online.remoteView(), 'Vista remota abierta (solo lectura). Se actualiza sola.'); },
  };

  function connectCard(c) {
    const f = (id, label, type = 'text', v = '', ph = '') => `<div class="checkout-field"><label>${label}</label><input id="${id}" type="${type}" class="custom-input" placeholder="${ph}" value="${esc(v)}" autocomplete="off"></div>`;
    const conn = online.conn();
    return `<div class="card" style="padding:20px;margin-bottom:16px"><div style="font-size:15px;font-weight:700;margin-bottom:10px">Conexión con Supabase</div>
      <div style="font-size:13px;margin-bottom:10px">Estado: <b>${esc(c.mode)}</b>${c.signedIn ? ' · ' + esc(c.email || '') : ''}${c.feed ? ' · pedidos: ' + esc(c.feed) : ''}${c.error ? `<br><span style="color:var(--red)">${esc(c.error)}</span>` : ''}</div>
      ${c.configured ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Proyecto: ${esc(conn.url)} · tienda web: <b>${esc(conn.slug || '—')}</b></div>
        ${c.signedIn ? `<button class="btn btn-accent" onclick="SAHTEN.online.ui.syncMenu()">🔄 Sincronizar menú</button> ` : `<div style="display:grid;gap:8px;max-width:420px;margin-bottom:10px">${f('nb-mail', 'Email', 'email')}${f('nb-pass', 'Contraseña', 'password')}</div><button class="btn btn-accent" onclick="SAHTEN.online.ui.signIn()">Iniciar sesión</button> `}
        <button class="btn" onclick="SAHTEN.online.ui.disconnect()">Desconectar</button>`
      : `<div style="display:grid;gap:10px;max-width:460px">${f('nb-url', 'URL del proyecto', 'url', '', 'https://abcd1234.supabase.co')}${f('nb-key', 'Anon key (pública)', 'text', '', 'eyJ…')}${f('nb-slug', 'Nombre de tu tienda en la web', 'text', '', 'mi-local')}${f('nb-mail', 'Email', 'email')}${f('nb-pass', 'Contraseña', 'password')}
        <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input id="nb-new" type="checkbox"> Crear una cuenta nueva con este email</label>
        <div style="font-size:11px;color:var(--muted)">Usá solo la <b>anon key</b>. Nunca pegues la clave <b>service_role</b>: la app la rechaza. La contraseña no se guarda.</div>
        <div><button class="btn btn-accent" onclick="SAHTEN.online.ui.connect()">Conectar proyecto</button></div></div>`}
      <div id="nube-msg"></div></div>`;
  }
  function syncCard(sy, role) {
    const stateTxt = { 'al día': '✓ Al día', sincronizando: '⏳ Sincronizando…', conflicto: '⚠ Conflicto', 'sin conexión': '● Sin conexión (pendiente)', error: '⚠ Error', 'sin vincular': 'Todavía no está en la nube' }[sy.state] || sy.state;
    const canPush = ['owner', 'admin'].includes(role);
    return `<div class="card" style="padding:20px;margin-bottom:16px"><div style="font-size:15px;font-weight:700;margin-bottom:8px">Proyecto en la nube</div>
      <div style="font-size:13px;margin-bottom:10px">${esc(stateTxt)}${sy.version ? ' · versión ' + sy.version : ''}${sy.lastAt ? ' · ' + new Date(sy.lastAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}${role ? ' · tu rol: <b>' + esc(ROLE_LABEL[role] || role) + '</b>' : ''}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">El archivo .sahten siempre se guarda primero en tu equipo; la nube es una copia que se actualiza por detrás (con cola si no hay internet). Las imágenes quedan en cada equipo.</div>
      ${sy.conflict ? `<div class="info-banner" style="background:rgba(242,140,0,.12);border-color:rgba(242,140,0,.4);margin-bottom:12px"><b>Alguien cambió el proyecto en la nube</b> mientras vos también lo cambiabas. ¿Qué versión querés conservar?<div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-accent" onclick="SAHTEN.online.ui.resolve('mine')">Quedarme con la mía</button><button class="btn" onclick="SAHTEN.online.ui.resolve('theirs')">Usar la de la nube</button></div></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${sy.linked ? '<button class="btn btn-accent" onclick="SAHTEN.online.ui.syncNow()">Sincronizar ahora</button>' : (canPush || !role ? '<button class="btn btn-accent" onclick="SAHTEN.online.ui.link()">☁ Subir este proyecto a la nube</button>' : '')}
        <button class="btn" onclick="SAHTEN.online.ui.listRemote()">Abrir proyecto de la nube…</button>${role === 'owner' && sy.linked ? '<button class="btn" onclick="SAHTEN.online.ui.remoteView()">👁 Vista remota en tiempo real</button>' : ''}</div>
      <div id="nube-remote" style="margin-top:12px"></div></div>`;
  }
  return ui;
}
