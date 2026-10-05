// ═══════════════════════════════════════════════════════════
// Costos: ingredientes, envases, combos y porciones
// ═══════════════════════════════════════════════════════════

// ── Unidades ─────────────────────────────────────────────
/** Convierte un valor a unidad base (g o ml). */
export function toBase(val, unit) {
  if (unit === 'kg') return val * 1000;
  if (unit === 'L') return val * 1000;
  return val; // g, ml, u
}

/** Normaliza grPaquete a partir de unit + cantidad (compatibilidad con recetas). */
export function ingNormalize(ing) {
  const u = ing.unit || 'g';
  const c = ing.cantidad != null ? ing.cantidad : ing.grPaquete;
  if (u === 'kg' || u === 'L') ing.grPaquete = c * 1000;
  else ing.grPaquete = c;
  ing.cantidad = c;
}

/** Precio por unidad base (g, ml o u). */
export function ingPxBase(ing) {
  ingNormalize(ing);
  return ing.precioPkg / Math.max(1, ing.grPaquete);
}

// ── Costo de una fila ────────────────────────────────────
export function calcIngCost(s, row) {
  if (row.ingId) {
    const ing = s.ingredients.find(x => x.id === row.ingId);
    if (ing) {
      const pxg = ing.precioPkg / ing.grPaquete; // precio por gramo base
      const qty = row.qty || 0;
      const unit = row.unit || 'g';
      let grams = qty;
      if (unit === 'kg') grams = qty * 1000;
      else if (unit === 'L') grams = qty * 1000;
      else if (unit === 'ml') grams = qty;
      else if (unit === 'u') grams = qty * (ing.grPaquete / (ing.cantidad || 1) || 1);
      return grams * pxg;
    }
  }
  return row.v || 0; // fallback: valor manual
}

/** Costo de una fila de envase (envId + qty + unit). Una sola regla, respeta la unidad. */
export function calcEnvCost(s, row) {
  if (row.envId) {
    const env = s.packs.find(x => x.id === row.envId);
    if (env) {
      const pxu = env.precioPkg / Math.max(1, env.cantidad || 1);
      const qty = row.qty || 1;
      const unit = row.unit || 'u';
      if (unit === 'u') return qty * pxu;
      if (unit === 'kg') return qty * 1000 * pxu;
      if (unit === 'g') return qty * pxu;
      return qty * pxu;
    }
  }
  return row.v || 0;
}
export const calcPackCost = calcEnvCost;

// ── Pesos y porciones ────────────────────────────────────
/** Peso de un ingrediente en gramos (null si la unidad es 'u' sin equivalencia). */
export function ingRowWeightG(s, row) {
  const qty = parseFloat(row.qty) || 0;
  if (qty <= 0) return null;
  const unit = row.unit || 'g';
  if (unit === 'g') return qty;
  if (unit === 'kg') return qty * 1000;
  if (unit === 'ml') return qty;
  if (unit === 'L') return qty * 1000;
  const ing = row.ingId ? s.ingredients.find(x => x.id === row.ingId) : null;
  if (ing && ing.unit !== 'u') {
    const grPerU = ing.grPaquete / Math.max(1, ing.cantidad);
    return qty * grPerU;
  }
  return null;
}

/** Porciones calculadas por peso total ÷ porción (null si no se puede). */
export function calcAutoPorc(p) {
  const pt = parseFloat(p.pesoTotal);
  const pc = parseFloat(p.porcionCant);
  if (!pt || !pc || pt <= 0 || pc <= 0) return null;
  const pu = p.pesoUnit || 'g';
  const cu = p.porcionUnit || 'g';
  const isWeight = u => u === 'g' || u === 'kg';
  const isVol = u => u === 'ml' || u === 'L';
  const isUnit = u => u === 'u';
  if (isWeight(pu) && isWeight(cu)) return toBase(pt, pu) / toBase(pc, cu);
  if (isVol(pu) && isVol(cu)) return toBase(pt, pu) / toBase(pc, cu);
  if (isUnit(pu) && isUnit(cu)) return pt / pc;
  return null;
}

/** Porciones efectivas. Prioridad: override manual › automático con merma › campo manual. */
export function getPorc(p) {
  const ov = parseFloat(p.porcionesOverride);
  if (ov > 0) return Math.max(0.01, Math.round(ov * 100) / 100);
  const auto = calcAutoPorc(p);
  if (auto !== null) {
    const merma = Math.max(0, Math.min(99, parseFloat(p.merma) || 0));
    const eff = auto * (1 - merma / 100);
    return Math.max(0.01, Math.round(eff * 100) / 100);
  }
  return Math.max(1, p.porciones || 1);
}

// ── Combos (sub-productos) ───────────────────────────────
export const COMBO_FRACS = {
  '1': 1, '2': 2, '3': 3, '4': 4,
  '1/2': 0.5, '1/3': 1 / 3, '1/4': 0.25,
  '2/3': 2 / 3, '3/4': 0.75,
};
export function comboFracVal(frac) { return COMBO_FRACS[frac] ?? parseFloat(frac) ?? 1; }

/** Proporción del producto destino que usa esta fila de combo. */
export function comboResolveProps(row, target) {
  const qty = parseFloat(row.qty) || 0;
  const unit = row.unit || 'u';
  if (qty <= 0) return { prop: 0, resolved: false };
  const pt = parseFloat(target.pesoTotal);
  const pu = target.pesoUnit || 'g';
  const isW = u => u === 'g' || u === 'kg';
  const isV = u => u === 'ml' || u === 'L';
  const isU = u => u === 'u';
  if (pt > 0) {
    if ((isW(unit) && isW(pu)) || (isV(unit) && isV(pu))) return { prop: toBase(qty, unit) / toBase(pt, pu), resolved: true };
    if (isU(unit) && isU(pu)) return { prop: qty / pt, resolved: true };
    if (isU(unit)) return { prop: qty / Math.max(1, getPorc(target)), resolved: true };
  } else if (isU(unit)) {
    return { prop: qty / Math.max(1, getPorc(target)), resolved: true };
  }
  return { prop: 0, resolved: false };
}

/** Peso que aporta un combo, en gramos base. */
export function comboRowWeightG(s, row) {
  if (row.addWeight === false) return null;
  const qty = parseFloat(row.qty) || 0;
  const unit = row.unit || 'u';
  if (qty <= 0) return null;
  if (unit === 'g') return qty;
  if (unit === 'kg') return qty * 1000;
  if (unit === 'ml') return qty;
  if (unit === 'L') return qty * 1000;
  const target = row.prodId ? s.products.find(x => x.id === row.prodId) : null;
  if (target && parseFloat(target.pesoTotal) > 0) {
    const ptG = toBase(parseFloat(target.pesoTotal), target.pesoUnit || 'g');
    const porc = getPorc(target);
    return (ptG / Math.max(1, porc)) * qty;
  }
  return null;
}

/** Peso total auto-sumado de ingredientes + combos, o null si no hay datos. */
export function calcAutoWeight(s, p) {
  let total = 0;
  let hasData = false;
  (p.ingredients || []).forEach(row => {
    const w = ingRowWeightG(s, row);
    if (w !== null) { total += w; hasData = true; }
  });
  (p.combos || []).forEach(row => {
    if (row.addWeight === false) return;
    const w = comboRowWeightG(s, row);
    if (w !== null) { total += w; hasData = true; }
  });
  if (!hasData || total <= 0) return null;
  let value, unit;
  if (total >= 1000) { value = parseFloat((total / 1000).toFixed(3)); unit = 'kg'; }
  else { value = parseFloat(total.toFixed(1)); unit = 'g'; }
  return { grams: total, value, unit, display: `${value} ${unit}` };
}

/** Costo de una fila de sub-producto, con sub-combos anidados y protección contra ciclos. */
export function calcComboCost(s, row, _visited) {
  if (!row.prodId) return 0;
  const target = s.products.find(x => x.id === row.prodId);
  if (!target) return 0;

  const visited = _visited || new Set();
  if (visited.has(target.id)) return 0;
  visited.add(target.id);

  const { prop, resolved } = comboResolveProps(row, target);
  if (!resolved || prop <= 0) return 0;

  const ingRaw = (target.ingredients || []).reduce((sum, r) => sum + calcIngCost(s, r), 0);
  const ingCost = ingRaw > 0 ? ingRaw : (target.receta_cost || 0); // respeta el costo manual del sub-producto
  let cost = ingCost * prop;

  if (row.addPackaging !== false) {
    const pack = (target.packaging || []).reduce((sum, r) => sum + calcPackCost(s, r), 0);
    cost += pack * prop;
  }

  const subCombos = target.combos || [];
  if (subCombos.length > 0) {
    const overrides = row.comboOverrides || {};
    subCombos.forEach((subRow, idx) => {
      const ov = overrides[idx];
      const effectiveRow = ov ? { ...subRow, qty: ov.qty ?? subRow.qty, unit: ov.unit ?? subRow.unit } : subRow;
      cost += calcComboCost(s, effectiveRow, new Set(visited)) * prop;
    });
  }
  return cost;
}

// ── Producto ─────────────────────────────────────────────
export const packCost = (s, p) => (p.packaging || []).reduce((sum, r) => sum + calcEnvCost(s, r), 0);
export const comboCost = (s, p) => (p.combos || []).reduce((sum, r) => sum + calcComboCost(s, r), 0);

/** Costo de la receta completa: ingredientes (o costo manual) + envases + combos. */
export function totalCost(s, p) {
  const ingCost = (p.ingredients || []).reduce((sum, r) => sum + calcIngCost(s, r), 0);
  const rc = ingCost > 0 ? ingCost : (p.receta_cost || 0);
  return rc + packCost(s, p) + comboCost(s, p);
}

/** Costo por unidad vendida: costo de la receta ÷ porciones. */
export const costPerUnit = (s, p) => totalCost(s, p) / getPorc(p);

/** Recalcula receta_cost desde los ingredientes indexados (no pisa el costo manual si no hay ingredientes). */
export function recalcRecetaCost(s, p) {
  const totIng = (p.ingredients || []).reduce((sum, r) => sum + calcIngCost(s, r), 0);
  const totPack = (p.packaging || []).reduce((sum, r) => sum + calcEnvCost(s, r), 0);
  const totCombo = (p.combos || []).reduce((sum, r) => sum + calcComboCost(s, r), 0);
  if (totIng > 0) p.receta_cost = totIng;
  return { totIng, totPack, totCombo };
}
