-- Intentos de upsell emitidos y consumidos SOLO por funciones Edge con service_role.
-- Ninguna función concede descuentos por sí sola: el motor debe confirmar costos,
-- comisión real, cesta completa, pedido y total antes de canjear esta intención.
CREATE TABLE IF NOT EXISTS sahten_catalog_private.upsell_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  promotion_id text NOT NULL CHECK (promotion_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  product_id text NOT NULL CHECK (product_id ~ '^[A-Za-z0-9_-]{1,150}$'),
  before_hash text NOT NULL CHECK (before_hash ~ '^[0-9a-f]{64}$'),
  after_hash text NOT NULL CHECK (after_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  redeemed_at timestamptz,
  request_id uuid,
  CHECK ((request_id IS NULL)=(redeemed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS upsell_intents_by_store_expiry
  ON sahten_catalog_private.upsell_intents (store_id, expires_at);
ALTER TABLE sahten_catalog_private.upsell_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_catalog_private.upsell_intents FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sahten_catalog_private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON sahten_catalog_private.upsell_intents TO service_role;

CREATE OR REPLACE FUNCTION public.sahten_upsell_issue(
  sid uuid,promotion_id text,product_id text,before_hash text,after_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE row_id uuid; due timestamptz;
BEGIN
  IF before_hash !~ '^[0-9a-f]{64}$' OR after_hash !~ '^[0-9a-f]{64}$'
    OR promotion_id !~ '^[A-Za-z0-9_-]{1,100}$'
    OR product_id !~ '^[A-Za-z0-9_-]{1,150}$'
    OR before_hash=after_hash
  THEN RAISE EXCEPTION 'upsell_invalid_hash'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.store_id=sid AND m.json #>> '{promotions,enabled}'='true'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(m.json #> '{promotions,upsells}','[]'::jsonb)) u
        WHERE u->>'id'=promotion_id AND u->>'kind'='upsell' AND u->>'enabled'='true'
        AND (u->>'maxUnits')::integer=1 AND u->'productIds' ? product_id)
  ) THEN RAISE EXCEPTION 'upsell_not_published'; END IF;
  INSERT INTO sahten_catalog_private.upsell_intents
   (store_id,promotion_id,product_id,before_hash,after_hash)
  VALUES(sid,promotion_id,product_id,before_hash,after_hash)
  RETURNING id,expires_at INTO row_id,due;
  RETURN jsonb_build_object('id',row_id,'expiresAt',due);
END;
$$;
CREATE OR REPLACE FUNCTION public.sahten_upsell_read(
  sid uuid,intent_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT to_jsonb(i) FROM sahten_catalog_private.upsell_intents i
 WHERE i.store_id=sid AND i.id=intent_id AND i.expires_at>now();
$$;
CREATE OR REPLACE FUNCTION public.sahten_upsell_redeem(
  sid uuid,intent_id uuid,expected_before_hash text,expected_after_hash text,request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE r jsonb;
BEGIN
  IF request_id IS NULL OR expected_before_hash !~ '^[0-9a-f]{64}$'
    OR expected_after_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'upsell_invalid_redemption'; END IF;
  -- Rechazo de campañas pausadas y de motor desactivado DESPUÉS de emitir token.
  IF NOT EXISTS(
    SELECT 1 FROM public.menus m
    JOIN sahten_catalog_private.upsell_intents i ON i.store_id=m.store_id
    WHERE m.store_id=sid AND i.id=intent_id
      AND m.json #>> '{promotions,enabled}'='true'
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(m.json #> '{promotions,upsells}','[]'::jsonb)) u
        WHERE u->>'id'=i.promotion_id AND u->>'enabled'='true')
  ) THEN RAISE EXCEPTION 'upsell_offer_no_longer_active'; END IF;
  UPDATE sahten_catalog_private.upsell_intents i
  SET redeemed_at=COALESCE(i.redeemed_at,now()),
      request_id=COALESCE(i.request_id,sahten_upsell_redeem.request_id)
  WHERE i.store_id=sid AND i.id=intent_id AND i.expires_at>now()
    AND i.before_hash=expected_before_hash AND i.after_hash=expected_after_hash
    AND (i.redeemed_at IS NULL OR i.request_id=sahten_upsell_redeem.request_id)
  RETURNING to_jsonb(i) INTO r;
  IF r IS NULL THEN RAISE EXCEPTION 'upsell_intent_expired_or_replayed'; END IF;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.sahten_upsell_issue(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sahten_upsell_read(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sahten_upsell_redeem(uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_upsell_issue(uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sahten_upsell_read(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sahten_upsell_redeem(uuid,uuid,text,text,uuid) TO service_role;
COMMENT ON TABLE sahten_catalog_private.upsell_intents IS
 'Short-lived single-offer nonce, bound to a server-validated before/after cart. No public direct access.';
