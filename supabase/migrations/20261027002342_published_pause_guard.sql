-- Una copia importada puede publicar una pausa antes de generar un estado privado.
-- El estado privado tiene prioridad; si no existe, se respeta el catálogo publicado.
create or replace function sahten_catalog_private.check_order_sales_availability() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare item jsonb;pid text;availability jsonb;resume_time timestamptz;
begin
 for item in select value from jsonb_array_elements(coalesce(new.payload->'items','[]')) loop
  pid:=coalesce(item->>'productId',item->>'id');
  select jsonb_build_object('paused',a.paused,'resumeAt',a.resume_at) into availability
   from sahten_catalog_private.sales_availability a where a.store_id=new.store_id and a.product_id=pid;
  if not found then
   select p.value->'salesAvailability' into availability from public.menus m,
    lateral jsonb_array_elements(coalesce(m.json->'products','[]')) p
    where m.store_id=new.store_id and p.value->>'id'=pid limit 1;
  end if;
  if availability->'paused'='true'::jsonb then
   begin resume_time:=nullif(availability->>'resumeAt','')::timestamptz;
   exception when invalid_datetime_format or datetime_field_overflow then raise exception 'product_paused';end;
   if resume_time is null or resume_time>now() then raise exception 'product_paused';end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function sahten_catalog_private.check_order_sales_availability() from public,anon,authenticated;
