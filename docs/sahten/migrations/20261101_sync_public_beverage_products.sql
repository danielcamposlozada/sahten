-- Sync de fichas sin costos para encargado/cajero, nunca la tienda web.
-- No publica archivos ni altera public.menus; solo public.projects.public.products.
DO $$
DECLARE
  project_id uuid := '388d9b9c-3805-443a-853f-f459f93edd61'::uuid;
  d jsonb; public_view jsonb; public_previous jsonb;
  products jsonb:='[]'::jsonb; item jsonb; sku jsonb;
  created int:=0; modified int:=0;
BEGIN
  SELECT data,public INTO d,public_view FROM public.projects
   WHERE id=project_id AND version=300 FOR UPDATE;
  IF d IS NULL OR jsonb_array_length(d #> '{catalog,productos}')<>62
     OR jsonb_array_length(d #> '{catalog,mercaderia}')<>11
     OR jsonb_array_length(public_view->'products')<>47
     OR d ? 'beveragePublicBackup'
  THEN RAISE EXCEPTION 'public_beverage_sync_guard'; END IF;
  public_previous := public_view->'products';
  FOR item IN SELECT * FROM jsonb_array_elements(public_previous) LOOP
    SELECT value INTO sku FROM jsonb_array_elements(d #> '{catalog,productos}')
      WHERE value->>'id'=item->>'id' AND value->>'category'='Bebidas' LIMIT 1;
    IF sku IS NOT NULL THEN
      item := item || jsonb_build_object('name',sku->>'name','category','Bebidas',
        'salesAvailability',sku->'salesAvailability');
      item := jsonb_set(item,'{fixedPrices}',
        COALESCE(item->'fixedPrices','{}'::jsonb) ||
          jsonb_build_object('mostrador',(sku #>> '{priceTargets,mostrador}')::numeric),true);
      modified:=modified+1;
    END IF;
    products:=products||jsonb_build_array(item);
  END LOOP;
  FOR sku IN SELECT value FROM jsonb_array_elements(d #> '{catalog,productos}')
     WHERE value->>'category'='Bebidas' LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public_previous) x
        WHERE x->>'id'=sku->>'id') THEN
      item:=jsonb_build_object(
        'id',sku->>'id','name',sku->>'name','category','Bebidas','star',false,
        'salesAvailability',sku->'salesAvailability',
        'fixedPrices',jsonb_build_object('mostrador',(sku #>> '{priceTargets,mostrador}')::numeric),
        'porciones',1,'ingredients','[]'::jsonb,'packaging','[]'::jsonb,
        'combos','[]'::jsonb,'priceFixedChannels','[]'::jsonb,'quoteIds','{}'::jsonb
      );
      products:=products||jsonb_build_array(item);
      created:=created+1;
    END IF;
  END LOOP;
  IF created<>7 OR modified<>4 OR jsonb_array_length(products)<>54 THEN
    RAISE EXCEPTION 'public_beverage_count_guard:%,%',created,modified; END IF;
  d:=jsonb_set(d,'{beveragePublicBackup}',jsonb_build_object(
    'versionBefore',300,'publicProducts',public_previous,'migration','public_drinks_sync_20261101'),true);
  UPDATE public.projects SET
    data=d,public=jsonb_set(public_view,'{products}',products,true),
    version=version+1,updated_at=clock_timestamp()
  WHERE id=project_id AND version=300;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale_version'; END IF;
END $$;
SELECT p.version, jsonb_array_length(p.public->'products') AS public_products,
 (SELECT count(*) FROM jsonb_array_elements(p.public->'products') x WHERE x->>'category'='Bebidas') AS public_drinks,
 (SELECT count(*) FROM jsonb_array_elements(p.public->'products') x WHERE x ? 'precioPkg' OR x ? 'merchandise' OR x ? 'ingredients' AND jsonb_array_length(x->'ingredients')>0) AS leaked_cost_or_recipe,
 p.data ? 'beveragePublicBackup' AS public_backup_available
 FROM public.projects p WHERE p.id='388d9b9c-3805-443a-853f-f459f93edd61'::uuid;