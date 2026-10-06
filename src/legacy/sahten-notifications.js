// ═══════════════════════════════════════════════════════
// SAHTEN — NOTIFICATION CENTER
// Bell icon, slide-down toasts, notification drawer
// ═══════════════════════════════════════════════════════

const NOTIF_KEY = 'sahten_notifications';
let _notifDrawerOpen = false;

// Dos listas: las del PROYECTO (pedidos, errores; viajan en el archivo y cambian con el proyecto) y las de la APP
// (scope:'app', por ejemplo «hay una versión nueva»: no dependen del proyecto abierto y no se guardan en él).
const APP_NOTIF_KEY = 'sahten-app-notifs';
function _readList(key) { try { const l = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(l) ? l : []; } catch(e) { return []; } }
function _loadNotifications() {
  return _readList(NOTIF_KEY).concat(_readList(APP_NOTIF_KEY)).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}
function _saveNotifications(list) {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(list.filter(n => n.scope !== 'app')));
    localStorage.setItem(APP_NOTIF_KEY, JSON.stringify(list.filter(n => n.scope === 'app')));
  } catch(e) { /* sin almacenamiento */ }
}

// ─── Add notification ────────────────────────────────
function pushNotification(opts) {
  // opts: { type:'order'|'delivery'|'error'|'info', title, body, source:'delivery'|'mostrador'|'sistema' }
  const notif = {
    id: 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    type: opts.type || 'info',
    title: opts.title || 'Notificación',
    body: opts.body || '',
    source: opts.source || 'sistema',
    timestamp: new Date().toISOString(),
    read: false,
    ...(opts.scope === 'app' ? { scope: 'app' } : {}),
    ...(opts.key ? { key: opts.key } : {}),
    ...(opts.action ? { action: opts.action } : {})   // { label, call }: botón dentro de la notificación
  };
  const list = _loadNotifications();
  if (notif.key && list.some(n => n.key === notif.key)) return list.find(n => n.key === notif.key);   // el mismo aviso no se repite
  list.unshift(notif);
  if (list.length > 50) list.splice(50);
  _saveNotifications(list);
  _updateBellBadge();
  _showNotifToast(notif);
  return notif;
}

// ─── Notification sound (hotel bell) ─────────────────
let _notifAudioCtx = null;

function _playNotifSound() {
  try {
    if (!_notifAudioCtx) _notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _notifAudioCtx;
    const now = ctx.currentTime;

    // Bell-like sound using 2 oscillators
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.3);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1800, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.25);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1).connect(ctx.destination);
    osc2.connect(gain2).connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.6);
    osc2.start(now);
    osc2.stop(now + 0.4);

    // Second ding (echo)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1400, now + 0.15);
    osc3.frequency.exponentialRampToValueAtTime(900, now + 0.5);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.2, now + 0.15);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(now + 0.15);
    osc3.stop(now + 0.7);
  } catch(e) { /* AudioContext not available */ }
}

// ─── Toast (slide down from top) ─────────────────────
function _showNotifToast(notif) {
  // Remove any existing toast
  document.getElementById('sahten-notif-toast')?.remove();

  const icons = {
    order: '🛒', delivery: '🛵', error: '⚠️', info: 'ℹ️', success: '✅'
  };
  const colors = {
    order: '#235328', delivery: '#F28C00', error: '#e04040', info: '#3b82f6', success: '#27ae60'
  };

  const toast = document.createElement('div');
  toast.id = 'sahten-notif-toast';
  toast.style.cssText = `
    position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
    z-index: 10000; width: calc(100% - 32px); max-width: 420px;
    background: white; border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
    padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px;
    cursor: pointer; transition: top 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
    border-left: 4px solid ${colors[notif.type] || colors.info};
  `;
  // Dark mode support
  if (document.documentElement.getAttribute('data-theme') === 'dark') {
    toast.style.background = '#2a2a2a';
    toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
  }

  toast.innerHTML = `
    <div style="font-size:24px;line-height:1;flex-shrink:0;margin-top:2px">${icons[notif.type] || icons.info}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-size:14px;font-weight:700;color:var(--ink,#1e2c1f)">${_escNotif(notif.title)}</div>
        <div style="font-size:10px;color:var(--muted,#7a8a7c);flex-shrink:0">${_notifTimeAgo(notif.timestamp)}</div>
      </div>
      <div style="font-size:12px;color:var(--muted,#7a8a7c);margin-top:3px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escNotif(notif.body)}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <span style="font-size:10px;padding:2px 8px;border-radius:6px;background:${colors[notif.type]||colors.info}15;color:${colors[notif.type]||colors.info};font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${_escNotif(notif.source)}</span>
      </div>
    </div>
    <button onclick="event.stopPropagation();this.closest('#sahten-notif-toast').remove()" style="background:none;border:none;font-size:16px;color:var(--muted,#999);cursor:pointer;padding:0;line-height:1;flex-shrink:0">✕</button>
  `;

  toast.onclick = () => {
    toast.remove();
    openNotifDrawer();
  };

  document.body.appendChild(toast);
  _playNotifSound();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.top = '16px'; });
  });

  // Auto-hide after 5s
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.top = '-100px';
      setTimeout(() => toast.remove(), 500);
    }
  }, 5000);
}

// ─── Bell badge ──────────────────────────────────────
function _updateBellBadge() {
  const list = _loadNotifications();
  const unread = list.filter(n => !n.read).length;
  // Update all bell badges (desktop + mobile)
  ['notif-bell-badge', 'notif-bell-badge-m'].forEach(id => {
    const badge = document.getElementById(id);
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
  });
}

// ─── Bell button HTML ────────────────────────────────
function getNotifBellHTML() {
  const list = _loadNotifications();
  const unread = list.filter(n => !n.read).length;
  return `
    <button class="btn notif-bell-btn" onclick="openNotifDrawer()" title="Notificaciones" style="position:relative;padding:8px 10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span id="notif-bell-badge" style="
        position:absolute;top:2px;right:2px;
        min-width:16px;height:16px;border-radius:8px;
        background:#e04040;color:white;font-size:10px;font-weight:800;
        display:${unread > 0 ? 'flex' : 'none'};align-items:center;justify-content:center;
        padding:0 4px;line-height:1;
      ">${unread > 9 ? '9+' : unread}</span>
    </button>
  `;
}

// ─── Notification drawer ─────────────────────────────
function openNotifDrawer() {
  _notifDrawerOpen = true;
  // Mark all as read
  const list = _loadNotifications();
  list.forEach(n => n.read = true);
  _saveNotifications(list);
  _updateBellBadge();

  let ov = document.getElementById('notif-drawer-overlay');
  if (ov) { ov.remove(); }

  ov = document.createElement('div');
  ov.id = 'notif-drawer-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);opacity:0;transition:opacity 0.2s;backdrop-filter:blur(2px)';
  ov.onclick = closeNotifDrawer;
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.opacity = '1'; });

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#1e1e1e' : 'white';
  const borderC = isDark ? '#333' : '#e5e5e5';

  const drawer = document.createElement('div');
  drawer.id = 'notif-drawer';
  drawer.style.cssText = `
    position:fixed;top:0;right:-400px;width:380px;max-width:calc(100vw - 16px);height:100vh;
    z-index:9999;background:${bg};box-shadow:-4px 0 24px rgba(0,0,0,0.12);
    display:flex;flex-direction:column;transition:right 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    border-left:1px solid ${borderC};
  `;

  const icons = { order:'🛒', delivery:'🛵', error:'⚠️', info:'ℹ️', success:'✅', update:'⬆️' };
  const colors = { order:'#235328', delivery:'#F28C00', error:'#e04040', info:'#3b82f6', success:'#27ae60', update:'#7c3aed' };

  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;border-bottom:1px solid ${borderC}">
      <div style="display:flex;align-items:center;gap:10px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span style="font-size:17px;font-weight:700;color:var(--ink,#1e2c1f)">Notificaciones</span>
        <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:var(--sand,#f5f5f5);color:var(--muted,#888);font-weight:600">${list.length}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        ${list.length > 0 ? '<button onclick="clearAllNotifications()" style="padding:6px 12px;border:1px solid '+borderC+';border-radius:8px;background:transparent;font-size:11px;font-weight:600;color:var(--muted,#888);cursor:pointer">Limpiar todo</button>' : ''}
        <button onclick="closeNotifDrawer()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted,#888);padding:4px">✕</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px">
      ${list.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--muted,#888)">
          <div style="font-size:40px;margin-bottom:12px;opacity:0.4">🔔</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:4px">Sin notificaciones</div>
          <div style="font-size:12px">Las notificaciones de pedidos y errores aparecerán acá.</div>
        </div>
      ` : list.map((n, i) => {
        const d = new Date(n.timestamp);
        const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        return `
          <div style="display:flex;gap:12px;padding:14px 12px;border-radius:12px;margin-bottom:2px;transition:background 0.1s;cursor:default" onmouseover="this.style.background='var(--sand,#f8f8f8)'" onmouseout="this.style.background='transparent'">
            <div style="width:36px;height:36px;border-radius:10px;background:${colors[n.type]||colors.info}12;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${icons[n.type]||icons.info}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div style="font-size:13px;font-weight:700;color:var(--ink,#1e2c1f);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escNotif(n.title)}</div>
                <button onclick="deleteNotification('${n.id}')" style="background:none;border:none;font-size:14px;color:var(--muted,#ccc);cursor:pointer;padding:0;flex-shrink:0">✕</button>
              </div>
              <div style="font-size:12px;color:var(--muted,#7a8a7c);margin-top:2px;line-height:1.4">${_escNotif(n.body)}</div>
              ${n.action ? `<button onclick="notifAction('${n.id}')" style="margin-top:8px;padding:7px 14px;border:0;border-radius:9px;background:${colors[n.type]||colors.info};color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">${_escNotif(n.action.label)}</button>` : ''}
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
                <span style="font-size:10px;padding:2px 7px;border-radius:5px;background:${colors[n.type]||colors.info}12;color:${colors[n.type]||colors.info};font-weight:600;text-transform:uppercase;letter-spacing:0.3px">${_escNotif(n.source)}</span>
                <span style="font-size:10px;color:var(--muted,#aaa)">${date} · ${time}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  document.body.appendChild(drawer);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { drawer.style.right = '0'; });
  });
}

function closeNotifDrawer() {
  _notifDrawerOpen = false;
  const drawer = document.getElementById('notif-drawer');
  const ov = document.getElementById('notif-drawer-overlay');
  if (drawer) { drawer.style.right = '-400px'; setTimeout(() => drawer.remove(), 300); }
  if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 200); }
}

function clearAllNotifications() {
  _saveNotifications([]);
  _updateBellBadge();
  closeNotifDrawer();
  if (window._posToast) _posToast('Notificaciones limpiadas');
}

// Botón de una notificación: hoy solo «update» (instalar la versión nueva, app de escritorio)
function notifAction(id) {
  const n = _loadNotifications().find(x => x.id === id); if (!n || !n.action) return;
  if (n.action.call === 'update' && window.SAHTEN && window.SAHTEN.desktop && window.SAHTEN.desktop.installUpdate) { closeNotifDrawer(); window.SAHTEN.desktop.installUpdate(); }
}
// Quita avisos por prefijo de clave (por ejemplo los de «versión nueva» cuando ya se actualizó)
function dropNotifications(prefix) {
  const list = _loadNotifications(); const keep = list.filter(n => !(n.key && n.key.startsWith(prefix)));
  if (keep.length !== list.length) { _saveNotifications(keep); _updateBellBadge(); }
}
window.notifAction = notifAction; window.dropNotifications = dropNotifications;

function deleteNotification(id) {
  const list = _loadNotifications().filter(n => n.id !== id);
  _saveNotifications(list);
  _updateBellBadge();
  // Re-render drawer if open
  if (_notifDrawerOpen) { closeNotifDrawer(); setTimeout(openNotifDrawer, 100); }
}

// ─── Helpers ─────────────────────────────────────────
function _escNotif(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function _notifTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return mins + ' min';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.floor(hrs / 24) + 'd';
}

// ─── Hook into order events ─────────────────────────
function _notifyNewOrder(order) {
  const source = order.source === 'delivery' ? 'delivery' : 'mostrador';
  const type = source === 'delivery' ? 'delivery' : 'order';
  pushNotification({
    type: type,
    title: 'Nuevo pedido #' + String(order.num).padStart(4, '0'),
    body: (order.customerName || 'Cliente') + ' · $' + Number(order.total || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' · ' + (order.items || []).length + ' items',
    source: source
  });
}

function _notifyError(title, body) {
  pushNotification({ type: 'error', title: title, body: body, source: 'sistema' });
}

function _notifyInfo(title, body) {
  pushNotification({ type: 'info', title: title, body: body, source: 'sistema' });
}

// ─── Poll for new delivery orders ────────────────────
let _lastOrderCount = 0;
function _pollDeliveryOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem('sahten_orders') || '[]');
    if (_lastOrderCount === 0) { _lastOrderCount = orders.length; return; }
    if (orders.length > _lastOrderCount) {
      // New orders arrived
      const newOrders = orders.slice(0, orders.length - _lastOrderCount);
      newOrders.forEach(o => _notifyNewOrder(o));
    }
    _lastOrderCount = orders.length;
  } catch(e) {}
}

// Start polling every 5 seconds
setInterval(_pollDeliveryOrders, 5000);

// Init
document.addEventListener('DOMContentLoaded', () => {
  _lastOrderCount = 0;
  try { _lastOrderCount = JSON.parse(localStorage.getItem('sahten_orders') || '[]').length; } catch(e) {}
  _updateBellBadge();
});
