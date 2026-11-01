-- Reutiliza exclusivamente los costos verificados de proyecto, sin emitir descuentos.
-- Migración preparada, NO aplicar hasta E2E y aprobación de costos. Los beneficios quedan OFF.
-- Datos financieros privados. No enviar este JSON al navegador.
-- Los valores de costos directos/fijos de pricingPolicies son snapshot contable;
-- el coste de producir UNA unidad extra exige revisión explícita.
-- No convertir `receta_cost` en `variableCost`: por ejemplo SUPERMIX incluye
-- envases y subproductos Fatay + tahini que no están dentro de ese importe.
-- El motor original de Sahten calcula costo completo con costPerUnit/gfAssigned.
-- Si faltan snapshots auditados, esta RPC no entrega economía aprobada (fail-closed).
-- Los informes de src/core/promotion-economics-audit.js NO habilitan ofertas.
CREATE OR REPLACE FUNCTION public.sahten_upsell_verified_costs(
 sid uuid,channel text DEFAULT 'mostrador'
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 WITH owner_data AS (
  SELECT p.data FROM public.projects p JOIN public.stores s ON s.project_id=p.id
  JOIN public.menus m ON m.store_id=s.id
  WHERE s.id=sid AND p.data #>> '{promotions,enabled}'='true'
    AND m.json #>> '{promotions,enabled}'='true'
 ), products AS (
  SELECT item AS product,data,
    item #> ARRAY['pricingPolicies',channel] AS costs,
    data #> ARRAY['promotions','incrementalCostOverrides',item->>'id'] AS extra
  FROM owner_data CROSS JOIN LATERAL
       jsonb_array_elements(coalesce(data#>'{catalog,productos}','[]'::jsonb)) item
 ), rows AS (
  SELECT product->>'id' product_id,
   CASE WHEN jsonb_typeof(costs->'variableCost')='number'
        AND (costs->>'variableCost')::numeric>=0
        THEN (costs->>'variableCost')::numeric END AS direct,
   CASE WHEN jsonb_typeof(costs->'fixedCost')='number'
        AND (costs->>'fixedCost')::numeric>=0
        THEN (costs->>'fixedCost')::numeric END AS fixed,
   CASE WHEN jsonb_typeof(extra->'additionalIncrementalCost')='number'
        AND (extra->>'additionalIncrementalCost')::numeric>=0
        THEN (extra->>'additionalIncrementalCost')::numeric END AS additional,
   (extra->>'verified')='true'
     AND extra->>'reviewedAt' IS NOT NULL AND extra->>'reviewedBy' IS NOT NULL AS cost_approved
  FROM products
 ), collected AS (
  SELECT coalesce(jsonb_object_agg(product_id,direct+fixed),'{}'::jsonb) AS costs,
    coalesce(jsonb_object_agg(product_id,jsonb_build_object(
      'verified',true,'directCost',direct,'fixedCost',fixed,
      'incrementalVerified',coalesce(cost_approved,false) AND additional IS NOT NULL,
      'additionalIncrementalCost',coalesce(additional,0))), '{}'::jsonb) AS economics
  FROM rows WHERE product_id IS NOT NULL AND direct IS NOT NULL AND fixed IS NOT NULL
 ), policy AS (
  SELECT data#>'{promotions,verifiedOrderCosts}' AS v FROM owner_data
 )
 SELECT CASE WHEN EXISTS(SELECT 1 FROM owner_data)
 THEN jsonb_build_object(
    'verified',true,'trustedCosts',collected.costs,'trustedEconomics',collected.economics,
    'trustedOrderCosts',jsonb_build_object(
       'verified',coalesce((policy.v->>'verified')='true',false)
         AND policy.v->>'reviewedAt' IS NOT NULL AND policy.v->>'reviewedBy' IS NOT NULL
         AND jsonb_typeof(policy.v->'additionalOrderCost')='number'
         AND jsonb_typeof(policy.v->'shippingSubsidy')='number'
         AND (policy.v->>'additionalOrderCost')::numeric>=0
         AND (policy.v->>'shippingSubsidy')::numeric>=0,
       'additionalOrderCost',coalesce((policy.v->>'additionalOrderCost')::numeric,0),
       'shippingSubsidy',coalesce((policy.v->>'shippingSubsidy')::numeric,0)),
    'trustedPaymentFeePercent',CASE WHEN
       jsonb_typeof(policy.v->'mpFeePercent')='number'
       AND (policy.v->>'mpFeePercent')::numeric>=0
       AND (policy.v->>'mpFeePercent')::numeric<=100
       AND policy.v->>'verified'='true'
       AND policy.v->>'reviewedAt' IS NOT NULL AND policy.v->>'reviewedBy' IS NOT NULL
       THEN (policy.v->>'mpFeePercent')::numeric ELSE NULL END)
 ELSE NULL END
 FROM collected LEFT JOIN policy ON true;
$$;
REVOKE ALL ON FUNCTION public.sahten_upsell_verified_costs(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_upsell_verified_costs(uuid,text) TO service_role;
COMMENT ON FUNCTION public.sahten_upsell_verified_costs(uuid,text) IS
 'Service-only: valid pricing policy snapshots and owner-reviewed incremental + order fee data; never expose on website.';
