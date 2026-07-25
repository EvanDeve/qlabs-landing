-- Identidad visual y ubicación de la marca.
--
-- logo_url: sin logo, todas las marcas se ven idénticas en el feed y una promo
-- real no se distingue de una de prueba. `brand_profiles` ya es de lectura
-- pública (policy brand_profiles_select_public) y el feed hace select('*'),
-- así que la columna llega sola a creadores — no hace falta tocar RLS.
--
-- location: hasta ahora la zona solo aparecía suelta dentro del texto del
-- brief ("La Fortuna", "Cartago"), donde no se puede filtrar ni leer de un
-- vistazo. Para contenido presencial es lo primero que un creador necesita
-- saber.
alter table public.brand_profiles
  add column if not exists logo_url text,
  add column if not exists location text;

-- Bucket público para los logos: mismo patrón que 'avatars' y 'portfolio'.
-- Cada marca solo escribe dentro de su propia carpeta {uid}/...
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
on conflict (id) do nothing;

create policy "brand_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'brand-logos');

create policy "brand_logos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "brand_logos_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "brand_logos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- La vista pública del marketplace también muestra la promo con su marca.
-- Se recrea para sumar logo y ubicación (una vista no admite add column).
drop view if exists public.campaign_previews;

create view public.campaign_previews
with (security_invoker = false) as
select
  c.id,
  c.title,
  b.brand_name,
  b.industry,
  b.logo_url as brand_logo_url,
  b.location as brand_location,
  (
    select array_agg(d ->> 'type')
    from jsonb_array_elements(c.deliverables) d
  ) as deliverable_types,
  c.published_at
from public.campaigns c
join public.brand_profiles b on b.profile_id = c.brand_id
where c.status = 'published';

grant select on public.campaign_previews to anon, authenticated;
