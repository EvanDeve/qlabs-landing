-- Fase 1 / épica 1.3: contadores públicos para la vista /ugc.
-- creator_profiles no tiene policy para anon (nada sensible se expone acá,
-- solo un conteo), así que se resuelve con una función security-definer.

create function public.public_marketplace_stats()
returns table (
  published_campaigns_count bigint,
  creators_count bigint,
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
    (select count(*) from public.brand_profiles)
$$;

grant execute on function public.public_marketplace_stats() to anon, authenticated;
