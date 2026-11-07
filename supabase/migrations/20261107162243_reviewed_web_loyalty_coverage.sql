-- Revisión privada y acotada al programa. Solo el costo admitido por el servidor
-- o una referencia del catálogo publicado puede respaldar el margen excepcional.
CREATE OR REPLACE FUNCTION sahten_private.reviewed_loyalty_basis(
  p_store_id uuid,p_product jsonb,p_review jsonb,p_verified_cost numeric
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE quote jsonb; source_cost numeric; limit_cost numeric; floor_pct numeric;
BEGIN
 IF jsonb_typeof(p_review) IS DISTINCT FROM 'object'
   OR (p_review->>'price')::numeric IS DISTINCT FROM (p_product->>'price')::numeric THEN
  RETURN NULL;
 END IF;
 limit_cost:=(p_review->>'costCeiling')::numeric;
 floor_pct:=(p_review->>'marginFloor')::numeric;
 IF limit_cost IS NULL OR limit_cost<=0 OR floor_pct IS NULL OR floor_pct NOT BETWEEN 1 AND 95 THEN RETURN NULL; END IF;
 source_cost:=p_verified_cost;
 IF source_cost IS NULL THEN
  IF p_review->>'quote' IS NULL OR (p_product->>'priceRevision') IS DISTINCT FROM (p_review->>'quote') THEN RETURN NULL; END IF;
  SELECT p.data#>ARRAY['costs','pricingQuotes',p_review->>'quote'] INTO quote
  FROM public.stores s JOIN public.projects p ON p.id=s.project_id WHERE s.id=p_store_id;
  IF quote->>'productId' IS DISTINCT FROM p_product->>'id'
     OR quote->>'channel' IS DISTINCT FROM 'mostrador'
     OR (quote->>'price')::numeric IS DISTINCT FROM (p_product->>'price')::numeric
     OR jsonb_typeof(quote->'unitVariable') IS DISTINCT FROM 'number'
     OR jsonb_typeof(quote->'unitFixed') IS DISTINCT FROM 'number'
     OR (quote->>'unitVariable')::numeric<=0 OR (quote->>'unitFixed')::numeric<0 THEN RETURN NULL; END IF;
  source_cost:=(quote->>'unitVariable')::numeric+(quote->>'unitFixed')::numeric;
 END IF;
 IF source_cost<=0 OR source_cost>limit_cost THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('cost',limit_cost,'marginFloor',floor_pct);
END $$;
REVOKE ALL ON FUNCTION sahten_private.reviewed_loyalty_basis(uuid,jsonb,jsonb,numeric) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.set_store_loyalty_program(p_store_id uuid,p_program text,p_terms jsonb,p_enabled boolean,p_expected_revision uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE doc jsonb; prior sahten_private.loyalty_programs; rev uuid:=gen_random_uuid(); target_id text; cost numeric; price numeric; rule jsonb; total numeric; payment numeric; mp jsonb; fee numeric; mp_total numeric;
        product_doc jsonb; costs jsonb; approved_review jsonb; basis jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_program NOT IN ('first_online','second_online') OR p_enabled IS NULL OR jsonb_typeof(p_terms) IS DISTINCT FROM 'object' OR length(p_terms::text)>12000
 OR length(trim(p_terms->>'name')) NOT BETWEEN 4 AND 100 OR p_terms->>'name' IS NULL
 OR (p_terms->>'extraPercent')::numeric NOT BETWEEN 0.01 AND 85 OR p_terms->>'extraPercent' IS NULL
 OR (p_terms->>'minEligibleSubtotal')::numeric<0 OR p_terms->>'minEligibleSubtotal' IS NULL
 OR coalesce(p_terms->>'validDays','') !~ '^[0-9]+$' OR (p_terms->>'validDays')::int NOT BETWEEN 1 AND 365 OR p_terms->>'validDays' IS NULL
 OR nullif(p_terms->>'maxExtraAmount','')::numeric<0
 OR jsonb_typeof(p_terms->'eligibleProductIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_terms->'eligibleProductIds') NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'invalid_loyalty_terms';END IF;
 IF nullif(p_terms->>'startsOn','')::date> nullif(p_terms->>'endsOn','')::date THEN RAISE EXCEPTION 'invalid_program_dates';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 IF doc IS NULL THEN RAISE EXCEPTION 'store_menu_missing';END IF;
 IF p_enabled AND (doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true' OR doc#>>'{payments,benefit,enabled}' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'promotions_not_published';END IF;
 payment:=coalesce((doc#>>'{payments,benefit,percent}')::numeric,0);
 IF p_terms ? 'paymentPercent' AND (p_terms->>'paymentPercent')::numeric<>payment THEN RAISE EXCEPTION 'loyalty_payment_changed';END IF;
 total:=payment+(p_terms->>'extraPercent')::numeric;
 IF p_terms ? 'totalPercent' AND (p_terms->>'totalPercent')::numeric<>total THEN RAISE EXCEPTION 'invalid_loyalty_total';END IF;
 p_terms:=(p_terms-'coverageReview')||jsonb_build_object('totalPercent',total,'paymentPercent',payment);
 mp:=p_terms->'mercadopago';
 IF mp IS NOT NULL AND (jsonb_typeof(mp) IS DISTINCT FROM 'object' OR jsonb_typeof(mp->'enabled') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'invalid_mercadopago_terms';END IF;
 IF mp->>'enabled'='true' THEN
  IF jsonb_typeof(mp->'totalPercent') IS DISTINCT FROM 'number' OR (mp->>'totalPercent')::numeric NOT BETWEEN 0.01 AND 95
   OR jsonb_typeof(mp->'minEligibleSubtotal') IS DISTINCT FROM 'number' OR (mp->>'minEligibleSubtotal')::numeric<0
   OR (mp->>'maxExtraAmount' IS NOT NULL AND (jsonb_typeof(mp->'maxExtraAmount') IS DISTINCT FROM 'number' OR (mp->>'maxExtraAmount')::numeric<=0))
  THEN RAISE EXCEPTION 'invalid_mercadopago_terms';END IF;
  mp_total:=(mp->>'totalPercent')::numeric;
  fee:=coalesce((doc#>>'{promotions,commercialPolicy,mercadopagoFeePercent}')::numeric,(doc#>>'{promotions,checkoutProFeePercent}')::numeric,10);
 END IF;
 SELECT * INTO prior FROM sahten_private.loyalty_programs WHERE store_id=p_store_id AND id=p_program FOR UPDATE;
 IF prior.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'loyalty_program_conflict' USING ERRCODE='40001';END IF;
 IF p_program IN ('first_online','second_online') AND p_terms-'eligibleProductIds'=prior.terms-ARRAY['eligibleProductIds','coverageReview'] THEN
  approved_review:=prior.terms->'coverageReview';
 END IF;
 costs:=public.sahten_promotion_costs(p_store_id,'online');
 FOR target_id IN SELECT jsonb_array_elements_text(p_terms->'eligibleProductIds') LOOP
  SELECT p INTO product_doc FROM jsonb_array_elements(doc->'products') p WHERE p->>'id'=target_id;
  price:=(product_doc->>'price')::numeric;
  cost:=(costs->>target_id)::numeric;
  rule:=public.sahten_promotion_rule(doc,target_id);
  IF approved_review ? target_id THEN
   basis:=sahten_private.reviewed_loyalty_basis(p_store_id,product_doc,approved_review->target_id,cost);
   IF basis IS NULL AND p_enabled THEN RAISE EXCEPTION 'promotion_cost_review_changed:%',target_id; END IF;
   IF basis IS NOT NULL THEN
    cost:=(basis->>'cost')::numeric;
    rule:=rule||jsonb_build_object('minMarginPct',(basis->>'marginFloor')::numeric);
   END IF;
  END IF;
  IF p_enabled AND (price IS NULL OR price<=0) THEN RAISE EXCEPTION 'product_not_published:%',target_id;END IF;
  IF p_enabled AND cost IS NULL THEN RAISE EXCEPTION 'promotion_cost_missing:%',target_id;END IF;
  IF p_enabled AND total>(rule->>'maxTotalPercent')::numeric THEN RAISE EXCEPTION 'campaign_discount_limit:%',target_id;END IF;
  IF p_enabled AND cost>price*(1-total/100)*(1-(rule->>'minMarginPct')::numeric/100) THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',target_id;END IF;
  IF p_enabled AND mp_total IS NOT NULL AND (mp_total>(rule->>'maxTotalPercent')::numeric OR cost>price*(1-mp_total/100)*(1-fee/100)*(1-(rule->>'minMarginPct')::numeric/100)) THEN RAISE EXCEPTION 'mercadopago_margin_below_minimum:%',target_id;END IF;
 END LOOP;
 IF approved_review IS NOT NULL THEN
  p_terms:=p_terms||jsonb_build_object('coverageReview',approved_review);
 END IF;
 INSERT INTO sahten_private.loyalty_programs(store_id,id,terms,enabled,revision,updated_by) VALUES(p_store_id,p_program,p_terms,p_enabled,rev,auth.uid())
 ON CONFLICT(store_id,id) DO UPDATE SET terms=excluded.terms,enabled=excluded.enabled,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO sahten_private.promotion_changes(store_id,actor,action,detail) SELECT id,auth.uid(),'loyalty_program_saved',jsonb_build_object('program',p_program,'before',prior.terms,'after',p_terms,'enabled',p_enabled) FROM public.stores WHERE id=p_store_id;
 RETURN jsonb_build_object('saved',true,'revision',rev);
END $$;
REVOKE ALL ON FUNCTION public.get_store_loyalty_programs(uuid),public.set_store_loyalty_program(uuid,text,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_loyalty_programs(uuid),public.set_store_loyalty_program(uuid,text,jsonb,boolean,uuid) TO authenticated;
