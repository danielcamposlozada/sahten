-- Solo estados. Los precios se toman del catálogo ya publicado, nunca del interruptor.
create schema if not exists sahten_catalog_private;
revoke all on schema sahten_catalog_private from public,anon,authenticated;
create table if not exists sahten_catalog_private.visibility(
 store_id uuid references public.stores(id) on delete cascade,
 product_id text not null,visible boolean not null,product jsonb not null,position integer not null default 0,
 updated_at timestamptz not null default now(),primary key(store_id,product_id)
);
create table if not exists sahten_catalog_private.sales_availability(
 store_id uuid references public.stores(id) on delete cascade,
 product_id text not null,paused boolean not null,resume_at timestamptz,
 updated_at timestamptz not null default now(),updated_by uuid,primary key(store_id,product_id)
);
alter table sahten_catalog_private.visibility enable row level security;
alter table sahten_catalog_private.sales_availability enable row level security;
revoke all on sahten_catalog_private.visibility,sahten_catalog_private.sales_availability from public,anon,authenticated;

create or replace function sahten_catalog_private.protect_availability() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare item jsonb; previous jsonb; intent record; saved record; pause record; pos integer:=0; items jsonb:='[]';
begin
 -- Este marcador solo viene de una publicación completa confirmada. Se quita del JSON público.
 if jsonb_typeof(new.json #> '{config,productVisibility}')='object' then
  for intent in select key,value from jsonb_each(new.json #> '{config,productVisibility}') loop
   if jsonb_typeof(intent.value)<>'boolean' then raise exception 'invalid_visibility'; end if;
   previous:=null;
   if tg_op='UPDATE' then select x.value,(x.ordinality-1)::integer into previous,pos from jsonb_array_elements(coalesce(old.json->'products','[]')) with ordinality x where x.value->>'id'=intent.key limit 1; end if;
   if previous is not null then
    insert into sahten_catalog_private.visibility(store_id,product_id,visible,product,position) values(new.store_id,intent.key,intent.value::boolean,previous,coalesce(pos,0))
     on conflict(store_id,product_id) do update set visible=excluded.visible,updated_at=now();
   else update sahten_catalog_private.visibility set visible=intent.value::boolean,updated_at=now() where store_id=new.store_id and product_id=intent.key; end if;
  end loop;
 end if;
 pos:=0;
 for item in select value from jsonb_array_elements(coalesce(new.json->'products','[]')) loop
  select * into saved from sahten_catalog_private.visibility where store_id=new.store_id and product_id=item->>'id';
  select * into pause from sahten_catalog_private.sales_availability where store_id=new.store_id and product_id=item->>'id';
  if found then item:=jsonb_set(item,'{salesAvailability}',jsonb_build_object('paused',pause.paused,'resumeAt',pause.resume_at,'updatedAt',pause.updated_at)); end if;
  if saved.product_id is not null then update sahten_catalog_private.visibility set product=item,position=pos where store_id=new.store_id and product_id=item->>'id'; end if;
  if saved.visible is distinct from false then items:=items||jsonb_build_array(item); end if;
  pos:=pos+1;
 end loop;
 new.json:=jsonb_set(new.json #- '{config,productVisibility}','{products}',items);
 return new;
end $$;
revoke all on function sahten_catalog_private.protect_availability() from public,anon,authenticated;
drop trigger if exists sahten_menu_availability on public.menus;
create trigger sahten_menu_availability before insert or update on public.menus for each row execute function sahten_catalog_private.protect_availability();

create or replace function public.set_menu_product_visibility(p_store_id uuid,p_product_id text,p_visible boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare menu jsonb; items jsonb; item jsonb; saved record; pos integer;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin']))) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_visible is null or p_product_id is null or length(p_product_id) not between 1 and 200 then raise exception 'invalid_visibility'; end if;
 select json into menu from public.menus where store_id=p_store_id for update;
 if not found then raise exception 'menu_not_published'; end if;
 items:=coalesce(menu->'products','[]');
 select x.value,(x.ordinality-1)::integer into item,pos from jsonb_array_elements(items) with ordinality x where x.value->>'id'=p_product_id limit 1;
 select * into saved from sahten_catalog_private.visibility where store_id=p_store_id and product_id=p_product_id;
 if item is null then item:=saved.product;pos:=saved.position;end if;
 if item is null then
  if not p_visible then return jsonb_build_object('id',p_product_id,'visible',false,'published',false);end if;
  raise exception 'product_not_published';
 end if;
 if p_visible and nullif(item->>'category','') is not null and jsonb_array_length(coalesce(menu #> '{config,categories}','[]'))>0 and not (menu #> '{config,categories}') ? (item->>'category') then raise exception 'category_not_published';end if;
 insert into sahten_catalog_private.visibility(store_id,product_id,visible,product,position) values(p_store_id,p_product_id,p_visible,item,coalesce(pos,0))
 on conflict(store_id,product_id) do update set visible=excluded.visible,product=excluded.product,position=excluded.position,updated_at=now();
 if p_visible then
  if not exists(select 1 from jsonb_array_elements(items) x where x->>'id'=p_product_id) then items:=jsonb_insert(items,array[greatest(0,coalesce(pos,0))::text],item);end if;
 else select coalesce(jsonb_agg(value order by ordinality),'[]') into items from jsonb_array_elements(items) with ordinality where value->>'id'<>p_product_id;end if;
 update public.menus set json=jsonb_set(menu,'{products}',items),updated_at=now() where store_id=p_store_id;
 return jsonb_build_object('id',p_product_id,'visible',p_visible);
end $$;
revoke all on function public.set_menu_product_visibility(uuid,text,boolean) from public,anon;
grant execute on function public.set_menu_product_visibility(uuid,text,boolean) to authenticated;

create or replace function public.set_product_sales_availability(p_store_id uuid,p_product_id text,p_paused boolean,p_resume_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare menu jsonb; state jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin']))) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_paused is null or p_product_id is null or length(p_product_id) not between 1 and 200 then raise exception 'invalid_availability'; end if;
 if p_resume_at is not null and (not p_paused or p_resume_at<=now()) then raise exception 'invalid_resume_time';end if;
 -- Mismo orden de bloqueo que publicar y ocultar: menú primero, estado después.
 select json into menu from public.menus where store_id=p_store_id for update;
 insert into sahten_catalog_private.sales_availability(store_id,product_id,paused,resume_at,updated_by) values(p_store_id,p_product_id,p_paused,p_resume_at,auth.uid())
 on conflict(store_id,product_id) do update set paused=excluded.paused,resume_at=excluded.resume_at,updated_at=now(),updated_by=excluded.updated_by;
 state:=jsonb_build_object('paused',p_paused,'resumeAt',p_resume_at,'updatedAt',now());
 if menu is not null then update public.menus set json=menu,updated_at=now() where store_id=p_store_id;end if;
 return jsonb_build_object('id',p_product_id,'salesAvailability',state);
end $$;
revoke all on function public.set_product_sales_availability(uuid,text,boolean,timestamptz) from public,anon;
grant execute on function public.set_product_sales_availability(uuid,text,boolean,timestamptz) to authenticated;

create or replace function public.get_product_sales_availability(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' and (auth.uid() is null or not exists(select 1 from public.stores s where s.id=p_store_id and (s.owner=auth.uid() or public.has_project_role(s.project_id,array['owner','admin','encargado','cajero','lectura'])))) then raise exception 'forbidden' using errcode='42501';end if;
 return jsonb_build_object('sales',coalesce((select jsonb_agg(jsonb_build_object('id',product_id,'salesAvailability',jsonb_build_object('paused',paused,'resumeAt',resume_at,'updatedAt',updated_at))) from sahten_catalog_private.sales_availability where store_id=p_store_id),'[]'), 'visibility',coalesce((select jsonb_agg(jsonb_build_object('id',product_id,'visible',visible)) from sahten_catalog_private.visibility where store_id=p_store_id),'[]'));
end $$;
revoke all on function public.get_product_sales_availability(uuid) from public,anon;
grant execute on function public.get_product_sales_availability(uuid) to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.get_product_sales_availability(uuid) to service_role; end if;end $$;

-- Defensa adicional para las tiendas antiguas que todavía crean pedidos por REST.
create or replace function sahten_catalog_private.check_order_sales_availability() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,sahten_catalog_private as $$
declare item jsonb;pid text;
begin
 for item in select value from jsonb_array_elements(coalesce(new.payload->'items','[]')) loop
  pid:=coalesce(item->>'productId',item->>'id');
  if exists(select 1 from sahten_catalog_private.sales_availability a where a.store_id=new.store_id and a.product_id=pid and a.paused and (a.resume_at is null or a.resume_at>now())) then raise exception 'product_paused';end if;
 end loop;
 return new;
end $$;
revoke all on function sahten_catalog_private.check_order_sales_availability() from public,anon,authenticated;
drop trigger if exists sahten_order_sales_availability on public.orders;
create trigger sahten_order_sales_availability before insert on public.orders for each row execute function sahten_catalog_private.check_order_sales_availability();
