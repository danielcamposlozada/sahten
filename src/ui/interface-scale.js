export const normalizeScale = value => Math.max(80, Math.min(125, Math.round(Number(value) || 100)));

export function installInterfaceScale(w = window, nativeZoom = null) {
  const d = w.document;
  let current = 100, queue = Promise.resolve(), requested = 100;
  const reflect = (value, message) => {
    d.querySelectorAll('[data-interface-scale]').forEach(el => { el.value = String(value); });
    const status = d.getElementById('interface-scale-status'); if (status) status.textContent = message || `Escala actual: ${value} %. Se guarda solo en este equipo.`;
  };
  const apply = async value => {
    if (nativeZoom) await nativeZoom(value / 100);
    else d.documentElement.style.zoom = String(value / 100);
    w.dispatchEvent(new w.Event('resize'));
  };
  const set = value => {
    requested = normalizeScale(value);
    reflect(requested, 'Aplicando escala…');
    const next = requested;
    queue = queue.catch(() => {}).then(async () => {
      if (next !== requested) return;
      try {
        await apply(next); current = next;
        try { w.localStorage.setItem('sahten-interface-scale', String(next)); } catch { reflect(current, 'Escala aplicada; no se pudo recordar en este equipo.'); return; }
        reflect(current);
      } catch { reflect(current, 'No se pudo cambiar la escala. Se conserva la anterior.'); }
    });
    return queue;
  };
  d.querySelectorAll('[data-interface-scale]').forEach(el => el.addEventListener('change', () => set(el.value)));
  d.querySelectorAll('[data-interface-preset]').forEach(el => el.addEventListener('click', () => set(el.dataset.interfacePreset)));
  try { current = requested = normalizeScale(w.localStorage.getItem('sahten-interface-scale')); } catch { /* escala normal */ }
  const ready = apply(current).then(() => reflect(current)).catch(() => { current = requested = 100; reflect(current, 'No se pudo restaurar la escala.'); });
  queue = ready;
  return { set, ready, value: () => current };
}
