// ═══════════════════════════════════════════════════════════
// Registro de módulos con eventos
// Reemplaza la cadena de wrappers (window.showPanel = function(){ _orig(); … })
// que cada archivo armaba por su cuenta.
//
//   onPanelShow('mostrador', name => …)   al mostrar un panel ('*' = cualquiera)
//   onDataChanged(() => …)                tras recalcAll() o al cargar datos (applyData)
//   beforeRender('renderStock', fn)       antes de que corra la función de render
//   afterRender('renderDashboard', fn)    después de que corra
//
// Las funciones de render se envuelven UNA sola vez (instrument) y los
// ganchos corren en el orden en que se registraron.
// ═══════════════════════════════════════════════════════════

const hooks = { before: new Map(), after: new Map(), around: new Map(), panel: new Map(), data: [] };
const wrapped = new Set();

function push(map, key, fn) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(fn);
  return () => { const a = map.get(key); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
}
function run(list, args, label) {
  (list || []).slice().forEach(fn => { try { fn(...args); } catch (e) { console.error('[Sahten] error en ' + label, e); } });
}

export const beforeRender = (name, fn) => push(hooks.before, name, fn);
export const afterRender = (name, fn) => push(hooks.after, name, fn);
/** around('mostSetTab', (next, tab) => …): decide si llamar a la función original (next) o reemplazarla. */
export const around = (name, fn) => push(hooks.around, name, fn);
export const onPanelShow = (panel, fn) => push(hooks.panel, panel, fn);
export const onDataChanged = fn => { hooks.data.push(fn); return () => { const i = hooks.data.indexOf(fn); if (i >= 0) hooks.data.splice(i, 1); }; };

/** Envuelve (una sola vez) las funciones globales indicadas para que disparen sus ganchos. */
export function instrument(names, win = window) {
  names.forEach(name => {
    const orig = win[name];
    if (typeof orig !== 'function' || wrapped.has(name)) return;
    wrapped.add(name);
    const wrapper = function (...args) {
      run(hooks.before.get(name), args, 'before:' + name);
      let call = (...a) => orig.apply(this, a);
      (hooks.around.get(name) || []).forEach(h => { const inner = call; call = (...a) => h(inner, ...a); });
      const r = call(...args);
      run(hooks.after.get(name), args, 'after:' + name);
      if (name === 'showPanel') {
        run(hooks.panel.get(args[0]), args, 'panel:' + args[0]);
        run(hooks.panel.get('*'), args, 'panel:*');
      }
      if (name === 'recalcAll' || name === 'applyData') run(hooks.data, args, 'dataChanged');
      return r;
    };
    win[name] = wrapper;
  });
}

export const events = { beforeRender, afterRender, around, onPanelShow, onDataChanged, instrument };
