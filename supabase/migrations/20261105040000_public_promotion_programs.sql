-- Public marketing facts only: never code digests, phone keys, customers or order history.
CREATE OR REPLACE FUNCTION public.get_public_loyalty_programs(p_store_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.terms->>'name',
  'totalPercent',p.terms->'totalPercent','extraPercent',p.terms->'extraPercent','paymentPercent',p.terms->'paymentPercent',
  'minEligibleSubtotal',p.terms->'minEligibleSubtotal','maxExtraAmount',p.terms->'maxExtraAmount',
  'mercadopago',p.terms->'mercadopago','validDays',p.terms->'validDays','startsOn',p.terms->'startsOn','endsOn',p.terms->'endsOn',
  'productIds',p.terms->'eligibleProductIds','methods',jsonb_build_array('efectivo','transferencia')||CASE WHEN p.terms#>>'{mercadopago,enabled}'='true' THEN '["mercadopago"]'::jsonb ELSE '[]'::jsonb END) ORDER BY p.id),'[]')
 FROM sahten_private.loyalty_programs p JOIN public.menus m ON m.store_id=p.store_id
 WHERE p.store_id=p_store_id AND p.enabled AND m.json#>>'{promotions,enabled}'='true'
  AND coalesce(m.json#>>'{config,enabled}','true')='true'
  AND (nullif(p.terms->>'startsOn','')::date IS NULL OR nullif(p.terms->>'startsOn','')::date<=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  AND (nullif(p.terms->>'endsOn','')::date IS NULL OR nullif(p.terms->>'endsOn','')::date>=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);
$$;
REVOKE ALL ON FUNCTION public.get_public_loyalty_programs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_programs(uuid) TO anon,authenticated,service_role;
