-- Reusar en la cotización la revisión privada autorizada para cada programa.
-- No se incluyen estos datos en la API pública ni en la respuesta al navegador.
CREATE OR REPLACE FUNCTION public.sahten_customer_coupon_lookup(
 p_store_id uuid,p_digest text,p_phone text,p_request_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.promotion_coupons; program_terms jsonb; doc jsonb; costs jsonb;
        cash_pct numeric; mp_pct numeric; mp_fee numeric;
        approvals jsonb:='{}'::jsonb;
BEGIN
 PERFORM sahten_private.assert_coupon_phone(p_store_id,p_digest,p_phone);
 SELECT * INTO c FROM sahten_private.promotion_coupons
 WHERE store_id=p_store_id AND code_digest=p_digest AND expires_at>now()
  AND (status='available' OR status='reserved' AND (reserved_until<now() OR reserved_request_id=p_request_id));
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false);END IF;
 IF c.channel='online' AND c.program IN ('first_online','second_online') THEN
  SELECT terms INTO program_terms FROM sahten_private.loyalty_programs WHERE store_id=p_store_id AND id=c.program;
  IF jsonb_typeof(program_terms->'coverageReview')='object'
    AND c.terms-ARRAY['eligibleProductIds','coverageReview']=program_terms-ARRAY['eligibleProductIds','coverageReview'] THEN
   SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id;
   costs:=public.sahten_promotion_costs(p_store_id,'online');
   cash_pct:=(c.terms->>'totalPercent')::numeric;
   mp_pct:=CASE WHEN c.terms#>>'{mercadopago,enabled}'='true' THEN (c.terms#>>'{mercadopago,totalPercent}')::numeric END;
   mp_fee:=coalesce((doc#>>'{promotions,commercialPolicy,mercadopagoFeePercent}')::numeric,(doc#>>'{promotions,checkoutProFeePercent}')::numeric,10);
   SELECT coalesce(jsonb_object_agg(p->>'id',jsonb_strip_nulls(jsonb_build_object('price',v.price,
    'cashPercent',CASE WHEN cash_pct>0 AND (v.price*(1-cash_pct/100)-0.01)*(1-v.floor_pct/100)>=v.cost THEN cash_pct END,
    'mpPercent',CASE WHEN mp_pct>0 AND mp_fee BETWEEN 0 AND 99.99 AND (v.price*(1-mp_pct/100)*(1-mp_fee/100)-0.02)*(1-v.floor_pct/100)>=v.cost THEN mp_pct END,
    'mpFeePercent',mp_fee))),'{}'::jsonb)
   INTO approvals FROM jsonb_array_elements(doc->'products') p
   CROSS JOIN LATERAL (SELECT sahten_private.reviewed_loyalty_basis(p_store_id,p,program_terms#>ARRAY['coverageReview',p->>'id'],(costs->>(p->>'id'))::numeric) value) r
   CROSS JOIN LATERAL (SELECT (p->>'price')::numeric price,(r.value->>'cost')::numeric cost,(r.value->>'marginFloor')::numeric floor_pct) v
   WHERE p->>'id'=ANY(c.eligible_product_ids) AND r.value IS NOT NULL;
  END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'id',c.id,'name',c.name,'status','available','program',c.program,'channel',c.channel,
  'expiresOn',to_char(c.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'),
  'extraPercent',c.extra_percent,'totalPercent',c.terms->'totalPercent','mercadopago',c.terms->'mercadopago',
  'maxExtraAmount',c.max_extra_amount,'minEligibleSubtotal',c.min_eligible_subtotal,'productIds',c.eligible_product_ids,'coverageApproval',approvals);
END $$;
REVOKE ALL ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text,uuid) TO service_role;
