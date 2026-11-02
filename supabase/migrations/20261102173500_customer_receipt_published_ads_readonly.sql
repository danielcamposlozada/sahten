-- Read only, authenticated, published campaign advertising for customer receipt.
-- Never exposes private cost, coupon digests, drafts, or customer data.
CREATE OR REPLACE FUNCTION public.get_store_ticket_promotions(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp
AS $$
DECLARE menu_json jsonb; promos jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND
   (s.owner=auth.uid() OR public.has_project_role(s.project_id,
      ARRAY['owner','admin','encargado','cajero','lectura']))
 ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT json INTO menu_json FROM public.menus WHERE store_id=p_store_id;
 IF menu_json IS NULL THEN RAISE EXCEPTION 'store_menu_missing';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',c.item->>'id','name',c.item->>'name','kind','public',
  'enabled',coalesce(st.enabled,(c.item->>'enabled')::boolean,false),
  'channels',coalesce(c.item->'channels','[]'::jsonb),
  'schedule',c.item->'schedule',
  'advertising',c.item->'advertising',
  'priority',coalesce(c.item->'priority','0'::jsonb)
 ) ORDER BY c.ordinal),'[]'::jsonb) INTO promos
 FROM jsonb_array_elements(coalesce(menu_json#>'{promotions,campaigns}','[]'::jsonb))
   WITH ORDINALITY c(item,ordinal)
 LEFT JOIN sahten_catalog_private.promotion_campaign_states st
   ON st.store_id=p_store_id AND st.campaign_id=c.item->>'id'
 WHERE coalesce(c.item#>>'{advertising,enabled}','false')='true'
   AND coalesce(c.item#>'{advertising,placement}','[]'::jsonb) ? 'ticket';
 RETURN jsonb_build_object('enabled',coalesce(menu_json#>>'{promotions,enabled}','false')='true',
   'ticket',coalesce(menu_json#>'{promotions,ticket}','{}'::jsonb),'campaigns',promos,
   'source','published_server');
END;
$$;
REVOKE ALL ON FUNCTION public.get_store_ticket_promotions(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_ticket_promotions(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_store_ticket_promotions(uuid) IS
 'Read-only published ticket ads for authenticated store personnel. No drafts, private costs or coupon issuance.';
