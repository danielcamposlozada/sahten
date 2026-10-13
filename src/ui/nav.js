// Navegación: un solo juego de listeners para el menú lateral, la barra inferior y el cajón del celular.
// Cada acceso declara su sección con data-panel; la URL (#/menuonline) permite volver atrás, recargar y compartir.
const HASH_RE = /^#\/([a-z]+)$/;

export function panelFromHash(hash, valid) {
  const m = HASH_RE.exec(hash || ''); return m && valid(m[1]) ? m[1] : null;
}

export function installNav(w = window) {
  const d = w.document;
  const exists = name => !!d.getElementById('panel-' + name);

  d.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-panel]');
    if (!el || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (typeof w.closeDrawer === 'function') w.closeDrawer();
    if (typeof w.showPanel === 'function') w.showPanel(el.dataset.panel);
  });

  // «Saltar al contenido» (teclado / lector de pantalla) sin tocar la URL de la app
  d.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-skip]'); if (!a) return;
    e.preventDefault(); const m = d.getElementById('main-content'); if (m) m.focus();
  });

  // Atrás / Adelante / hash editado a mano
  w.addEventListener('hashchange', () => {
    const name = panelFromHash(w.location.hash, exists);
    if (!name || name === w.currentPanel || typeof w.showPanel !== 'function') return;
    w._navFromHistory = true;
    try { w.showPanel(name); } finally { w._navFromHistory = false; }
  });

  // Enlace directo (…/#/menuonline) al abrir la app
  return function openFromHash() {
    const name = panelFromHash(w.location.hash, exists);
    if (name && typeof w.showPanel === 'function') {
      w._navFromHistory = true;
      try { w.showPanel(name); } finally { w._navFromHistory = false; }
    }
    return name;
  };
}
