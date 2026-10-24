-- Preparada, no aplicada automáticamente a producción. Configuración en el proyecto/menu existentes.
create schema if not exists sahten_delivery_private;
revoke all on schema sahten_delivery_private from public, anon, authenticated;
create table if not exists sahten_delivery_private.providers(store_id uuid primary key references public.stores(id),secret_id uuid not null,updated_at timestamptz not null default now());
create table if not exists sahten_delivery_private.quotes(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',payload jsonb not null,route jsonb not null,result jsonb not null,revision text not null,requested_at timestamptz,authorized_by uuid,authorization_reason text,authorized_at timestamptz,tariff_exception boolean not null default false);
create table if not exists sahten_delivery_private.submissions(store_id uuid not null references public.stores(id),request_id uuid not null,order_id uuid not null references public.orders(id),primary key(store_id,request_id));
create table if not exists sahten_delivery_private.limits(bucket text primary key,window_at timestamptz not null default now(),hits int not null default 1);
alter table sahten_delivery_private.providers enable row level security;
alter table sahten_delivery_private.quotes enable row level security;
alter table sahten_delivery_private.submissions enable row level security;
alter table sahten_delivery_private.limits enable row level security;
create index if not exists delivery_quotes_pending on sahten_delivery_private.quotes(store_id,requested_at) where requested_at is not null and authorized_at is null;
create or replace function public.sahten_delivery_backend(action text,args jsonb) returns jsonb language plpgsql security definer set search_path=public,sahten_delivery_private as $$
declare q sahten_delivery_private.quotes; sid uuid:=(args->>'store_id')::uuid; secret uuid; oid uuid; hits int; oldp sahten_delivery_private.providers;
begin
 if action='provider_status' then return jsonb_build_object('configured',exists(select 1 from sahten_delivery_private.providers where store_id=sid));
 elsif action='provider' then return (select to_jsonb(p)-'secret_id'||jsonb_build_object('key',v.decrypted_secret) from sahten_delivery_private.providers p join vault.decrypted_secrets v on v.id=p.secret_id where p.store_id=sid);
 elsif action='save_provider' then
  select * into oldp from sahten_delivery_private.providers where store_id=sid for update;
  secret:=vault.create_secret(args->>'key');
  insert into sahten_delivery_private.providers(store_id,secret_id)values(sid,secret) on conflict(store_id)do update set secret_id=excluded.secret_id,updated_at=now();
  if oldp.secret_id is not null then delete from vault.secrets where id=oldp.secret_id; end if;
  return jsonb_build_object('configured',true);
 elsif action='geocode_slot' then
  insert into sahten_delivery_private.limits(bucket,window_at)values('geocode-global',now())on conflict(bucket)do update set window_at=now() where limits.window_at<now()-interval '1 second' returning limits.hits into hits;
  return to_jsonb(hits is not null);
 elsif action='limit' then
  insert into sahten_delivery_private.limits(bucket)values(args->>'bucket')on conflict(bucket)do update set hits=case when limits.window_at<now()-interval '1 minute' then 1 else limits.hits+1 end,window_at=case when limits.window_at<now()-interval '1 minute' then now() else limits.window_at end returning limits.hits into hits;
  return to_jsonb(hits<=least((args->>'max')::int,120));
 elsif action='save_quote' then
  delete from sahten_delivery_private.quotes where expires_at<now()-interval '30 days' or (expires_at<now()-interval '1 day' and requested_at is null);
  delete from sahten_delivery_private.limits where window_at<now()-interval '1 day';
  insert into sahten_delivery_private.quotes(store_id,payload,route,result,revision)values(sid,args->'payload',args->'route',args->'result',args->>'revision')returning * into q;return to_jsonb(q);
 elsif action='quote' then select * into q from sahten_delivery_private.quotes where id=(args->>'id')::uuid and store_id=sid and expires_at>now();return case when found then to_jsonb(q) else null end;
 elsif action='request' then
  update sahten_delivery_private.quotes set requested_at=coalesce(requested_at,now()),payload=args->'payload' where id=(args->>'id')::uuid and store_id=sid and expires_at>now() returning * into q;
  if not found then raise exception 'quote_expired'; end if;return to_jsonb(q);
 elsif action='requests' then return coalesce((select jsonb_agg(to_jsonb(r)) from(select * from sahten_delivery_private.quotes where store_id=sid and requested_at is not null and authorized_at is null and expires_at>now() order by created_at limit 50)r),'[]'::jsonb);
 elsif action='authorize' then
  update sahten_delivery_private.quotes set authorized_by=(args->>'actor')::uuid,authorization_reason=args->>'reason',authorized_at=now(),tariff_exception=coalesce((args->>'tariff_exception')::boolean,false) where id=(args->>'id')::uuid and store_id=sid and expires_at>now() returning * into q;
  if not found then raise exception 'quote_expired'; end if;return to_jsonb(q);
 elsif action='submission' then return (select jsonb_build_object('id',r.id,'order',r.payload) from sahten_delivery_private.submissions s join public.orders r on r.id=s.order_id where s.store_id=sid and s.request_id=(args->>'request_id')::uuid);
 elsif action='order' then
  perform pg_advisory_xact_lock(hashtext(sid::text||(args->>'request_id')));
  select order_id into oid from sahten_delivery_private.submissions where store_id=sid and request_id=(args->>'request_id')::uuid;
  if oid is null then
   insert into public.orders(store_id,payload,status)values(sid,args->'payload','pendiente')returning id into oid;
   insert into sahten_delivery_private.submissions(store_id,request_id,order_id)values(sid,(args->>'request_id')::uuid,oid);
  elsif exists(select 1 from public.orders r where r.id=oid and (r.payload-'id'-'num'-'createdAt'-'status'-'deliverySnapshot')<>((args->'payload')-'id'-'num'-'createdAt'-'status'-'deliverySnapshot')) then raise exception 'order_conflict';
  end if; return (select jsonb_build_object('id',oid,'order',payload) from public.orders where id=oid);
 else raise exception 'invalid_action';end if;
end $$;
revoke all on function public.sahten_delivery_backend(text,jsonb) from public, anon, authenticated;
grant execute on function public.sahten_delivery_backend(text,jsonb) to service_role;
-- Los menús antiguos conservan su compatibilidad; v2 requiere el servidor para todos los medios.
create or replace function public.guard_delivery_v2_order() returns trigger language plpgsql as $$
begin
 if exists(select 1 from public.menus where store_id=new.store_id and (json->'delivery'->'deliveryV2'->>'active')='true') and current_setting('role',true)<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then raise exception 'server_validation_required';end if;
 return new;
end $$;
drop trigger if exists guard_delivery_v2_order on public.orders;
create trigger guard_delivery_v2_order before insert on public.orders for each row execute function public.guard_delivery_v2_order();

-- Prueba de validación de cada nueva venta local con delivery. No es un cobro ni cambia órdenes anteriores.
create table if not exists sahten_delivery_private.pos_validations(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),local_order_id text not null,payload jsonb not null,created_at timestamptz not null default now(),unique(store_id,local_order_id));
alter table sahten_delivery_private.pos_validations enable row level security;
create or replace function public.delivery_order_financials(o jsonb) returns jsonb language sql immutable as $$
 select jsonb_build_object('source',o->'source','lat',o->'lat','lng',o->'lng','address',o->'address','items',o->'items','subtotal',o->'subtotal','shipping',o->'shipping','total',o->'total','discount',coalesce(o->'discountAmount',o->'discount','0'::jsonb),'paymentMethod',o->'paymentMethod','deliverySnapshot',o->'deliverySnapshot');
$$;
create or replace function public.validate_delivery_pos_record(sid uuid,lid text,p jsonb) returns uuid language plpgsql security definer set search_path=public,sahten_delivery_private as $$
declare v sahten_delivery_private.pos_validations;
begin
 select * into v from sahten_delivery_private.pos_validations where store_id=sid and local_order_id=lid for update;
 if found then if public.delivery_order_financials(v.payload)<>public.delivery_order_financials(p) then raise exception 'validation_conflict';end if;return v.id;end if;
 insert into sahten_delivery_private.pos_validations(store_id,local_order_id,payload)values(sid,lid,p)returning id into v.id;return v.id;
end $$;
revoke all on function public.validate_delivery_pos_record(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.validate_delivery_pos_record(uuid,text,jsonb) to service_role;
create or replace function public.assert_delivery_sales(pid uuid,sales jsonb,previous jsonb) returns void language plpgsql security definer set search_path=public,sahten_delivery_private as $$
declare o jsonb; prior jsonb; baseline jsonb; canonical jsonb;
begin
 if not exists(select 1 from public.stores s join public.menus m on m.store_id=s.id where s.project_id=pid and m.json->'delivery'->'deliveryV2'->>'active'='true')then return;end if;
 select data->'sales' into baseline from public.projects where id=pid;
 for o in select value from jsonb_array_elements(coalesce(sales->'orders','[]')) loop
  if coalesce(o->>'source',o->>'orderType','')<>'delivery' then continue;end if;
  select value into prior from jsonb_array_elements(coalesce(previous->'orders',baseline->'orders','[]')) where value->>'id'=o->>'id' limit 1;
  if prior is not null and public.delivery_order_financials(prior)=public.delivery_order_financials(o)then continue;end if;
  -- Los pedidos remotos ya fueron calculados por el servidor (incluido Checkout Pro).
  if o->>'remoteId' is not null and exists(select 1 from public.orders r join public.stores s on s.id=r.store_id where s.project_id=pid and r.id::text=o->>'remoteId' and public.delivery_order_financials(r.payload)=public.delivery_order_financials(o))then continue;end if;
  select v.payload into canonical from sahten_delivery_private.pos_validations v join public.stores s on s.id=v.store_id where s.project_id=pid and v.id::text=o->>'deliveryValidationId' and v.local_order_id=o->>'id';
  if canonical is null or public.delivery_order_financials(canonical)<>public.delivery_order_financials(o) then raise exception 'delivery_server_validation_required';end if;
 end loop;
end $$;
revoke all on function public.assert_delivery_sales(uuid,jsonb,jsonb),public.delivery_order_financials(jsonb) from public,anon,authenticated;
create or replace function public.guard_delivery_sales() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='project_ops' then perform public.assert_delivery_sales(new.project_id,new.sales,case when tg_op='UPDATE' then old.sales else null end);
 else perform public.assert_delivery_sales(new.id,new.data->'sales',old.data->'sales');end if;
 return new;
end $$;
revoke all on function public.guard_delivery_sales() from public,anon,authenticated;
drop trigger if exists guard_delivery_sales on public.project_ops;
create trigger guard_delivery_sales before insert or update on public.project_ops for each row execute function public.guard_delivery_sales();
drop trigger if exists guard_delivery_project_sales on public.projects;
create trigger guard_delivery_project_sales before update of data on public.projects for each row execute function public.guard_delivery_sales();
