-- Loyalty Loop · imagen del cupón.
--
-- La columna `image_url` existía desde la fase 2 y no había forma de llenarla:
-- las tarjetas eran solo texto. Una foto del plato o del local es lo que hace
-- que un cupón se vea deseable al lado de otros cinco.
--
-- Bucket público, como `avatars`, `portfolio` y `brand-logos`: la imagen la ve
-- cualquier creador con el feed abierto, no hay nada privado que proteger. Lo
-- que sí se protege es quién ESCRIBE: cada marca solo puede subir dentro de su
-- propia carpeta `{uid}/...`, igual que en los otros buckets.

insert into storage.buckets (id, name, public)
values ('coupon-images', 'coupon-images', true)
on conflict (id) do nothing;

create policy "coupon_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'coupon-images');

create policy "coupon_images_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'coupon-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "coupon_images_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'coupon-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "coupon_images_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'coupon-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
