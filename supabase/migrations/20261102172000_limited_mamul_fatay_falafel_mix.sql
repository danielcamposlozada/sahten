-- Exceptional, limited cash/transfer price promotion. Owner authorized commercial
-- floor exceptions, NOT security / coupon or checkout exceptions.
-- Every published rule is validated against the private live project costs.
DO $launch$
DECLARE sid uuid; aid uuid; doc jsonb; prices jsonb; live jsonb; base numeric;
  val jsonb; p jsonb; sku text; real_cost numeric; list_price numeric; extra numeric;
  cost_buffer numeric; net numeric; minimum numeric; rule_id text;
  rule jsonb; specs jsonb;
BEGIN
 SELECT id,owner INTO sid,aid FROM public.stores WHERE slug='sahten';
 IF sid IS NULL OR aid IS NULL THEN RAISE EXCEPTION 'no_owner_or_store';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=sid FOR UPDATE;
 IF doc#>>'{promotions,enabled}'<>'true' OR
    doc#>>'{payments,benefit,percent}'<>'10' OR
    doc#>>'{payments,benefit,enabled}'<>'true'
 THEN RAISE EXCEPTION 'storefront_payment_policy_changed';END IF;
 prices:=public.sahten_promotion_costs(sid,'online');
 specs:=jsonb_build_array(
 jsonb_build_object('id','postres-mamul-extra-nov26','name','Mamul de Nuez o Dátil · 12% total',
  'productIds',jsonb_build_array('mamul_nuez','mamul_datil'),'extraPercent',2,
  'minimumMargin',38,'reservedExtraCost',150),
 jsonb_build_object('id','fatay-adicional-moderado-nov26','name','Fatay individual · 11% total',
  'productIds',jsonb_build_array('fatay'),'extraPercent',1,
  'minimumMargin',31,'reservedExtraCost',150),
 jsonb_build_object('id','falafel-mix-moderado-nov26','name','Falafel Mix · 11% total',
  'productIds',jsonb_build_array('falafel_mix'),'extraPercent',1,
  'minimumMargin',42,'reservedExtraCost',150)
 );
 FOR val IN SELECT x FROM jsonb_array_elements(specs) x LOOP
   rule_id:=val->>'id';
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(doc#>'{promotions,campaigns}') x
     WHERE x->>'id'=rule_id)
   THEN RAISE EXCEPTION 'already_enabled:%',rule_id; END IF;
   IF EXISTS(SELECT 1 FROM sahten_catalog_private.promotion_draft_publications x
    WHERE x.store_id=sid AND x.campaign_id=rule_id)
   THEN RAISE EXCEPTION 'ledger_duplicate:%',rule_id; END IF;
   extra:=(val->>'extraPercent')::numeric;
   minimum:=(val->>'minimumMargin')::numeric;
   cost_buffer:=(val->>'reservedExtraCost')::numeric;
   FOR sku IN SELECT jsonb_array_elements_text(val->'productIds') LOOP
     SELECT x INTO p FROM jsonb_array_elements(doc->'products') x WHERE x->>'id'=sku;
     IF p IS NULL OR p#>>'{salesAvailability,paused}'='true'
       OR COALESCE(p->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
       OR COALESCE(prices->>sku,'') !~ '^[0-9]+([.][0-9]+)?$'
     THEN RAISE EXCEPTION 'published_cost_price_missing:%',sku;END IF;
     list_price:=(p->>'price')::numeric;
     real_cost:=(prices->>sku)::numeric;
     IF list_price<> CASE sku
        WHEN 'mamul_nuez' THEN 7000
        WHEN 'mamul_datil' THEN 7000
        WHEN 'fatay' THEN 5850
        WHEN 'falafel_mix' THEN 8950 END
     THEN RAISE EXCEPTION 'unexpected_price:%',sku;END IF;
     net:=list_price*(100-10-extra)/100;
     IF net<=0 OR (net-real_cost)/net*100<minimum
       OR (net-real_cost-cost_buffer)/net*100 <
            CASE sku WHEN 'fatay' THEN 28
                 WHEN 'falafel_mix' THEN 40
                 ELSE 35 END
     THEN RAISE EXCEPTION 'commercial_exception_floor_not_met:%',sku;END IF;
   END LOOP;
   rule:=jsonb_build_object(
      'id',rule_id,'kind','public','name',val->>'name','enabled',true,
      'channels',jsonb_build_array('online'),'priority',34,
      'productIds',val->'productIds','extraPercent',extra,'maxUnits',1,
      'minMarginPct',minimum,'requiresVerifiedCosts',true,
      'advertising',jsonb_build_object('enabled',true,
        'placement',jsonb_build_array('cart','checkout'),
        'message',val->>'name'),
      'commercialFloorException',true,'ownerDelegatedApproval','2026-11-02'
   );
   INSERT INTO sahten_catalog_private.promotion_draft_publications
     (store_id,campaign_id,campaign,published_by)
   VALUES (sid,rule_id,rule,aid);
 END LOOP;
 UPDATE public.menus SET json=doc,updated_at=clock_timestamp() WHERE store_id=sid;
 IF (SELECT jsonb_array_length(json#>'{promotions,campaigns}')
    FROM public.menus WHERE store_id=sid)<>6
 THEN RAISE EXCEPTION 'publication_readback_failed';END IF;
END;
$launch$;