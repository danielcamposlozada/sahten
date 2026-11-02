-- Make verified online-only discounts eligible as NEXT-purchase ads on
-- customer tickets. This changes advertising placement, NOT pricing/activation.
DO $ticket$
DECLARE sid uuid; current_menu jsonb; campaigns jsonb; ids text[]:=ARRAY[
 'postres-extra-online-nov26','postres-mamul-extra-nov26',
 'fatay-adicional-moderado-nov26','falafel-mix-moderado-nov26'];
 cid text; message text; changed integer; after_menu jsonb;
BEGIN
 SELECT s.id INTO sid FROM public.stores s WHERE s.slug='sahten';
 IF sid IS NULL THEN RAISE EXCEPTION 'store_not_found';END IF;
 SELECT json INTO current_menu FROM public.menus WHERE store_id=sid FOR UPDATE;
 IF jsonb_array_length(current_menu#>'{promotions,campaigns}')<>6
    OR coalesce(current_menu#>>'{promotions,ticket,enabled}','false')<>'true'
 THEN RAISE EXCEPTION 'menu_or_ticket_state_changed';END IF;
 FOREACH cid IN ARRAY ids LOOP
  IF (SELECT count(*) FROM jsonb_array_elements(current_menu#>'{promotions,campaigns}') v
   WHERE v->>'id'=cid AND v->>'enabled'='true' AND v->'channels' ? 'online')<>1
  THEN RAISE EXCEPTION 'campaign_not_verified:%',cid; END IF;
 END LOOP;
 SELECT jsonb_agg(CASE WHEN c->>'id'=ANY(ids) THEN
     jsonb_set(jsonb_set(c,'{advertising,placement}',
       coalesce(c#>'{advertising,placement}','[]'::jsonb)||'"ticket"'::jsonb,true),
      '{advertising,message}',
      to_jsonb(CASE c->>'id'
       WHEN 'postres-extra-online-nov26' THEN 'En tu próxima compra online: Baklava o torta con 12% total al pagar en efectivo o transferencia.'
       WHEN 'postres-mamul-extra-nov26' THEN 'En tu próxima compra online: Mamul de Nuez o Dátil con 12% total en efectivo o transferencia.'
       WHEN 'fatay-adicional-moderado-nov26' THEN 'En tu próxima compra online: Fatay individual con 11% total en efectivo o transferencia.'
       ELSE 'En tu próxima compra online: Falafel Mix con 11% total en efectivo o transferencia.' END),true)
     ELSE c END ORDER BY ord) INTO campaigns
 FROM jsonb_array_elements(current_menu#>'{promotions,campaigns}') WITH ORDINALITY a(c,ord);
 -- The menu has a BEFORE UPDATE trigger that restores published draft
 -- campaigns from this ledger. Update the ledger FIRST, then the menu.
 UPDATE sahten_catalog_private.promotion_draft_publications p SET
 campaign=c.item
 FROM jsonb_array_elements(campaigns) AS c(item)
 WHERE p.store_id=sid AND p.campaign_id=c.item->>'id'
   AND p.campaign_id=ANY(ids);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>4 THEN RAISE EXCEPTION 'ledger_not_updated:%',changed;END IF;
 UPDATE public.menus
 SET json=jsonb_set(current_menu,'{promotions,campaigns}',campaigns,true),
 updated_at=clock_timestamp()
 WHERE store_id=sid;
 SELECT json INTO after_menu FROM public.menus WHERE store_id=sid;
 IF jsonb_array_length(after_menu->'products')<>47
    OR jsonb_array_length(after_menu#>'{promotions,campaigns}')<>6
    OR (SELECT count(*) FROM jsonb_array_elements(after_menu#>'{promotions,campaigns}') x
         WHERE x->>'id'=ANY(ids) AND x#>'{advertising,placement}' ? 'ticket')<>4
 THEN RAISE EXCEPTION 'ticket_advertising_readback_failed';END IF;
END;
$ticket$;
