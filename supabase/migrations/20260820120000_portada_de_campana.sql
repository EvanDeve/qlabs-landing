-- Portada de la campaña.
--
-- El feed de promos del creador pasa a ser un feed de tarjetas grandes con
-- imagen —lenguaje de app de iPhone—: la foto es lo primero que frena el
-- scroll. Hasta hoy la campaña era solo texto y no había dónde guardar una.
--
-- Bucket público, como `coupon-images`, `brand-logos` y `avatars`: la portada
-- la ve cualquier creador con el feed abierto, no hay nada privado que
-- proteger. Lo que sí se protege es quién ESCRIBE: cada marca solo puede subir
-- dentro de su propia carpeta `{uid}/...`.
--
-- Nullable a propósito: las campañas que ya existen no tienen portada y la
-- tarjeta cae al degradado de la marca. No se inventa una imagen.

alter table campaigns add column if not exists cover_url text;

comment on column campaigns.cover_url is
  'URL pública de la portada dentro del bucket campaign-covers. NULL = la tarjeta del feed usa el degradado de la marca.';

insert into storage.buckets (id, name, public)
values ('campaign-covers', 'campaign-covers', true)
on conflict (id) do nothing;

create policy "campaign_covers_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'campaign-covers');

create policy "campaign_covers_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'campaign-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "campaign_covers_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'campaign-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "campaign_covers_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'campaign-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
