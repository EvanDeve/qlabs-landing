-- El perfil público del creador (/ugc/creadores/[handle]) está pensado para
-- compartirse por fuera de la app — link en bio de Instagram, WhatsApp — pero
-- TODAS sus fuentes eran `to authenticated`, así que un visitante anónimo veía
-- un 404. Es decir: el media-kit no funcionaba para su público real.
--
-- Se expone mediante una vista y no abriendo `creator_profiles` a anon, porque
-- esa tabla tiene rate_min/rate_max (las tarifas del creador) y `profiles`
-- es la tabla de cuentas. La vista publica solo lo que la página ya muestra.

create or replace view public.creator_public_profiles
with (security_invoker = false) as
select
  cp.profile_id,
  cp.handle,
  cp.followers_count,
  cp.niches,
  cp.languages,
  cp.instagram_handle,
  cp.tiktok_handle,
  cp.verified,
  cp.engagement_rate,
  cp.avg_views,
  p.display_name,
  p.bio,
  p.city,
  p.avatar_url
from public.creator_profiles cp
join public.profiles p on p.id = cp.profile_id;

grant select on public.creator_public_profiles to anon, authenticated;

-- Book, habilidades y marcas previas son contenido de portafolio: públicos por
-- naturaleza. Sus policies ya eran `using (true)`, solo faltaba el rol anon.
create policy "creator_skills_select_anon"
  on public.creator_skills for select to anon using (true);

create policy "creator_past_brands_select_anon"
  on public.creator_past_brands for select to anon using (true);

create policy "portfolio_items_select_anon"
  on public.portfolio_items for select to anon using (true);

-- Las estadísticas del media-kit (trabajos entregados, rating) también las ve
-- el visitante anónimo. La función ya es security definer y solo devuelve
-- agregados, nunca filas de applications.
grant execute on function public.creator_public_stats(uuid) to anon;
