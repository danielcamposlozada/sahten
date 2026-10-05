// ═══════════════════════════════════════════════════════════
// .sahten ⇄ estado del núcleo (cálculo). El formato completo y las migraciones viven en src/project/schema.js
// ═══════════════════════════════════════════════════════════
import { createState } from './state.js';
import { migrate, SAHTEN_FORMAT } from '../project/schema.js';

export { SAHTEN_FORMAT, SCHEMA_VERSION } from '../project/schema.js';
const clone = v => JSON.parse(JSON.stringify(v));

/** .sahten (objeto, cualquier esquema) → estado para src/core. */
export function stateFromSahten(input) {
  const { kind, file } = migrate(input);
  if (kind !== 'project') throw new Error('No es un proyecto .sahten');
  const cat = file.catalog, costs = file.costs;
  return createState({
    project: clone(file.project),
    tiers: clone(cat.tiers), channels: clone(file.channels),
    ingredients: clone(cat.ingredientes), packs: clone(cat.envases), products: clone(cat.productos),
    gastosOp: clone(costs.gastosOp), gastosS: clone(costs.gastosS), gfMonths: clone(costs.gfMonths),
    gfDiscHistory: clone(costs.gfDiscHistory || []),
    stock: clone(file.stock.items), movements: clone(file.stock.movements),
    globalCommission: +costs.globalCommission || 0, usdRate: +costs.usdRate || 1200, customTC: +costs.customTC || 0,
    projection: {
      channelDist: clone(file.projections.channelDist), channelLocked: clone(file.projections.channelLocked),
      manualMode: !!file.projections.manualMode, manualUnits: clone(file.projections.manualUnits),
    },
  });
}
