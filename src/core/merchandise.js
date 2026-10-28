// Mercadería comparte el cálculo de presentación de Ingredientes, pero mantiene
// su catálogo separado. Las recetas y las ventas referencian el mismo artículo.
import { toBase, calcIngCost } from './costs.js';

export function createResaleProduct(s, itemId, id) {
  const item = (s.merchandise || []).find(x => x.id === itemId);
  if (!item) throw new Error('No encontramos ese artículo de Mercadería.');
  const existing = s.products.find(p => p.productType === 'resale' && p.merchandise?.length === 1 && p.merchandise[0].merchId === itemId);
  if (existing) return existing;
  const p = {
    id, name: item.name, productType: 'resale', merchandise: [{ merchId: item.id, qty: 1 }],
    ingredients: [], packaging: [], combos: [], receta_cost: 0,
    porciones: 1, porcionLabel: 'unidad', pesoTotal: '', pesoUnit: 'u',
    tier: s.tiers.find(t => t.id === 'T3')?.id || s.tiers[0]?.id || 'T3',
    gfPct: 0, avgMes: 0, weeks: [0, 0, 0, 0], star: false, tags: [], category: '',
    discount: 0, discountType: 'pct', channelDiscounts: {}, recetaOnly: false,
    salesAvailability: { paused: true, resumeAt: null, updatedAt: new Date().toISOString() },
  };
  s.products.push(p);
  return p;
}

export function merchandiseUsages(s, id) {
  return s.products.filter(p => (p.merchandise || []).some(r => r.merchId === id));
}

/** Traslado explícito: conserva ID, stock, referencias y valores históricos. */
export function moveIngredientToMerchandise(s, id) {
  const item = s.ingredients.find(x => x.id === id);
  if (!item) throw new Error('No encontramos ese ingrediente.');
  if (item.unit !== 'u') throw new Error('Solo se pueden mover artículos cargados en unidades (u). Revisá su presentación antes de moverlos.');
  if ((s.merchandise || []).some(x => x.id === id)) throw new Error('Ese artículo ya existe en Mercadería.');
  s.merchandise ||= [];
  s.merchandise.push({ ...item, unit: 'u', presentacion: item.presentacion || 'Paquete' });
  for (const p of s.products) {
    const rows = (p.ingredients || []).filter(r => r.ingId === id);
    if (!rows.length) continue;
    p.merchandise = [...(p.merchandise || []), ...rows.map(r => ({ merchId: id, qty: toBase(Number(r.qty) || 0, r.unit || 'g') }))];
    p.ingredients = p.ingredients.filter(r => r.ingId !== id);
    // Evita que el último ingrediente trasladado sobreviva como costo manual.
    p.receta_cost = p.ingredients.reduce((sum, row) => sum + calcIngCost(s, row), 0);
  }
  s.ingredients.splice(s.ingredients.indexOf(item), 1);
  if (s.stock[id]) s.stock[id].unit = 'u';
  return item;
}
