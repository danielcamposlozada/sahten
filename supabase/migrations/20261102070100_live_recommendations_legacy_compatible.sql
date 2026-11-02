-- Safe, owner/admin-only live editing of full-price cart recommendations.
-- Changes only public.menus.json.cartRecommendations; never alters discounts or product prices.
CREATE OR REPLACE FUNCTION public.get_store_cart_recommendations(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE doc jsonb; rules jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id=p_store_id
      AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT m.json INTO doc FROM public.menus m WHERE m.store_id=p_store_id;
  IF doc IS NULL THEN RAISE EXCEPTION 'menu_not_published'; END IF;
  rules:=COALESCE(doc#>'{cartRecommendations,ruleCatalog}',doc->'cartRecommendations','{}'::jsonb);
  RETURN jsonb_build_object(
    'published',true,'revision',rules->>'revision','rules',rules,
    'products',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',p->>'id','name',p->>'name','price',p->'price',
      'category',p->>'category','salesAvailability',p->'salesAvailability'
      ) ORDER BY p->>'name'),'[]'::jsonb) FROM jsonb_array_elements(doc->'products') p)
  );
END $$;

CREATE OR REPLACE FUNCTION public.set_store_cart_recommendations(
  p_store_id uuid, p_rules jsonb, p_expected_revision text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE doc jsonb; rules jsonb; c jsonb; r jsonb; p jsonb; item jsonb;
        groups jsonb:='[]'::jsonb; complements jsonb:='[]'::jsonb;
        product_ids text[]; id_set text[]:=ARRAY[]::text[]; rid text;
        i text; k text; newrev text; candidate jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id=p_store_id
      AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules)<>'object'
     OR jsonb_typeof(p_rules->'complements') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_rules->'beverageContexts') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_rules->'complements')>24
     OR jsonb_array_length(p_rules->'beverageContexts')>12
  THEN RAISE EXCEPTION 'recommendation_rules_invalid'; END IF;
  SELECT m.json INTO doc FROM public.menus m WHERE m.store_id=p_store_id FOR UPDATE;
  IF doc IS NULL THEN RAISE EXCEPTION 'menu_not_published'; END IF;
  rules:=COALESCE(doc#>'{cartRecommendations,ruleCatalog}',doc->'cartRecommendations','{}'::jsonb);
  IF rules->>'revision' IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'recommendations_revision_conflict' USING ERRCODE='40001';
  END IF;
  -- Only published, priced products can be used in a recommendation.
  SELECT array_agg(p->>'id') INTO product_ids
  FROM jsonb_array_elements(COALESCE(doc->'products','[]'::jsonb)) p
  WHERE p->>'id' IS NOT NULL AND COALESCE(p->>'price','') ~ '^[0-9]+(\.[0-9]+)?$'
    AND (p->>'price')::numeric>0
    AND COALESCE(p#>>'{salesAvailability,retired}','false')<>'true';
  FOR r IN SELECT value FROM jsonb_array_elements(p_rules->'complements') LOOP
    rid:=r->>'id';
    IF rid IS NULL OR rid !~ '^[a-z0-9][a-z0-9_-]{2,50}$'
       OR rid=ANY(id_set)
       OR length(trim(COALESCE(r->>'name',''))) NOT BETWEEN 3 AND 100
       OR r->>'productId'<>ALL(COALESCE(product_ids,ARRAY[]::text[]))
       OR COALESCE(r->>'priority','') !~ '^[0-9]{1,3}$'
       OR (r->>'priority')::int > 100
       OR jsonb_typeof(r->'triggerProductIds') IS DISTINCT FROM 'array'
       OR jsonb_array_length(r->'triggerProductIds') NOT BETWEEN 1 AND 25
       OR jsonb_typeof(COALESCE(r->'suppressIfPresent','[]'::jsonb))<>'array'
    THEN RAISE EXCEPTION 'invalid_complement_rule:%',rid; END IF;
    FOR i IN SELECT jsonb_array_elements_text(r->'triggerProductIds') LOOP
      IF i<>ALL(COALESCE(product_ids,ARRAY[]::text[])) THEN RAISE EXCEPTION 'invalid_trigger:%',i; END IF;
    END LOOP;
    FOR i IN SELECT jsonb_array_elements_text(COALESCE(r->'suppressIfPresent','[]'::jsonb)) LOOP
      IF i<>ALL(COALESCE(product_ids,ARRAY[]::text[])) THEN RAISE EXCEPTION 'invalid_exclusion:%',i; END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(doc->'products') p
      WHERE p->>'id'=r->>'productId' AND p->>'category' IS DISTINCT FROM 'Bebidas') THEN
      RAISE EXCEPTION 'complement_must_be_food'; END IF;
    id_set:=array_append(id_set,rid);
    complements:=complements||jsonb_build_array(jsonb_build_object(
      'id',rid,'name',left(trim(r->>'name'),100),'enabled',COALESCE((r->>'enabled')::boolean,true),
      'productId',r->>'productId','priority',(r->>'priority')::int,
      'triggerProductIds',r->'triggerProductIds',
      'suppressIfPresent',COALESCE(r->'suppressIfPresent','[]'::jsonb),
      'placement',jsonb_build_array('cart')));
  END LOOP;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rules->'beverageContexts') LOOP
    rid:=r->>'id';
    IF rid IS NULL OR rid !~ '^[a-z0-9][a-z0-9_-]{2,50}$'
       OR rid=ANY(id_set)
       OR length(trim(COALESCE(r->>'name',''))) NOT BETWEEN 3 AND 100
       OR COALESCE(r->>'priority','') !~ '^[0-9]{1,3}$'
       OR (r->>'priority')::int > 100
       OR jsonb_typeof(r->'triggerProductIds') IS DISTINCT FROM 'array'
       OR jsonb_array_length(r->'triggerProductIds') NOT BETWEEN 1 AND 25
       OR jsonb_typeof(r->'options') IS DISTINCT FROM 'array'
       OR jsonb_array_length(r->'options') NOT BETWEEN 1 AND 12
    THEN RAISE EXCEPTION 'invalid_beverage_rule:%',rid; END IF;
    FOR i IN SELECT jsonb_array_elements_text(r->'triggerProductIds') LOOP
      IF i<>ALL(COALESCE(product_ids,ARRAY[]::text[])) THEN RAISE EXCEPTION 'invalid_trigger:%',i; END IF;
    END LOOP;
    FOR i IN SELECT jsonb_array_elements_text(r->'options') LOOP
      IF i<>ALL(COALESCE(product_ids,ARRAY[]::text[]))
         OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(doc->'products') p
                       WHERE p->>'id'=i AND p->>'category'='Bebidas')
      THEN RAISE EXCEPTION 'invalid_beverage:%',i; END IF;
    END LOOP;
    IF COALESCE(r->>'minEligibleSubtotal','0') !~ '^[0-9]{1,8}$'
       OR (r->>'minEligibleSubtotal')::numeric>99999999
       OR (r->>'maxEligibleSubtotal' IS NOT NULL AND
         (r->>'maxEligibleSubtotal' !~ '^[0-9]{1,8}$'
          OR (r->>'maxEligibleSubtotal')::numeric<(r->>'minEligibleSubtotal')::numeric))
    THEN RAISE EXCEPTION 'invalid_subtotal_range'; END IF;
    id_set:=array_append(id_set,rid);
    groups:=groups||jsonb_build_array(jsonb_build_object(
      'id',rid,'name',left(trim(r->>'name'),100),'enabled',COALESCE((r->>'enabled')::boolean,true),
      'priority',(r->>'priority')::int,'triggerProductIds',r->'triggerProductIds',
      'options',r->'options','minEligibleSubtotal',COALESCE(r->'minEligibleSubtotal','0'::jsonb),
      'maxEligibleSubtotal',r->'maxEligibleSubtotal','placement',jsonb_build_array('cart')));
  END LOOP;
  newrev:=gen_random_uuid()::text;
  candidate:=jsonb_build_object('enabled',true,'version',1,
    'complements',complements,'beverageContexts',groups,'revision',newrev,
    'paymentEligible','all','discountPercent',0);
  -- Current published site does not read rule.enabled yet. Publish active rows only,
  -- but keep paused rows in ruleCatalog for owner/admin reactivation without redeploy.
  candidate:=jsonb_set(candidate,'{ruleCatalog}',candidate,true);
  candidate:=jsonb_set(candidate,'{complements}',
    COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(complements) x
              WHERE x->>'enabled'='true'),'[]'::jsonb),true);
  candidate:=jsonb_set(candidate,'{beverageContexts}',
    COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(groups) x
              WHERE x->>'enabled'='true'),'[]'::jsonb),true);
  UPDATE public.menus SET json=jsonb_set(doc,'{cartRecommendations}',candidate,true),
    updated_at=clock_timestamp() WHERE store_id=p_store_id;
  RETURN jsonb_build_object('published',true,'revision',newrev,'rules',candidate);
END $$;

REVOKE ALL ON FUNCTION public.get_store_cart_recommendations(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_store_cart_recommendations(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_cart_recommendations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_cart_recommendations(uuid,jsonb,text) TO authenticated;
