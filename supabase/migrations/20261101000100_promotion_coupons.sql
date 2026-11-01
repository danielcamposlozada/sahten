-- SAHTEN coupon ledger v1. MIGRATION ONLY: deploy with review after test environment.
-- Never store raw coupon codes or client-facing secret tokens in public schemas.
CREATE TABLE IF NOT EXISTS sahten_private.promotion_coupons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 code_digest text NOT NULL CHECK (code_digest ~ '^[0-9a-f]{64}$'),
 program text NOT NULL CHECK (program IN ('first_online','second_online','loyalty','manual')),
 name text NOT NULL DEFAULT 'Beneficio SAHTEN',
 eligible_product_ids text[] NOT NULL DEFAULT '{}'::text[],
 min_eligible_subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (min_eligible_subtotal>=0),
 extra_percent numeric(5,2) NOT NULL CHECK (extra_percent>0 AND extra_percent<=20),
 max_extra_amount numeric(14,2) CHECK (max_extra_amount>=0),
 channel text NOT NULL DEFAULT 'online' CHECK (channel IN ('online','mostrador')),
 origin_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','redeemed','cancelled')),
 reserved_request_id uuid,
 reserved_until timestamptz,
 redeemed_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
 redeemed_at timestamptz,
 CHECK (expires_at>issued_at),
 CHECK (status<>'redeemed' OR redeemed_at IS NOT NULL),
 UNIQUE (store_id,code_digest)
);
CREATE INDEX IF NOT EXISTS promotion_coupons_store_status_idx ON sahten_private.promotion_coupons(store_id,status,expires_at);
CREATE INDEX IF NOT EXISTS promotion_coupons_origin_idx ON sahten_private.promotion_coupons(origin_order_id);

ALTER TABLE sahten_private.promotion_coupons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sahten_private.promotion_coupons FROM PUBLIC,anon,authenticated,service_role;

-- Server-only atomic access. Edge Function must authenticate an admin before 'issue'.
-- Buyers never call this RPC directly; public API has no grants for anon/authenticated.
CREATE OR REPLACE FUNCTION public.sahten_coupon_backend(action text,args jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,sahten_private,pg_temp
AS $$
DECLARE
 sid uuid;
 ref uuid;
 dig text;
 ord uuid;
 row_record sahten_private.promotion_coupons%ROWTYPE;
BEGIN
 IF args IS NULL OR jsonb_typeof(args)<>'object' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
 sid := NULLIF(args->>'store_id','')::uuid;
 IF sid IS NULL THEN RAISE EXCEPTION 'invalid_store_id'; END IF;
 IF action='issue' THEN
   dig:=lower(NULLIF(args->>'code_digest',''));
   IF dig IS NULL OR dig !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_code_digest'; END IF;
   INSERT INTO sahten_private.promotion_coupons
   (store_id,code_digest,program,name,eligible_product_ids,min_eligible_subtotal,
    extra_percent,max_extra_amount,channel,origin_order_id,expires_at)
   VALUES(sid,dig,args->>'program',
     left(coalesce(NULLIF(args->>'name',''),'Beneficio SAHTEN'),100),
     ARRAY(SELECT jsonb_array_elements_text(COALESCE(args->'eligible_product_ids','[]'::jsonb))),
     coalesce((args->>'min_eligible_subtotal')::numeric,0),
     (args->>'extra_percent')::numeric,
     NULLIF(args->>'max_extra_amount','')::numeric,
     coalesce(NULLIF(args->>'channel',''),'online'),
     NULLIF(args->>'origin_order_id','')::uuid,
     (args->>'expires_at')::timestamptz)
   RETURNING * INTO row_record;
   RETURN jsonb_build_object('id',row_record.id,'expiresOn',
     to_char(row_record.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'));
 ELSIF action IN ('lookup','reserve','redeem','release','cancel') THEN
   dig:=lower(NULLIF(args->>'code_digest',''));
   IF dig IS NULL OR dig !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_code_digest'; END IF;
   IF action='lookup' THEN
      SELECT * INTO row_record FROM sahten_private.promotion_coupons
       WHERE store_id=sid AND code_digest=dig AND expires_at>now()
       AND (status='available' OR (status='reserved' AND reserved_until<now()))
       LIMIT 1;
   ELSIF action='reserve' THEN
      ref:=(args->>'request_id')::uuid;
      IF ref IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
      UPDATE sahten_private.promotion_coupons
      SET status='reserved',reserved_request_id=ref,reserved_until=now()+interval '20 minutes'
      WHERE store_id=sid AND code_digest=dig AND expires_at>now()
        AND (status='available'
          OR (status='reserved' AND (reserved_request_id=ref OR reserved_until<now())))
      RETURNING * INTO row_record;
   ELSIF action='redeem' THEN
      ref:=(args->>'request_id')::uuid;
      ord:=(args->>'order_id')::uuid;
      IF ref IS NULL OR ord IS NULL THEN RAISE EXCEPTION 'request_and_order_required'; END IF;
      UPDATE sahten_private.promotion_coupons
      SET status='redeemed',redeemed_order_id=ord,redeemed_at=now(),reserved_until=NULL
      WHERE store_id=sid AND code_digest=dig AND status='reserved'
      AND reserved_request_id=ref AND reserved_until>=now()
      AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=ord AND o.store_id=sid)
      RETURNING * INTO row_record;
   ELSIF action='release' THEN
      ref:=(args->>'request_id')::uuid;
      UPDATE sahten_private.promotion_coupons
      SET status='available',reserved_request_id=NULL,reserved_until=NULL
      WHERE store_id=sid AND code_digest=dig AND status='reserved'
       AND reserved_request_id=ref
      RETURNING * INTO row_record;
   ELSE
      UPDATE sahten_private.promotion_coupons
      SET status='cancelled',reserved_request_id=NULL,reserved_until=NULL
      WHERE store_id=sid AND code_digest=dig AND status<>'redeemed'
      RETURNING * INTO row_record;
   END IF;
   IF row_record.id IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
   RETURN jsonb_build_object('ok',true,'id',row_record.id,'name',row_record.name,
    'status',row_record.status,'program',row_record.program,'channel',row_record.channel,
    'expiresOn',to_char(row_record.expires_at AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD'),
    'extraPercent',row_record.extra_percent,'maxExtraAmount',row_record.max_extra_amount,
    'minEligibleSubtotal',row_record.min_eligible_subtotal,'productIds',row_record.eligible_product_ids);
 END IF;
 RAISE EXCEPTION 'unknown_action';
END $$;
REVOKE ALL ON FUNCTION public.sahten_coupon_backend(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_coupon_backend(text,jsonb) TO service_role;
COMMENT ON FUNCTION public.sahten_coupon_backend(text,jsonb)
  IS 'Server-only coupon ledger. Caller must perform store admin/customer identity authorization before invoke.';

-- Internal cost snapshot for server-side margin guard. Never exposed to anon/authenticated.
CREATE OR REPLACE FUNCTION public.sahten_promotion_costs(sid uuid, channel text DEFAULT 'mostrador')
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_private,pg_temp
AS $$
 WITH st AS (
  SELECT project_id FROM public.stores WHERE id=sid
 ),
 catalog AS (
  SELECT jsonb_array_elements(pr.data#>'{catalog,productos}') p
  FROM public.projects pr JOIN st ON st.project_id=pr.id
 ), priced AS (
  SELECT p->>'id' id,
   COALESCE(NULLIF(p#>>ARRAY['pricingPolicies',channel,'variableCost'],''),p#>>'{pricingPolicies,mostrador,variableCost}') variable,
   COALESCE(NULLIF(p#>>ARRAY['pricingPolicies',channel,'fixedCost'],''),p#>>'{pricingPolicies,mostrador,fixedCost}') fixed
  FROM catalog
 ) SELECT coalesce(jsonb_object_agg(id, (variable::numeric+fixed::numeric))
   FILTER (WHERE variable IS NOT NULL AND fixed IS NOT NULL), '{}'::jsonb)
 FROM priced;
$$;
REVOKE ALL ON FUNCTION public.sahten_promotion_costs(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_promotion_costs(uuid,text) TO service_role;
COMMENT ON FUNCTION public.sahten_promotion_costs(uuid,text)
 IS 'Service-only expense snapshot. Never embed its result in public menu.json.';


-- Verificación detallada de costos para el nuevo guard incremental. 
-- Desactivada comercialmente hasta que se validen gastos incrementales y prueba de selección.
-- Nunca enviar el resultado a menu.json ni a un navegador.
CREATE OR REPLACE FUNCTION public.sahten_promotion_economics(sid uuid, channel text DEFAULT 'mostrador')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,sahten_private,pg_temp AS $$
 WITH source AS (
   SELECT pr.data
   FROM public.stores s JOIN public.projects pr ON pr.id=s.project_id
   WHERE s.id=sid
 ), items AS (
   SELECT item.value AS product, src.data
   FROM source src CROSS JOIN LATERAL
     jsonb_array_elements(COALESCE(src.data #> '{catalog,productos}','[]'::jsonb)) item
 ), values_found AS (
   SELECT product->>'id' AS product_id,
     COALESCE(product #> ARRAY['pricingPolicies',channel,'variableCost'],
       product #> '{pricingPolicies,mostrador,variableCost}') AS variable_value,
     COALESCE(product #> ARRAY['pricingPolicies',channel,'fixedCost'],
       product #> '{pricingPolicies,mostrador,fixedCost}') AS fixed_value,
     data #> ARRAY['promotions','incrementalCostOverrides',product->>'id'] AS reviewed_override
   FROM items WHERE product->>'id' ~ '^[a-zA-Z0-9_-]{1,100}$'
 ), valid_costs AS (
   SELECT product_id,
     CASE WHEN jsonb_typeof(variable_value)='number'
       AND (variable_value::text)::numeric>=0 THEN (variable_value::text)::numeric END AS direct,
     CASE WHEN jsonb_typeof(fixed_value)='number'
       AND (fixed_value::text)::numeric>=0 THEN (fixed_value::text)::numeric END AS allocated_fixed,
     reviewed_override AS extra,
     CASE WHEN jsonb_typeof(reviewed_override->'additionalIncrementalCost')='number'
        AND (reviewed_override->>'additionalIncrementalCost')::numeric>=0
        THEN (reviewed_override->>'additionalIncrementalCost')::numeric END AS additional
   FROM values_found
 ), economics AS (
   SELECT product_id,direct,allocated_fixed,additional,
     coalesce(extra->>'verified','false')='true'
       AND extra->>'reviewedAt' IS NOT NULL
       AND extra->>'reviewedBy' IS NOT NULL
       AND additional IS NOT NULL AS incremental_verified
   FROM valid_costs WHERE direct IS NOT NULL AND allocated_fixed IS NOT NULL
 )
 SELECT jsonb_build_object(
   'costs',COALESCE(jsonb_object_agg(product_id,direct+allocated_fixed),'{}'::jsonb),
   'economics',COALESCE(jsonb_object_agg(product_id,jsonb_build_object(
     'verified',true,'directCost',direct,'fixedCost',allocated_fixed,
     'additionalIncrementalCost',COALESCE(additional,0),
     'incrementalVerified',incremental_verified)),'{}'::jsonb)
 )
 FROM economics;
$$;
REVOKE ALL ON FUNCTION public.sahten_promotion_economics(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sahten_promotion_economics(uuid,text) TO service_role;
COMMENT ON FUNCTION public.sahten_promotion_economics(uuid,text)
  IS 'Service-only verified direct/fixed costs; incremental cost requires separate reviewed override. Do not expose publicly.';
