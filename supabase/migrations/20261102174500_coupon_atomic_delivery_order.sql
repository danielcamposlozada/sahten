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