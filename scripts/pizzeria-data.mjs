// Datos FICTICIOS de la pizzería de ejemplo (negocio inventado, precios orientativos en pesos argentinos).
// Los usa scripts/make-demo.mjs para generar src/project/demo.sahten.json.
const ing = (id, name, precioPkg, grPaquete, unit = 'g', cantidad = grPaquete) => ({ id, name, precioPkg, grPaquete, unit, cantidad });
export const INGREDIENTES = [
  ing('harina', 'Harina 000', 1300, 1000), ing('levadura', 'Levadura fresca', 3500, 500), ing('sal', 'Sal fina', 800, 1000),
  ing('aceite', 'Aceite de oliva', 9500, 1000), ing('tomate', 'Puré de tomate', 2200, 1000), ing('muzza', 'Muzzarella', 8800, 1000),
  ing('jamon', 'Jamón cocido', 12500, 1000), ing('morron', 'Morrón rojo', 3800, 1000), ing('cebolla', 'Cebolla', 1100, 1000),
  ing('aceituna', 'Aceitunas verdes', 5200, 1000), ing('tomate_f', 'Tomate fresco', 2500, 1000), ing('albahaca', 'Albahaca', 1800, 100),
  ing('gaseosa', 'Gaseosa 1,5 L (reventa)', 2400, 1500, 'ml', 1),
];
const env = (id, name, precioPkg, cantidad) => ({ id, name, precioPkg, cantidad });
export const ENVASES = [env('caja', 'Caja de pizza', 36000, 100), env('servilleta', 'Servilleta', 3500, 500), env('bolsa', 'Bolsa de papel', 9000, 100), env('caja_emp', 'Caja de empanadas x6', 26000, 100)];
export const GASTOS_OP = [
  { name: 'Alquiler', amount: 650000 }, { name: 'Luz, agua y gas', amount: 280000 }, { name: 'Sistema de caja', amount: 60000 },
  { name: 'Impuestos', amount: 220000 }, { name: 'Misceláneos', amount: 90000 },
];
export const GASTOS_S = [{ name: 'Pizzero', amount: 900000 }, { name: 'Ayudante y caja', amount: 700000 }];

const masa = [['harina', 300, 'g'], ['levadura', 8, 'g'], ['sal', 6, 'g'], ['aceite', 15, 'g']];
const salsa = [['tomate', 150, 'g']];
const row = ([ingId, qty, unit]) => ({ ingId, qty, unit, v: 0 });
const prod = (id, name, category, tier, avgMes, lines, packaging, extra = {}) => ({
  id, name, star: !!extra.star, tier, gfPct: 15, gfPctOverride: null, avgMes, discount: 0, discountType: 'pct', receta_cost: 0, porciones: 1, merma: 0,
  porcionesOverride: null, porcionLabel: 'porciones', recetaOnly: false, category, pesoTotal: String(extra.peso || ''), pesoUnit: 'g', porcionCant: '', porcionUnit: 'g',
  pesoTotalManual: false, weeks: [25, 25, 25, 25], tags: extra.tags || [], ingredients: lines.map(row), packaging: packaging.map(([envId, qty]) => ({ envId, qty, unit: 'u', v: 0 })), combos: [], channelDiscounts: {},
});
export const PRODUCTS = [
  prod('pizza_muzza', 'Pizza Muzzarella', 'Pizzas', 'T3', 420, [...masa, ...salsa, ['muzza', 300, 'g'], ['aceituna', 30, 'g']], [['caja', 1], ['servilleta', 2]], { star: true, peso: 800 }),
  prod('pizza_napo', 'Pizza Napolitana', 'Pizzas', 'T3', 260, [...masa, ...salsa, ['muzza', 280, 'g'], ['tomate_f', 120, 'g'], ['albahaca', 5, 'g']], [['caja', 1], ['servilleta', 2]], { peso: 850 }),
  prod('pizza_fuga', 'Pizza Fugazzeta', 'Pizzas', 'T2', 200, [...masa, ['muzza', 350, 'g'], ['cebolla', 250, 'g'], ['aceituna', 30, 'g']], [['caja', 1], ['servilleta', 2]], { star: true, peso: 950 }),
  prod('pizza_jamon', 'Pizza Jamón y Morrones', 'Pizzas', 'T2', 180, [...masa, ...salsa, ['muzza', 280, 'g'], ['jamon', 120, 'g'], ['morron', 100, 'g']], [['caja', 1], ['servilleta', 2]], { peso: 900 }),
  prod('empanada_jyq', 'Empanadas Jamón y Queso (x6)', 'Empanadas', 'T4', 150, [['harina', 250, 'g'], ['aceite', 30, 'g'], ['muzza', 180, 'g'], ['jamon', 120, 'g'], ['cebolla', 60, 'g']], [['caja_emp', 1], ['servilleta', 2]], { peso: 700 }),
  prod('gaseosa', 'Gaseosa 1,5 L', 'Bebidas', 'T5', 330, [['gaseosa', 1, 'u']], [['bolsa', 1]], { tags: ['reventa'] }),
];
export const STOCK_LEVELS = {   // [actual, mínimo]; lo que no figura queda en el valor por defecto
  harina: [18000, 10000], levadura: [450, 500], sal: [3000, 1000], aceite: [4200, 2000], tomate: [9000, 5000], muzza: [14000, 8000], jamon: [3500, 3000],
  morron: [2200, 1500], cebolla: [6000, 3000], aceituna: [2500, 1000], tomate_f: [1800, 1500], albahaca: [60, 100], gaseosa: [14, 12000 / 1500],
  caja: [180, 100], servilleta: [900, 500], bolsa: [70, 50], caja_emp: [40, 30],
};
export const MOVIMIENTOS = [
  { fecha: '2/10/2026 09:10 a. m.', ing: 'Muzzarella', tipo: 'ingreso', qty: 20000, nota: 'Compra semanal', categoria: 'ingrediente', unit: 'g' },
  { fecha: '3/10/2026 08:45 a. m.', ing: 'Harina 000', tipo: 'ingreso', qty: 25000, nota: 'Bolsa 25 kg', categoria: 'ingrediente', unit: 'g' },
  { fecha: '4/10/2026 11:30 p. m.', ing: 'Jamón cocido', tipo: 'egreso', qty: -600, nota: 'Merma por vencimiento', categoria: 'ingrediente', unit: 'g' },
];
export const CHANNELS_PATCH = {   // id → cambios sobre los canales de fábrica
  mostrador: { enabled: true }, whatsapp: { enabled: true, surcharge: 0.05, desc: 'Pedidos por mensaje' }, rappi: { enabled: true, commission: 0.3 },
  pedidosya: { enabled: true, commission: 0.28 }, fudo: { enabled: false }, mercadopago: { enabled: false },
};
export const DIST = { mostrador: 45, whatsapp: 25, rappi: 15, pedidosya: 15, fudo: 0, mercadopago: 0 };
export const PROJECT = { name: 'Pizzería La Esquina (ejemplo)', setupDone: true, demo: true, checklistDismissed: true };

// ── Formato crudo de v3 (filas {n, v} y filas de combo «Pizza x4», «Pizza 1/2») ─────────────────────────────────────────────
// Lo usan los tests y el baseline: se cargan en la app original (reference/) y en la nueva para comparar números.
// La app arranca SIEMPRE vacía; estos datos nunca se incluyen en el programa.
const pxg = Object.fromEntries(INGREDIENTES.map(i => [i.id, i.precioPkg / i.grPaquete]));
const lineCost = r => { const i = INGREDIENTES.find(x => x.id === r.ingId); const g = r.unit === 'u' ? r.qty * (i.grPaquete / (i.cantidad || 1)) : r.qty; return g * pxg[r.ingId]; };
const rawProducts = PRODUCTS.map(p => { const q = { ...p, receta_cost: +p.ingredients.reduce((s, r) => s + lineCost(r), 0).toFixed(2) }; delete q.gfPctOverride; delete q.porcionesOverride; return q; });
const rc = n => rawProducts.find(p => p.name === n).receta_cost;
rawProducts.push({ id: 'combo_fiesta', name: 'Combo Fiesta', star: false, tier: 'T3', gfPct: 5, avgMes: 40, discount: 0, discountType: 'pct', receta_cost: 0, porciones: 1, merma: 0, porcionLabel: 'porciones', recetaOnly: false, category: 'Combos',
  pesoTotal: '', pesoUnit: 'g', porcionCant: '', porcionUnit: 'g', pesoTotalManual: false, weeks: [10, 10, 10, 10], tags: [], packaging: [{ n: 'Bolsa de papel', v: 90 }],
  ingredients: [{ n: 'Pizza Muzzarella x4', v: +(rc('Pizza Muzzarella') * 4).toFixed(2) }, { n: 'Pizza Napolitana 1/2', v: +(rc('Pizza Napolitana') / 2).toFixed(2) }], combos: [], channelDiscounts: {} });
export const RAW_V3 = { PRODUCTS: rawProducts, INGREDIENTES, ENVASES, GASTOS_OP, GASTOS_S };
