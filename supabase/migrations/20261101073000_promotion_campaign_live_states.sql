-- DRAFT / NOT DEPLOYED: isolated live toggles for existing published promotional campaigns.
-- Never republishes prices, products, photos, coupons, delivery, or payment methods.
CREATE TABLE IF NOT EXISTS sahten_catalog_private.promotion_campaign_states (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_id text NOT NULL CHECK (length(campaign_id) BETWEEN 1 AND 100),
  enabled boolean NOT NULL,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  PRIMARY KEY (store_id, campaign_id)
);
ALTER TABLE sahten_catalog_private.promotion_campaign_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_catalog_private.promotion_campaign_states FROM PUBLIC, anon, authenticated;

-- A stale full-menu upload must not undo a separately confirmed live pause.
CREATE OR REPLACE FUNCTION sahten_catalog_private.protect_promotion_campaign_states()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, sahten_catalog_private, pg_temp AS $$
DECLARE merged jsonb;
BEGIN
  IF jsonb_typeof(NEW.json #> '{promotions,campaigns}') <> 'array' THEN RETURN NEW; END IF;
  SELECT jsonb_agg(
    CASE WHEN operational.campaign_id IS NULL THEN campaign
      ELSE jsonb_set(campaign, '{enabled}', to_jsonb(operational.enabled), true) END ORDER BY ord
  ) INTO merged
  FROM jsonb_array_elements(NEW.json #> '{promotions,campaigns}') WITH ORDINALITY AS src(campaign,ord)
  LEFT JOIN sahten_catalog_private.promotion_campaign_states operational
    ON operational.store_id = NEW.store_id AND operational.campaign_id = campaign->>'id';
  IF merged IS NOT NULL THEN
    NEW.json := jsonb_set(NEW.json, '{promotions,campaigns}', merged, true);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sahten_catalog_private.protect_promotion_campaign_states() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sahten_menu_promotion_campaign_states ON public.menus;
CREATE TRIGGER sahten_menu_promotion_campaign_states
  BEFORE INSERT OR UPDATE ON public.menus FOR EACH ROW
  EXECUTE FUNCTION sahten_catalog_private.protect_promotion_campaign_states();

-- Permissions: only owner/admin can change a campaign, including using an existing JWT.
CREATE OR REPLACE FUNCTION public.set_promotion_campaign_state(
  p_store_id uuid, p_campaign_id text, p_enabled boolean,
  p_expected_revision uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, sahten_catalog_private, pg_temp AS $$
DECLARE menu_record jsonb;
        prior sahten_catalog_private.promotion_campaign_states%ROWTYPE;
        found_prior boolean;
        next_revision uuid;
        stored_at timestamptz;
        stored_by uuid;
        matched int;
        updated_campaigns jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id=p_store_id
    AND (s.owner=auth.uid()
      OR public.has_project_role(s.project_id, ARRAY['owner','admin']))
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_enabled IS NULL OR p_campaign_id IS NULL
     OR length(p_campaign_id) NOT BETWEEN 1 AND 100
     OR p_campaign_id !~ '^[a-zA-Z0-9_-]+$'
  THEN RAISE EXCEPTION 'invalid_campaign_state'; END IF;
  SELECT json INTO menu_record FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
  IF NOT FOUND OR menu_record #>> '{promotions,enabled}' IS DISTINCT FROM 'true'
    OR jsonb_typeof(menu_record #> '{promotions,campaigns}') <> 'array'
  THEN RAISE EXCEPTION 'promotions_not_published'; END IF;
  SELECT count(*) INTO matched
    FROM jsonb_array_elements(menu_record #> '{promotions,campaigns}') campaign
    WHERE campaign->>'id'=p_campaign_id;
  IF matched <> 1 THEN RAISE EXCEPTION 'campaign_not_published'; END IF;
  SELECT * INTO prior FROM sahten_catalog_private.promotion_campaign_states
    WHERE store_id=p_store_id AND campaign_id=p_campaign_id FOR UPDATE;
  found_prior := FOUND;
  IF found_prior AND prior.enabled=p_enabled THEN
    RETURN jsonb_build_object('id',p_campaign_id,'enabled',p_enabled,
      'revision',prior.revision,'updatedAt',prior.updated_at,'unchanged',true);
  END IF;
  IF (found_prior AND prior.revision IS DISTINCT FROM p_expected_revision)
      OR (NOT found_prior AND p_expected_revision IS NOT NULL)
  THEN RAISE EXCEPTION 'promotion_state_conflict'; END IF;
  INSERT INTO sahten_catalog_private.promotion_campaign_states
    (store_id,campaign_id,enabled,updated_by)
    VALUES(p_store_id,p_campaign_id,p_enabled,auth.uid())
    ON CONFLICT (store_id,campaign_id) DO UPDATE
      SET enabled=EXCLUDED.enabled, revision=gen_random_uuid(),
          updated_at=clock_timestamp(), updated_by=EXCLUDED.updated_by
    RETURNING revision,updated_at,updated_by INTO next_revision,stored_at,stored_by;
  SELECT jsonb_agg(
    CASE WHEN campaign->>'id'=p_campaign_id
       THEN jsonb_set(campaign,'{enabled}',to_jsonb(p_enabled),true)
       ELSE campaign END ORDER BY ord
  ) INTO updated_campaigns
  FROM jsonb_array_elements(menu_record #> '{promotions,campaigns}')
    WITH ORDINALITY AS src(campaign,ord);
  UPDATE public.menus
    SET json=jsonb_set(menu_record,'{promotions,campaigns}',updated_campaigns,true),
        updated_at=clock_timestamp()
    WHERE store_id=p_store_id;
  RETURN jsonb_build_object('id',p_campaign_id,'enabled',p_enabled,
    'revision',next_revision,'updatedAt',stored_at,'unchanged',false);
END $$;
REVOKE ALL ON FUNCTION public.set_promotion_campaign_state(uuid,text,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_promotion_campaign_state(uuid,text,boolean,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_promotion_campaign_states(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, sahten_catalog_private, pg_temp AS $$
DECLARE menu_record jsonb;
        campaigns jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id=p_store_id
    AND (s.owner=auth.uid()
      OR public.has_project_role(s.project_id, ARRAY['owner','admin','encargado','cajero','lectura']))
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT json INTO menu_record FROM public.menus WHERE store_id=p_store_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',published.campaign->>'id',
    'enabled',coalesce(operational.enabled,(published.campaign->>'enabled')::boolean,false),
    'revision',operational.revision,
    'updatedAt',operational.updated_at
  ) ORDER BY published.ord),'[]'::jsonb) INTO campaigns
  FROM jsonb_array_elements(coalesce(menu_record #> '{promotions,campaigns}','[]'::jsonb))
       WITH ORDINALITY AS published(campaign,ord)
  LEFT JOIN sahten_catalog_private.promotion_campaign_states operational
    ON operational.store_id=p_store_id AND operational.campaign_id=published.campaign->>'id';
  RETURN jsonb_build_object(
    'published',coalesce(menu_record #>> '{promotions,enabled}','false')='true',
    'campaigns',campaigns
  );
END $$;
REVOKE ALL ON FUNCTION public.get_promotion_campaign_states(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_promotion_campaign_states(uuid) TO authenticated;
