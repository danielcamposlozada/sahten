-- ═══════════════════════════════════════════════════════════════════════════
-- Sahten · esquema de Supabase (opcional)
--
-- Cómo usarlo: Supabase › SQL Editor › pegar todo este archivo › Run.
-- Es idempotente: se puede volver a correr.
--
--  C.2  stores · menus · orders        menú publicado + pedidos en tiempo real
--  C.3  projects · project_ops · project_members · project_invites · audit_log
--       sincronización del proyecto, roles, invitaciones y auditoría
--
-- Seguridad:
--  · El cliente web y la app usan SOLO la anon key. NUNCA pongas la service_role key en la app ni en la web.
--  · Todas las tablas tienen RLS. El visitante anónimo solo puede LEER el menú y CREAR pedidos.
--  · Los datos del proyecto (costos, márgenes) no se leen con SELECT: solo con funciones que verifican el rol.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tablas ───────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb,       -- el .sahten completo (solo owner / admin / lectura)
  public      jsonb not null default '{}'::jsonb,       -- versión sin costos ni márgenes, con precios ya calculados (encargado / cajero)
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','admin','encargado','cajero','lectura')),
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin','encargado','cajero','lectura')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists project_invites_unique on public.project_invites (project_id, lower(email));

-- pedidos y stock del día: lo escriben encargado y cajero sin tocar costos ni precios (no chocan con los cambios del dueño)
create table if not exists public.project_ops (
  project_id  uuid primary key references public.projects(id) on delete cascade,
  sales       jsonb not null default '{}'::jsonb,
  stock       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name        text not null default '',
  owner       uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.menus (
  store_id    uuid primary key references public.stores(id) on delete cascade,
  json        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  payload     jsonb not null,
  status      text not null default 'pendiente' check (status in ('pendiente','recibido','preparando','listo','entregado','cancelado')),
  created_at  timestamptz not null default now()
);
create index if not exists orders_store_created on public.orders (store_id, created_at desc);

create table if not exists public.audit_log (
  id          bigserial primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index if not exists audit_project_at on public.audit_log (project_id, at desc);

-- ── Funciones de ayuda (security definer: leen los miembros sin exponerlos) ──
create or replace function public.project_role(pid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = pid and user_id = auth.uid()
$$;

create or replace function public.has_project_role(pid uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.project_role(pid) = any(roles), false)
$$;

create or replace function public.audit(pid uuid, act text, det jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (project_id, user_id, action, detail) values (pid, auth.uid(), act, det)
$$;

-- ── Proyectos: crear, leer y guardar solo con funciones ──────────────────
create or replace function public.create_project(p_name text, p_data jsonb, p_public jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.projects (owner, name, data, public, updated_by) values (auth.uid(), coalesce(p_name,''), coalesce(p_data,'{}'), coalesce(p_public,'{}'), auth.uid()) returning id into pid;
  insert into public.project_members (project_id, user_id, role) values (pid, auth.uid(), 'owner');
  perform public.audit(pid, 'create', jsonb_build_object('name', p_name));
  return pid;
end $$;

-- el .sahten completo: dueño, administrador y lectura
create or replace function public.get_project_data(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_project_role(pid, array['owner','admin','lectura']) then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('data', data, 'version', version, 'updated_at', updated_at, 'name', name) from public.projects where id = pid);
end $$;

-- versión sin costos: cualquier miembro
create or replace function public.get_project_public(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.project_role(pid) is null then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('public', public, 'version', version, 'updated_at', updated_at, 'name', name) from public.projects where id = pid);
end $$;

-- guardar con control de versión: si alguien guardó antes, avisa en vez de pisar
create or replace function public.save_project(pid uuid, p_data jsonb, p_public jsonb, base_version bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur record; newv bigint; last_at timestamptz;
begin
  if not public.has_project_role(pid, array['owner','admin']) then raise exception 'forbidden'; end if;
  select version, updated_at, updated_by into cur from public.projects where id = pid for update;
  if cur.version <> base_version then
    return jsonb_build_object('conflict', true, 'version', cur.version, 'updated_at', cur.updated_at, 'updated_by', cur.updated_by);
  end if;
  update public.projects set data = p_data, public = coalesce(p_public, public), version = version + 1, updated_at = now(), updated_by = auth.uid(), name = coalesce(p_data->'project'->>'name', name)
    where id = pid returning version, updated_at into newv, last_at;
  -- se registra como mucho una vez cada 15 minutos por usuario (el guardado es automático)
  if not exists (select 1 from public.audit_log where project_id = pid and user_id = auth.uid() and action = 'save' and at > now() - interval '15 minutes') then
    perform public.audit(pid, 'save', jsonb_build_object('version', newv));
  end if;
  return jsonb_build_object('ok', true, 'version', newv, 'updated_at', last_at);
end $$;

-- ── Pedidos y stock del día (encargado y cajero) ─────────────────────────
create or replace function public.save_ops(pid uuid, p_sales jsonb, p_stock jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text := public.project_role(pid);
begin
  if r is null or r = 'lectura' then raise exception 'forbidden'; end if;
  if p_stock is not null and r = 'cajero' then raise exception 'forbidden'; end if;   -- el cajero solo toca el Mostrador
  insert into public.project_ops (project_id, sales, stock, updated_by) values (pid, coalesce(p_sales,'{}'), coalesce(p_stock,'{}'), auth.uid())
  on conflict (project_id) do update set sales = coalesce(p_sales, project_ops.sales), stock = coalesce(p_stock, project_ops.stock), updated_at = now(), updated_by = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.get_ops(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.project_role(pid) is null then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('sales', sales, 'stock', stock, 'updated_at', updated_at) from public.project_ops where project_id = pid);
end $$;

-- ── Usuarios: solo el dueño ──────────────────────────────────────────────
create or replace function public.list_members(pid uuid) returns table (user_id uuid, email text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_project_role(pid, array['owner','admin']) then raise exception 'forbidden'; end if;
  return query select m.user_id, u.email::text, m.role from public.project_members m join auth.users u on u.id = m.user_id where m.project_id = pid order by m.created_at;
end $$;

create or replace function public.invite_member(pid uuid, p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare iid uuid;
begin
  if not public.has_project_role(pid, array['owner']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin','encargado','cajero','lectura') then raise exception 'invalid role'; end if;
  insert into public.project_invites (project_id, email, role, created_by) values (pid, lower(trim(p_email)), p_role, auth.uid())
  on conflict (project_id, lower(email)) do update set role = excluded.role, accepted_at = null returning id into iid;
  perform public.audit(pid, 'invite', jsonb_build_object('email', lower(trim(p_email)), 'role', p_role));
  return iid;
end $$;

-- al iniciar sesión: las invitaciones hechas a tu email se convierten en membresías
create or replace function public.accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare mail text := lower(auth.jwt() ->> 'email'); n int := 0; i record;
begin
  if auth.uid() is null or mail is null then return 0; end if;
  for i in select * from public.project_invites where lower(email) = mail and accepted_at is null loop
    insert into public.project_members (project_id, user_id, role) values (i.project_id, auth.uid(), i.role)
    on conflict (project_id, user_id) do update set role = excluded.role;
    update public.project_invites set accepted_at = now() where id = i.id;
    perform public.audit(i.project_id, 'join', jsonb_build_object('role', i.role));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.set_member_role(pid uuid, uid uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_project_role(pid, array['owner']) then raise exception 'forbidden'; end if;
  if p_role not in ('admin','encargado','cajero','lectura') then raise exception 'invalid role'; end if;
  if (select role from public.project_members where project_id = pid and user_id = uid) = 'owner' then raise exception 'cannot change owner'; end if;
  update public.project_members set role = p_role where project_id = pid and user_id = uid;
  perform public.audit(pid, 'role', jsonb_build_object('user', uid, 'role', p_role));
end $$;

create or replace function public.remove_member(pid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_project_role(pid, array['owner']) then raise exception 'forbidden'; end if;
  if (select role from public.project_members where project_id = pid and user_id = uid) = 'owner' then raise exception 'cannot remove owner'; end if;
  delete from public.project_members where project_id = pid and user_id = uid;
  perform public.audit(pid, 'remove', jsonb_build_object('user', uid));
end $$;

create or replace function public.list_audit(pid uuid, lim int default 100) returns setof public.audit_log
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_project_role(pid, array['owner','admin']) then raise exception 'forbidden'; end if;
  return query select * from public.audit_log where project_id = pid order by at desc, id desc limit least(coalesce(lim,100), 500);
end $$;

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.project_ops     enable row level security;
alter table public.stores          enable row level security;
alter table public.menus           enable row level security;
alter table public.orders          enable row level security;
alter table public.audit_log       enable row level security;

-- projects: se listan sin la columna «data» (ni siquiera el dueño la lee con SELECT; usa get_project_data)
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (public.project_role(id) is not null);
-- project_members: cada uno ve sus propias membresías; el resto, con list_members
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members for select to authenticated using (user_id = auth.uid());
-- invitaciones, ops y auditoría: solo por funciones (sin políticas = nadie accede directo)

-- stores: lectura pública mínima (id, slug, name); escribe el dueño de la tienda o admin/dueño del proyecto
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores for select to anon, authenticated using (true);
drop policy if exists stores_write on public.stores;
create policy stores_write on public.stores for all to authenticated
  using (owner = auth.uid() or public.has_project_role(project_id, array['owner','admin']))
  with check (owner = auth.uid() or public.has_project_role(project_id, array['owner','admin']));

-- menus: lectura pública; escritura solo de quien administra la tienda
drop policy if exists menus_select on public.menus;
create policy menus_select on public.menus for select to anon, authenticated using (true);
drop policy if exists menus_write on public.menus;
create policy menus_write on public.menus for all to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin']))))
  with check (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin']))));

-- orders: cualquiera crea un pedido (pendiente, de una tienda que existe, de tamaño razonable); solo el personal los ve y cambia
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to anon, authenticated
  with check (status = 'pendiente' and jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 20000
              and exists (select 1 from public.stores s where s.id = store_id));
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin','encargado','cajero']))));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin','encargado','cajero']))))
  with check (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin','encargado','cajero']))));
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin']))));

-- ── Permisos por columna / función ───────────────────────────────────────
revoke all on public.projects, public.project_members, public.project_invites, public.project_ops, public.audit_log from anon, authenticated;
grant select (id, owner, name, version, updated_at, public) on public.projects to authenticated;
grant select on public.project_members to authenticated;
revoke all on public.stores, public.menus, public.orders from anon, authenticated;
grant select (id, slug, name) on public.stores to anon;
grant select (id, slug, name, owner, project_id, created_at) on public.stores to authenticated;
grant insert (slug, name, owner, project_id), update (slug, name, project_id), delete on public.stores to authenticated;
grant select on public.menus to anon, authenticated;
grant insert, update, delete on public.menus to authenticated;
grant insert (store_id, payload, status) on public.orders to anon, authenticated;
grant select, update (status), delete on public.orders to authenticated;

revoke all on function public.create_project(text, jsonb, jsonb), public.get_project_data(uuid), public.get_project_public(uuid), public.save_project(uuid, jsonb, jsonb, bigint),
  public.save_ops(uuid, jsonb, jsonb), public.get_ops(uuid), public.list_members(uuid), public.invite_member(uuid, text, text), public.accept_invites(),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid), public.list_audit(uuid, int), public.project_role(uuid), public.has_project_role(uuid, text[]), public.audit(uuid, text, jsonb) from public;
grant execute on function public.create_project(text, jsonb, jsonb), public.get_project_data(uuid), public.get_project_public(uuid), public.save_project(uuid, jsonb, jsonb, bigint),
  public.save_ops(uuid, jsonb, jsonb), public.get_ops(uuid), public.list_members(uuid), public.invite_member(uuid, text, text), public.accept_invites(),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid), public.list_audit(uuid, int), public.project_role(uuid), public.has_project_role(uuid, text[]) to authenticated;
-- (public.audit no se concede: solo la usan las otras funciones)

-- ── Tiempo real: pedidos nuevos ──────────────────────────────────────────
-- (No se publica «projects»: Realtime enviaría la fila completa, con los costos, a quien escuche. La vista remota consulta la versión.)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
  end if;
end $$;
