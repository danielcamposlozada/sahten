-- Emergency, limited storefront promotion. Does NOT enable coupon redemption or upgrades.
-- Security: only known published SKUs, current fixed+variable costs, 45% base
-- contribution floor and ARS 250 additional per-unit reserve (= >40% after reserve).
-- The additional two percentage points apply to ONE unit per product per order.
-- Client preview is indicative; the server quote requires the actual cost snapshot.
DO $rollout$
DECLARE sid uuid; owner_id uuid; current_menu jsonb; costs jsonb;
  doc jsonb; pid text; price numeric; cost numeric;
  expected_price numeric; net numeric; campaign jsonb;
  cid text:='postres-extra-online-nov26';
BEGIN
 SELECT id,owner INTO sid,owner_id FROM public.stores WHERE slug='sahten';
 IF sid IS NULL OR owner_id IS NULL
 THEN RAISE EXCEPTION 'store_not_ready'; END IF;
 SELECT json INTO current_menu FROM public.menus WHERE store_id=sid FOR UPDATE;
 IF current_menu IS NULL OR current_menu#>>'{promotions,enabled}'<>'true'
    OR current_menu#>>'{payments,benefit,enabled}'<>'true'
    OR current_menu#>>'{payments,benefit,percent}'<>'10'
 THEN RAISE EXCEPTION 'unsafe_checkout_or_payment_state'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(
      COALESCE(current_menu#>'{promotions,campaigns}','[]'::jsonb)) x
     WHERE x->>'id'=cid)
 THEN RAISE EXCEPTION 'dessert_campaign_already_exists'; END IF;
 IF EXISTS(SELECT 1 FROM sahten_catalog_private.promotion_draft_publications
    WHERE store_id=sid AND campaign_id=cid)
 THEN RAISE EXCEPTION 'dessert_campaign_ledger_conflict'; END IF;
 costs:=public.sahten_promotion_costs(sid,'online');
 FOREACH pid IN ARRAY ARRAY['baklava','torta_de_chocolate'] LOOP
   expected_price:=CASE pid WHEN 'baklava' THEN 7350
     WHEN 'torta_de_chocolate' THEN 8200 END;
   SELECT x INTO doc FROM jsonb_array_elements(current_menu->'products') x
   WHERE x->>'id'=pid;
   IF doc IS NULL OR doc->>'price' IS NULL OR
      COALESCE(doc->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
      OR COALESCE(doc#>>'{salesAvailability,retired}','false')='true'
      OR COALESCE(doc#>>'{salesAvailability,paused}','false')='true'
   THEN RAISE EXCEPTION 'product_unavailable:%',pid; END IF;
   price:=(doc->>'price')::numeric;
   IF price<>expected_price OR
      COALESCE(costs->>pid,'') !~ '^[0-9]+([.][0-9]+)?$'
   THEN RAISE EXCEPTION 'cost_or_price_revision_required:%',pid; END IF;
   cost:=(costs->>pid)::numeric;
   net:=price*0.88; -- 10% habitual + 2 puntos adicionales.
   IF net<=0 OR (net-cost)/net<0.45
      OR (net-cost-250)/net<0.40
   THEN RAISE EXCEPTION 'minimum_margin_or_cost_buffer_failed:%',pid; END IF;
 END LOOP;
 campaign:=jsonb_build_object(
  'id',cid,'kind','public','name','Postres seleccionados · 12% con efectivo o transferencia',
  'enabled',true,'priority',35,'channels',jsonb_build_array('online'),
  'productIds',jsonb_build_array('baklava','torta_de_chocolate'),
  'extraPercent',2,'maxUnits',1,'minMarginPct',45,
  'requiresVerifiedCosts',false,
  'advertising',jsonb_build_object('enabled',true,
    'message','Baklava y torta · 12% total al pagar en efectivo o transferencia.',
    'placement',jsonb_build_array('cart','checkout')),
  'publicationSource','owner_delegated_emergency_20261102',
  'verifiedCostsAtPublication',true
 );
 INSERT INTO sahten_catalog_private.promotion_draft_publications
   (store_id,campaign_id,campaign,published_by)
 VALUES (sid,cid,campaign,owner_id);
 -- The existing retention trigger appends the approved new rule without
 -- overwriting pre-existing campaigns, price lists, photos or recommendations.
 UPDATE public.menus SET json=current_menu,updated_at=clock_timestamp()
 WHERE store_id=sid;
 IF NOT EXISTS(SELECT 1 FROM public.menus m,
    LATERAL jsonb_array_elements(m.json#>'{promotions,campaigns}') v
    WHERE m.store_id=sid AND v->>'id'=cid AND v->>'enabled'='true')
 THEN RAISE EXCEPTION 'campaign_publish_readback_failed'; END IF;
END
$rollout$;