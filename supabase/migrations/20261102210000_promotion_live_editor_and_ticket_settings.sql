-- Live management of already-published campaigns. Do not expose costs, payment credentials or coupon secrets.
CREATE OR REPLACE FUNCTION public.get_store_promotion_management(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp
AS $$
DECLARE doc jsonb; rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
   (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin','encargado','cajero','lectura']))
 ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id;
 IF doc IS NULL THEN RAISE EXCEPTION 'store_menu_missing'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',c.item->>'id','name',c.item->>'name','enabled',
      coalesce(st.enabled,(c.item->>'enabled')::boolean,false),
   'revision',st.revision,'updatedAt',st.updated_at,
   'kind',c.item->>'kind','channels',coalesce(c.item->'channels','[]'::jsonb),
   'schedule',c.item->'schedule',
   'productIds',coalesce(c.item->'productIds','[]'::jsonb),
   'extraPercent',coalesce(c.item->'extraPercent','0'::jsonb),
   'maxUnits',c.item->'maxUnits','priority',coalesce(c.item->'priority','0'::jsonb),
   'minMarginPct',c.item->'minMarginPct',
   'advertising',coalesce(c.item->'advertising','{}'::jsonb)
 ) ORDER BY c.ord),'[]'::jsonb) INTO rows
 FROM jsonb_array_elements(coalesce(doc#>'{promotions,campaigns}','[]'::jsonb))
   WITH ORDINALITY AS c(item,ord)
 LEFT JOIN sahten_catalog_private.promotion_campaign_states st
  ON st.store_id=p_store_id AND st.campaign_id=c.item->>'id';
 RETURN jsonb_build_object(
  'published',coalesce(doc#>>'{promotions,enabled}','false')='true',
  'campaigns',rows,'paymentPercent',coalesce(doc#>'{promotions,paymentPercent}','10'::jsonb),
  'ticket',coalesce(doc#>'{promotions,ticket}','{}'::jsonb),
  'source','published_management');
END;
$$;
REVOKE ALL ON FUNCTION public.get_store_promotion_management(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_promotion_management(uuid) TO authenticated;

-- The changes are a partial patch to one existing published campaign.
-- Cost-sensitive edits are re-validated against prices and private server costs.
CREATE OR REPLACE FUNCTION public.set_store_promotion_campaign_details(
 p_store_id uuid,p_campaign_id text,p_patch jsonb,p_expected_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp
AS $$
DECLARE doc jsonb; old jsonb; next_row jsonb; updated jsonb;
 prior sahten_catalog_private.promotion_campaign_states%ROWTYPE;
 found_prior boolean; enabled_state boolean; next_revision uuid;
 campaign_count int; base_pct numeric; pct numeric; min_margin numeric;
 pid text; channel_name text; product_doc jsonb; unit_price numeric; cost numeric; costs jsonb;
 sched jsonb; adv jsonb; name_text text; allowed text;
 d text; keys text[];
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
     (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
 ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_campaign_id IS NULL OR p_campaign_id !~ '^[a-zA-Z0-9_-]{1,100}$'
  OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
  OR length(p_patch::text)>6500 OR p_patch='{}'::jsonb
 THEN RAISE EXCEPTION 'invalid_campaign_patch'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k
    WHERE k NOT IN ('name','priority','schedule','channels','productIds',
                     'extraPercent','maxUnits','advertising'))
 THEN RAISE EXCEPTION 'campaign_patch_forbidden_fields'; END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 IF doc IS NULL OR doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'promotions_not_published'; END IF;
 SELECT count(*),max(c.value::text)::jsonb INTO campaign_count,old
 FROM jsonb_array_elements(doc#>'{promotions,campaigns}') c(value)
 WHERE c.value->>'id'=p_campaign_id;
 IF campaign_count<>1 THEN RAISE EXCEPTION 'campaign_not_published'; END IF;
 SELECT * INTO prior FROM sahten_catalog_private.promotion_campaign_states
 WHERE store_id=p_store_id AND campaign_id=p_campaign_id FOR UPDATE;
 found_prior:=FOUND;
 IF (found_prior AND prior.revision IS DISTINCT FROM p_expected_revision)
  OR (NOT found_prior AND p_expected_revision IS NOT NULL)
 THEN RAISE EXCEPTION 'promotion_state_conflict'; END IF;
 enabled_state:=coalesce(prior.enabled,(old->>'enabled')::boolean,false);
 next_row:=old || p_patch;
 -- Advertising patch merges only published creative settings.
 IF p_patch ? 'advertising' THEN
   IF jsonb_typeof(p_patch->'advertising') IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch->'advertising') k
       WHERE k NOT IN ('enabled','message','placement','advanceDays','ticketFormat'))
   THEN RAISE EXCEPTION 'invalid_advertising_patch'; END IF;
   adv:=coalesce(old->'advertising','{}'::jsonb) || p_patch->'advertising';
   next_row:=jsonb_set(next_row,'{advertising}',adv,true);
 END IF;
 name_text:=trim(coalesce(next_row->>'name',''));
 IF length(name_text) NOT BETWEEN 4 AND 100 THEN RAISE EXCEPTION 'invalid_campaign_name';END IF;
 IF coalesce(next_row->>'priority','') !~ '^[0-9]{1,3}$'
   OR (next_row->>'priority')::int>100 THEN RAISE EXCEPTION 'invalid_campaign_priority';END IF;
 IF coalesce(next_row->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
 THEN RAISE EXCEPTION 'invalid_campaign_discount';END IF;
 pct:=(next_row->>'extraPercent')::numeric;
 base_pct:=coalesce(nullif(doc#>>'{promotions,paymentPercent}','')::numeric,10);
 IF pct<0 OR pct>10 OR base_pct+pct>20 THEN RAISE EXCEPTION 'campaign_discount_limit';END IF;
 IF next_row ? 'maxUnits' AND next_row->'maxUnits'<>'null'::jsonb AND
   (coalesce(next_row->>'maxUnits','') !~ '^[0-9]{1,2}$'
    OR (next_row->>'maxUnits')::int NOT BETWEEN 1 AND 30)
 THEN RAISE EXCEPTION 'invalid_campaign_unit_limit';END IF;
 IF jsonb_typeof(next_row->'channels') IS DISTINCT FROM 'array' OR
   jsonb_array_length(next_row->'channels') NOT BETWEEN 1 AND 2 OR
   EXISTS (SELECT 1 FROM jsonb_array_elements_text(next_row->'channels') v
     WHERE v NOT IN ('online','mostrador'))
 THEN RAISE EXCEPTION 'invalid_campaign_channels';END IF;
 IF jsonb_typeof(next_row->'productIds') IS DISTINCT FROM 'array' OR
    jsonb_array_length(next_row->'productIds') NOT BETWEEN 1 AND 30 OR
    (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(next_row->'productIds') x)
      <>jsonb_array_length(next_row->'productIds')
 THEN RAISE EXCEPTION 'invalid_campaign_products';END IF;
 sched:=next_row->'schedule';
 IF sched='null'::jsonb THEN sched:=jsonb_build_object('type','always'); END IF;
 IF jsonb_typeof(sched) IS DISTINCT FROM 'object' OR
   sched->>'type' NOT IN ('always','weekly','central_weekends','dates') THEN
   RAISE EXCEPTION 'invalid_campaign_schedule';END IF;
 IF jsonb_typeof(sched->'excludedDates')='array' AND
   EXISTS(SELECT 1 FROM jsonb_array_elements_text(sched->'excludedDates') v
      WHERE v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
 THEN RAISE EXCEPTION 'invalid_schedule_exclusion';END IF;
 IF sched->>'type'='weekly' AND
   (jsonb_typeof(sched->'weekdays') IS DISTINCT FROM 'array'
   OR jsonb_array_length(sched->'weekdays') NOT BETWEEN 1 AND 7
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(sched->'weekdays') v
          WHERE v !~ '^[0-6]$'))
 THEN RAISE EXCEPTION 'invalid_campaign_weekdays';END IF;
 IF sched->>'type'='dates' AND
   (jsonb_typeof(sched->'dates') IS DISTINCT FROM 'array'
    OR jsonb_array_length(sched->'dates') NOT BETWEEN 1 AND 45
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(sched->'dates') v
        WHERE v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
 THEN RAISE EXCEPTION 'invalid_campaign_dates';END IF;
 IF sched ? 'from' AND sched->>'from'<>'' AND sched->>'from' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  OR sched ? 'until' AND sched->>'until'<>'' AND sched->>'until' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  OR coalesce(sched->>'from','')<>'' AND coalesce(sched->>'until','')<>'' AND sched->>'from'>sched->>'until'
 THEN RAISE EXCEPTION 'invalid_campaign_date_range';END IF;
 IF (sched ? 'startTime' AND sched->>'startTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
   OR (sched ? 'endTime' AND sched->>'endTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
   OR (sched ? 'startTime' AND sched ? 'endTime' AND sched->>'startTime'>sched->>'endTime')
 THEN RAISE EXCEPTION 'invalid_campaign_hours';END IF;
 adv:=coalesce(next_row->'advertising','{}'::jsonb);
 IF jsonb_typeof(adv->'enabled') NOT IN ('boolean','null') OR
    length(coalesce(adv->>'message',''))>190 OR
    jsonb_typeof(adv->'placement') IS DISTINCT FROM 'array' OR
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(adv->'placement') v
      WHERE v NOT IN ('ticket','cart','checkout','menu')) OR
    coalesce(adv->>'advanceDays','0') !~ '^[0-9]{1,2}$' OR
    coalesce((adv->>'advanceDays')::int,0)>14 OR
    coalesce(adv->>'ticketFormat','A') NOT IN ('A','B','D')
 THEN RAISE EXCEPTION 'invalid_campaign_advertising';END IF;
 IF coalesce((adv->>'enabled')::boolean,false)
     AND length(trim(coalesce(adv->>'message','')))<10
 THEN RAISE EXCEPTION 'campaign_advertising_message_required';END IF;

 -- Revalidate changes to economics or eligible products with PRIVATE trusted costs.
 IF p_patch ? 'extraPercent' OR p_patch ? 'productIds' OR p_patch ? 'channels' THEN
   min_margin:=coalesce(nullif(old->>'minMarginPct','')::numeric,40);
   FOR channel_name IN SELECT jsonb_array_elements_text(next_row->'channels') LOOP
     costs:=public.sahten_promotion_costs(p_store_id,channel_name);
     FOR pid IN SELECT jsonb_array_elements_text(next_row->'productIds') LOOP
       SELECT p INTO product_doc FROM jsonb_array_elements(coalesce(doc->'products','[]'::jsonb)) p
        WHERE p->>'id'=pid;
       IF product_doc IS NULL OR coalesce(product_doc->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
         OR coalesce(product_doc#>>'{salesAvailability,retired}','false')='true'
         OR coalesce(product_doc#>>'{salesAvailability,paused}','false')='true'
       THEN RAISE EXCEPTION 'campaign_product_unavailable:%',pid;END IF;
       unit_price:=(product_doc->>'price')::numeric;
       IF unit_price<=0 OR costs->>pid IS NULL OR
          (costs->>pid) !~ '^[0-9]+([.][0-9]+)?$'
       THEN RAISE EXCEPTION 'campaign_cost_unverified:%',pid;END IF;
       cost:=(costs->>pid)::numeric;
       IF cost>unit_price*(1-(base_pct+pct)/100)*(1-min_margin/100)
       THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',pid;END IF;
     END LOOP;
   END LOOP;
 END IF;
 next_row:=jsonb_set(next_row,'{enabled}',to_jsonb(enabled_state),true);
 SELECT jsonb_agg(CASE WHEN c.item->>'id'=p_campaign_id THEN next_row ELSE c.item END ORDER BY c.ord)
 INTO updated FROM jsonb_array_elements(doc#>'{promotions,campaigns}')
 WITH ORDINALITY AS c(item,ord);
 next_revision:=gen_random_uuid();
 INSERT INTO sahten_catalog_private.promotion_campaign_states
  (store_id,campaign_id,enabled,revision,updated_by,updated_at)
 VALUES(p_store_id,p_campaign_id,enabled_state,next_revision,auth.uid(),clock_timestamp())
 ON CONFLICT(store_id,campaign_id) DO UPDATE
  SET revision=EXCLUDED.revision,enabled=EXCLUDED.enabled,
      updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at;
 UPDATE public.menus
 SET json=jsonb_set(doc,'{promotions,campaigns}',updated,true),updated_at=clock_timestamp()
 WHERE store_id=p_store_id;
 RETURN jsonb_build_object('id',p_campaign_id,'saved',true,'enabled',enabled_state,'revision',next_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.set_store_promotion_campaign_details(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_promotion_campaign_details(uuid,text,jsonb,uuid) TO authenticated;

-- The two receipt switches are not local project flags. They update the same
-- published menu read by every app/website, with an optimistic revision.
CREATE OR REPLACE FUNCTION public.set_store_promotion_ticket_settings(
 p_store_id uuid,p_settings jsonb,p_expected_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp
AS $$
DECLARE doc jsonb; previous jsonb; updated jsonb; revision uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
    (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
 ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) k WHERE k NOT IN ('enabled','advertise')) OR
    NOT p_settings ? 'enabled' OR NOT p_settings ? 'advertise' OR
    jsonb_typeof(p_settings->'enabled')<>'boolean' OR
    jsonb_typeof(p_settings->'advertise')<>'boolean'
 THEN RAISE EXCEPTION 'invalid_ticket_settings';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 IF doc IS NULL OR doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'promotions_not_published';END IF;
 previous:=coalesce(doc#>'{promotions,ticket}','{}'::jsonb);
 IF nullif(previous->>'revision','')::uuid IS DISTINCT FROM p_expected_revision
 THEN RAISE EXCEPTION 'promotion_ticket_conflict';END IF;
 revision:=gen_random_uuid();
 updated:=previous || p_settings || jsonb_build_object(
  'revision',revision,'updatedAt',clock_timestamp());
 UPDATE public.menus SET
  json=jsonb_set(doc,'{promotions,ticket}',updated,true),
  updated_at=clock_timestamp()
 WHERE store_id=p_store_id;
 RETURN updated;
END;
$$;
REVOKE ALL ON FUNCTION public.set_store_promotion_ticket_settings(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_promotion_ticket_settings(uuid,jsonb,uuid) TO authenticated;
