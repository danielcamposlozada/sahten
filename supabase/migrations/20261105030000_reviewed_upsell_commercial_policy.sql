-- Apply the same owner-configured policy to reviewed, signed upsells.

CREATE OR REPLACE FUNCTION sahten_catalog_private.upsell_definition(value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE target text; tiers jsonb; tier jsonb; threshold numeric; pct numeric; last_threshold numeric:=-1; last_pct numeric:=0;
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'object' OR length(value::text)>16000
 OR coalesce(value->>'id','') !~ '^[a-z0-9][a-z0-9_-]{2,50}$'
 OR length(trim(coalesce(value->>'name',''))) NOT BETWEEN 4 AND 100
 OR value->>'kind' IS DISTINCT FROM 'upsell' OR value->>'maxUnits' IS DISTINCT FROM '1'
 THEN RAISE EXCEPTION 'invalid_upsell_definition';END IF;
 IF jsonb_typeof(value->'productIds') IS DISTINCT FROM 'array' OR jsonb_array_length(value->'productIds')<>1
 OR jsonb_typeof(value->'triggerProductIds') IS DISTINCT FROM 'array' OR jsonb_array_length(value->'triggerProductIds') NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'invalid_upsell_products'; END IF;
 target:=value#>>'{productIds,0}';
 IF target !~ '^[a-zA-Z0-9_-]{1,100}$' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(value->'triggerProductIds') x WHERE x=target OR x !~ '^[a-zA-Z0-9_-]{1,100}$')
 OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(value->'triggerProductIds') x)<>jsonb_array_length(value->'triggerProductIds')
 THEN RAISE EXCEPTION 'invalid_upsell_products'; END IF;
 IF value->'channels' IS NOT NULL AND value->'channels'<>'["online"]'::jsonb
 THEN RAISE EXCEPTION 'upsell_online_pickup_only';END IF;
 IF value->'schedule' IS NOT NULL AND value->'schedule'<>'null'::jsonb AND value->'schedule'<>'{"type":"always"}'::jsonb
 THEN RAISE EXCEPTION 'upsell_schedule_not_supported'; END IF;
 IF coalesce(value->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$' OR (value->>'extraPercent')::numeric NOT BETWEEN 0 AND 85
 OR coalesce(value->>'priority','30') !~ '^[0-9]{1,3}$' OR coalesce(value->>'priority','30')::integer>100
 THEN RAISE EXCEPTION 'upsell_discount_limit'; END IF;
 tiers:=coalesce(value->'discountTiers','[]'::jsonb);
 IF jsonb_typeof(tiers) IS DISTINCT FROM 'array' OR jsonb_array_length(tiers)>5 THEN RAISE EXCEPTION 'upsell_tiers_invalid';END IF;
 FOR tier IN SELECT x FROM jsonb_array_elements(tiers) x LOOP
   IF coalesce(tier->>'minEligibleNetSubtotal','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$'
   OR coalesce(tier->>'totalDiscountPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
   THEN RAISE EXCEPTION 'upsell_tiers_invalid';END IF;
   threshold:=(tier->>'minEligibleNetSubtotal')::numeric;pct:=(tier->>'totalDiscountPercent')::numeric;
   IF threshold<=last_threshold OR pct<=10 OR pct>95 OR pct<last_pct
   THEN RAISE EXCEPTION 'upsell_discount_limit';END IF;
   last_threshold:=threshold;last_pct:=pct;
 END LOOP;
 IF jsonb_array_length(tiers)=0 AND (value->>'extraPercent')::numeric<=0 THEN RAISE EXCEPTION 'upsell_discount_limit';END IF;
 IF jsonb_typeof(coalesce(value->'suppressIfPresent','[]'::jsonb)) IS DISTINCT FROM 'array'
 OR jsonb_array_length(coalesce(value->'suppressIfPresent','[]'::jsonb))>30
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(value->'suppressIfPresent','[]'::jsonb)) x WHERE x !~ '^[a-zA-Z0-9_-]{1,100}$')
 THEN RAISE EXCEPTION 'invalid_upsell_exclusions';END IF;
 RETURN jsonb_build_object('id',value->>'id','name',trim(value->>'name'),'kind','upsell','enabled',false,
  'productIds',value->'productIds','triggerProductIds',value->'triggerProductIds','maxUnits',1,
  'extraPercent',(value->>'extraPercent')::numeric,'discountTiers',tiers,'channels',jsonb_build_array('online'),
  'priority',coalesce(value->>'priority','30')::integer,'schedule',jsonb_build_object('type','always'),
  'suppressIfPresent',coalesce(value->'suppressIfPresent','[]'::jsonb),
  'advertising',jsonb_build_object('enabled',true,'placement',jsonb_build_array('cart'),
    'message',left(coalesce(value#>>'{advertising,message}',value->>'name'),200)));
END $$;

CREATE OR REPLACE FUNCTION sahten_catalog_private.upsell_source_fingerprint(sid uuid,definition jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(jsonb_build_object('definition',definition,'costs',sahten_catalog_private.upsell_cost_source(sid),
 'prices',(SELECT jsonb_agg(jsonb_build_object('id',p->>'id','price',p->'price') ORDER BY p->>'id') FROM jsonb_array_elements(m.json->'products') p),
 'commercialPolicy',m.json#>'{promotions,commercialPolicy}','benefit',m.json#>'{payments,benefit}','methods',m.json#>'{payments,methods}')::text)
 FROM public.menus m WHERE m.store_id=sid;
$$;

CREATE OR REPLACE FUNCTION public.get_store_upsell_review_context(p_store_id uuid,p_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE definition jsonb;doc jsonb;costs jsonb;pid text;p jsonb;target_rule jsonb;pct numeric;special boolean:=false;
BEGIN
 PERFORM sahten_catalog_private.upsell_manager(p_store_id);
 definition:=sahten_catalog_private.upsell_definition(p_definition);
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id;
 IF doc IS NULL OR doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'promotions_not_published';END IF;
 costs:=sahten_catalog_private.upsell_cost_source(p_store_id);
 FOR pid IN SELECT jsonb_array_elements_text(definition->'productIds') UNION SELECT jsonb_array_elements_text(definition->'triggerProductIds') LOOP
  SELECT x INTO p FROM jsonb_array_elements(coalesce(doc->'products','[]'::jsonb)) x WHERE x->>'id'=pid;
  IF p IS NULL OR coalesce(p->>'price','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$' OR (p->>'price')::numeric<=0
    OR coalesce(p->>'recetaOnly','false')='true' OR coalesce(p->>'upsellOnly','false')='true'
    OR costs->pid IS NULL THEN RAISE EXCEPTION 'upsell_product_or_cost_unverified:%',pid;END IF;
 END LOOP;
 target_rule:=public.sahten_promotion_rule(doc,definition#>>'{productIds,0}',definition);
 FOR pct IN SELECT (t->>'totalDiscountPercent')::numeric FROM jsonb_array_elements(definition->'discountTiers') t
 UNION ALL SELECT coalesce((doc#>>'{payments,benefit,percent}')::numeric,0)+(definition->>'extraPercent')::numeric WHERE jsonb_array_length(definition->'discountTiers')=0 LOOP
  IF pct>(target_rule->>'maxTotalPercent')::numeric THEN
   IF definition->>'id'='fatay-individual-up' AND definition#>>'{productIds,0}'='fatay' AND pct<=30 THEN special:=true;
   ELSE RAISE EXCEPTION 'upsell_discount_limit';END IF;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('rule',target_rule,'commercialPolicy',doc#>'{promotions,commercialPolicy}','requiresException',special,'definition',definition,'sourceFingerprint',sahten_catalog_private.upsell_source_fingerprint(p_store_id,definition),
 'products',doc->'products','costs',costs,'paymentPercent',doc#>'{payments,benefit,percent}',
 'existing',(SELECT jsonb_build_object('revision',r.revision,'enabled',r.enabled,'reviewId',r.review_id) FROM sahten_catalog_private.upsell_rules r WHERE r.store_id=p_store_id AND r.offer_id=definition->>'id'));
END $$;

CREATE OR REPLACE FUNCTION public.review_and_publish_store_upsell(
 p_store_id uuid,p_definition jsonb,p_incremental_cost numeric,p_order_cost numeric,p_review_note text,
 p_source_fingerprint text,p_expected_revision uuid DEFAULT NULL,p_accept_exception boolean DEFAULT false,p_defer_additional boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;definition jsonb;costs jsonb;eid text;existing uuid;review_id uuid;rev uuid;special boolean;
BEGIN
 PERFORM sahten_catalog_private.upsell_manager(p_store_id);
 -- Serialize independent publications/activation and ordinary catalog writes for this store.
 PERFORM 1 FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 ctx:=public.get_store_upsell_review_context(p_store_id,p_definition);definition:=ctx->'definition';eid:=definition->>'id';
 SELECT revision INTO existing FROM sahten_catalog_private.upsell_rules WHERE store_id=p_store_id AND offer_id=eid FOR UPDATE;
 IF existing IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'upsell_revision_conflict';END IF;
 IF p_source_fingerprint IS DISTINCT FROM ctx->>'sourceFingerprint' THEN RAISE EXCEPTION 'upsell_cost_source_changed';END IF;
 IF p_defer_additional IS NULL OR (NOT p_defer_additional AND (p_incremental_cost IS NULL OR p_order_cost IS NULL
 OR p_incremental_cost NOT BETWEEN 0 AND 10000000 OR p_order_cost NOT BETWEEN 0 AND 10000000
 OR round(p_incremental_cost,2)<>p_incremental_cost OR round(p_order_cost,2)<>p_order_cost))
 OR length(trim(coalesce(p_review_note,''))) NOT BETWEEN 20 AND 1000
 THEN RAISE EXCEPTION 'upsell_review_incomplete';END IF;
 special:=coalesce((ctx->>'requiresException')::boolean,false);
 IF special AND p_accept_exception IS DISTINCT FROM true THEN RAISE EXCEPTION 'upsell_exception_acceptance_required';END IF;
 review_id:=gen_random_uuid();
 costs:=ctx->'costs';
 costs:=jsonb_set(costs,ARRAY[definition#>>'{productIds,0}'],(costs->(definition#>>'{productIds,0}'))||jsonb_build_object('incrementalVerified',NOT p_defer_additional,'additionalIncrementalCost',CASE WHEN p_defer_additional THEN 0 ELSE p_incremental_cost END));
 INSERT INTO sahten_catalog_private.upsell_reviews(id,store_id,offer_id,definition,economics,source_fingerprint,review_note,additional_deferred,exception_accepted,approved_by)
 VALUES(review_id,p_store_id,eid,definition,jsonb_build_object('products',costs,
 'orderCosts',jsonb_build_object('verified',NOT p_defer_additional,'additionalOrderCost',CASE WHEN p_defer_additional THEN 0 ELSE p_order_cost END,'shippingSubsidy',0),
 'costException',CASE WHEN p_defer_additional THEN jsonb_build_object('approved',true,'kind','deferred_additional_costs','auditId',review_id,
 'approvedBy',auth.uid(),'approvedAt',clock_timestamp(),'note',trim(p_review_note),'assumedIncrementalCost',0,'assumedOrderCost',0) ELSE NULL END),
 ctx->>'sourceFingerprint',trim(p_review_note),p_defer_additional,special,auth.uid());
 INSERT INTO sahten_catalog_private.upsell_rules(store_id,offer_id,review_id,enabled,updated_by)
 VALUES(p_store_id,eid,review_id,false,auth.uid()) ON CONFLICT(store_id,offer_id)
 DO UPDATE SET review_id=EXCLUDED.review_id,enabled=false,revision=gen_random_uuid(),updated_by=auth.uid(),updated_at=clock_timestamp() RETURNING revision INTO rev;
 INSERT INTO sahten_catalog_private.upsell_audit(store_id,offer_id,actor,action,snapshot)
 VALUES(p_store_id,eid,auth.uid(),'publish_paused',jsonb_build_object('reviewId',review_id,'definition',definition,'economics',costs,'orderCost',p_order_cost,'note',trim(p_review_note),'additionalDeferred',p_defer_additional,'exception',special,'revision',rev));
 UPDATE public.menus SET json=json,updated_at=clock_timestamp() WHERE store_id=p_store_id;
 RETURN jsonb_build_object('published',true,'enabled',false,'id',eid,'revision',rev,'reviewId',review_id);
END $$;

REVOKE ALL ON FUNCTION sahten_catalog_private.upsell_definition(jsonb),sahten_catalog_private.upsell_source_fingerprint(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
