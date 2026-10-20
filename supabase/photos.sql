-- Ejecutar DESPUÉS de schema.sql. Fotos de menú públicas; escritura solo dueño/admin.
-- Idempotente. Nunca se guardan claves privadas ni datos del negocio en este bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sahten-photos', 'sahten-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_store_photos(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stores s where s.id::text = folder
      and (s.owner = auth.uid() or public.has_project_role(s.project_id, array['owner','admin']))
  )
$$;
revoke all on function public.can_manage_store_photos(text) from public, anon;
grant execute on function public.can_manage_store_photos(text) to authenticated;

drop policy if exists sahten_photos_select on storage.objects;
create policy sahten_photos_select on storage.objects for select to authenticated
using (bucket_id = 'sahten-photos' and public.can_manage_store_photos((storage.foldername(name))[1]));

drop policy if exists sahten_photos_insert on storage.objects;
create policy sahten_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sahten-photos' and public.can_manage_store_photos((storage.foldername(name))[1]));

drop policy if exists sahten_photos_update on storage.objects;
create policy sahten_photos_update on storage.objects for update to authenticated
using (bucket_id = 'sahten-photos' and public.can_manage_store_photos((storage.foldername(name))[1]))
with check (bucket_id = 'sahten-photos' and public.can_manage_store_photos((storage.foldername(name))[1]));

-- Sin borrado automático: las versiones anteriores pueden seguir usadas por un menú o respaldo.
