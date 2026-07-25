-- Foto de perfil del creador (modelo LinkedIn): bucket público, cada usuario
-- solo escribe en su propia carpeta {uid}/... — mismo patrón que 'portfolio'
-- y 'hero-logos'.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_bucket_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_bucket_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_bucket_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_bucket_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
