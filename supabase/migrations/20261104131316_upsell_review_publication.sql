-- Independent, immutable owner/admin reviews. No seed data or automatic activation.
CREATE SCHEMA IF NOT EXISTS sahten_catalog_private;
CREATE TABLE IF NOT EXISTS sahten_catalog_private.upsell_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 offer_id text NOT NULL,
 definition jsonb NOT NULL, economics jsonb NOT NULL, source_fingerprint text NOT NULL,
 review_note text NOT NULL, additional_deferred boolean NOT NULL DEFAULT false, exception_accepted boolean NOT NULL DEFAULT false,
 approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(store_id,offer_id,id)
);
CREATE TABLE IF NOT EXISTS sahten_catalog_private.upsell_rules (
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 offer_id text NOT NULL, review_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false, revision uuid NOT NULL DEFAULT gen_random_uuid(),
 updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(store_id,offer_id),
 FOREIGN KEY(store_id,offer_id,review_id) REFERENCES sahten_catalog_private.upsell_reviews(store_id,offer_id,id)
);
CREATE TABLE IF NOT EXISTS sahten_catalog_private.upsell_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 offer_id text NOT NULL, actor uuid NOT NULL, action text NOT NULL,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sahten_catalog_private.upsell_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sahten_catalog_private.upsell_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sahten_catalog_private.upsell_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_catalog_private.upsell_reviews,sahten_catalog_private.upsell_rules,sahten_catalog_private.upsell_audit
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION sahten_catalog_private.upsell_manager(sid uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=sid
   AND(s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin'])))
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION sahten_catalog_private.upsell_manager(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Preserve the approved channel cost snapshots; never calculate costs from a browser quote.
CREATE OR REPLACE FUNCTION sahten_catalog_private.upsell_cost_source(sid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH catalog AS(
 SELECT p FROM public.projects pr JOIN public.stores s ON s.project_id=pr.id
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(pr.data#>'{catalog,productos}','[]'::jsonb)) p WHERE s.id=sid
 ), amounts AS(
 SELECT p->>'id' id,
 coalesce(p#>>'{pricingPolicies,online,variableCost}',p#>>'{pricingPolicies,mostrador,variableCost}') direct,
 coalesce(p#>>'{pricingPolicies,online,fixedCost}',p#>>'{pricingPolicies,mostrador,fixedCost}') fixed FROM catalog
 ) SELECT coalesce(jsonb_object_agg(id,jsonb_build_object('verified',true,'directCost',direct::numeric,'fixedCost',fixed::numeric))
 FILTER(WHERE id IS NOT NULL AND EXISTS(SELECT 1 FROM public.menus m CROSS JOIN LATERAL jsonb_array_elements(coalesce(m.json->'products','[]'::jsonb)) product WHERE m.store_id=sid AND product->>'id'=amounts.id) AND direct ~ '^[0-9]{1,11}([.][0-9]{1,2})?$' AND fixed ~ '^[0-9]{1,11}([.][0-9]{1,2})?$'),'{}'::jsonb) FROM amounts;
$$;
REVOKE ALL ON FUNCTION sahten_catalog_private.upsell_cost_source(uuid) FROM PUBLIC,anon,authenticated,service_role;

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
 IF coalesce(value->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$' OR (value->>'extraPercent')::numeric NOT BETWEEN 0 AND 10
 OR coalesce(value->>'priority','30') !~ '^[0-9]{1,3}$' OR coalesce(value->>'priority','30')::integer>100
 THEN RAISE EXCEPTION 'upsell_discount_limit'; END IF;
 tiers:=coalesce(value->'discountTiers','[]'::jsonb);
 IF jsonb_typeof(tiers) IS DISTINCT FROM 'array' OR jsonb_array_length(tiers)>5 THEN RAISE EXCEPTION 'upsell_tiers_invalid';END IF;
 FOR tier IN SELECT x FROM jsonb_array_elements(tiers) x LOOP
   IF coalesce(tier->>'minEligibleNetSubtotal','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$'
   OR coalesce(tier->>'totalDiscountPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
   THEN RAISE EXCEPTION 'upsell_tiers_invalid';END IF;
   threshold:=(tier->>'minEligibleNetSubtotal')::numeric;pct:=(tier->>'totalDiscountPercent')::numeric;
   IF threshold<=last_threshold OR pct<=10 OR pct>30 OR pct<last_pct
     OR (pct>20 AND (value->>'id'<>'fatay-individual-up' OR target<>'fatay'))
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
REVOKE ALL ON FUNCTION sahten_catalog_private.upsell_definition(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION sahten_catalog_private.upsell_source_fingerprint(sid uuid,definition jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(jsonb_build_object('definition',definition,'costs',sahten_catalog_private.upsell_cost_source(sid),
 'prices',(SELECT jsonb_agg(jsonb_build_object('id',p->>'id','price',p->'price') ORDER BY p->>'id') FROM jsonb_array_elements(m.json->'products') p),
 'benefit',m.json#>'{payments,benefit}','methods',m.json#>'{payments,methods}')::text)
 FROM public.menus m WHERE m.store_id=sid;
$$;
REVOKE ALL ON FUNCTION sahten_catalog_private.upsell_source_fingerprint(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_store_upsell_review_context(p_store_id uuid,p_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE definition jsonb;doc jsonb;costs jsonb;pid text;p jsonb;
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
 RETURN jsonb_build_object('definition',definition,'sourceFingerprint',sahten_catalog_private.upsell_source_fingerprint(p_store_id,definition),
 'products',doc->'products','costs',costs,'paymentPercent',doc#>'{payments,benefit,percent}',
 'existing',(SELECT jsonb_build_object('revision',r.revision,'enabled',r.enabled,'reviewId',r.review_id) FROM sahten_catalog_private.upsell_rules r WHERE r.store_id=p_store_id AND r.offer_id=definition->>'id'));
END $$;
REVOKE ALL ON FUNCTION public.get_store_upsell_review_context(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_upsell_review_context(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION sahten_catalog_private.retain_reviewed_upsells()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kept jsonb; reviewed jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO kept FROM jsonb_array_elements(
 CASE WHEN jsonb_typeof(NEW.json#>'{promotions,upsells}')='array' THEN NEW.json#>'{promotions,upsells}' ELSE '[]'::jsonb END) x
 WHERE NOT EXISTS(SELECT 1 FROM sahten_catalog_private.upsell_rules r WHERE r.store_id=NEW.store_id AND r.offer_id=x->>'id');
 SELECT coalesce(jsonb_agg(v.definition||jsonb_build_object('enabled',r.enabled) ORDER BY r.offer_id),'[]'::jsonb) INTO reviewed
 FROM sahten_catalog_private.upsell_rules r JOIN sahten_catalog_private.upsell_reviews v ON v.id=r.review_id WHERE r.store_id=NEW.store_id;
 IF reviewed='[]'::jsonb THEN RETURN NEW;END IF;
 IF jsonb_typeof(NEW.json->'promotions') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'reviewed_upsells_require_promotions';END IF;
 NEW.json:=jsonb_set(NEW.json,'{promotions,upsells}',kept||reviewed,true);
 NEW.json:=jsonb_set(NEW.json,'{promotions,upsellGuardRequired}','true'::jsonb,true);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sahten_catalog_private.retain_reviewed_upsells() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sahten_menu_reviewed_upsells ON public.menus;
CREATE TRIGGER sahten_menu_reviewed_upsells BEFORE INSERT OR UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION sahten_catalog_private.retain_reviewed_upsells();

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
 special:=EXISTS(SELECT 1 FROM jsonb_array_elements(definition->'discountTiers') t WHERE (t->>'totalDiscountPercent')::numeric>20);
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
REVOKE ALL ON FUNCTION public.review_and_publish_store_upsell(uuid,jsonb,numeric,numeric,text,text,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_and_publish_store_upsell(uuid,jsonb,numeric,numeric,text,text,uuid,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_store_upsell_state(p_store_id uuid,p_offer_id text,p_enabled boolean,p_expected_revision uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r sahten_catalog_private.upsell_rules;v sahten_catalog_private.upsell_reviews;rev uuid;
BEGIN
 PERFORM sahten_catalog_private.upsell_manager(p_store_id);
 PERFORM 1 FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 SELECT * INTO r FROM sahten_catalog_private.upsell_rules WHERE store_id=p_store_id AND offer_id=p_offer_id FOR UPDATE;
 IF r IS NULL THEN RAISE EXCEPTION 'upsell_not_published';END IF;
 IF r.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'upsell_revision_conflict';END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_upsell_state';END IF;
 SELECT * INTO v FROM sahten_catalog_private.upsell_reviews WHERE id=r.review_id;
 IF p_enabled AND v.source_fingerprint IS DISTINCT FROM sahten_catalog_private.upsell_source_fingerprint(p_store_id,v.definition)
 THEN RAISE EXCEPTION 'upsell_cost_source_changed';END IF;
 UPDATE sahten_catalog_private.upsell_rules SET enabled=p_enabled,revision=gen_random_uuid(),updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE store_id=p_store_id AND offer_id=p_offer_id RETURNING revision INTO rev;
 INSERT INTO sahten_catalog_private.upsell_audit(store_id,offer_id,actor,action,snapshot)
 VALUES(p_store_id,p_offer_id,auth.uid(),CASE WHEN p_enabled THEN 'enable' ELSE 'pause' END,jsonb_build_object('reviewId',r.review_id,'revision',rev));
 UPDATE public.menus SET json=json,updated_at=clock_timestamp() WHERE store_id=p_store_id;
 RETURN jsonb_build_object('id',p_offer_id,'enabled',p_enabled,'revision',rev);
END $$;
REVOKE ALL ON FUNCTION public.set_store_upsell_state(uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_upsell_state(uuid,text,boolean,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_store_upsell_management(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM sahten_catalog_private.upsell_manager(p_store_id);
 RETURN jsonb_build_object('source','reviewed_upsells','offers',coalesce((
 SELECT jsonb_agg(jsonb_build_object('id',r.offer_id,'enabled',r.enabled,'revision',r.revision,'reviewId',v.id,
 'definition',v.definition,'economics',v.economics,'reviewNote',v.review_note,'additionalDeferred',v.additional_deferred,'approvedAt',v.approved_at,'approvedBy',v.approved_by,
 'requiresReview',v.source_fingerprint IS DISTINCT FROM sahten_catalog_private.upsell_source_fingerprint(p_store_id,v.definition)))
 FROM sahten_catalog_private.upsell_rules r JOIN sahten_catalog_private.upsell_reviews v ON v.id=r.review_id WHERE r.store_id=p_store_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_store_upsell_management(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_upsell_management(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sahten_upsell_economics(p_store_id uuid,p_offer_id text,p_product_ids jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r sahten_catalog_private.upsell_rules;v sahten_catalog_private.upsell_reviews;costs jsonb;
BEGIN
 SELECT * INTO r FROM sahten_catalog_private.upsell_rules WHERE store_id=p_store_id AND offer_id=p_offer_id;
 IF r IS NULL OR NOT r.enabled THEN RETURN NULL;END IF;
 SELECT * INTO v FROM sahten_catalog_private.upsell_reviews WHERE id=r.review_id;
 IF v.source_fingerprint IS DISTINCT FROM sahten_catalog_private.upsell_source_fingerprint(p_store_id,v.definition) THEN RETURN NULL;END IF;
 IF jsonb_typeof(p_product_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_product_ids)>50 THEN RAISE EXCEPTION 'invalid_upsell_products';END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO costs FROM jsonb_each(v.economics->'products') WHERE p_product_ids ? key;
 RETURN v.economics||jsonb_build_object('revision',v.id,'products',costs,'definition',v.definition,
 'sourceMenu',(SELECT jsonb_build_object('products',m.json->'products','payments',m.json->'payments','config',m.json->'config') FROM public.menus m WHERE m.store_id=p_store_id),
 'sourceFingerprint',v.source_fingerprint,
 'exceptionApproval',CASE WHEN v.exception_accepted THEN jsonb_build_object('verified',true,'auditId',v.id,'maxTotalPercent',30) ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.sahten_upsell_economics(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sahten_upsell_economics(uuid,text,jsonb) TO service_role;


-- Final commit: catalog/cost review and consumed acceptance must still match.
-- The order and its existing idempotency ledger are written in the same transaction.
CREATE OR REPLACE FUNCTION public.confirm_reviewed_upsell_order(
 p_store_id uuid,p_offer_id text,p_review_id uuid,p_session_id text,p_request_id uuid,p_nonce text,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r sahten_catalog_private.upsell_rules;v sahten_catalog_private.upsell_reviews;
BEGIN
 PERFORM 1 FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 PERFORM 1 FROM public.projects pr JOIN public.stores s ON s.project_id=pr.id WHERE s.id=p_store_id FOR SHARE OF pr;
 SELECT * INTO r FROM sahten_catalog_private.upsell_rules WHERE store_id=p_store_id AND offer_id=p_offer_id;
 IF r IS NULL OR NOT r.enabled OR r.review_id IS DISTINCT FROM p_review_id THEN RAISE EXCEPTION 'upsell_review_changed';END IF;
 SELECT * INTO v FROM sahten_catalog_private.upsell_reviews WHERE id=r.review_id;
 IF v.source_fingerprint IS DISTINCT FROM sahten_catalog_private.upsell_source_fingerprint(p_store_id,v.definition)
 THEN RAISE EXCEPTION 'upsell_cost_source_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM sahten_catalog_private.upsell_nonce_consumptions n
 WHERE n.store_id=p_store_id AND n.nonce=p_nonce AND n.session_id=p_session_id
 AND n.request_id=p_request_id AND n.expires_at>=now()) THEN RAISE EXCEPTION 'upsell_acceptance_missing';END IF;
 IF p_payload->>'source' IS DISTINCT FROM 'pickup' OR coalesce(p_payload->>'paymentMethod','') NOT IN ('efectivo','transferencia')
 OR p_payload->>'upsellReviewId' IS DISTINCT FROM p_review_id::text
 OR p_payload->>'couponCodeDigest' IS NOT NULL
 OR coalesce(p_payload->>'upsellAcceptanceDigest','') !~ '^[a-f0-9]{64}$'
 OR (SELECT count(*) FROM jsonb_array_elements(p_payload#>'{promotionSnapshot,lines}') l
 WHERE l->>'appliedPromotionType'='upsell' AND l->>'appliedPromotionId'=p_offer_id)<>1
 THEN RAISE EXCEPTION 'invalid_upsell_order';END IF;
 RETURN public.sahten_delivery_backend('order',jsonb_build_object('store_id',p_store_id,'request_id',p_request_id,'payload',p_payload));
END $$;
REVOKE ALL ON FUNCTION public.confirm_reviewed_upsell_order(uuid,text,uuid,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_reviewed_upsell_order(uuid,text,uuid,text,uuid,text,jsonb) TO service_role;
