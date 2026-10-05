// Resumen de diferencias entre dos versiones de un proyecto (precios, costos, GF) para mostrar antes de restaurar.
import { stateFromSahten } from '../core/projectFile.js';
import { mostradorFinalPrice, costPerUnit, totalGF, fmt } from '../core/index.js';

export function summarizeDiff(currentFile, otherFile) {
  const a = stateFromSahten(currentFile), b = stateFromSahten(otherFile);
  const mapA = new Map(a.products.map(p => [p.id, p])), mapB = new Map(b.products.map(p => [p.id, p]));
  const prices = [], costs = [];
  mapB.forEach((pb, id) => {
    const pa = mapA.get(id); if (!pa) return;
    const x = mostradorFinalPrice(a, pa), y = mostradorFinalPrice(b, pb);
    if (x !== y) prices.push({ id, name: pb.name, from: x, to: y });
    const cx = costPerUnit(a, pa), cy = costPerUnit(b, pb);
    if (Math.abs(cx - cy) > 0.005) costs.push({ id, name: pb.name, from: cx, to: cy });
  });
  const gf = { from: totalGF(a), to: totalGF(b) };
  const added = [...mapB.keys()].filter(id => !mapA.has(id)).map(id => mapB.get(id).name);
  const removed = [...mapA.keys()].filter(id => !mapB.has(id)).map(id => mapA.get(id).name);
  const same = !prices.length && !costs.length && gf.from === gf.to && !added.length && !removed.length;
  return { prices, costs, gf, added, removed, same, currency: a };
}

/** Líneas de texto (es-AR) para mostrar el resumen. «Hoy → al restaurar». */
export function describeDiff(d, max = 6) {
  const f = n => fmt(d.currency, n);
  if (d.same) return ['No hay diferencias en precios, costos ni gastos fijos.'];
  const out = [];
  if (d.prices.length) out.push(`Precios: ${d.prices.length} producto${d.prices.length > 1 ? 's' : ''} cambian.`, ...d.prices.slice(0, max).map(p => `   ${p.name}: ${f(p.from)} → ${f(p.to)}`));
  if (d.costs.length) out.push(`Costos: ${d.costs.length} producto${d.costs.length > 1 ? 's' : ''} cambian.`);
  if (d.gf.from !== d.gf.to) out.push(`Gastos fijos: ${f(d.gf.from)} → ${f(d.gf.to)} por mes.`);
  if (d.added.length) out.push(`Se agregan: ${d.added.slice(0, max).join(', ')}.`);
  if (d.removed.length) out.push(`Se quitan: ${d.removed.slice(0, max).join(', ')}.`);
  return out;
}
