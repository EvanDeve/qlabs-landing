-- La home pública (/ugc) rotula su contador como "Creadores verificados", pero
-- `creators_count` cuenta TODOS los creator_profiles, verificados o no. Con
-- creadores sin verificar en la plataforma el número que se anuncia es falso —
-- y "creadores verificados" es justamente la promesa central del marketplace.
--
-- Se agrega un contador aparte en vez de reinterpretar `creators_count`, para
-- no cambiarle el significado a una columna que ya existe.
drop function if exists public.public_marketplace_stats();

create function public.public_marketplace_stats()
returns table (
  published_campaigns_count bigint,
  creators_count bigint,
  verified_creators_count bigint,
  brands_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.campaigns where status = 'published'),
    (select count(*) from public.creator_profiles),
    (select count(*) from public.creator_profiles where verified),
    (select count(*) from public.brand_profiles)
$$;

grant execute on function public.public_marketplace_stats() to anon, authenticated;
