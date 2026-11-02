// Regla de negocio propuesta: ración completa de 6 croquetas, NO 3 de Falafel Mix.
// DUPLICA la mecánica de Fatay individual, sin habilitar descuentos hasta aprobación.
export const FALAFEL_RACION_ID='falafel';
export const FALAFEL_RACION_UPSELL_ID='falafel-racion-up';
export function falafelRacionUpsellDraft(fatayPolicy) {
 if(!fatayPolicy||fatayPolicy.id!=='fatay-individual-up'||fatayPolicy.kind!=='upsell')
  throw new Error('fatay_up_policy_missing');
 const tiers=Array.isArray(fatayPolicy.discountTiers)?fatayPolicy.discountTiers:[];
 if(tiers.length!==3||tiers.some((t,i)=>Number(t.totalDiscountPercent)!==[20,25,30][i]
     ||Number(t.minEligibleNetSubtotal)!==[20000,35000,50000][i]))
  throw new Error('fatay_tiers_unverified');
 return {
  ...fatayPolicy,
  id:FALAFEL_RACION_UPSELL_ID,
  name:'Sumá una ración de Croquetas de Falafel (6 unidades)',
  enabled:false, // aprobación explícita de costos + MP pendiente
  priority:54,
  productIds:[FALAFEL_RACION_ID],
  triggerProductIds:[...(fatayPolicy.triggerProductIds||[])],
  suppressIfPresent:[
   ...new Set([...(fatayPolicy.suppressIfPresent||[]),FALAFEL_RACION_ID,
    'falafel_mix','sandwich_falafel'])
  ],
  discountTiers:tiers.map(t=>({...t})),
  maxUnits:1,
  maxEligibleUnitsPerOrder:1,
  maxDiscountedUnitsPerCart:1,
  requireExplicitCustomerAcceptance:true,
  marginAssessment:'incremental_unit_plus_basket',
  minMarginPct:40,
  costReviewRequired:true,
  activationBlockers:[
   'verify_six_croquettes_portion_cost_and_tahini',
   'verify_real_packaging_and_incremental_labor',
   'verify_checkout_pro_fee_and_net_margin',
   'verify_full_basket_margin_40pct',
   'owner_approval_required'
  ],
  // El producto son seis croquetas: qty 1 = UNA RACIÓN, jamás una croqueta.
  unitDefinition:{productId:FALAFEL_RACION_ID,quantity:1,portionCroquettes:6},
  advertising:{enabled:false,placement:['cart','checkout'],
   message:'¿Sumás una ración de 6 croquetas de falafel? Consultá tu oferta.'}
 };
}
