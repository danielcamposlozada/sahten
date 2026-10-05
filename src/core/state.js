// ═══════════════════════════════════════════════════════════
// Estado único del proyecto (objeto en memoria)
// Todo el cálculo de src/core/ recibe este objeto como primer argumento.
// No toca el DOM ni localStorage.
// ═══════════════════════════════════════════════════════════

export function createProjectionState() {
  return {
    channelDist: {},     // { channelId: pct 0-100 }
    channelLocked: {},   // { channelId: true }
    manualMode: false,
    manualUnits: {},     // { productId: unidades }
  };
}

/** Crea un estado de proyecto vacío (o parte de `init`). */
export function createState(init = {}) {
  return {
    project: {},            // nombre, tipo, moneda (currencySymbol, roundTo, locale), estUnitsMonth, targetMargin, …
    tiers: [],
    channels: [],
    ingredients: [],
    packs: [],              // envases
    products: [],
    gastosOp: [],           // gastos operativos { id, name, amount }
    gastosS: [],            // sueldos { id, name, amount }
    gfDiscHistory: [],      // legado: ya no afecta el GF
    gfMonths: {},           // control mensual { 'YYYY-MM': {...} }
    stock: {},              // { itemId: { actual, minimo, unit } }
    movements: [],
    globalCommission: 0,    // en % (antes: input #global-commission)
    usdRate: 1200,          // antes: input #usd-rate
    customTC: 0,
    projection: createProjectionState(),
    ...init,
  };
}

/** Estado vivo de la app. El código legado lo ve a través de accesores globales (ver src/bridge). */
export const state = createState();

/** Reemplaza el contenido del estado vivo sin cambiar la identidad del objeto. */
export function resetState(target = state, init = {}) {
  const fresh = createState(init);
  Object.keys(target).forEach(k => delete target[k]);
  Object.assign(target, fresh);
  return target;
}
