export const inventoryEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inventorySearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let sequence = 0;
export function inventoryActionMenu(label, buttons) {
  const id = 'inventory-actions-' + ++sequence;
  return `<div class="inventory-actions"><button type="button" class="btn inventory-more" popovertarget="${id}" data-inventory-menu="${id}" aria-controls="${id}" aria-label="Acciones de ${inventoryEscape(label)}" aria-expanded="false" title="Acciones"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button><div id="${id}" popover="auto" class="inventory-action-popover" aria-label="Acciones de ${inventoryEscape(label)}">${buttons}</div></div>`;
}

export function installInventoryMenus(w) {
  const d = w.document;
  const close = (menu, focus = false) => {
    if (typeof menu.hidePopover === 'function') { try { menu.hidePopover(); } catch { /* cerrado */ } }
    menu.classList.remove('fallback-open');
    const button = d.querySelector(`[data-inventory-menu="${menu.id}"]`);
    button?.setAttribute('aria-expanded', 'false'); if (focus) button?.focus();
  };
  const place = menu => {
    const button = d.querySelector(`[data-inventory-menu="${menu.id}"]`); if (!button) return;
    const b = button.getBoundingClientRect(), m = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(w.innerWidth - m.width - 8, b.right - m.width)) + 'px';
    menu.style.top = Math.max(8, b.bottom + m.height + 8 > w.innerHeight ? b.top - m.height - 4 : b.bottom + 4) + 'px';
    button.setAttribute('aria-expanded', 'true');
  };
  d.addEventListener('toggle', e => {
    if (!e.target.classList?.contains('inventory-action-popover')) return;
    if (e.newState === 'open') place(e.target);
    else d.querySelector(`[data-inventory-menu="${e.target.id}"]`)?.setAttribute('aria-expanded', 'false');
  }, true);
  d.addEventListener('click', e => {
    const button = e.target.closest('[data-inventory-menu]');
    if (button) {
      const menu = d.getElementById(button.dataset.inventoryMenu);
      if (typeof menu.showPopover !== 'function') { menu.classList.toggle('fallback-open'); if (menu.classList.contains('fallback-open')) place(menu); else close(menu); }
      return;
    }
    d.querySelectorAll('.inventory-action-popover').forEach(menu => close(menu));
  });
  d.addEventListener('keydown', e => { if (e.key === 'Escape') d.querySelectorAll('.inventory-action-popover').forEach(menu => { if (menu.classList.contains('fallback-open')) close(menu, true); }); });
  w.addEventListener('resize', () => d.querySelectorAll('.inventory-action-popover').forEach(menu => close(menu)));
}
