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
 price numeric; cost numeric; margin numeric; headroom numeric;
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
   IF pct<=0 OR pct>10 OR
      coalesce(p_draft->>'minEligibleSubtotal','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$' OR
      coalesce(p_draft->>'validDays','') !~ '^[0-9]{1,3}$' OR
      coalesce(p_draft->>'validDays','0')::numeric NOT BETWEEN 1 AND 365 OR
      (p_draft->>'maxExtraAmount' IS NOT NULL AND coalesce(p_draft->>'maxExtraAmount','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$')
   THEN terms_ok:=false;END IF;
 ELSE
   IF pct<=0 OR pct>10 THEN terms_ok:=false; END IF;
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
 IF total_pct>20 THEN terms_ok:=false; END IF;
 FOR target IN SELECT jsonb_array_elements_text(targets) LOOP
   n:=n+1;
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
          THEN round((price*(100-total_pct)/100)*0.6-cost,2) ELSE null END;
       IF margin IS NULL OR margin<40 THEN margins_ok:=false;END IF;
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
   jsonb_build_object('id','margin','ok',margins_ok AND n>0,'label','Margen estimado mínimo de 40% con descuento total','action','costs'),
   jsonb_build_object('id','additional','ok',false,'label','Envase, trabajo, merma, reparto y comisiones revisados','action','costs'),
   jsonb_build_object('id','checkout','ok',false,'label',CASE WHEN p_type='productUpgrades'
      THEN 'Reemplazo y cobro recotizados por servidor' WHEN p_type='couponPrograms'
      THEN 'Canje único ligado al pedido y prueba de pago/caja'
      ELSE 'Oferta aceptada y cobrada con cotización firmada' END,'action','checkout'),
   jsonb_build_object('id','publication','ok',false,'label','Habilitación comercial de esta regla en el checkout','action','checkout')
 );
 RETURN jsonb_build_object('type',p_type,'id',p_draft->>'id','checkedAt',clock_timestamp(),
   'draftFingerprint',md5(p_draft::text),'source','server','canPublish',false,'canActivate',false,
   'paymentBasePercent',base_pct,'totalPercent',total_pct,'minMarginPercent',40,
   'products',assessed,'checks',checks,
   'message','Verificación del menú y costo base completa. Falta aprobación de gastos incrementales y checkout transaccional. No se publicaron descuentos ni cupones.');
END
$$;
REVOKE ALL ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.verify_promotion_draft(uuid,text,jsonb) IS
 'Owner/admin only READ-ONLY draft preflight: live menu + private base cost economics. NEVER authorizes discount publication or coupon issuance.';
