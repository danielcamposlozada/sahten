-- Ejecutar DESPUÉS de schema.sql. Fotos de menú públicas; escritura solo dueño/admin.
-- Idempotente. Nunca se guardan claves privadas ni datos del negocio en este bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sahten-photos', 'sahten-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create schema if not exists sahten_private;
revoke all on schema sahten_private from public, anon;
grant usage on schema sahten_private to authenticated;

create or replace function sahten_private.can_manage_store_photos(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.stores s where s.id::text = folder
      and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin']))
  )
$$;
revoke all on function sahten_private.can_manage_store_photos(text) from public, anon;
grant execute on function sahten_private.can_manage_store_photos(text) to authenticated;

-- Clientes anteriores no envían fotos: esa ausencia no significa que se hayan eliminado.
-- La versión 1 del protocolo sí puede publicar un mapa vacío para borrarlas a propósito.
create or replace function sahten_private.preserve_project_photos() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.data->>'cloudImagesVersion' = '1' and new.data->>'cloudImagesVersion' is distinct from '1' then
    new.data := new.data || jsonb_build_object('images', old.data->'images', 'cloudImagesVersion', 1);
  end if;
  if old.public->>'cloudImagesVersion' = '1' and new.public->>'cloudImagesVersion' is distinct from '1' then
    new.public := new.public || jsonb_build_object('images', old.public->'images', 'cloudImagesVersion', 1);
  end if;
  return new;
end $$;
revoke all on function sahten_private.preserve_project_photos() from public, anon, authenticated;
drop trigger if exists preserve_project_photos on public.projects;
create trigger preserve_project_photos before update on public.projects
for each row execute function sahten_private.preserve_project_photos();

drop policy if exists sahten_photos_select on storage.objects;
create policy sahten_photos_select on storage.objects for select to authenticated
using (bucket_id = 'sahten-photos' and sahten_private.can_manage_store_photos((storage.foldername(name))[1]));

drop policy if exists sahten_photos_insert on storage.objects;
create policy sahten_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sahten-photos' and sahten_private.can_manage_store_photos((storage.foldername(name))[1]));

drop policy if exists sahten_photos_update on storage.objects;
create policy sahten_photos_update on storage.objects for update to authenticated
using (bucket_id = 'sahten-photos' and sahten_private.can_manage_store_photos((storage.foldername(name))[1]))
with check (bucket_id = 'sahten-photos' and sahten_private.can_manage_store_photos((storage.foldername(name))[1]));

-- Sin borrado automático: las versiones anteriores pueden seguir usadas por un menú o respaldo.
