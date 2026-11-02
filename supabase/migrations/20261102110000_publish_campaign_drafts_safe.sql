-- Publish NEW, verified online discount campaigns from local drafts.
-- Never touches prices, photos, orders, MP, coupon issuance or the base 10% benefit.
CREATE TABLE IF NOT EXISTS sahten_catalog_private.promotion_draft_publications (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id text NOT NULL CHECK (campaign_id ~ '^[a-z0-9][a-z0-9_-]{2,50}$'),
  campaign jsonb NOT NULL,
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (store_id,campaign_id)
);
ALTER TABLE sahten_catalog_private.promotion_draft_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_catalog_private.promotion_draft_publications FROM PUBLIC, anon, authenticated;

-- An ordinary menu sync must not silently erase a campaign published independently.
-- The existing promotion-state trigger runs afterwards and retains live pauses.
CREATE OR REPLACE FUNCTION sahten_catalog_private.retain_published_draft_campaigns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp AS $$
DECLARE base_campaigns jsonb;
DECLARE saved_campaigns jsonb;
BEGIN
  IF jsonb_typeof(NEW.json#>'{promotions,campaigns}') IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(jsonb_agg(c ORDER BY ord),'[]'::jsonb) INTO base_campaigns
  FROM jsonb_array_elements(NEW.json#>'{promotions,campaigns}') WITH ORDINALITY source(c,ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM sahten_catalog_private.promotion_draft_publications p
    WHERE p.store_id=NEW.store_id AND p.campaign_id=c->>'id'
  );
  SELECT COALESCE(jsonb_agg(campaign ORDER BY campaign_id),'[]'::jsonb)
    INTO saved_campaigns
  FROM sahten_catalog_private.promotion_draft_publications
  WHERE store_id=NEW.store_id;
  NEW.json:=jsonb_set(NEW.json,'{promotions,campaigns}',base_campaigns||saved_campaigns,true);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sahten_catalog_private.retain_published_draft_campaigns() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sahten_menu_campaign_draft_publications ON public.menus;
CREATE TRIGGER sahten_menu_campaign_draft_publications
BEFORE INSERT OR UPDATE ON public.menus FOR EACH ROW
EXECUTE FUNCTION sahten_catalog_private.retain_published_draft_campaigns();

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
  IF pct<=0 OR pct>10 OR priority_num>100
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
  IF base_pct<0 OR base_pct+pct>20 THEN RAISE EXCEPTION 'campaign_discount_limit'; END IF;

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
    -- 40% contribution margin after the normal benefit and the added discount.
    IF cost>unit_price*(1-(base_pct+pct)/100)*(1-min_margin/100)
    THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',pid; END IF;
  END LOOP;
  clean:=jsonb_build_object(
    'id',campaign_id,'kind','public','name',campaign_name,'enabled',false,
    'priority',priority_num,'extraPercent',pct,'channels',jsonb_build_array('online'),
    'productIds',p_campaign->'productIds','schedule',schedule_doc,
    'minMarginPct',min_margin,'requiresVerifiedCosts',true,
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
