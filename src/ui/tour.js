// Tour guiado: recorre las secciones con un recuadro que resalta el menú y explica qué hace cada una.
// Se abre solo en el proyecto de ejemplo y se puede repetir cuando quieras: Ajustes › Esta app › Ayuda y tour.
// Los textos están juntos acá para poder traducirlos (i18n) sin tocar la lógica.
export const TOUR_STEPS = [
  { panel: 'dashboard', title: 'Bienvenido a Sahten', text: 'Este es el resumen de tu negocio: precios promedio, márgenes y gastos fijos. Te muestro en 1 minuto cómo se conecta todo. Podés salir cuando quieras.' },
  { panel: 'ingredientes', title: '1 · Ingredientes', text: 'Cargás cada insumo con el precio del paquete y su tamaño. Si el precio de la mozzarella sube, se actualizan todas las recetas y todos los precios.' },
  { panel: 'envases', title: '2 · Envases', text: 'Cajas, bolsas y servilletas. Se suman al costo de cada producto que los usa.' },
  { panel: 'costreceta', title: '3 · Costo de receta', text: 'Armás cada plato con ingredientes y envases. Sahten calcula el costo por porción, incluso con sub-recetas como la masa o la salsa.' },
  { panel: 'productos', title: '4 · Menú y precios', text: 'Acá está el precio final de cada plato por canal. Elegís el nivel de ganancia (tier) y el precio sale solo. Tocá «¿De dónde sale este precio?» para ver el desglose.' },
  { panel: 'stock', title: '5 · Stock', text: 'Cantidades actuales y mínimos de ingredientes y envases. Registrás ingresos, egresos y mermas, y te avisa cuando algo está por acabarse.' },
  { panel: 'gastos', title: '6 · Gastos fijos', text: 'Alquiler, sueldos, servicios. Se reparten en el precio de lo que vendés, así que ningún plato «se come» el gasto del local.' },
  { panel: 'ventas', title: '7 · Ventas + GF', text: 'Cuántas unidades vendés de cada plato por mes. Define cuánto gasto fijo absorbe cada unidad.' },
  { panel: 'proyeccion', title: '8 · Proyección', text: 'Simulá un mes: unidades, reparto por canal (mostrador, delivery, apps), ganancia y punto de equilibrio.' },
  { panel: 'mostrador', title: '9 · Mostrador', text: 'Cargás pedidos de retiro o delivery. Las órdenes alimentan los reportes.' },
  { panel: 'menuonline', title: '10 · Menú online', text: 'Tu carta para compartir con clientes, con pedido por WhatsApp. Opcional y sin costo.' },
  { panel: 'ajustes', title: 'Listo. Tu turno', text: 'Para empezar con tu negocio: Archivo › Nuevo proyecto. Este tour queda siempre disponible en Ajustes › Esta app › Ayuda y tour.' },
];

const KEY = 'sahten-tour';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } },
  set(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento: no pasa nada */ } },
};

export function installTour(w = window) {
  const d = w.document;
  let i = 0, ov = null, hl = null, box = null;

  function target(step) {
    return d.querySelector(`.sidebar .nav-item[onclick*="showPanel('${step.panel}')"], .nav-item[onclick*="showPanel('${step.panel}')"]`);
  }
  function close(done) {
    ov && ov.remove(); hl && hl.remove(); box && box.remove(); ov = hl = box = null;
    d.removeEventListener('keydown', onKey, true);
    if (done) store.set({ ...store.get(), done: true });
  }
  function onKey(e) { if (e.key === 'Escape') close(false); else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1); else if (e.key === 'ArrowLeft') go(-1); }
  function go(n) { if (i + n >= TOUR_STEPS.length) return close(true); i = Math.max(0, i + n); render(); }
  function render() {
    const s = TOUR_STEPS[i];
    try { if (typeof w.showPanel === 'function') w.showPanel(s.panel); } catch (e) { console.warn(e); }
    if (!ov) {
      ov = d.createElement('div'); ov.id = 'st-tour'; ov.style.cssText = 'position:fixed;inset:0;z-index:19990;background:transparent';
      hl = d.createElement('div'); hl.style.cssText = 'position:fixed;z-index:19991;border-radius:10px;box-shadow:0 0 0 9999px rgba(10,20,12,.58);pointer-events:none;transition:all .25s';
      box = d.createElement('div'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Tour guiado');
      box.style.cssText = 'position:fixed;z-index:19992;width:min(340px,calc(100vw - 24px));background:var(--card,#fff);color:var(--ink,#1e2c1f);border-radius:14px;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:inherit';
      d.body.append(ov, hl, box); d.addEventListener('keydown', onKey, true);
    }
    const last = i === TOUR_STEPS.length - 1;
    box.innerHTML = `<div style="font-size:11px;color:var(--muted,#6b7c6c);margin-bottom:4px">Paso ${i + 1} de ${TOUR_STEPS.length}</div>
      <div style="font-weight:800;font-size:15px;margin-bottom:6px">${s.title}</div>
      <div style="font-size:13px;line-height:1.5">${s.text}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:14px">
        <button type="button" data-t="skip" style="background:none;border:0;color:var(--muted,#6b7c6c);cursor:pointer;font:inherit;font-size:12px;padding:6px 0">${last ? '' : 'Salir del tour'}</button>
        <span style="flex:1"></span>
        ${i > 0 ? '<button type="button" data-t="prev" style="border:1.5px solid var(--border,#e2ddd5);background:transparent;color:inherit;border-radius:10px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer">Atrás</button>' : ''}
        <button type="button" data-t="next" style="border:0;background:var(--accent,#F28C00);color:#fff;border-radius:10px;padding:7px 16px;font:inherit;font-weight:700;cursor:pointer">${last ? 'Terminar' : 'Siguiente'}</button>
      </div>`;
    box.querySelector('[data-t=next]').onclick = () => go(1);
    const p = box.querySelector('[data-t=prev]'); if (p) p.onclick = () => go(-1);
    box.querySelector('[data-t=skip]').onclick = () => close(false);
    const t = target(s), r = t && t.getBoundingClientRect();
    if (r && r.width > 0) {
      hl.style.cssText += `;left:${r.left - 4}px;top:${r.top - 3}px;width:${r.width + 8}px;height:${r.height + 6}px`;
      box.style.left = Math.min(r.right + 16, w.innerWidth - box.offsetWidth - 12) + 'px';
      box.style.top = Math.max(12, Math.min(r.top - 8, w.innerHeight - box.offsetHeight - 12)) + 'px'; box.style.transform = '';
    } else {   // sin menú lateral (móvil): recuadro centrado
      hl.style.cssText += ';left:50%;top:50%;width:0;height:0';
      box.style.left = '50%'; box.style.top = '50%'; box.style.transform = 'translate(-50%,-50%)';
    }
  }
  const tour = {
    start() { if (!d.getElementById('st-tour')) { i = 0; render(); } },
    isOpen: () => !!d.getElementById('st-tour'),
    seen: () => !!store.get().done,
    close: () => close(false),
  };
  w.sahtenTour = tour;
  return tour;
}
