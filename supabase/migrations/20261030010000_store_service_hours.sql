-- Calendarios operativos aislados. No publica productos, precios, tarifas ni proyectos.
create table if not exists sahten_catalog_private.store_service_hours (
 store_id uuid not null references public.stores(id) on delete cascade,
 kind text not null check(kind in ('opening','delivery')),
 hours jsonb not null, revision uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now(), updated_by uuid,
 primary key(store_id,kind)
);
alter table sahten_catalog_private.store_service_hours enable row level security;
revoke all on sahten_catalog_private.store_service_hours from public,anon,authenticated;

create or replace function sahten_catalog_private.valid_service_hours(h jsonb) returns boolean
language plpgsql stable set search_path=pg_catalog,public as $$
declare periods jsonb; p jsonb; ex jsonb; dates text[]:='{}';
begin
 if h is null or jsonb_typeof(h)<>'object' or not (h ?& array['enabled','timeZone','weekly','exceptions']) or jsonb_typeof(h->'enabled')<>'boolean'
 or jsonb_typeof(h->'timeZone')<>'string' or not exists(select 1 from pg_timezone_names where name=h->>'timeZone')
 or jsonb_typeof(h->'weekly')<>'array' or jsonb_array_length(h->'weekly')<>7
 or jsonb_typeof(h->'exceptions')<>'array' or jsonb_array_length(h->'exceptions')>366 then return false;end if;
 if exists(select 1 from jsonb_object_keys(h) k where k not in ('enabled','timeZone','weekly','exceptions')) then return false;end if;
 for ex in select value from jsonb_array_elements(h->'exceptions') loop
  if jsonb_typeof(ex)<>'object' or coalesce(ex->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or to_char((ex->>'date')::date,'YYYY-MM-DD')<>ex->>'date' or (ex->>'date')=any(dates) then return false;end if;
  if exists(select 1 from jsonb_object_keys(ex) k where k not in ('date','periods')) then return false;end if;
  dates:=array_append(dates,ex->>'date');
 end loop;
 for periods in select value from jsonb_array_elements(h->'weekly') union all select value->'periods' from jsonb_array_elements(h->'exceptions') loop
  if periods is null or jsonb_typeof(periods)<>'array' or jsonb_array_length(periods)>4 then return false;end if;
  for p in select value from jsonb_array_elements(periods) loop
   if jsonb_typeof(p)<>'object' or coalesce(p->>'start','')!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p->>'end','')!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' or p->>'start'=p->>'end' then return false;end if;
   if exists(select 1 from jsonb_object_keys(p) k where k not in ('start','end')) then return false;end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;

create or replace function sahten_catalog_private.service_hours_open(h jsonb,stamp timestamptz) returns boolean
language plpgsql stable set search_path=pg_catalog,public,sahten_catalog_private as $$
declare local_now timestamp; today date; target date; periods jsonb; ex jsonb; p jsonb; start_at timestamp; end_at timestamp; offset_day integer;
begin
 if h is null or h='null'::jsonb then return true;end if;
 if not sahten_catalog_private.valid_service_hours(h) then return false;end if;
 if h->>'enabled'='false' then return true;end if;
 local_now:=stamp at time zone (h->>'timeZone');today:=local_now::date;
 if exists(select 1 from jsonb_array_elements(h->'exceptions') e where e->>'date'=today::text and jsonb_array_length(e->'periods')=0)then return false;end if;
 for offset_day in -1..0 loop
  target:=today+offset_day;
  select value into ex from jsonb_array_elements(h->'exceptions') where value->>'date'=target::text;
  periods:=case when ex is not null then ex->'periods' else h->'weekly'->extract(dow from target)::integer end;
  for p in select value from jsonb_array_elements(periods) loop
   start_at:=target+(p->>'start')::time;end_at:=target+(p->>'end')::time;
   if end_at<start_at then end_at:=end_at+interval '1 day';end if;
   if local_now>=start_at and local_now<end_at then return true;end if;
  end loop;
 end loop;
 return false;
end $$;

create or replace function sahten_catalog_private.apply_service_hours(m jsonb,kind text,h jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog,public as $$
declare d jsonb;
begin
 if kind='opening' then return jsonb_set(m,'{store}',coalesce(m->'store','{}')||jsonb_build_object('openingHours',h));end if;
 d:=coalesce(m->'delivery','{}')||jsonb_build_object('hours',h);
 if jsonb_typeof(d->'deliveryV2')='object' then d:=jsonb_set(d,'{deliveryV2}',(d->'deliveryV2')||jsonb_build_object('hours',h));end if;
 return jsonb_set(m,'{delivery}',d);
end $$;

create or replace function public.set_store_service_hours(p_store_id uuid,p_kind text,p_hours jsonb,p_expected_revision uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; current_revision uuid; next_revision uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin'])))then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind not in ('opening','delivery') or p_kind is null or not sahten_catalog_private.valid_service_hours(p_hours) then raise exception 'invalid_service_hours' using errcode='22023';end if;
 select json into m from public.menus where store_id=p_store_id for update;
 if not found then raise exception 'menu_not_published';end if;
 select revision into current_revision from sahten_catalog_private.store_service_hours where store_id=p_store_id and kind=p_kind;
 if current_revision is distinct from p_expected_revision then raise exception 'service_hours_conflict' using errcode='40001';end if;
 insert into sahten_catalog_private.store_service_hours(store_id,kind,hours,revision,updated_by)values(p_store_id,p_kind,p_hours,next_revision,auth.uid())
 on conflict(store_id,kind)do update set hours=excluded.hours,revision=excluded.revision,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
 update public.menus set json=sahten_catalog_private.apply_service_hours(m,p_kind,p_hours),updated_at=clock_timestamp() where store_id=p_store_id;
 return jsonb_build_object('hours',p_hours,'revision',next_revision);
end $$;
revoke all on function public.set_store_service_hours(uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.set_store_service_hours(uuid,text,jsonb,uuid) to authenticated;

create or replace function public.get_store_service_hours(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; result jsonb:='{}';v_kind text;h jsonb;v uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin','encargado','cajero','lectura'])))then raise exception 'forbidden' using errcode='42501';end if;
 select json into m from public.menus where store_id=p_store_id;
 foreach v_kind in array array['opening','delivery'] loop
  select hours,revision into h,v from sahten_catalog_private.store_service_hours s where s.store_id=p_store_id and s.kind=v_kind;
  if not found then h:=case when v_kind='opening' then m#>'{store,openingHours}' else coalesce(m#>'{delivery,hours}',m#>'{delivery,deliveryV2,hours}') end;v:=null;end if;
  result:=result||jsonb_build_object(v_kind,jsonb_build_object('hours',h,'revision',v));
 end loop;
 return result;
end $$;
revoke all on function public.get_store_service_hours(uuid) from public,anon;
grant execute on function public.get_store_service_hours(uuid) to authenticated;

-- Una publicación desde una app vieja no reemplaza los horarios operativos confirmados.
create or replace function sahten_catalog_private.protect_service_hours() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare entry record;
begin
 for entry in select kind,hours from sahten_catalog_private.store_service_hours where store_id=new.store_id loop
  new.json:=sahten_catalog_private.apply_service_hours(new.json,entry.kind,entry.hours);
 end loop;
 return new;
end $$;
drop trigger if exists sahten_menu_service_hours on public.menus;
create trigger sahten_menu_service_hours before insert or update on public.menus for each row execute function sahten_catalog_private.protect_service_hours();

create or replace function sahten_catalog_private.assert_order_service_hours(sid uuid,o jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; h jsonb;
begin
 if coalesce(o->>'source','') not in ('pickup','delivery') then return;end if;
 select json into m from public.menus where store_id=sid for update;
 h:=case when o->>'source'='pickup' then m#>'{store,openingHours}' else coalesce(m#>'{delivery,hours}',m#>'{delivery,deliveryV2,hours}') end;
 if not sahten_catalog_private.service_hours_open(h,clock_timestamp()) then
  if o->>'source'='pickup' then raise exception 'pickup_closed';else raise exception 'delivery_hours_closed';end if;
 end if;
end $$;
create or replace function sahten_catalog_private.check_order_service_hours() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
begin
 -- Acreditar un Checkout Pro iniciado antes del cierre conserva su curso.
 if coalesce(auth.jwt()->>'role','')='service_role' and new.payment_provider='mercadopago' then return new;end if;
 perform sahten_catalog_private.assert_order_service_hours(new.store_id,new.payload);return new;
end $$;
drop trigger if exists sahten_order_service_hours on public.orders;
create trigger sahten_order_service_hours before insert on public.orders for each row execute function sahten_catalog_private.check_order_service_hours();
create or replace function sahten_catalog_private.check_checkout_service_hours() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
begin
 perform sahten_catalog_private.assert_order_service_hours(new.store_id,new.order_payload);return new;
end $$;
do $$ begin
 if to_regclass('sahten_private.mp_checkouts') is not null then
  drop trigger if exists sahten_checkout_service_hours on sahten_private.mp_checkouts;
  create trigger sahten_checkout_service_hours before insert on sahten_private.mp_checkouts for each row execute function sahten_catalog_private.check_checkout_service_hours();
 end if;
end $$;
revoke all on function sahten_catalog_private.valid_service_hours(jsonb),sahten_catalog_private.service_hours_open(jsonb,timestamptz),sahten_catalog_private.apply_service_hours(jsonb,text,jsonb),sahten_catalog_private.protect_service_hours(),sahten_catalog_private.assert_order_service_hours(uuid,jsonb),sahten_catalog_private.check_order_service_hours(),sahten_catalog_private.check_checkout_service_hours() from public,anon,authenticated;
