-- Sahten: canje de HMAC + confirmación de delivery en UNA sola transacción.
-- SOLO service_role después de validación HMAC/costos y tarifa en Edge.
-- La excepción de la inserción revierte también el canje del nonce.
-- No activa ofertas ni altera el backend de pedidos normales.
CREATE OR REPLACE FUNCTION public.sahten_delivery_upsell_order(
  p_store_id uuid,
  p_nonce text,
  p_session_id text,
  p_request_id uuid,
  p_expires_at timestamptz,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, sahten_catalog_private, sahten_delivery_private, pg_temp
AS $$
DECLARE result jsonb;
BEGIN
  IF p_store_id IS NULL OR p_request_id IS NULL OR
     jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
     coalesce(p_payload->>'paymentMethod','') NOT IN ('efectivo','transferencia') OR
     coalesce(p_payload->>'source','') NOT IN ('pickup','delivery') OR
     jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR
     jsonb_array_length(p_payload->'items') = 0 OR
     p_payload->>'total' IS NULL
  THEN RAISE EXCEPTION 'upsell_order_invalid'; END IF;

  IF NOT public.sahten_consume_upsell_nonce(
       p_store_id,p_nonce,p_session_id,p_request_id,p_expires_at
     ) THEN RAISE EXCEPTION 'upsell_nonce_reused'; END IF;

  -- La inserción ocurre en el MISMO statement/transaction Postgres. Un error
  -- en order/submission debe revertir también el nonce (ningún canje huérfano).
  result := public.sahten_delivery_backend('order',jsonb_build_object(
    'store_id',p_store_id,'request_id',p_request_id,'payload',p_payload
  ));
  IF result IS NULL OR result->>'id' IS NULL OR result->'order' IS NULL
  THEN RAISE EXCEPTION 'upsell_order_not_recorded'; END IF;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.sahten_delivery_upsell_order(
  uuid,text,text,uuid,timestamptz,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_delivery_upsell_order(
  uuid,text,text,uuid,timestamptz,jsonb
) TO service_role;
COMMENT ON FUNCTION public.sahten_delivery_upsell_order(
  uuid,text,text,uuid,timestamptz,jsonb
) IS 'Service role only: atomic upsell nonce consumption and idempotent delivery/pickup order confirmation; signed quote must be checked by Edge first.';
