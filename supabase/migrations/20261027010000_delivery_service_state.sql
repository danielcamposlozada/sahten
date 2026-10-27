-- Pausa operativa por negocio: independiente de tarifas, catálogo y horario.
create table if not exists sahten_catalog_private.delivery_service_state (
 store_id uuid primary key references public.stores(id) on delete cascade,
 enabled boolean not null, updated_at timestamptz not null default now(), updated_by uuid
);
alter table sahten_catalog_private.delivery_service_state enable row level security;
revoke all on sahten_catalog_private.delivery_service_state from public,anon,authenticated;

create or replace function public.set_delivery_service_state(p_store_id uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin']))) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'invalid_delivery_state';end if;
 select json into m from public.menus where store_id=p_store_id for update;
 if not found then raise exception 'menu_not_published';end if;
 insert into sahten_catalog_private.delivery_service_state(store_id,enabled,updated_by)values(p_store_id,p_enabled,auth.uid())
 on conflict(store_id)do update set enabled=excluded.enabled,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
 result:=jsonb_build_object('enabled',p_enabled,'updatedAt',clock_timestamp());
 update public.menus set json=jsonb_set(m,'{delivery}',coalesce(m->'delivery','{}')||jsonb_build_object('enabled',p_enabled)),updated_at=now() where store_id=p_store_id;
 return result;
end $$;
revoke all on function public.set_delivery_service_state(uuid,boolean) from public,anon;
grant execute on function public.set_delivery_service_state(uuid,boolean) to authenticated;

create or replace function public.get_delivery_service_state(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin','encargado','cajero','lectura']))) then raise exception 'forbidden' using errcode='42501';end if;
 return (select jsonb_build_object('enabled',coalesce((m.json #>> '{delivery,enabled}')::boolean,true)) from public.menus m where m.store_id=p_store_id);
end $$;
revoke all on function public.get_delivery_service_state(uuid) from public,anon;
grant execute on function public.get_delivery_service_state(uuid) to authenticated;

-- Una publicación completa desde una copia vieja nunca reabre el servicio.
create or replace function sahten_catalog_private.protect_delivery_service_state() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare value boolean;
begin
 select enabled into value from sahten_catalog_private.delivery_service_state where store_id=new.store_id;
 if found then new.json:=jsonb_set(new.json,'{delivery}',coalesce(new.json->'delivery','{}')||jsonb_build_object('enabled',value));end if;
 return new;
end $$;
revoke all on function sahten_catalog_private.protect_delivery_service_state() from public,anon,authenticated;
drop trigger if exists sahten_menu_delivery_service on public.menus;
create trigger sahten_menu_delivery_service before insert or update on public.menus for each row execute function sahten_catalog_private.protect_delivery_service_state();

-- Última defensa para páginas antiguas que envían por REST. Solo nuevas órdenes.
create or replace function sahten_catalog_private.check_delivery_service_state() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb;
begin
 if new.payload->>'source'<>'delivery' or new.payload->>'source' is null then return new;end if;
 -- Una reserva de Checkout Pro ya iniciada debe poder acreditar su pago posterior.
 if coalesce(auth.jwt()->>'role','')='service_role' and new.payment_provider='mercadopago' then return new;end if;
 select json into m from public.menus where store_id=new.store_id for update;
 if m #> '{delivery,enabled}'='false'::jsonb then raise exception 'delivery_service_paused';end if;
 return new;
end $$;
revoke all on function sahten_catalog_private.check_delivery_service_state() from public,anon,authenticated;
drop trigger if exists sahten_order_delivery_service on public.orders;
create trigger sahten_order_delivery_service before insert on public.orders for each row execute function sahten_catalog_private.check_delivery_service_state();

-- Cierra también la carrera entre calcular el total e iniciar un checkout nuevo.
create or replace function sahten_catalog_private.check_delivery_checkout_state() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb;
begin
 if new.order_payload->>'source'='delivery' then
  select json into m from public.menus where store_id=new.store_id for update;
  if m #> '{delivery,enabled}'='false'::jsonb then raise exception 'delivery_service_paused';end if;
 end if;
 return new;
end $$;
revoke all on function sahten_catalog_private.check_delivery_checkout_state() from public,anon,authenticated;
do $$ begin
 if to_regclass('sahten_private.mp_checkouts') is not null then
  drop trigger if exists sahten_checkout_delivery_service on sahten_private.mp_checkouts;
  create trigger sahten_checkout_delivery_service before insert on sahten_private.mp_checkouts for each row execute function sahten_catalog_private.check_delivery_checkout_state();
 end if;
end $$;
