-- First and second online rewards count and originate only from paid web orders.
-- CREATE OR REPLACE preserves existing grants and ownership.

CREATE OR REPLACE FUNCTION sahten_private.issue_phone_benefit(sid uuid,phone text,purpose text,origin uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE k text; pg sahten_private.loyalty_programs; c sahten_private.promotion_coupons; count_paid int; cid uuid; code text; expiry timestamptz;
BEGIN
 IF purpose NOT IN ('first_online','second_online') THEN RETURN NULL;END IF;
 SELECT * INTO pg FROM sahten_private.loyalty_programs WHERE store_id=sid AND id=purpose AND enabled;
 IF NOT FOUND OR nullif(pg.terms->>'startsOn','')::date>(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date OR nullif(pg.terms->>'endsOn','')::date<(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN RETURN NULL;END IF;
 k:=sahten_private.loyalty_key(sid,phone);
 PERFORM pg_advisory_xact_lock(hashtextextended(sid::text||k,0));
 SELECT count(*) INTO count_paid FROM public.orders o WHERE o.store_id=sid AND o.payload->>'source' IN ('pickup','delivery')
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(phone) AND sahten_private.loyalty_paid(o);
 IF purpose='first_online' AND count_paid<>0 OR purpose='second_online' AND count_paid<>1 THEN RETURN NULL;END IF;
 IF purpose='second_online' AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=origin AND o.store_id=sid AND o.payload->>'source' IN ('pickup','delivery') AND sahten_private.loyalty_paid(o)
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(phone)) THEN RETURN NULL;END IF;
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=sid AND customer_key=k AND program=purpose;
 IF NOT FOUND THEN
  cid:=gen_random_uuid();code:=sahten_private.loyalty_code(sid,cid);
  expiry:=(date_trunc('day',now() AT TIME ZONE 'America/Argentina/Buenos_Aires')+make_interval(days=>(pg.terms->>'validDays')::int)+interval '1 day'-interval '1 millisecond') AT TIME ZONE 'America/Argentina/Buenos_Aires';
  INSERT INTO sahten_private.promotion_coupons(id,store_id,code_digest,program,name,eligible_product_ids,min_eligible_subtotal,extra_percent,max_extra_amount,channel,origin_order_id,expires_at,customer_key,terms)
  VALUES(cid,sid,encode(sha256(convert_to(code,'UTF8')),'hex'),purpose,pg.terms->>'name',ARRAY(SELECT jsonb_array_elements_text(pg.terms->'eligibleProductIds')),
    (pg.terms->>'minEligibleSubtotal')::numeric,(pg.terms->>'extraPercent')::numeric,nullif(pg.terms->>'maxExtraAmount','')::numeric,'online',origin,expiry,k,pg.terms) RETURNING * INTO c;
 END IF;
 IF c.status<>'available' OR c.expires_at<=now() THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',c.id,'code',sahten_private.loyalty_code(sid,c.id),'status',c.status,'program',c.program,'name',c.name,
  'mercadopago',c.terms->'mercadopago','extraPercent',c.extra_percent,'totalPercent',(c.terms->>'totalPercent')::numeric,'paymentPercent',coalesce((c.terms->>'paymentPercent')::numeric,10),'minEligibleSubtotal',c.min_eligible_subtotal,
  'maxExtraAmount',c.max_extra_amount,'channel','online','productIds',c.eligible_product_ids,
  'expiresOn',to_char(c.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'));
END $$;

CREATE OR REPLACE FUNCTION public.sahten_phone_benefit(p_store_id uuid,p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE origin uuid; result jsonb;
BEGIN
 IF public.sahten_loyalty_phone(p_phone) IS NULL THEN RETURN NULL;END IF;
 result:=sahten_private.issue_phone_benefit(p_store_id,p_phone,'first_online');
 IF result IS NOT NULL THEN RETURN result;END IF;
 SELECT o.id INTO origin FROM public.orders o WHERE o.store_id=p_store_id AND o.payload->>'source' IN ('pickup','delivery') AND sahten_private.loyalty_paid(o)
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(p_phone) ORDER BY o.created_at LIMIT 1;
 RETURN sahten_private.issue_phone_benefit(p_store_id,p_phone,'second_online',origin);
END $$;

CREATE OR REPLACE FUNCTION sahten_private.assert_coupon_phone(sid uuid,dig text,phone text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.promotion_coupons; k text; n int;
BEGIN
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=sid AND code_digest=dig;
 IF NOT FOUND THEN RAISE EXCEPTION 'coupon_unavailable';END IF;
 IF c.customer_key IS NULL THEN
  IF c.program IN ('first_online','second_online') THEN RAISE EXCEPTION 'coupon_phone_required';END IF;
  RETURN;
 END IF;
 k:=sahten_private.loyalty_key(sid,phone);
 PERFORM pg_advisory_xact_lock(hashtextextended(sid::text||k,0));
 IF k<>c.customer_key THEN RAISE EXCEPTION 'coupon_unavailable';END IF;
 SELECT count(*) INTO n FROM public.orders o WHERE o.store_id=sid AND o.payload->>'source' IN ('pickup','delivery') AND sahten_private.loyalty_paid(o)
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(phone);
 IF c.program='first_online' AND n<>0 OR c.program='second_online' AND n<>1 THEN RAISE EXCEPTION 'coupon_ineligible';END IF;
 IF c.program='second_online' AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=c.origin_order_id AND o.store_id=sid AND o.payload->>'source' IN ('pickup','delivery') AND sahten_private.loyalty_paid(o) AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(phone)) THEN RAISE EXCEPTION 'coupon_origin_unpaid';END IF;
END $$;
