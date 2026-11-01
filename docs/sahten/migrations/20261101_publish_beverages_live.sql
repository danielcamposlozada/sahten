DO $$
DECLARE pid uuid:='388d9b9c-3805-443a-853f-f459f93edd61';sid uuid:='d9b05fcc-1e22-47a1-b3ae-48eacbdff3cc';
d jsonb; old_menu jsonb; new_menu jsonb; cur_items jsonb; added jsonb; hidden jsonb; visible_hidden jsonb; snapshot jsonb; n integer;
BEGIN
 SELECT p.data,m.json INTO d,old_menu FROM public.projects p JOIN public.stores s ON s.project_id=p.id JOIN public.menus m ON m.store_id=s.id
 WHERE p.id=pid AND s.id=sid AND s.slug='sahten' AND p.version=301 FOR UPDATE OF p,m;
 IF d IS NULL OR d ? 'webBeveragesPublishBackup' OR d #>> '{promotions,enabled}' <> 'false'
  OR jsonb_array_length(old_menu->'products')<>28
  OR (SELECT count(*) FROM jsonb_array_elements(d #> '{catalog,productos}') x WHERE x->>'category'='Bebidas')<>11
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(old_menu->'products') x WHERE x->>'category'='Bebidas')
 THEN RAISE EXCEPTION 'catalog_safety_guard'; END IF;
 SELECT jsonb_object_agg(v.product_id,v.visible) INTO snapshot FROM sahten_catalog_private.visibility v
 WHERE v.store_id=sid AND v.product_id IN ('p1793032422487','p1793049167225');
 IF snapshot <> '{"p1793032422487":false,"p1793049167225":false}'::jsonb
 THEN RAISE EXCEPTION 'visibility_safety_guard'; END IF;
 UPDATE sahten_catalog_private.visibility v SET visible=true WHERE v.store_id=sid AND v.product_id IN ('p1793032422487','p1793049167225') AND v.visible=false;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'visibility_update_failed'; END IF;
 SELECT jsonb_agg(CASE WHEN v->>'id'='cocacola_600ml' THEN v || jsonb_build_object('category','Bebidas','name','Coca-Cola 600 ml') ELSE v END ORDER BY ord)
 INTO cur_items FROM jsonb_array_elements(old_menu->'products') WITH ORDINALITY i(v,ord);
 SELECT jsonb_agg(jsonb_build_object(
   'id',v->>'id','name',v->>'name','category','Bebidas','star',false,'tags','[]'::jsonb,'description','',
   'price',(v #>> '{priceTargets,mostrador}')::numeric,
   'image',CASE WHEN (d->'images'->>(v->>'id')) LIKE 'https://%' THEN to_jsonb(d->'images'->>(v->>'id')) ELSE 'null'::jsonb END,
   'salesAvailability',COALESCE(v->'salesAvailability','{"paused":false}'::jsonb)) ORDER BY v->>'name')
 INTO added FROM jsonb_array_elements(d #> '{catalog,productos}') v
 WHERE v->>'category'='Bebidas' AND v->>'id'<>'cocacola_600ml';
 IF jsonb_array_length(cur_items)<>28 OR jsonb_array_length(added)<>10
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(added) a WHERE (a->>'price')::numeric NOT IN (1400,2000,2500))
 THEN RAISE EXCEPTION 'new_menu_invalid'; END IF;
 hidden:=d #> '{online,menuConfig,hiddenProducts}';
 SELECT COALESCE(jsonb_agg(v),'[]'::jsonb) INTO visible_hidden
 FROM jsonb_array_elements(COALESCE(hidden,'[]'::jsonb)) v
 WHERE v #>> '{}' NOT IN ('p1793032422487','p1793049167225','p1793167440976');
 new_menu:=jsonb_set(jsonb_set(old_menu,'{products}',cur_items||added,true),
  '{config,categories}','["Bebidas"]'::jsonb || (old_menu #> '{config,categories}'),true);
 d:=jsonb_set(d,'{webBeveragesPublishBackup}',jsonb_build_object(
 'versionBefore',301,'previousMenu',old_menu,'previousHiddenProducts',hidden,'previousDrinkVisibility',snapshot,'createdAt',clock_timestamp()::text),true);
 d:=jsonb_set(d,'{online,menuConfig,hiddenProducts}',visible_hidden,true);
 UPDATE public.projects SET data=d,version=302,updated_at=clock_timestamp() WHERE id=pid AND version=301;
 IF NOT FOUND THEN RAISE EXCEPTION 'version_conflict'; END IF;
 UPDATE public.menus SET json=new_menu,updated_at=clock_timestamp() WHERE store_id=sid;
 SELECT jsonb_array_length(json->'products') INTO n FROM public.menus WHERE store_id=sid;
 IF n<>38 THEN RAISE EXCEPTION 'after_trigger_expected_38_found_%',n; END IF;
END $$;
SELECT p.version, jsonb_array_length(m.json->'products') as products,
 (SELECT count(*) FROM jsonb_array_elements(m.json->'products') x WHERE x->>'category'='Bebidas') as drinks,
 (SELECT count(*) FROM jsonb_array_elements(m.json->'products') x WHERE x->>'id' IN ('p1793032422487','p1793049167225')) as restored_visibility,
 p.data ? 'webBeveragesPublishBackup' as rollback_ready, m.json->'promotions' as promos
 FROM public.projects p JOIN public.stores s ON s.project_id=p.id JOIN public.menus m ON m.store_id=s.id WHERE s.slug='sahten';