-- Solo dos estados por zona. No publica tarifas, geometrías, horarios ni el proyecto.
create table if not exists sahten_catalog_private.delivery_zone_states (
 store_id uuid not null references public.stores(id) on delete cascade,
 zone_id text not null,
 flag text not null check(flag in ('enabled','requiresAuthorization')),
 enabled boolean not null,
 updated_at timestamptz not null default now(), updated_by uuid,
 primary key(store_id,zone_id,flag)
);
alter table sahten_catalog_private.delivery_zone_states enable row level security;
revoke all on sahten_catalog_private.delivery_zone_states from public,anon,authenticated;

create or replace function public.set_delivery_zone_state(p_store_id uuid,p_zone_id text,p_flag text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; zones jsonb; matches integer;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin']))) then raise exception 'forbidden' using errcode='42501';end if;
 if p_enabled is null or p_flag is null or p_flag not in ('enabled','requiresAuthorization') or p_zone_id is null or length(p_zone_id) not between 1 and 100 then raise exception 'invalid_zone_state';end if;
 select json into m from public.menus where store_id=p_store_id for update;
 if not found then raise exception 'menu_not_published';end if;
 select count(*) into matches from jsonb_array_elements(coalesce(m #> '{delivery,deliveryV2,zones}','[]')) z where z->>'id'=p_zone_id;
 if matches<>1 then raise exception 'zone_not_published';end if;
 insert into sahten_catalog_private.delivery_zone_states(store_id,zone_id,flag,enabled,updated_by) values(p_store_id,p_zone_id,p_flag,p_enabled,auth.uid())
 on conflict(store_id,zone_id,flag)do update set enabled=excluded.enabled,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
 select jsonb_agg(case when z->>'id'=p_zone_id then z||jsonb_build_object(p_flag,p_enabled) else z end order by ord) into zones from jsonb_array_elements(m #> '{delivery,deliveryV2,zones}') with ordinality a(z,ord);
 update public.menus set json=jsonb_set(m,'{delivery,deliveryV2,zones}',zones),updated_at=now() where store_id=p_store_id;
 return jsonb_build_object('id',p_zone_id,'flag',p_flag,'enabled',p_enabled);
end $$;
revoke all on function public.set_delivery_zone_state(uuid,text,text,boolean) from public,anon;
grant execute on function public.set_delivery_zone_state(uuid,text,text,boolean) to authenticated;

create or replace function public.get_delivery_zone_states(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare m jsonb; zones jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin','encargado','cajero','lectura']))) then raise exception 'forbidden' using errcode='42501';end if;
 select json into m from public.menus where store_id=p_store_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',z->>'id','enabled',coalesce(z->'enabled','true'::jsonb),'requiresAuthorization',coalesce(z->'requiresAuthorization','false'::jsonb)) order by ord),'[]') into zones from jsonb_array_elements(coalesce(m #> '{delivery,deliveryV2,zones}','[]')) with ordinality a(z,ord);
 return jsonb_build_object('revision',m #>> '{delivery,deliveryV2,revision}','zones',zones);
end $$;
revoke all on function public.get_delivery_zone_states(uuid) from public,anon;
grant execute on function public.get_delivery_zone_states(uuid) to authenticated;

-- Una copia vieja del catálogo no puede revertir una decisión operativa en vivo.
create or replace function sahten_catalog_private.protect_delivery_zone_states() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare zones jsonb;
begin
 if jsonb_typeof(new.json #> '{delivery,deliveryV2,zones}')<>'array' then return new;end if;
 select jsonb_agg(z||coalesce((select jsonb_object_agg(s.flag,to_jsonb(s.enabled)) from sahten_catalog_private.delivery_zone_states s where s.store_id=new.store_id and s.zone_id=z->>'id'),'{}') order by ord) into zones from jsonb_array_elements(new.json #> '{delivery,deliveryV2,zones}') with ordinality a(z,ord);
 if zones is not null then new.json:=jsonb_set(new.json,'{delivery,deliveryV2,zones}',zones);end if;
 return new;
end $$;
revoke all on function sahten_catalog_private.protect_delivery_zone_states() from public,anon,authenticated;
drop trigger if exists sahten_menu_delivery_zone_states on public.menus;
create trigger sahten_menu_delivery_zone_states before insert or update on public.menus for each row execute function sahten_catalog_private.protect_delivery_zone_states();
