-- Migración específica del proyecto SAHTEN: bebidas terminadas -> Mercadería.
-- La transacción es atómica y registra snapshot dentro del proyecto para restauración.
-- Requiere revisión 297; no cambia imágenes, menú público ni historial de órdenes.
DO $$
DECLARE
  v_project uuid := '388d9b9c-3805-443a-853f-f459f93edd61'::uuid;
  d jsonb; cat jsonb; original_cat jsonb; stock_rows jsonb; spec jsonb;
  row_spec jsonb; source_ing jsonb; product jsonb; products jsonb := '[]'::jsonb;
  existing_ids text[]; old_ingredients jsonb; merch_rows jsonb;
  new_ing jsonb; items jsonb; rewritten jsonb;
  ing_row jsonb; moved jsonb;
  item_id text; merch_id text; product_id text; name text; price numeric;
  c numeric; pkg numeric; cost_ok boolean; found_product boolean;
  original_products jsonb := '[]'::jsonb; original_stock jsonb;
  moved_count integer := 0; created_count integer := 0;
  now_iso text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  SELECT p.data INTO d FROM public.projects p WHERE p.id=v_project AND p.version=297 FOR UPDATE;
  IF d IS NULL OR d #>> '{promotions,planVersion}' IS DISTINCT FROM '4'
     OR jsonb_array_length(d #> '{catalog,ingredientes}') <> 65
     OR jsonb_array_length(d #> '{catalog,productos}') <> 55
     OR jsonb_array_length(d #> '{catalog,mercaderia}') <> 0
     OR d ? 'beverageMigrationBackup'
  THEN RAISE EXCEPTION 'beverage_migration_precondition_failed'; END IF;
  original_cat := d->'catalog';
  original_stock := d #> '{stock,items}';
  cat := original_cat;
  stock_rows := original_stock;
  spec := jsonb_build_array(
    jsonb_build_object('productId','p1793032422487','merchId','ing_1789514268920','name','Agua sin gas 600 ml','price',2000),
    jsonb_build_object('productId','bebida_agua_con_gas_600ml','merchId','ing_1789514365061','name','Agua con gas 600 ml','price',2000),
    jsonb_build_object('productId','cocacola_600ml','merchId','ing_1789514495806','name','Coca-Cola 600 ml','price',2500),
    jsonb_build_object('productId','bebida_cocacola_zero_600ml','merchId','ing_1789514425466','name','Coca-Cola Zero 600 ml','price',2500),
    jsonb_build_object('productId','bebida_sprite_600ml','merchId','ing_1789514612600','name','Sprite 600 ml','price',2500),
    jsonb_build_object('productId','bebida_fanta_600ml','merchId','ing_1789514641826','name','Fanta 600 ml','price',2500),
    jsonb_build_object('productId','p1793049167225','merchId','ing_1789514903695','name','Coca-Cola 220 ml','price',1400),
    jsonb_build_object('productId','bebida_cocacola_zero_220ml','merchId','ing_1793167658187','name','Coca-Cola Zero 220 ml','price',1400),
    jsonb_build_object('productId','bebida_sprite_220ml','merchId','ing_1793167659804','name','Sprite 220 ml','price',1400),
    jsonb_build_object('productId','bebida_sprite_zero_220ml','merchId','ing_1793167724162','name','Sprite Zero 220 ml','price',1400),
    jsonb_build_object('productId','p1793167440976','merchId','merch_fanta_220ml','name','Fanta 220 ml','price',1400)
  );
  SELECT array_agg(x->>'merchId') INTO existing_ids
  FROM jsonb_array_elements(spec) x WHERE x->>'merchId' <> 'merch_fanta_220ml';
  SELECT count(*) INTO moved_count FROM jsonb_array_elements(cat->'ingredientes') i
  WHERE i->>'id' = ANY(existing_ids);
  IF moved_count <> 10 OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(spec) x WHERE x->>'merchId' <> 'merch_fanta_220ml'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cat->'ingredientes') i WHERE i->>'id'=x->>'merchId')
  ) THEN RAISE EXCEPTION 'missing_or_duplicate_beverage_ingredient'; END IF;
  -- Una receta puede seguir utilizando agua de cocina: ese ingrediente NO se traslada.
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cat->'ingredientes') i
    WHERE i->>'id'='ing_1779464718583' AND i->>'name'='Agua') THEN
    RAISE EXCEPTION 'kitchen_water_not_found'; END IF;

  -- Migrar registros de compra. Mantener 6/8/12/24 según la compra cargada,
  -- sin inventar que todos los proveedores facturan exactamente doce unidades.
  FOR row_spec IN SELECT * FROM jsonb_array_elements(spec) LOOP
    merch_id := row_spec->>'merchId'; name := row_spec->>'name';
    SELECT i INTO source_ing FROM jsonb_array_elements(cat->'ingredientes') i
      WHERE i->>'id'=merch_id LIMIT 1;
    cost_ok := source_ing IS NOT NULL AND source_ing->>'unit'='u'
       AND COALESCE((source_ing->>'cantidad')::numeric,0)>0
       AND COALESCE((source_ing->>'precioPkg')::numeric,0)>0;
    c := CASE WHEN cost_ok THEN (source_ing->>'cantidad')::numeric ELSE 1 END;
    pkg := CASE WHEN cost_ok THEN (source_ing->>'precioPkg')::numeric ELSE NULL END;
    items := jsonb_build_object(
      'id',merch_id,'name',name,'unit','u','cantidad',c,'precioPkg',pkg,
      'presentacion',CASE WHEN cost_ok THEN 'Pack de '||c::integer ELSE 'Por unidad, costo a revisar' END,
      'costVerified',cost_ok,'costStatus',CASE WHEN cost_ok THEN 'purchase_recorded' ELSE 'missing_supplier_cost' END,
      'migrationSource','sahten_beverages_20261101'
    );
    cat := jsonb_set(cat,'{mercaderia}',(cat->'mercaderia')||jsonb_build_array(items));
    stock_rows := jsonb_set(stock_rows,ARRAY[merch_id],
      COALESCE(stock_rows->merch_id,'{"actual":0}'::jsonb) ||
        jsonb_build_object('unit','u','minimo',0),true);
  END LOOP;
  SELECT COALESCE(jsonb_agg(i),'[]'::jsonb) INTO new_ing
  FROM jsonb_array_elements(cat->'ingredientes') i WHERE NOT i->>'id'=ANY(existing_ids);
  cat := jsonb_set(cat,'{ingredientes}',new_ing);

  -- Convertir referencias de ingredientes en referencias a Mercadería y eliminar
  -- filas de cantidad cero. Ninguna receta retiene una referencia huérfana.
  FOR product IN SELECT * FROM jsonb_array_elements(cat->'productos') LOOP
    SELECT COALESCE(jsonb_agg(i),'[]'::jsonb) INTO old_ingredients
    FROM jsonb_array_elements(COALESCE(product->'ingredients','[]'::jsonb)) i
    WHERE NOT i->>'ingId'=ANY(existing_ids);
    merch_rows:=COALESCE(product->'merchandise','[]'::jsonb);
    FOR ing_row IN SELECT * FROM jsonb_array_elements(COALESCE(product->'ingredients','[]'::jsonb))
       WHERE ing_row->>'ingId'=ANY(existing_ids) LOOP
      IF COALESCE((ing_row->>'qty')::numeric,0)>0 THEN
        merch_rows:=merch_rows||jsonb_build_array(jsonb_build_object(
          'merchId',ing_row->>'ingId','qty',(ing_row->>'qty')::numeric));
      END IF;
    END LOOP;
    product:=jsonb_set(jsonb_set(product,'{ingredients}',old_ingredients),'{merchandise}',merch_rows);
    -- Los productos de bebida reventa deben consumir exactamente UNA unidad vendida.
    SELECT x INTO row_spec FROM jsonb_array_elements(spec) x
      WHERE x->>'productId'=product->>'id' LIMIT 1;
    IF row_spec IS NOT NULL THEN
      product:=product || jsonb_build_object(
        'name',row_spec->>'name','category','Bebidas','productType','resale',
        'ingredients','[]'::jsonb,
        'merchandise',jsonb_build_array(jsonb_build_object('merchId',row_spec->>'merchId','qty',1)),
        'receta_cost',0,'porciones',1,'porcionesOverride',1,'porcionLabel','unidad','recetaOnly',false,
        'salesAvailability',jsonb_build_object('paused',false,'resumeAt',null,'updatedAt',now_iso),
        'priceTargets',COALESCE(product->'priceTargets','{}'::jsonb)||jsonb_build_object('mostrador',(row_spec->>'price')::numeric),
        'fixedPrices',COALESCE(product->'fixedPrices','{}'::jsonb)||jsonb_build_object('mostrador',(row_spec->>'price')::numeric),
        'pricingMode',COALESCE(product->'pricingMode','{}'::jsonb)||'{"mostrador":"fixed"}'::jsonb,
        'salesChannel','mostrador'
      );
      product:=jsonb_set(product,'{pricingPolicies,mostrador,variableCost}','null'::jsonb,true);
      product:=jsonb_set(product,'{pricingPolicies,mostrador,fixedCost}','null'::jsonb,true);
    END IF;
    products:=products||jsonb_build_array(product);
  END LOOP;
  -- Crear los faltantes sin cambiar IDs/fotos de productos que ya existían.
  FOR row_spec IN SELECT * FROM jsonb_array_elements(spec) LOOP
    product_id:=row_spec->>'productId';
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(products) p WHERE p->>'id'=product_id) THEN
      product:=jsonb_build_object(
        'id',product_id,'name',row_spec->>'name','productType','resale','category','Bebidas',
        'merchandise',jsonb_build_array(jsonb_build_object('merchId',row_spec->>'merchId','qty',1)),
        'ingredients','[]'::jsonb,'packaging','[]'::jsonb,'combos','[]'::jsonb,'receta_cost',0,
        'porciones',1,'porcionesOverride',1,'porcionLabel','unidad','pesoTotal','','pesoUnit','u',
        'tier','T3','gfPct',0,'avgMes',0,'weeks',jsonb_build_array(0,0,0,0),'star',false,
        'tags','[]'::jsonb,'discount',0,'discountType','pct','channelDiscounts','{}'::jsonb,
        'recetaOnly',false,
        'salesAvailability',jsonb_build_object('paused',false,'resumeAt',null,'updatedAt',now_iso),
        'priceTargets',jsonb_build_object('mostrador',(row_spec->>'price')::numeric),
        'fixedPrices',jsonb_build_object('mostrador',(row_spec->>'price')::numeric),
        'pricingMode','{"mostrador":"fixed"}'::jsonb
      );
      products:=products||jsonb_build_array(product);
      created_count:=created_count+1;
    END IF;
  END LOOP;
  IF created_count<>7 OR jsonb_array_length(products)<>62 OR jsonb_array_length(new_ing)<>55
     OR jsonb_array_length(cat->'mercaderia')<>11 THEN
    RAISE EXCEPTION 'beverage_migration_postcondition_failed'; END IF;
  -- Backup solo dentro del proyecto privado; no exponer compras ni costos en el repo.
  d:=jsonb_set(d,'{beverageMigrationBackup}',jsonb_build_object(
    'migration','beverages_to_merchandise_20261101',
    'versionBefore',297,'catalog',original_cat,'stockItems',original_stock),true);
  cat:=jsonb_set(cat,'{productos}',products);
  cat:=jsonb_set(cat,'{categorias}',cat->'categorias'||jsonb_build_array('Bebidas'));
  d:=jsonb_set(jsonb_set(d,'{catalog}',cat,true),'{stock,items}',stock_rows,true);
  UPDATE public.projects SET data=d,version=version+1,updated_at=clock_timestamp()
   WHERE id=v_project AND version=297;
  IF NOT FOUND THEN RAISE EXCEPTION 'concurrent_project_update'; END IF;
END $$;
SELECT p.version,
  jsonb_array_length(p.data #> '{catalog,ingredientes}') ingredients,
  jsonb_array_length(p.data #> '{catalog,mercaderia}') merchandise,
  jsonb_array_length(p.data #> '{catalog,productos}') products,
  p.data ? 'beverageMigrationBackup' AS rollback_snapshot_available,
  (SELECT count(*) FROM jsonb_array_elements(p.data #> '{catalog,productos}') x
    WHERE x->>'productType'='resale' AND x->>'category'='Bebidas') resale_drinks
FROM public.projects p WHERE p.id='388d9b9c-3805-443a-853f-f459f93edd61'::uuid;