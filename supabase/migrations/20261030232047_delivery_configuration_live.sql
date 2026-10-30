-- Guardado comercial aislado. No publica productos/precios/pagos ni reemplaza los horarios o estados en vivo.
create table if not exists sahten_catalog_private.delivery_configurations (
 store_id uuid primary key references public.stores(id) on delete cascade,
 configuration jsonb not null, revision uuid not null,
 updated_at timestamptz not null default now(), updated_by uuid
);
create table if not exists sahten_catalog_private.delivery_configuration_history (
 store_id uuid not null references public.stores(id) on delete cascade,
 revision uuid not null, configuration jsonb not null,
 updated_at timestamptz not null default now(), updated_by uuid,
 primary key(store_id,revision)
);
alter table sahten_catalog_private.delivery_configurations enable row level security;
alter table sahten_catalog_private.delivery_configuration_history enable row level security;
revoke all on sahten_catalog_private.delivery_configurations,sahten_catalog_private.delivery_configuration_history from public,anon,authenticated;

create or replace function sahten_catalog_private.delivery_config_number(v jsonb,lo numeric,hi numeric) returns boolean
language sql immutable set search_path='' as $$ select case when jsonb_typeof(v)='number' then (v#>>'{}')::numeric between lo and hi else false end $$;
create or replace function sahten_catalog_private.delivery_config_ring(r jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb;
begin
 if jsonb_typeof(r)<>'array' or jsonb_array_length(r) not between 3 and 256 then return false;end if;
 for p in select value from jsonb_array_elements(r) loop
  if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or not sahten_catalog_private.delivery_config_number(p->0,-90,90) or not sahten_catalog_private.delivery_config_number(p->1,-180,180) then return false;end if;
 end loop;return true;
exception when others then return false;
end $$;
create or replace function sahten_catalog_private.valid_delivery_configuration(c jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare o jsonb;l jsonb;p jsonb;z jsonb;b jsonb;r jsonb;ids text[]:='{}';modern boolean;
begin
 if c is null or jsonb_typeof(c)<>'object' or length(c::text)>200000 or c->'version'<>'1'::jsonb or not(c ?& array['version','origin','legacy','policy']) then return false;end if;
 if exists(select 1 from jsonb_object_keys(c) k where k not in ('version','origin','legacy','policy'))then return false;end if;
 o:=c->'origin';l:=c->'legacy';p:=c->'policy';
 if jsonb_typeof(o)<>'object' or not(o ?& array['address','lat','lng']) or jsonb_typeof(o->'address')<>'string' or length(o->>'address')>300 then return false;end if;
 if exists(select 1 from jsonb_object_keys(o) k where k not in ('address','lat','lng'))then return false;end if;
 if (o->'lat'='null'::jsonb) is distinct from (o->'lng'='null'::jsonb) then return false;end if;
 if o->'lat'<>'null'::jsonb and not sahten_catalog_private.delivery_config_number(o->'lat',-90,90) or o->'lng'<>'null'::jsonb and not sahten_catalog_private.delivery_config_number(o->'lng',-180,180) then return false;end if;
 if jsonb_typeof(l)<>'object' or not(l ?& array['zones','deliveryMinOrder','freeShippingMin','costPerKm']) or jsonb_typeof(l->'zones')<>'array' or jsonb_array_length(l->'zones')>20 then return false;end if;
 if exists(select 1 from jsonb_object_keys(l) k where k not in ('zones','deliveryMinOrder','freeShippingMin','costPerKm')) then return false;end if;
 if not sahten_catalog_private.delivery_config_number(l->'deliveryMinOrder',0,1000000000) or not sahten_catalog_private.delivery_config_number(l->'freeShippingMin',0,1000000000) or not sahten_catalog_private.delivery_config_number(l->'costPerKm',0,1000000000) then return false;end if;
 for z in select value from jsonb_array_elements(l->'zones') loop
  if jsonb_typeof(z)<>'object' or jsonb_typeof(z->'id')<>'string' or jsonb_typeof(z->'name')<>'string' or coalesce(length(z->>'id'),0) not between 1 and 100 or coalesce(length(z->>'name'),0) not between 1 and 80 or coalesce(z->>'type','') not in ('circle','polygon') then return false;end if;
  if z->>'id'=any(ids) then return false;end if;ids:=array_append(ids,z->>'id');
  if exists(select 1 from jsonb_object_keys(z) k where k not in ('id','name','type','radiusKm','points','baseCost')) then return false;end if;
  if not sahten_catalog_private.delivery_config_number(z->'baseCost',0,1000000000) or not sahten_catalog_private.delivery_config_number(z->'radiusKm',0,1000) then return false;end if;
  if jsonb_typeof(z->'points')<>'array' or jsonb_array_length(z->'points')>256 then return false;end if;
  if z->>'type'='polygon' and not sahten_catalog_private.delivery_config_ring(z->'points') then return false;end if;
 end loop;
 if p='null'::jsonb then return true;end if;
 if jsonb_typeof(p)<>'object' or not(p ?& array['version','active','promotionsEnabled','stackWithPayment','center','regularMaxKm','maxRouteKm','routingProvider','zones']) or p->'version'<>'2'::jsonb then return false;end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('version','active','promotionsEnabled','stackWithPayment','center','regularMaxKm','maxRouteKm','routingProvider','zones')) then return false;end if;
 if jsonb_typeof(p->'active')<>'boolean' or jsonb_typeof(p->'promotionsEnabled')<>'boolean' or jsonb_typeof(p->'stackWithPayment')<>'boolean' or coalesce(p->>'routingProvider','')<>'openrouteservice' then return false;end if;
 if not sahten_catalog_private.delivery_config_number(p->'regularMaxKm',0.01,8) or not sahten_catalog_private.delivery_config_number(p->'maxRouteKm',0.01,8.5) or (p->>'regularMaxKm')::numeric>(p->>'maxRouteKm')::numeric then return false;end if;
 o:=p->'center';if jsonb_typeof(o)<>'object' or not sahten_catalog_private.delivery_config_number(o->'lat',-90,90) or not sahten_catalog_private.delivery_config_number(o->'lng',-180,180) or jsonb_typeof(o->'verifiedAt')<>'string' or coalesce(length(o->>'verifiedAt'),0) not between 1 and 100 then return false;end if;
 if exists(select 1 from jsonb_object_keys(o) k where k not in ('lat','lng','address','source','verifiedAt')) or coalesce(length(o->>'address'),0)>300 or coalesce(length(o->>'source'),0)>1000 then return false;end if;
 if jsonb_typeof(p->'zones')<>'array' or jsonb_array_length(p->'zones') not between 1 and 20 then return false;end if;ids:='{}';
 for z in select value from jsonb_array_elements(p->'zones') loop
  if jsonb_typeof(z)<>'object' or not(z ?& array['id','name','type','color','enabled','requiresAuthorization','baseCost','minOrder','radiusKm','innerRadiusKm','points','holes','benefits']) then return false;end if;
  if jsonb_typeof(z->'id')<>'string' or jsonb_typeof(z->'name')<>'string' or coalesce(length(z->>'id'),0) not between 1 and 100 or coalesce(length(z->>'name'),0) not between 1 and 80 or z->>'id'=any(ids) then return false;end if;ids:=array_append(ids,z->>'id');
  if exists(select 1 from jsonb_object_keys(z) k where k not in ('id','name','type','color','enabled','requiresAuthorization','baseCost','minOrder','radiusKm','innerRadiusKm','points','holes','benefits'))then return false;end if;
  if coalesce(z->>'type','') not in ('circle','polygon') or coalesce(z->>'color','')!~'^#[0-9a-fA-F]{6}$' or jsonb_typeof(z->'enabled')<>'boolean' or jsonb_typeof(z->'requiresAuthorization')<>'boolean' then return false;end if;
  if not sahten_catalog_private.delivery_config_number(z->'baseCost',0,1000000000) or not sahten_catalog_private.delivery_config_number(z->'minOrder',0,1000000000) or not sahten_catalog_private.delivery_config_number(z->'radiusKm',0.01,8.5) or not sahten_catalog_private.delivery_config_number(z->'innerRadiusKm',0,8.5) or (z->>'innerRadiusKm')::numeric>=(z->>'radiusKm')::numeric then return false;end if;
  if jsonb_typeof(z->'points')<>'array' or jsonb_array_length(z->'points')>256 or jsonb_typeof(z->'holes')<>'array' or jsonb_array_length(z->'holes')>20 then return false;end if;
  if z->>'type'='polygon' then
   if not sahten_catalog_private.delivery_config_ring(z->'points') then return false;end if;
   for r in select value from jsonb_array_elements(z->'holes') loop if not sahten_catalog_private.delivery_config_ring(r) then return false;end if;end loop;
  end if;
  if jsonb_typeof(z->'benefits')<>'array' or jsonb_array_length(z->'benefits')>10 then return false;end if;
  for b in select value from jsonb_array_elements(z->'benefits') loop
   if jsonb_typeof(b)<>'object' or not(b ?& array['threshold','cost']) or exists(select 1 from jsonb_object_keys(b) k where k not in ('threshold','cost')) or not sahten_catalog_private.delivery_config_number(b->'threshold',0.01,1000000000) or not sahten_catalog_private.delivery_config_number(b->'cost',0,(z->>'baseCost')::numeric) then return false;end if;
  end loop;
 end loop;return true;
exception when others then return false;
end $$;

create or replace function sahten_catalog_private.delivery_configuration_from_menu(m jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('version',1,'origin',jsonb_build_object('address',coalesce(m#>'{store,address}','""'::jsonb),'lat',coalesce(m#>'{delivery,lat}',m#>'{store,lat}','null'::jsonb),'lng',coalesce(m#>'{delivery,lng}',m#>'{store,lng}','null'::jsonb)),
 'legacy',jsonb_build_object('zones',coalesce(m#>'{delivery,zones}','[]'::jsonb),'deliveryMinOrder',coalesce(m#>'{delivery,deliveryMinOrder}','0'::jsonb),'freeShippingMin',coalesce(m#>'{delivery,freeShippingMin}','0'::jsonb),'costPerKm',coalesce(m#>'{delivery,costPerKm}','0'::jsonb)),
 'policy',coalesce((m#>'{delivery,deliveryV2}')-array['hours','revision','effectiveAt'],'null'::jsonb))
$$;
create or replace function sahten_catalog_private.apply_delivery_configuration(m jsonb,c jsonb,v uuid,stamp timestamptz) returns jsonb
language plpgsql stable set search_path='' as $$
declare d jsonb;p jsonb;zones jsonb;h jsonb;
begin
 d:=coalesce(m->'delivery','{}')||(c->'legacy')||jsonb_build_object('lat',c#>'{origin,lat}','lng',c#>'{origin,lng}','configurationRevision',v);
 p:=c->'policy';
 if p<>'null'::jsonb then
  select jsonb_agg(z||coalesce((select jsonb_build_object('enabled',coalesce(old->'enabled','true'::jsonb),'requiresAuthorization',coalesce(old->'requiresAuthorization','false'::jsonb)) from jsonb_array_elements(coalesce(m#>'{delivery,deliveryV2,zones}','[]')) old where old->>'id'=z->>'id' limit 1),'{}') order by ord) into zones from jsonb_array_elements(p->'zones') with ordinality a(z,ord);
  p:=p||jsonb_build_object('zones',zones,'revision',v,'effectiveAt',stamp);h:=coalesce(m#>'{delivery,hours}',m#>'{delivery,deliveryV2,hours}');
  if h is not null then p:=p||jsonb_build_object('hours',h);end if;
  d:=d||jsonb_build_object('deliveryV2',p);
 else d:=d-'deliveryV2';end if;
 m:=jsonb_set(m,'{delivery}',d);return jsonb_set(m,'{store}',coalesce(m->'store','{}')||(c->'origin'));
end $$;
create or replace function public.get_store_delivery_configuration(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m jsonb;v uuid;stamp timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and(s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin','encargado','cajero','lectura'])))then raise exception 'forbidden' using errcode='42501';end if;
 select json into m from public.menus where store_id=p_store_id;if not found then return null;end if;
 select revision,updated_at into v,stamp from sahten_catalog_private.delivery_configurations where store_id=p_store_id;
 return jsonb_build_object('configuration',sahten_catalog_private.delivery_configuration_from_menu(m),'revision',v,'updatedAt',stamp);
end $$;
revoke all on function public.get_store_delivery_configuration(uuid) from public,anon;
grant execute on function public.get_store_delivery_configuration(uuid) to authenticated;

create or replace function public.set_store_delivery_configuration(p_store_id uuid,p_configuration jsonb,p_expected_revision uuid,p_request_id uuid,p_parent_revision uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m jsonb;current_revision uuid;previous jsonb;stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and(s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin'])))then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or not sahten_catalog_private.valid_delivery_configuration(p_configuration)then raise exception 'invalid_delivery_configuration' using errcode='22023';end if;
 select json into m from public.menus where store_id=p_store_id for update;if not found then raise exception 'menu_not_published';end if;
 select revision,configuration into current_revision,previous from sahten_catalog_private.delivery_configurations where store_id=p_store_id;
 if current_revision=p_request_id then
  if previous<>p_configuration then raise exception 'delivery_configuration_conflict' using errcode='40001';end if;
  return public.get_store_delivery_configuration(p_store_id);
 end if;
 if exists(select 1 from sahten_catalog_private.delivery_configuration_history where store_id=p_store_id and revision=p_request_id)then raise exception 'delivery_configuration_conflict' using errcode='40001';end if;
 if current_revision is distinct from p_expected_revision and(p_parent_revision is null or current_revision is distinct from p_parent_revision)then raise exception 'delivery_configuration_conflict' using errcode='40001';end if;
 insert into sahten_catalog_private.delivery_configurations(store_id,configuration,revision,updated_at,updated_by)values(p_store_id,p_configuration,p_request_id,stamp,auth.uid())
 on conflict(store_id)do update set configuration=excluded.configuration,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into sahten_catalog_private.delivery_configuration_history(store_id,configuration,revision,updated_at,updated_by)values(p_store_id,p_configuration,p_request_id,stamp,auth.uid());
 update public.menus set json=sahten_catalog_private.apply_delivery_configuration(m,p_configuration,p_request_id,stamp),updated_at=stamp where store_id=p_store_id;
 return public.get_store_delivery_configuration(p_store_id);
end $$;
revoke all on function public.set_store_delivery_configuration(uuid,jsonb,uuid,uuid,uuid) from public,anon;
grant execute on function public.set_store_delivery_configuration(uuid,jsonb,uuid,uuid,uuid) to authenticated;

create or replace function sahten_catalog_private.protect_delivery_configuration() returns trigger
language plpgsql security definer set search_path='' as $$
declare c record;
begin
 select * into c from sahten_catalog_private.delivery_configurations where store_id=new.store_id;
 if found then new.json:=sahten_catalog_private.apply_delivery_configuration(new.json,c.configuration,c.revision,c.updated_at);end if;
 return new;
end $$;
drop trigger if exists sahten_menu_delivery_configuration on public.menus;
-- Se ejecuta antes de los protectores existentes de estados por zona y horarios.
create trigger sahten_menu_delivery_configuration before insert or update on public.menus for each row execute function sahten_catalog_private.protect_delivery_configuration();
revoke all on function sahten_catalog_private.delivery_config_number(jsonb,numeric,numeric),sahten_catalog_private.delivery_config_ring(jsonb),sahten_catalog_private.valid_delivery_configuration(jsonb),sahten_catalog_private.delivery_configuration_from_menu(jsonb),sahten_catalog_private.apply_delivery_configuration(jsonb,jsonb,uuid,timestamptz),sahten_catalog_private.protect_delivery_configuration() from public,anon,authenticated;
