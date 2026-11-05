-- Coupons belong to the store. The provider only receives the final quoted total.
-- Pending provider payments never consume a coupon and never expire its hold blindly.
ALTER TABLE sahten_private.mp_checkouts ADD COLUMN IF NOT EXISTS coupon_released_at timestamptz;
ALTER TABLE sahten_private.mp_checkouts ADD COLUMN IF NOT EXISTS coupon_review text;
DROP FUNCTION IF EXISTS public.sahten_customer_coupon_lookup(uuid,text,text);
CREATE OR REPLACE FUNCTION public.sahten_customer_coupon_lookup(p_store_id uuid,p_digest text,p_phone text,p_request_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.promotion_coupons;
BEGIN
 PERFORM sahten_private.assert_coupon_phone(p_store_id,p_digest,p_phone);
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=p_store_id AND code_digest=p_digest AND expires_at>now()
  AND (status='available' OR status='reserved' AND (reserved_until<now() OR reserved_request_id=p_request_id));
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false);END IF;
 RETURN jsonb_build_object('ok',true,'id',c.id,'name',c.name,'status','available','program',c.program,'channel',c.channel,
  'expiresOn',to_char(c.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'),
  'extraPercent',c.extra_percent,'totalPercent',c.terms->'totalPercent','mercadopago',c.terms->'mercadopago',
  'maxExtraAmount',c.max_extra_amount,'minEligibleSubtotal',c.min_eligible_subtotal,'productIds',c.eligible_product_ids);
END $$;
REVOKE ALL ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_customer_coupon_lookup(uuid,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sahten_mp_checkout_request(p_store_id uuid,p_request_id uuid,p_proof_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.mp_checkouts;
BEGIN
 SELECT * INTO c FROM sahten_private.mp_checkouts WHERE store_id=p_store_id AND request_id=p_request_id;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF c.proof_hash IS DISTINCT FROM p_proof_hash THEN RAISE EXCEPTION 'checkout_conflict';END IF;
 RETURN to_jsonb(c)||jsonb_build_object('order',c.order_payload,'mode',(SELECT mode FROM sahten_private.mp_accounts WHERE id=c.account_id));
END $$;
REVOKE ALL ON FUNCTION public.sahten_mp_checkout_request(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_mp_checkout_request(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION sahten_private.hold_checkout_coupon() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.promotion_coupons; dig text:=NEW.order_payload->>'couponCodeDigest';
BEGIN
 IF dig IS NULL THEN RETURN NEW;END IF;
 PERFORM sahten_private.assert_coupon_phone(NEW.store_id,dig,NEW.order_payload->>'customerPhone');
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=NEW.store_id AND code_digest=dig FOR UPDATE;
 IF c.id IS NULL OR c.terms#>>'{mercadopago,enabled}' IS DISTINCT FROM 'true' OR c.expires_at<=now()
  OR c.id::text IS DISTINCT FROM NEW.order_payload#>>'{promotionSnapshot,couponId}'
  OR NOT(c.status='available' OR c.status='reserved' AND (c.reserved_until<now() OR c.reserved_request_id=NEW.request_id))
 THEN RAISE EXCEPTION 'coupon_unavailable';END IF;
 UPDATE sahten_private.promotion_coupons SET status='reserved',reserved_request_id=NEW.request_id,reserved_until='infinity'::timestamptz WHERE id=c.id;
 RETURN NEW;
END $$;
CREATE TRIGGER hold_checkout_coupon BEFORE INSERT ON sahten_private.mp_checkouts FOR EACH ROW EXECUTE FUNCTION sahten_private.hold_checkout_coupon();

CREATE OR REPLACE FUNCTION sahten_private.settle_checkout_coupon() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.promotion_coupons; dig text:=NEW.order_payload->>'couponCodeDigest';
BEGIN
 IF dig IS NULL OR NEW.payment_status NOT IN ('paid','overpaid') OR NEW.order_id IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO c FROM sahten_private.promotion_coupons WHERE store_id=NEW.store_id AND code_digest=dig FOR UPDATE;
 IF c.status='redeemed' AND c.redeemed_order_id=NEW.order_id THEN RETURN NEW;END IF;
 IF c.status='reserved' AND c.reserved_request_id=NEW.request_id AND NEW.coupon_released_at IS NULL THEN
  -- Never recost an already funded order; use the immutable reserved quote.
  UPDATE sahten_private.promotion_coupons SET status='redeemed',redeemed_order_id=NEW.order_id,redeemed_at=now(),reserved_until=NULL WHERE id=c.id;
 ELSE
  UPDATE sahten_private.mp_checkouts SET coupon_review='late_payment_coupon_conflict' WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settle_checkout_coupon AFTER UPDATE OF payment_status ON sahten_private.mp_checkouts FOR EACH ROW EXECUTE FUNCTION sahten_private.settle_checkout_coupon();
REVOKE ALL ON FUNCTION sahten_private.hold_checkout_coupon(),sahten_private.settle_checkout_coupon() FROM PUBLIC,anon,authenticated,service_role;

-- Edge calls this only after expiring the preference and verifying the provider
-- has no approved/pending/in-process/mediated payments. Proof is still required.
CREATE OR REPLACE FUNCTION public.sahten_mp_release_coupon(p_checkout_id uuid,p_proof_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
DECLARE c sahten_private.mp_checkouts;
BEGIN
 SELECT * INTO c FROM sahten_private.mp_checkouts WHERE id=p_checkout_id FOR UPDATE;
 IF c.id IS NULL OR c.proof_hash IS DISTINCT FROM p_proof_hash THEN RAISE EXCEPTION 'checkout_conflict';END IF;
 IF c.expires_at>now() OR c.order_id IS NOT NULL OR EXISTS(SELECT 1 FROM sahten_private.mp_payments p WHERE p.checkout_id=c.id AND p.status NOT IN ('rejected','cancelled'))
 THEN RAISE EXCEPTION 'coupon_payment_pending';END IF;
 UPDATE sahten_private.promotion_coupons SET status='available',reserved_request_id=NULL,reserved_until=NULL
  WHERE store_id=c.store_id AND code_digest=c.order_payload->>'couponCodeDigest' AND status='reserved' AND reserved_request_id=c.request_id;
 UPDATE sahten_private.mp_checkouts SET coupon_released_at=coalesce(coupon_released_at,now()) WHERE id=c.id;
 RETURN jsonb_build_object('released',true);
END $$;
REVOKE ALL ON FUNCTION public.sahten_mp_release_coupon(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_mp_release_coupon(uuid,text) TO service_role;
