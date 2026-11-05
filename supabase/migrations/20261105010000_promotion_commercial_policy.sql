CREATE TABLE IF NOT EXISTS sahten_private.promotion_changes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL REFERENCES public.stores(id),
 actor uuid NOT NULL,action text NOT NULL,detail jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE sahten_private.promotion_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_private.promotion_changes FROM PUBLIC,anon,authenticated,service_role;
-- Commercial controls are owner/admin-only. No existing campaign is enabled by this migration.
CREATE OR REPLACE FUNCTION public.sahten_promotion_rule(doc jsonb,pid text DEFAULT '',campaign jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
 'minMarginPct',coalesce(nullif(doc#>>ARRAY['promotions','commercialPolicy','products',pid,'minMarginPct'],'')::numeric,
   nullif(campaign->>'minMarginPct','')::numeric,nullif(doc#>>'{promotions,commercialPolicy,minMarginPct}','')::numeric,40),
 'maxTotalPercent',coalesce(nullif(doc#>>ARRAY['promotions','commercialPolicy','products',pid,'maxTotalPercent'],'')::numeric,
   nullif(doc#>>'{promotions,commercialPolicy,maxTotalPercent}','')::numeric,20));
$$;
CREATE OR REPLACE FUNCTION public.get_store_promotion_policy(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE doc jsonb; costs jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
  (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id;
 costs:=public.sahten_promotion_costs(p_store_id,'online');
 RETURN jsonb_build_object('policy',coalesce(doc#>'{promotions,commercialPolicy}','{"minMarginPct":40,"maxTotalPercent":20,"products":{}}'),
  'costs',costs,'checkoutProFeePercent',doc#>'{promotions,checkoutProFeePercent}','paymentPercent',coalesce((doc#>>'{payments,benefit,percent}')::numeric,0),'products',coalesce(doc->'products','[]'),'revision',doc#>>'{promotions,commercialPolicy,revision}');
END $$;
CREATE OR REPLACE FUNCTION public.set_store_promotion_policy(p_store_id uuid,p_policy jsonb,p_expected_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE doc jsonb; v jsonb; id text; r uuid:=gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
  (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_policy) IS DISTINCT FROM 'object' OR length(p_policy::text)>20000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_policy) k WHERE k NOT IN ('minMarginPct','maxTotalPercent','products','mercadopagoFeePercent','mercadopagoFeeProvisional'))
 OR jsonb_typeof(p_policy->'products') IS DISTINCT FROM 'object'
 OR (p_policy->>'minMarginPct')::numeric NOT BETWEEN 0 AND 95
 OR (p_policy->>'maxTotalPercent')::numeric NOT BETWEEN 10 AND 95
 OR jsonb_typeof(p_policy->'minMarginPct') IS DISTINCT FROM 'number' OR jsonb_typeof(p_policy->'maxTotalPercent') IS DISTINCT FROM 'number'
 OR p_policy->>'minMarginPct' IS NULL OR p_policy->>'maxTotalPercent' IS NULL
 THEN RAISE EXCEPTION 'invalid_promotion_policy';END IF;
 IF (p_policy ? 'mercadopagoFeePercent' AND (jsonb_typeof(p_policy->'mercadopagoFeePercent') IS DISTINCT FROM 'number'
  OR (p_policy->>'mercadopagoFeePercent')::numeric NOT BETWEEN 0 AND 99.99))
 OR (p_policy ? 'mercadopagoFeeProvisional' AND jsonb_typeof(p_policy->'mercadopagoFeeProvisional') IS DISTINCT FROM 'boolean')
 THEN RAISE EXCEPTION 'invalid_payment_fee_assumption';END IF;
 FOR id,v IN SELECT * FROM jsonb_each(p_policy->'products') LOOP
  IF id !~ '^[a-zA-Z0-9_-]{1,100}$' OR jsonb_typeof(v) IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('minMarginPct','maxTotalPercent'))
  OR (v ? 'minMarginPct' AND (jsonb_typeof(v->'minMarginPct')<>'number' OR (v->>'minMarginPct')::numeric NOT BETWEEN 0 AND 95))
  OR (v ? 'maxTotalPercent' AND (jsonb_typeof(v->'maxTotalPercent')<>'number' OR (v->>'maxTotalPercent')::numeric NOT BETWEEN 10 AND 95))
  THEN RAISE EXCEPTION 'invalid_product_promotion_policy';END IF;
 END LOOP;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 IF doc IS NULL THEN RAISE EXCEPTION 'store_menu_missing';END IF;
 IF nullif(doc#>>'{promotions,commercialPolicy,revision}','')::uuid IS DISTINCT FROM p_expected_revision
 THEN RAISE EXCEPTION 'promotion_policy_conflict' USING ERRCODE='40001';END IF;
 UPDATE public.menus SET json=jsonb_set(doc,'{promotions}',coalesce(doc->'promotions','{}')||jsonb_build_object('commercialPolicy',p_policy||jsonb_build_object('revision',r)),true),updated_at=now()
 WHERE store_id=p_store_id;
 INSERT INTO sahten_private.promotion_changes(store_id,actor,action,detail)
 SELECT s.id,auth.uid(),'promotion_policy_updated',jsonb_build_object('before',doc#>'{promotions,commercialPolicy}','after',p_policy,'revision',r)
 FROM public.stores s WHERE s.id=p_store_id;
 RETURN jsonb_build_object('saved',true,'revision',r,'policy',p_policy);
END $$;
REVOKE ALL ON FUNCTION public.get_store_promotion_policy(uuid),public.set_store_promotion_policy(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_promotion_policy(uuid),public.set_store_promotion_policy(uuid,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_promotion_campaign_draft(
  p_store_id uuid,p_campaign jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp AS $$
DECLARE doc jsonb; campaign_id text; campaign_name text; mode text;
        pct numeric; base_pct numeric; min_margin numeric:=40;
        priority_num integer; pid text; channel_name text; value_text text;
        product_doc jsonb; unit_price numeric; cost numeric;
        costs jsonb; clean jsonb; schedule_doc jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id=p_store_id
      AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_campaign) IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'invalid_campaign'; END IF;
  campaign_id:=p_campaign->>'id';
  campaign_name:=trim(COALESCE(p_campaign->>'name',''));
  IF campaign_id IS NULL OR campaign_id !~ '^[a-z0-9][a-z0-9_-]{2,50}$'
     OR length(campaign_name) NOT BETWEEN 4 AND 100
     OR p_campaign->>'kind' IS DISTINCT FROM 'public'
  THEN RAISE EXCEPTION 'invalid_campaign_identity'; END IF;
  IF COALESCE(p_campaign->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
     OR COALESCE(p_campaign->>'priority','') !~ '^[0-9]{1,3}$'
  THEN RAISE EXCEPTION 'invalid_campaign_percentage'; END IF;
  pct:=(p_campaign->>'extraPercent')::numeric;
  priority_num:=(p_campaign->>'priority')::integer;
  IF pct<=0 OR pct>85 OR priority_num>100
  THEN RAISE EXCEPTION 'campaign_discount_limit'; END IF;
  IF jsonb_typeof(p_campaign->'channels') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_campaign->'channels')<>1
    OR p_campaign->'channels'<>'["online"]'::jsonb
  THEN RAISE EXCEPTION 'only_verified_online_channel'; END IF;
  IF jsonb_typeof(p_campaign->'productIds') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_campaign->'productIds') NOT BETWEEN 1 AND 30
    OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_campaign->'productIds') x)
       <>jsonb_array_length(p_campaign->'productIds')
  THEN RAISE EXCEPTION 'invalid_campaign_products'; END IF;
  schedule_doc:=p_campaign->'schedule';
  mode:=schedule_doc->>'type';
  IF jsonb_typeof(schedule_doc) IS DISTINCT FROM 'object'
     OR mode NOT IN ('weekly','dates','central_weekends','always')
  THEN RAISE EXCEPTION 'invalid_campaign_schedule'; END IF;
  IF mode='weekly' THEN
    IF jsonb_typeof(schedule_doc->'weekdays') IS DISTINCT FROM 'array'
       OR jsonb_array_length(schedule_doc->'weekdays') NOT BETWEEN 1 AND 7
       OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(schedule_doc->'weekdays') v
                 WHERE v !~ '^[0-6]$')
    THEN RAISE EXCEPTION 'invalid_campaign_weekdays'; END IF;
  END IF;
  IF mode='dates' THEN
    IF jsonb_typeof(schedule_doc->'dates') IS DISTINCT FROM 'array'
       OR jsonb_array_length(schedule_doc->'dates') NOT BETWEEN 1 AND 45
       OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(schedule_doc->'dates') v
                 WHERE v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    THEN RAISE EXCEPTION 'invalid_campaign_dates'; END IF;
  END IF;
  FOR value_text IN SELECT schedule_doc->>'from' UNION ALL SELECT schedule_doc->>'until' LOOP
    IF value_text IS NOT NULL AND value_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN RAISE EXCEPTION 'invalid_campaign_date_range'; END IF;
  END LOOP;
  IF schedule_doc->>'from' IS NOT NULL AND schedule_doc->>'until' IS NOT NULL
    AND schedule_doc->>'from'>schedule_doc->>'until'
  THEN RAISE EXCEPTION 'invalid_campaign_date_range'; END IF;
  FOR value_text IN SELECT schedule_doc->>'startTime' UNION ALL SELECT schedule_doc->>'endTime' LOOP
    IF value_text IS NOT NULL AND value_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    THEN RAISE EXCEPTION 'invalid_campaign_hours'; END IF;
  END LOOP;
  IF schedule_doc->>'startTime' IS NOT NULL AND schedule_doc->>'endTime' IS NOT NULL
     AND schedule_doc->>'startTime'>schedule_doc->>'endTime'
  THEN RAISE EXCEPTION 'invalid_campaign_hours'; END IF;

  SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
  IF doc IS NULL OR doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'promotions_not_published'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(doc#>'{promotions,campaigns}','[]'::jsonb)) c
           WHERE c->>'id'=campaign_id)
  THEN RAISE EXCEPTION 'campaign_already_published'; END IF;
  base_pct:=COALESCE(NULLIF(doc#>>'{promotions,paymentPercent}','')::numeric,10);
  IF base_pct<0 OR base_pct+pct>=100 THEN RAISE EXCEPTION 'campaign_discount_limit'; END IF;

  -- The cost snapshot is private and computed on the server, never submitted by the client.
  costs:=public.sahten_promotion_costs(p_store_id,'online');
  FOR pid IN SELECT jsonb_array_elements_text(p_campaign->'productIds') LOOP
    SELECT p INTO product_doc FROM jsonb_array_elements(COALESCE(doc->'products','[]'::jsonb)) p
      WHERE p->>'id'=pid;
    IF product_doc IS NULL OR COALESCE(product_doc->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
       OR COALESCE(product_doc#>>'{salesAvailability,retired}','false')='true'
       OR COALESCE(product_doc#>>'{salesAvailability,paused}','false')='true'
    THEN RAISE EXCEPTION 'campaign_product_unavailable:%',pid; END IF;
    unit_price:=(product_doc->>'price')::numeric;
    IF unit_price<=0 OR costs->>pid IS NULL
       OR (costs->>pid) !~ '^[0-9]+([.][0-9]+)?$'
    THEN RAISE EXCEPTION 'campaign_cost_unverified:%',pid; END IF;
    cost:=(costs->>pid)::numeric;
    min_margin:=(public.sahten_promotion_rule(doc,pid)->>'minMarginPct')::numeric;
    IF base_pct+pct>(public.sahten_promotion_rule(doc,pid)->>'maxTotalPercent')::numeric THEN RAISE EXCEPTION 'campaign_discount_limit:%',pid;END IF;
    IF cost>unit_price*(1-(base_pct+pct)/100)*(1-min_margin/100)
    THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',pid; END IF;
  END LOOP;
  clean:=jsonb_build_object(
    'id',campaign_id,'kind','public','name',campaign_name,'enabled',false,
    'priority',priority_num,'extraPercent',pct,'channels',jsonb_build_array('online'),
    'productIds',p_campaign->'productIds','schedule',schedule_doc,
    'minMarginPct',null,'requiresVerifiedCosts',true,
    'advertising',jsonb_build_object('enabled',false,'placement','[]'::jsonb,'message','')
  );
  INSERT INTO sahten_catalog_private.promotion_draft_publications
    (store_id,campaign_id,campaign,published_by)
  VALUES(p_store_id,campaign_id,clean,auth.uid());
  -- Retention trigger appends the sanitized paused campaign to the live menu.
  UPDATE public.menus SET json=doc,updated_at=clock_timestamp() WHERE store_id=p_store_id;
  RETURN jsonb_build_object('published',true,'id',campaign_id,'enabled',false,
    'channel','online','requiresActivation',true);
END $$;
REVOKE ALL ON FUNCTION public.publish_promotion_campaign_draft(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_promotion_campaign_draft(uuid,jsonb)
  TO authenticated;
COMMENT ON FUNCTION public.publish_promotion_campaign_draft(uuid,jsonb)
  IS 'Owner/admin only: validate online prices, private costs and 40pct margin; publish as PAUSED. Does not activate discounts.';

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
                     'extraPercent','maxUnits','advertising','minMarginPct'))
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
 IF pct<0 OR pct>85 OR base_pct+pct>=100 THEN RAISE EXCEPTION 'campaign_discount_limit';END IF;
 IF next_row ? 'minMarginPct' AND next_row->'minMarginPct'<>'null'::jsonb AND
  (jsonb_typeof(next_row->'minMarginPct')<>'number' OR (next_row->>'minMarginPct')::numeric NOT BETWEEN 0 AND 95)
 THEN RAISE EXCEPTION 'invalid_campaign_margin';END IF;
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
 IF p_patch ? 'extraPercent' OR p_patch ? 'productIds' OR p_patch ? 'channels' OR p_patch ? 'minMarginPct' THEN
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
       min_margin:=(public.sahten_promotion_rule(doc,pid,next_row)->>'minMarginPct')::numeric;
       IF base_pct+pct>(public.sahten_promotion_rule(doc,pid,next_row)->>'maxTotalPercent')::numeric THEN RAISE EXCEPTION 'campaign_discount_limit:%',pid;END IF;
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


-- Owner-only, read-only production preflight of draft promotions.
-- No coupons issued, no discounts enabled, no menu rows changed.
-- A quote of current published prices/base-costs is NOT approval of incremental costs.
CREATE OR REPLACE FUNCTION public.verify_promotion_draft(
  p_store_id uuid, p_type text, p_draft jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_private,pg_temp
AS $$
DECLARE
 doc jsonb; published jsonb; costs jsonb;
 checks jsonb:='[]'::jsonb; assessed jsonb:='[]'::jsonb;
 targets jsonb:='[]'::jsonb; triggers jsonb:='[]'::jsonb;
 target text; trigger_id text; p jsonb;
 pct numeric; total_pct numeric; base_pct numeric;
 price numeric; cost numeric; margin numeric; headroom numeric; min_margin numeric;
 targets_ok boolean:=true; triggers_ok boolean:=true;
 costs_ok boolean:=true; margins_ok boolean:=true;
 terms_ok boolean:=true; exact boolean:=true;
 n integer:=0; name text; reason text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
     (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))
 ) THEN
   RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 IF p_type NOT IN ('upsells','productUpgrades','couponPrograms')
    OR jsonb_typeof(p_draft) IS DISTINCT FROM 'object'
    OR length(p_draft::text)>32000 THEN
   RAISE EXCEPTION 'invalid_draft';
 END IF;
 IF coalesce(p_draft->>'id','') !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,75}$'
    OR length(trim(coalesce(p_draft->>'name',''))) NOT BETWEEN 4 AND 100
 THEN
   RAISE EXCEPTION 'invalid_draft_identity';
 END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id;
 IF doc IS NULL THEN RAISE EXCEPTION 'menu_not_published'; END IF;
 published:=coalesce(doc->'products','[]'::jsonb);
 IF jsonb_typeof(published) IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'published_catalog_invalid'; END IF;
 base_pct:=CASE WHEN coalesce(doc#>>'{promotions,paymentPercent}','') ~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
   THEN (doc#>>'{promotions,paymentPercent}')::numeric ELSE 10 END;
 IF base_pct NOT BETWEEN 0 AND 20 THEN base_pct:=10; END IF;
 costs:=public.sahten_promotion_costs(p_store_id,'online');
 IF jsonb_typeof(costs) IS DISTINCT FROM 'object' THEN costs:='{}'::jsonb; END IF;
 IF p_type='couponPrograms' THEN
   targets:=coalesce(p_draft->'eligibleProductIds','[]'::jsonb);
   IF coalesce(p_draft->>'channel','online')<>'online' THEN
     terms_ok:=false;
   END IF;
 ELSE
   targets:=CASE WHEN p_type='productUpgrades'
     THEN jsonb_build_array(p_draft->>'replacementProductId')
     ELSE coalesce(p_draft->'productIds','[]'::jsonb) END;
   triggers:=CASE WHEN jsonb_typeof(p_draft->'triggerProductIds')='array'
     THEN p_draft->'triggerProductIds'
     WHEN p_draft->>'triggerProductId' IS NOT NULL
     THEN jsonb_build_array(p_draft->>'triggerProductId')
     ELSE '[]'::jsonb END;
 END IF;
 IF jsonb_typeof(targets) IS DISTINCT FROM 'array'
    OR jsonb_typeof(triggers) IS DISTINCT FROM 'array'
    OR jsonb_array_length(targets)>30 OR jsonb_array_length(triggers)>30
 THEN RAISE EXCEPTION 'invalid_draft_products'; END IF;
 -- Coupons with unrestricted eligibility cannot be profitability-tested as a
 -- sample product. The owner must select product coverage before preflight.
 IF jsonb_array_length(targets)=0 THEN targets_ok:=false; END IF;
 IF p_type<>'couponPrograms' AND jsonb_array_length(triggers)=0
 THEN triggers_ok:=false; END IF;
 IF coalesce(p_draft->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
 THEN pct:=0;terms_ok:=false;
 ELSE pct:=(p_draft->>'extraPercent')::numeric;END IF;
 IF p_type='couponPrograms' THEN
   IF pct<=0 OR pct>85 OR
      coalesce(p_draft->>'minEligibleSubtotal','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$' OR
      coalesce(p_draft->>'validDays','') !~ '^[0-9]{1,3}$' OR
      coalesce(p_draft->>'validDays','0')::numeric NOT BETWEEN 1 AND 365 OR
      (p_draft->>'maxExtraAmount' IS NOT NULL AND coalesce(p_draft->>'maxExtraAmount','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$')
   THEN terms_ok:=false;END IF;
 ELSE
   IF pct<=0 OR pct>85 THEN terms_ok:=false; END IF;
   IF p_type='productUpgrades' AND
     p_draft->>'replacementProductId'=p_draft->>'triggerProductId'
   THEN triggers_ok:=false; END IF;
 END IF;
 IF jsonb_typeof(p_draft->'discountTiers')='array' AND
    jsonb_array_length(p_draft->'discountTiers')>0 THEN
   -- Tiers above the normal 20% discount require a separate exception process.
   SELECT bool_and(coalesce(t->>'totalDiscountPercent','') ~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
      AND coalesce(t->>'totalDiscountPercent','0')::numeric>base_pct
      AND coalesce(t->>'totalDiscountPercent','0')::numeric<=20),
      max(CASE WHEN coalesce(t->>'totalDiscountPercent','') ~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
         THEN (t->>'totalDiscountPercent')::numeric ELSE 100 END)
   INTO exact,total_pct
   FROM jsonb_array_elements(p_draft->'discountTiers') t;
   IF exact IS DISTINCT FROM true THEN terms_ok:=false;END IF;
 ELSE
   total_pct:=base_pct+pct;
 END IF;
 IF total_pct>=100 THEN terms_ok:=false; END IF;
 FOR target IN SELECT jsonb_array_elements_text(targets) LOOP
   n:=n+1;
   min_margin:=(public.sahten_promotion_rule(doc,target,p_draft)->>'minMarginPct')::numeric;
   IF total_pct>(public.sahten_promotion_rule(doc,target,p_draft)->>'maxTotalPercent')::numeric THEN terms_ok:=false;END IF;
   SELECT product INTO p FROM jsonb_array_elements(published) product
     WHERE product->>'id'=target LIMIT 1;
   IF p IS NULL OR
      coalesce(p->>'price','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$' OR
      coalesce(p->>'retired','false')='true' OR
      coalesce(p#>>'{salesAvailability,paused}','false')='true' THEN
     targets_ok:=false;costs_ok:=false;margins_ok:=false;
     assessed:=assessed||jsonb_build_array(jsonb_build_object(
       'id',target,'published',false,'price',null,'baseCost',null,'estimatedMarginPct',null,
       'headroomAt40Pct',null));
   ELSE
     price:=(p->>'price')::numeric;
     IF price<=0 THEN targets_ok:=false; END IF;
     IF costs->>target IS NULL OR costs->>target !~ '^[0-9]{1,11}([.][0-9]{1,2})?$'
     THEN
       costs_ok:=false;margins_ok:=false;cost:=null;margin:=null;headroom:=null;
     ELSE
       cost:=(costs->>target)::numeric;
       margin:=CASE WHEN price>0 AND total_pct<100
          THEN round((1-cost/(price*(100-total_pct)/100))*100,1) ELSE null END;
       headroom:=CASE WHEN price>0 AND total_pct<100
          THEN round((price*(100-total_pct)/100)*(1-min_margin/100)-cost,2) ELSE null END;
       IF margin IS NULL OR margin<min_margin THEN margins_ok:=false;END IF;
     END IF;
     assessed:=assessed||jsonb_build_array(jsonb_build_object(
       'id',target,'name',p->>'name','published',true,'price',price,
       'baseCost',cost,'estimatedMarginPct',margin,'headroomAt40Pct',headroom));
   END IF;
 END LOOP;
 FOR trigger_id IN SELECT jsonb_array_elements_text(triggers) LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(published) x
        WHERE x->>'id'=trigger_id AND coalesce(x->>'price','') ~ '^[0-9]+([.][0-9]+)?$'
          AND (x->>'price')::numeric>0
          AND coalesce(x->>'retired','false')<>'true') THEN
     triggers_ok:=false;
   END IF;
 END LOOP;
 checks:=jsonb_build_array(
   jsonb_build_object('id','terms','ok',terms_ok,'label','Descuento y reglas dentro de los límites','action','edit'),
   jsonb_build_object('id','products','ok',targets_ok,'label','Productos disponibles en el menú publicado','action','edit'),
   jsonb_build_object('id','triggers','ok',triggers_ok,'label',CASE WHEN p_type='couponPrograms'
       THEN 'No requiere disparadores' ELSE 'Productos disparadores publicados' END,'action','edit'),
   jsonb_build_object('id','costs','ok',costs_ok AND n>0,'label','Costo base real disponible en el servidor','action','costs'),
   jsonb_build_object('id','margin','ok',margins_ok AND n>0,'label','Margen estimado según la regla comercial configurada','action','costs'),
   jsonb_build_object('id','additional','ok',false,'label','Envase, trabajo, merma, reparto y comisiones revisados','action','costs'),
   jsonb_build_object('id','checkout','ok',false,'label',CASE WHEN p_type='productUpgrades'
      THEN 'Reemplazo y cobro recotizados por servidor' WHEN p_type='couponPrograms'
      THEN 'Canje único ligado al pedido y prueba de pago/caja'
      ELSE 'Oferta aceptada y cobrada con cotización firmada' END,'action','checkout'),
   jsonb_build_object('id','publication','ok',false,'label','Habilitación comercial de esta regla en el checkout','action','checkout')
 );
 RETURN jsonb_build_object('type',p_type,'id',p_draft->>'id','checkedAt',clock_timestamp(),
   'draftFingerprint',md5(p_draft::text),'source','server','canPublish',false,'canActivate',false,
   'paymentBasePercent',base_pct,'totalPercent',total_pct,'minMarginPercent',(public.sahten_promotion_rule(doc,'',p_draft)->>'minMarginPct')::numeric,
   'products',assessed,'checks',checks,
   'message','Verificación del menú y costo base completa. Falta aprobación de gastos incrementales y checkout transaccional. No se publicaron descuentos ni cupones.');
END
$$;
REVOKE ALL ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) IS
 'Owner/admin only READ-ONLY draft preflight: live menu + private base cost economics. NEVER authorizes discount publication or coupon issuance.';

-- An ordinary catalog upload from an older app must not erase live commercial rules.
CREATE OR REPLACE FUNCTION sahten_private.retain_commercial_policy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.json#>'{promotions,commercialPolicy}' IS NOT NULL
 AND (NEW.json#>>'{promotions,commercialPolicy,revision}' IS NULL OR
 NEW.json#>>'{promotions,commercialPolicy,revision}'=OLD.json#>>'{promotions,commercialPolicy,revision}') THEN
  NEW.json:=jsonb_set(NEW.json,'{promotions}',coalesce(NEW.json->'promotions','{}')||jsonb_build_object('commercialPolicy',OLD.json#>'{promotions,commercialPolicy}'),true);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sahten_private.retain_commercial_policy() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sahten_retain_commercial_policy ON public.menus;
CREATE TRIGGER sahten_retain_commercial_policy BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION sahten_private.retain_commercial_policy();
