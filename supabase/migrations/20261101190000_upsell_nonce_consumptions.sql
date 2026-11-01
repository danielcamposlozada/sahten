-- Solo una aceptación de upsell por nonce y solicitud; no publica ofertas.
-- Requiere que la Edge Function verifique primero el reto HMAC en privado.
CREATE TABLE IF NOT EXISTS sahten_catalog_private.upsell_nonce_consumptions (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  nonce text NOT NULL CHECK (nonce ~ '^[A-Za-z0-9_-]{32}$'),
  session_id text NOT NULL CHECK (length(session_id) BETWEEN 1 AND 100),
  request_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id,nonce)
);
CREATE INDEX IF NOT EXISTS upsell_nonce_expiry_idx
 ON sahten_catalog_private.upsell_nonce_consumptions(expires_at);
ALTER TABLE sahten_catalog_private.upsell_nonce_consumptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_catalog_private.upsell_nonce_consumptions
 FROM PUBLIC,anon,authenticated,service_role;

-- Solo el backend con service_role puede consumir un reto; la web no recibe
-- grant ni de lectura ni de ejecución. Repetir el mismo request_id es idempotente,
-- reutilizar el token en otra compra devuelve false.
CREATE OR REPLACE FUNCTION public.sahten_consume_upsell_nonce(
  p_store_id uuid,p_nonce text,p_session_id text,p_request_id uuid,p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_catalog_private,pg_temp
AS $$
DECLARE newly_consumed text;
BEGIN
  IF p_store_id IS NULL OR p_request_id IS NULL OR
     p_nonce IS NULL OR p_nonce !~ '^[A-Za-z0-9_-]{32}$' OR
     p_session_id IS NULL OR length(p_session_id) NOT BETWEEN 1 AND 100 OR
     p_expires_at IS NULL OR p_expires_at<=now() OR
     p_expires_at>now()+interval '5 minutes'
  THEN RAISE EXCEPTION 'upsell_nonce_invalid'; END IF;
  INSERT INTO sahten_catalog_private.upsell_nonce_consumptions(
    store_id,nonce,session_id,request_id,expires_at
  ) VALUES (p_store_id,p_nonce,p_session_id,p_request_id,p_expires_at)
  ON CONFLICT (store_id,nonce) DO NOTHING RETURNING nonce INTO newly_consumed;
  IF newly_consumed IS NOT NULL THEN RETURN true; END IF;
  RETURN EXISTS(
    SELECT 1 FROM sahten_catalog_private.upsell_nonce_consumptions
    WHERE store_id=p_store_id AND nonce=p_nonce
      AND session_id=p_session_id AND request_id=p_request_id
      AND expires_at>=now()
  );
END $$;
REVOKE ALL ON FUNCTION public.sahten_consume_upsell_nonce(
 uuid,text,text,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_consume_upsell_nonce(
 uuid,text,text,uuid,timestamptz) TO service_role;
COMMENT ON FUNCTION public.sahten_consume_upsell_nonce(uuid,text,text,uuid,timestamptz)
 IS 'Backend-only; atomic idempotent upsell HMAC nonce consume; never grants a discount by itself.';
