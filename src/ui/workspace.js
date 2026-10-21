const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Foco e inactividad del fondo; los diálogos secundarios conservan su propio teclado. */
export function bindModalFocus(panel, { w = window, trigger = w.document.activeElement, background = [], close } = {}) {
  const d = w.document;
  const previous = background.filter(Boolean).map(el => [el, el.inert]);
  previous.forEach(([el]) => { el.inert = true; });
  function onKey(e) {
    if (e.defaultPrevented) return;
    const otherDialog = d.activeElement?.closest('[role="dialog"],.modal-overlay');
    if (otherDialog && !panel.contains(otherDialog) && otherDialog !== panel) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length && !el.closest('[inert]'));
    if (!controls.length) { e.preventDefault(); panel.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (!panel.contains(d.activeElement) || d.activeElement === panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  d.addEventListener('keydown', onKey);
  panel.focus({ preventScroll: true });
  return ({ restoreFocus = true } = {}) => {
    d.removeEventListener('keydown', onKey);
    previous.forEach(([el, inert]) => { el.inert = !!inert; });
    if (restoreFocus && trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
  };
}

/** Preferencia de este equipo: nunca forma parte de los datos del negocio. */
export function installWorkspace(w = window) {
  const d = w.document, root = d.documentElement;
  const sidebar = d.querySelector('.sidebar'), toggle = d.getElementById('nav-toggle');
  if (!sidebar || !toggle) return;
  let preference = null;
  try { preference = w.localStorage.getItem('sahten-navigation'); } catch { /* almacenamiento opcional */ }
  sidebar.querySelectorAll('.nav-item').forEach(el => {
    const label = [...el.childNodes].map(n => n.textContent).join(' ').trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', label); el.title = label;
    [...el.children].filter(n => n.tagName === 'SPAN' && !n.classList.contains('nav-badge')).forEach(n => n.classList.add('nav-label'));
    [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => {
      const span = d.createElement('span'); span.className = 'nav-label'; n.replaceWith(span); span.append(n);
    });
  });
  function sync() {
    const mobile = w.innerWidth <= 768;
    const compact = preference ? preference === 'compact' : w.innerWidth < 1280;
    root.dataset.navigation = mobile ? 'mobile' : compact ? 'compact' : 'expanded';
    toggle.setAttribute('aria-controls', mobile ? 'app-drawer-overlay' : 'app-sidebar');
    toggle.setAttribute('aria-expanded', String(mobile ? !!d.querySelector('.app-drawer-overlay.open') : !compact));
    toggle.setAttribute('aria-label', mobile ? 'Abrir menú de secciones' : compact ? 'Desplegar menú lateral' : 'Plegar menú lateral');
    toggle.title = toggle.getAttribute('aria-label');
    const width = d.querySelector('.main').getBoundingClientRect().width || w.innerWidth - (mobile ? 0 : compact ? 72 : 260);
    root.dataset.workspace = width <= 1000 ? 'compact' : 'wide';
    root.dataset.orderLayout = width <= 900 ? 'overlay' : 'columns';
    w.dispatchEvent(new w.Event('sahten:layout'));
  }
  toggle.addEventListener('click', () => {
    if (w.innerWidth <= 768) { w.toggleDrawer(); return; }
    preference = root.dataset.navigation === 'compact' ? 'expanded' : 'compact';
    try { w.localStorage.setItem('sahten-navigation', preference); } catch { /* sin persistencia */ }
    sync();
  });
  w.addEventListener('resize', sync);
  if (w.ResizeObserver) new w.ResizeObserver(sync).observe(d.querySelector('.main'));
  sync();
}
