-- Checkout-only Fatay 4U product at its existing registered fixed price.
-- Run only AFTER the new storefront hides upsellOnly products from public listing.
-- It replaces one 3U combo; no extra percentage promotional discount.
DO $publish$
DECLARE
 sid uuid; pid uuid; menu_json jsonb; project_data jsonb;
 four jsonb; rule jsonb; next_menu jsonb; next_project jsonb;
BEGIN
 SELECT id,project_id INTO sid,pid FROM public.stores WHERE slug='sahten';
 IF sid IS NULL OR pid IS NULL THEN RAISE EXCEPTION 'store_not_found';END IF;
 SELECT json INTO menu_json FROM public.menus WHERE store_id=sid FOR UPDATE;
 SELECT data INTO project_data FROM public.projects WHERE id=pid FOR UPDATE;
 IF jsonb_array_length(menu_json->'products')<>47
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(menu_json->'products') x WHERE x->>'id'='p1779570052552')
 THEN RAISE EXCEPTION 'unexpected_live_catalog_revision';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(menu_json->'products') x
    WHERE x->>'id'='p1779467294622' AND x->>'price'='16850')
 THEN RAISE EXCEPTION 'three_fatay_pricing_changed';END IF;
 SELECT x INTO four FROM jsonb_array_elements(project_data#>'{catalog,productos}') x
 WHERE x->>'id'='p1779570052552';
 IF four IS NULL OR four->>'name'<>'Fatay con la Cuarta (4U)'
    OR four#>>'{fixedPrices,mostrador}'<>'18500'
    OR four->>'category'<>'Entradas'
 THEN RAISE EXCEPTION 'four_fatay_catalog_validation_failed';END IF;
 SELECT x INTO rule FROM jsonb_array_elements(project_data#>'{promotions,productUpgrades}') x
 WHERE x->>'id'='fatay-cuarta';
 IF rule IS NULL OR rule->>'triggerProductId'<>'p1779467294622'
    OR rule->>'replacementProductId'<>'p1779570052552'
    OR rule->>'kind'<>'replace_product'
    OR rule->>'extraPercent'<>'0'
 THEN RAISE EXCEPTION 'upgrading_rule_changed';END IF;
 IF menu_json#>>'{payments,benefit,percent}'<>'10'
    OR menu_json#>>'{promotions,enabled}'<>'true'
 THEN RAISE EXCEPTION 'payment_policy_changed';END IF;
 next_menu:=jsonb_set(menu_json,'{products}',(menu_json->'products')||jsonb_build_array(
  jsonb_build_object(
   'id','p1779570052552','name',four->>'name',
   'category','Entradas','price',18500,
   'image',null,'description','Cuatro Fatay · disponible únicamente al mejorar el combo de 3',
   'tags','[]'::jsonb,'upsellOnly',true,'upgradeFrom','p1779467294622',
   'priceRevision','47cdeabe-b6d7-4b1d-9d7e-7109ff2ebc26'
  )),true);
 next_menu:=jsonb_set(next_menu,'{config,productVisibility,p1779570052552}','false'::jsonb,true);
 UPDATE public.menus SET json=next_menu,updated_at=clock_timestamp() WHERE store_id=sid;
 next_project:=jsonb_set(project_data,'{promotions,productUpgrades}',(
  SELECT jsonb_agg(
   CASE WHEN x->>'id'='fatay-cuarta' THEN
    x||jsonb_build_object(
     'enabled',true,'status','active_checkout_only',
     'extraPercent',0,'commercialFloorException',true,
     'requireVerifiedTargetCost',false,
     'activationBlockers',jsonb_build_array('revisar_costo_completo_del_combo_4u'))
   ELSE x END
  )
  FROM jsonb_array_elements(project_data#>'{promotions,productUpgrades}') x),true);
 UPDATE public.projects SET data=next_project WHERE id=pid;
 IF (SELECT jsonb_array_length(json->'products') FROM public.menus WHERE store_id=sid)<>48
    OR NOT EXISTS(SELECT 1 FROM public.menus m CROSS JOIN LATERAL jsonb_array_elements(m.json->'products') p
       WHERE m.store_id=sid AND p->>'id'='p1779570052552'
       AND p->>'upsellOnly'='true' AND p->>'upgradeFrom'='p1779467294622'
       AND p->>'price'='18500')
 THEN RAISE EXCEPTION 'verification_failed'; END IF;
END;
$publish$;