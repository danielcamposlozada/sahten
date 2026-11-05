-- New programs are OFF until the owner explicitly publishes their terms.
ALTER TABLE sahten_private.promotion_coupons DROP CONSTRAINT IF EXISTS promotion_coupons_extra_percent_check;
ALTER TABLE sahten_private.promotion_coupons ADD CONSTRAINT promotion_coupons_extra_percent_check CHECK(extra_percent>0 AND extra_percent<=85);
-- Phone recognition is intentionally not identity verification (owner decision).
CREATE OR REPLACE FUNCTION public.sahten_loyalty_phone(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE n text:=regexp_replace(coalesce(value,''),'[^0-9]','','g'); international boolean:=trim(coalesce(value,'')) ~ '^(\+|00)';
BEGIN
 IF left(n,2)='00' THEN n:=substr(n,3);END IF;
 IF international AND left(n,2)<>'54' THEN RETURN CASE WHEN n ~ '^[1-9][0-9]{6,14}$' THEN '+'||n ELSE NULL END;END IF;
 IF international AND left(n,2)='54' AND length(n) NOT IN (12,13) THEN RETURN NULL;END IF;
 IF length(n)=13 AND left(n,3)='549' THEN n:=substr(n,4);
 ELSIF length(n)=12 AND left(n,2)='54' THEN n:=substr(n,3);
 ELSIF length(n)=11 AND left(n,1)='0' THEN n:=substr(n,2);END IF;
 IF length(n)=10 THEN RETURN '+54'||n;END IF;
 IF international AND n ~ '^[1-9][0-9]{10,14}$' THEN RETURN '+'||n;END IF;
 RETURN NULL;
END $$;
CREATE TABLE IF NOT EXISTS sahten_private.loyalty_store_keys(
 store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
 salt text NOT NULL DEFAULT (gen_random_uuid()::text||gen_random_uuid()::text));
CREATE TABLE IF NOT EXISTS sahten_private.loyalty_programs(
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 id text NOT NULL CHECK(id IN ('first_online','second_online')),
 terms jsonb NOT NULL, enabled boolean NOT NULL DEFAULT false,
 revision uuid NOT NULL DEFAULT gen_random_uuid(),updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid,
 PRIMARY KEY(store_id,id));
CREATE TABLE IF NOT EXISTS sahten_private.order_collections(
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
 store_id uuid NOT NULL REFERENCES public.stores(id),amount numeric(14,2) NOT NULL CHECK(amount>0),
 method text NOT NULL CHECK(method IN ('efectivo','transferencia')),
 confirmed_by uuid NOT NULL,confirmed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE sahten_private.promotion_coupons ADD COLUMN IF NOT EXISTS customer_key text;
ALTER TABLE sahten_private.promotion_coupons ADD COLUMN IF NOT EXISTS terms jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS coupon_customer_program_once ON sahten_private.promotion_coupons(store_id,customer_key,program)
 WHERE customer_key IS NOT NULL AND program IN ('first_online','second_online');
ALTER TABLE sahten_private.loyalty_store_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sahten_private.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sahten_private.order_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_private.loyalty_store_keys,sahten_private.loyalty_programs,sahten_private.order_collections FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION sahten_private.loyalty_key(sid uuid,phone text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE secret text; n text:=public.sahten_loyalty_phone(phone);
BEGIN
 IF n IS NULL THEN RAISE EXCEPTION 'invalid_loyalty_phone';END IF;
 INSERT INTO sahten_private.loyalty_store_keys(store_id) VALUES(sid) ON CONFLICT DO NOTHING;
 SELECT salt INTO secret FROM sahten_private.loyalty_store_keys WHERE store_id=sid;
 RETURN encode(sha256(convert_to(secret||':'||n,'UTF8')),'hex');
END $$;
CREATE OR REPLACE FUNCTION sahten_private.loyalty_code(sid uuid,cid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,sahten_private AS $$
 SELECT 'SHT-'||translate(substr(encode(sha256(convert_to(salt||':coupon:'||cid::text,'UTF8')),'hex'),1,16),'0123456789abcdef','ABCDEFGHJKLMNPQR')
 FROM sahten_private.loyalty_store_keys WHERE store_id=sid;
$$;
CREATE OR REPLACE FUNCTION sahten_private.loyalty_paid(o public.orders) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,sahten_private AS $$
 SELECT o.status<>'cancelado' AND o.payment_status='paid' AND
 ((o.payment_provider='mercadopago' AND o.payment_ref IS NOT NULL) OR
 (o.payment_provider='manual' AND EXISTS(SELECT 1 FROM sahten_private.order_collections c WHERE c.order_id=o.id AND c.store_id=o.store_id)));
$$;

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
 IF purpose='second_online' AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=origin AND o.store_id=sid AND sahten_private.loyalty_paid(o)
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
 SELECT o.id INTO origin FROM public.orders o WHERE o.store_id=p_store_id AND sahten_private.loyalty_paid(o)
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(p_phone) ORDER BY o.created_at LIMIT 1;
 RETURN sahten_private.issue_phone_benefit(p_store_id,p_phone,'second_online',origin);
END $$;
REVOKE ALL ON FUNCTION public.sahten_phone_benefit(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_phone_benefit(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_store_loyalty_programs(p_store_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'enabled',enabled,'revision',revision,'terms',terms)) FROM sahten_private.loyalty_programs WHERE store_id=p_store_id),'[]');
END $$;
CREATE OR REPLACE FUNCTION public.set_store_loyalty_program(p_store_id uuid,p_program text,p_terms jsonb,p_enabled boolean,p_expected_revision uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE doc jsonb; prior sahten_private.loyalty_programs; rev uuid:=gen_random_uuid(); target_id text; cost numeric; price numeric; rule jsonb; total numeric; payment numeric; mp jsonb; fee numeric; mp_total numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF p_program NOT IN ('first_online','second_online') OR p_enabled IS NULL OR jsonb_typeof(p_terms) IS DISTINCT FROM 'object' OR length(p_terms::text)>12000
 OR length(trim(p_terms->>'name')) NOT BETWEEN 4 AND 100 OR p_terms->>'name' IS NULL
 OR (p_terms->>'extraPercent')::numeric NOT BETWEEN 0.01 AND 85 OR p_terms->>'extraPercent' IS NULL
 OR (p_terms->>'minEligibleSubtotal')::numeric<0 OR p_terms->>'minEligibleSubtotal' IS NULL
 OR coalesce(p_terms->>'validDays','') !~ '^[0-9]+$' OR (p_terms->>'validDays')::int NOT BETWEEN 1 AND 365 OR p_terms->>'validDays' IS NULL
 OR nullif(p_terms->>'maxExtraAmount','')::numeric<0
 OR jsonb_typeof(p_terms->'eligibleProductIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_terms->'eligibleProductIds') NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'invalid_loyalty_terms';END IF;
 IF nullif(p_terms->>'startsOn','')::date> nullif(p_terms->>'endsOn','')::date THEN RAISE EXCEPTION 'invalid_program_dates';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR UPDATE;
 IF doc IS NULL THEN RAISE EXCEPTION 'store_menu_missing';END IF;
 IF p_enabled AND (doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true' OR doc#>>'{payments,benefit,enabled}' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'promotions_not_published';END IF;
 payment:=coalesce((doc#>>'{payments,benefit,percent}')::numeric,0);
 IF p_terms ? 'paymentPercent' AND (p_terms->>'paymentPercent')::numeric<>payment THEN RAISE EXCEPTION 'loyalty_payment_changed';END IF;
 total:=payment+(p_terms->>'extraPercent')::numeric;
 IF p_terms ? 'totalPercent' AND (p_terms->>'totalPercent')::numeric<>total THEN RAISE EXCEPTION 'invalid_loyalty_total';END IF;
 p_terms:=p_terms||jsonb_build_object('totalPercent',total);
 mp:=p_terms->'mercadopago';
 IF mp IS NOT NULL AND (jsonb_typeof(mp) IS DISTINCT FROM 'object' OR jsonb_typeof(mp->'enabled') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'invalid_mercadopago_terms';END IF;
 IF mp->>'enabled'='true' THEN
  IF jsonb_typeof(mp->'totalPercent') IS DISTINCT FROM 'number' OR (mp->>'totalPercent')::numeric NOT BETWEEN 0.01 AND 95
   OR jsonb_typeof(mp->'minEligibleSubtotal') IS DISTINCT FROM 'number' OR (mp->>'minEligibleSubtotal')::numeric<0
   OR (mp->>'maxExtraAmount' IS NOT NULL AND (jsonb_typeof(mp->'maxExtraAmount') IS DISTINCT FROM 'number' OR (mp->>'maxExtraAmount')::numeric<=0))
  THEN RAISE EXCEPTION 'invalid_mercadopago_terms';END IF;
  mp_total:=(mp->>'totalPercent')::numeric;
  fee:=coalesce((doc#>>'{promotions,commercialPolicy,mercadopagoFeePercent}')::numeric,(doc#>>'{promotions,checkoutProFeePercent}')::numeric,10);
 END IF;
 FOR target_id IN SELECT jsonb_array_elements_text(p_terms->'eligibleProductIds') LOOP
  SELECT (p->>'price')::numeric INTO price FROM jsonb_array_elements(doc->'products') p WHERE p->>'id'=target_id;
  cost:=((public.sahten_promotion_costs(p_store_id,'online'))->>target_id)::numeric;
  rule:=public.sahten_promotion_rule(doc,target_id);
  IF p_enabled AND (price IS NULL OR price<=0) THEN RAISE EXCEPTION 'product_not_published:%',target_id;END IF;
  IF p_enabled AND cost IS NULL THEN RAISE EXCEPTION 'promotion_cost_missing:%',target_id;END IF;
  IF p_enabled AND total>(rule->>'maxTotalPercent')::numeric THEN RAISE EXCEPTION 'campaign_discount_limit:%',target_id;END IF;
  IF p_enabled AND cost>price*(1-total/100)*(1-(rule->>'minMarginPct')::numeric/100) THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',target_id;END IF;
  IF p_enabled AND mp_total IS NOT NULL AND (mp_total>(rule->>'maxTotalPercent')::numeric OR cost>price*(1-mp_total/100)*(1-fee/100)*(1-(rule->>'minMarginPct')::numeric/100)) THEN RAISE EXCEPTION 'mercadopago_margin_below_minimum:%',target_id;END IF;
 END LOOP;
 SELECT * INTO prior FROM sahten_private.loyalty_programs WHERE store_id=p_store_id AND id=p_program FOR UPDATE;
 IF prior.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'loyalty_program_conflict' USING ERRCODE='40001';END IF;
 p_terms:=p_terms||jsonb_build_object('paymentPercent',payment);
 INSERT INTO sahten_private.loyalty_programs(store_id,id,terms,enabled,revision,updated_by) VALUES(p_store_id,p_program,p_terms,p_enabled,rev,auth.uid())
 ON CONFLICT(store_id,id) DO UPDATE SET terms=excluded.terms,enabled=excluded.enabled,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO sahten_private.promotion_changes(store_id,actor,action,detail) SELECT id,auth.uid(),'loyalty_program_saved',jsonb_build_object('program',p_program,'before',prior.terms,'after',p_terms,'enabled',p_enabled) FROM public.stores WHERE id=p_store_id;
 RETURN jsonb_build_object('saved',true,'revision',rev);
END $$;
REVOKE ALL ON FUNCTION public.get_store_loyalty_programs(uuid),public.set_store_loyalty_program(uuid,text,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_loyalty_programs(uuid),public.set_store_loyalty_program(uuid,text,jsonb,boolean,uuid) TO authenticated;

-- The phone restriction is checked AGAIN while holding a customer lock at redemption.
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
 SELECT count(*) INTO n FROM public.orders o WHERE o.store_id=sid AND sahten_private.loyalty_paid(o)
  AND public.sahten_loyalty_phone(o.payload->>'customerPhone')=public.sahten_loyalty_phone(phone);
 IF c.program='first_online' AND n<>0 OR c.program='second_online' AND n<>1 THEN RAISE EXCEPTION 'coupon_ineligible';END IF;
 IF c.program='second_online' AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=c.origin_order_id AND o.store_id=sid AND sahten_private.loyalty_paid(o)) THEN RAISE EXCEPTION 'coupon_origin_unpaid';END IF;
END $$;
CREATE OR REPLACE FUNCTION public.sahten_customer_coupon_lookup(p_store_id uuid,p_digest text,p_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE result jsonb; terms jsonb;
BEGIN
 PERFORM sahten_private.assert_coupon_phone(p_store_id,p_digest,p_phone);
 SELECT c.terms INTO terms FROM sahten_private.promotion_coupons c WHERE c.store_id=p_store_id AND c.code_digest=p_digest;
 result:=public.sahten_coupon_backend('lookup',jsonb_build_object('store_id',p_store_id,'code_digest',p_digest));
 RETURN result||jsonb_build_object('totalPercent',terms->'totalPercent','mercadopago',terms->'mercadopago');
END $$;
REVOKE ALL ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION sahten_private.loyalty_order_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
BEGIN
 IF NEW.status='cancelado' OR NEW.payment_status IN ('refunded','partially_refunded','charged_back','in_mediation','rejected') THEN
  UPDATE sahten_private.promotion_coupons SET status='cancelled',reserved_request_id=NULL,reserved_until=NULL
  WHERE origin_order_id=NEW.id AND status IN ('available','reserved');
 ELSIF sahten_private.loyalty_paid(NEW) AND NEW.payload->>'source' IN ('pickup','delivery')
  AND public.sahten_loyalty_phone(NEW.payload->>'customerPhone') IS NOT NULL THEN
  PERFORM sahten_private.issue_phone_benefit(NEW.store_id,NEW.payload->>'customerPhone','second_online',NEW.id);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_loyalty_confirmed ON public.orders;
CREATE TRIGGER order_loyalty_confirmed AFTER INSERT OR UPDATE OF payment_status,payment_provider,status ON public.orders
 FOR EACH ROW EXECUTE FUNCTION sahten_private.loyalty_order_changed();

CREATE OR REPLACE FUNCTION public.get_order_promotion_reward(p_store_id uuid,p_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE o public.orders;c sahten_private.promotion_coupons;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin','encargado','cajero']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND store_id=p_store_id;
 IF NOT FOUND OR NOT sahten_private.loyalty_paid(o) THEN RETURN NULL;END IF;
 -- Reprinting the first receipt after another paid purchase must not advertise
 -- a second-purchase reward that the redemption guard can no longer accept.
 IF (SELECT count(*) FROM public.orders paid WHERE paid.store_id=p_store_id
  AND paid.payload->>'source' IN ('pickup','delivery') AND sahten_private.loyalty_paid(paid)
  AND public.sahten_loyalty_phone(paid.payload->>'customerPhone')=public.sahten_loyalty_phone(o.payload->>'customerPhone'))<>1
 THEN RETURN NULL;END IF;
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=p_store_id AND origin_order_id=p_order_id AND program='second_online' AND status='available' AND expires_at>now();
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',c.id,'kind','coupon','code',sahten_private.loyalty_code(p_store_id,c.id),'status',c.status,'channel',c.channel,
  'headline','Tu segunda compra online','mercadopago',c.terms->'mercadopago','extraPercent',c.extra_percent,'totalPercent',(c.terms->>'totalPercent')::numeric,'paymentPercent',(c.terms->>'paymentPercent')::numeric,
  'minEligibleSubtotal',c.min_eligible_subtotal,'maxExtraAmount',c.max_extra_amount,'productIds',c.eligible_product_ids,
  'expiresOn',to_char(c.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'));
END $$;
CREATE OR REPLACE FUNCTION public.confirm_store_order_collection(p_store_id uuid,p_order_id uuid,p_expected_total numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE o public.orders;prior sahten_private.order_collections;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND (s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin','encargado','cajero']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND store_id=p_store_id FOR UPDATE;
 IF NOT FOUND OR o.status='cancelado' OR o.payload->>'paymentMethod' NOT IN ('efectivo','transferencia') OR coalesce(o.payment_provider,'')='mercadopago'
 OR p_expected_total IS NULL OR p_expected_total<=0 OR p_expected_total IS DISTINCT FROM (o.payload->>'total')::numeric
 THEN RAISE EXCEPTION 'invalid_order_collection';END IF;
 SELECT * INTO prior FROM sahten_private.order_collections WHERE order_id=o.id;
 IF prior.order_id IS NOT NULL THEN
  IF o.payment_status<>'paid' OR prior.amount<>p_expected_total THEN RAISE EXCEPTION 'collection_requires_review';END IF;
  RETURN jsonb_build_object('paid',true,'alreadyConfirmed',true,'confirmedAt',prior.confirmed_at,'reward',public.get_order_promotion_reward(p_store_id,p_order_id));
 END IF;
 INSERT INTO sahten_private.order_collections(order_id,store_id,amount,method,confirmed_by) VALUES(o.id,p_store_id,p_expected_total,o.payload->>'paymentMethod',auth.uid());
 UPDATE public.orders SET payment_provider='manual',payment_status='paid',payment_updated_at=now() WHERE id=o.id;
 INSERT INTO sahten_private.promotion_changes(store_id,actor,action,detail) SELECT id,auth.uid(),'order_collection_confirmed',jsonb_build_object('orderId',o.id,'amount',p_expected_total,'method',o.payload->>'paymentMethod') FROM public.stores WHERE id=p_store_id;
 RETURN jsonb_build_object('paid',true,'alreadyConfirmed',false,'confirmedAt',now(),'reward',public.get_order_promotion_reward(p_store_id,p_order_id));
END $$;
REVOKE ALL ON FUNCTION public.get_order_promotion_reward(uuid,uuid),public.confirm_store_order_collection(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_promotion_reward(uuid,uuid),public.confirm_store_order_collection(uuid,uuid,numeric) TO authenticated;
REVOKE ALL ON FUNCTION sahten_private.loyalty_key(uuid,text),sahten_private.loyalty_code(uuid,uuid),sahten_private.loyalty_paid(public.orders),sahten_private.issue_phone_benefit(uuid,text,text,uuid),sahten_private.assert_coupon_phone(uuid,text,text),sahten_private.loyalty_order_changed() FROM PUBLIC,anon,authenticated,service_role;

-- Atomic coupon + cash/transfer order. No payment on credit.
-- Only Edge service_role may use this RPC, AFTER fresh trusted quote/order validation.
CREATE OR REPLACE FUNCTION public.sahten_coupon_confirm_order(
  p_store_id uuid,p_digest text,p_request_id uuid,p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_private,pg_temp
AS $$
DECLARE coupon jsonb; result jsonb; linked uuid;
BEGIN
 IF p_store_id IS NULL OR p_request_id IS NULL
    OR p_digest !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_payload->>'paymentMethod' NOT IN ('efectivo','transferencia')
    OR p_payload->>'source' NOT IN ('pickup','delivery')
    OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'items')<1
 THEN RAISE EXCEPTION 'invalid_coupon_order';END IF;
 PERFORM sahten_private.assert_coupon_phone(p_store_id,p_digest,p_payload->>'customerPhone');
 coupon:=public.sahten_coupon_backend('reserve',jsonb_build_object(
  'store_id',p_store_id,'code_digest',p_digest,'request_id',p_request_id));
 IF coupon->>'ok'<>'true' OR coupon->>'id' IS NULL
 THEN RAISE EXCEPTION 'coupon_unavailable';END IF;
 IF coalesce(p_payload#>>'{promotionSnapshot,couponId}','') <> coupon->>'id'
 THEN RAISE EXCEPTION 'coupon_order_quote_mismatch';END IF;
 result:=public.sahten_delivery_backend('order',jsonb_build_object(
  'store_id',p_store_id,'request_id',p_request_id,'payload',p_payload));
 IF result IS NULL OR result->>'id' IS NULL OR result->'order' IS NULL
 THEN RAISE EXCEPTION 'coupon_order_not_recorded';END IF;
 linked:=(result->>'id')::uuid;
 coupon:=public.sahten_coupon_backend('redeem',jsonb_build_object(
  'store_id',p_store_id,'code_digest',p_digest,
  'request_id',p_request_id,'order_id',linked));
 IF coupon->>'ok'<>'true' OR coupon->>'status'<>'redeemed'
 THEN RAISE EXCEPTION 'coupon_redeem_failed';END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sahten_coupon_confirm_order(uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_coupon_confirm_order(uuid,text,uuid,jsonb)
 TO service_role;
COMMENT ON FUNCTION public.sahten_coupon_confirm_order(uuid,text,uuid,jsonb)
 IS 'Server-only: reserve coupon, record idempotent cash order, and redeem once in the same PostgreSQL transaction; Edge must quote from trusted menu first.';
-- One-off coupons use the same protected ledger, phone binding and economics.
CREATE OR REPLACE FUNCTION public.issue_store_manual_coupon(p_store_id uuid,p_terms jsonb,p_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE doc jsonb;k text;cid uuid:=gen_random_uuid();code text;payment numeric;total numeric;pid text;price numeric;cost numeric;rule jsonb;expiry timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.stores s WHERE s.id=p_store_id AND(s.owner=auth.uid() OR public.has_project_role(s.project_id,ARRAY['owner','admin']))) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_terms) IS DISTINCT FROM 'object' OR length(p_terms::text)>12000
 OR length(trim(coalesce(p_terms->>'name',''))) NOT BETWEEN 4 AND 100
 OR coalesce(p_terms->>'extraPercent','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
 OR (p_terms->>'extraPercent')::numeric NOT BETWEEN 0.01 AND 85
 OR coalesce(p_terms->>'minEligibleSubtotal','') !~ '^[0-9]{1,11}([.][0-9]{1,2})?$'
 OR coalesce(p_terms->>'validDays','') !~ '^[0-9]{1,3}$' OR (p_terms->>'validDays')::int NOT BETWEEN 1 AND 365
 OR nullif(p_terms->>'maxExtraAmount','')::numeric<=0
 OR jsonb_typeof(p_terms->'eligibleProductIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_terms->'eligibleProductIds') NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'invalid_coupon_terms';END IF;
 SELECT json INTO doc FROM public.menus WHERE store_id=p_store_id FOR SHARE;
 IF doc IS NULL OR doc#>>'{promotions,enabled}' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'promotions_not_published';END IF;
 payment:=coalesce((doc#>>'{payments,benefit,percent}')::numeric,0);total:=payment+(p_terms->>'extraPercent')::numeric;
 IF p_terms ? 'paymentPercent' AND (p_terms->>'paymentPercent')::numeric<>payment THEN RAISE EXCEPTION 'loyalty_payment_changed';END IF;
 IF p_terms ? 'totalPercent' AND (p_terms->>'totalPercent')::numeric<>total THEN RAISE EXCEPTION 'invalid_loyalty_total';END IF;
 IF p_terms ? 'channel' AND p_terms->>'channel'<>'online' THEN RAISE EXCEPTION 'coupon_online_only';END IF;
 FOR pid IN SELECT jsonb_array_elements_text(p_terms->'eligibleProductIds') LOOP
  SELECT (p->>'price')::numeric INTO price FROM jsonb_array_elements(doc->'products') p WHERE p->>'id'=pid;
  cost:=(public.sahten_promotion_costs(p_store_id,'online')->>pid)::numeric;rule:=public.sahten_promotion_rule(doc,pid);
  IF price IS NULL OR price<=0 THEN RAISE EXCEPTION 'product_not_published:%',pid;END IF;
  IF cost IS NULL THEN RAISE EXCEPTION 'promotion_cost_missing:%',pid;END IF;
  IF total>(rule->>'maxTotalPercent')::numeric THEN RAISE EXCEPTION 'campaign_discount_limit:%',pid;END IF;
  IF cost>price*(1-total/100)*(1-(rule->>'minMarginPct')::numeric/100) THEN RAISE EXCEPTION 'campaign_margin_below_minimum:%',pid;END IF;
 END LOOP;
 k:=sahten_private.loyalty_key(p_store_id,p_phone);code:=sahten_private.loyalty_code(p_store_id,cid);
 expiry:=(date_trunc('day',now() AT TIME ZONE 'America/Argentina/Buenos_Aires')+make_interval(days=>(p_terms->>'validDays')::int)+interval '1 day'-interval '1 millisecond') AT TIME ZONE 'America/Argentina/Buenos_Aires';
 p_terms:=p_terms||jsonb_build_object('paymentPercent',payment,'totalPercent',total);
 INSERT INTO sahten_private.promotion_coupons(id,store_id,code_digest,program,name,eligible_product_ids,min_eligible_subtotal,extra_percent,max_extra_amount,channel,expires_at,customer_key,terms)
 VALUES(cid,p_store_id,encode(sha256(convert_to(code,'UTF8')),'hex'),'manual',p_terms->>'name',ARRAY(SELECT jsonb_array_elements_text(p_terms->'eligibleProductIds')),
 (p_terms->>'minEligibleSubtotal')::numeric,(p_terms->>'extraPercent')::numeric,nullif(p_terms->>'maxExtraAmount','')::numeric,'online',expiry,k,p_terms);
 INSERT INTO sahten_private.promotion_changes(store_id,actor,action,detail) VALUES(p_store_id,auth.uid(),'manual_coupon_issued',jsonb_build_object('couponId',cid,'terms',p_terms));
 RETURN jsonb_build_object('id',cid,'code',code,'channel','online','status','available','extraPercent',(p_terms->>'extraPercent')::numeric,
  'paymentPercent',payment,'totalPercent',total,'minEligibleSubtotal',(p_terms->>'minEligibleSubtotal')::numeric,'maxExtraAmount',p_terms->'maxExtraAmount',
  'productIds',p_terms->'eligibleProductIds','expiresOn',to_char(expiry AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'));
END $$;
REVOKE ALL ON FUNCTION public.issue_store_manual_coupon(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_store_manual_coupon(uuid,jsonb,text) TO authenticated;
