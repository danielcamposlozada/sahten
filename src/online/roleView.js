// Aplica un rol a la pantalla: oculta secciones, costos y márgenes; guarda contra navegar a lo no permitido; solo lectura.
import { canSeePanel, canSeeCosts, canEdit, firstPanel, ROLE_LABEL, NO_COSTS_CSS } from './roles.js';

const PANEL_RE = /showPanel\('([a-z]+)'\)/;

export function applyRole(role, w = window) {
  const d = w.document;
  let st = d.getElementById('role-css');
  if (!st) { st = d.createElement('style'); st.id = 'role-css'; st.textContent = NO_COSTS_CSS; d.head.appendChild(st); }
  d.body.classList.toggle('role-no-costs', !!role && !canSeeCosts(role));
  d.body.classList.toggle('role-readonly', !!role && !canEdit(role));
  d.body.dataset.role = role || '';
  d.querySelectorAll('.nav-item, .bottom-nav-item, .app-drawer-item').forEach(el => {
    const m = PANEL_RE.exec(el.getAttribute('onclick') || ''); if (!m) return;
    const ok = canSeePanel(role, m[1]) || (role && m[1] === 'nube');       // «Nube y usuarios» queda para cerrar sesión / ver el rol
    el.style.display = ok ? '' : 'none';
  });
  d.querySelectorAll('.nav-section').forEach(sec => {                        // oculta títulos de grupos que quedaron vacíos
    let n = sec.nextElementSibling, any = false;
    while (n && !n.classList.contains('nav-section')) { if (n.classList.contains('nav-item') && n.style.display !== 'none') any = true; n = n.nextElementSibling; }
    sec.style.display = any ? '' : 'none';
  });
  let b = d.getElementById('role-banner');
  if (role && role !== 'owner' && role !== 'admin') {
    if (!b) { b = d.createElement('div'); b.id = 'role-banner'; b.className = 'role-banner'; const main = d.querySelector('.main'); main && main.insertBefore(b, main.firstChild); }
    b.textContent = 'Ingresaste como ' + ROLE_LABEL[role] + (canEdit(role) ? '' : ' · solo lectura');
  } else if (b) b.remove();
  if (role && !canSeePanel(role, w.currentPanel)) w.showPanel(firstPanel(role));
}

/** Guarda: cualquier intento de mostrar un panel no permitido vuelve al primero permitido. */
export function installRoleGuard(getRole, events) {
  events.around('showPanel', (next, name) => {
    const role = getRole();
    if (role && !canSeePanel(role, name) && name !== 'nube') return next(firstPanel(role));
    return next(name);
  });
}
