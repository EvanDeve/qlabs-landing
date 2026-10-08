-- Spec 001 · limpieza de la base (ver specs/001-limpieza/).
--
-- Borra lo que nadie usa y que en prod está vacío (verificado el 2026-10-08):
--   - creator_services, creator_addons: 0 filas; ningún formulario escribe.
--   - creator_delivery_stats(): nadie la llama (la reemplazó
--     creator_public_stats) y le mostraba a cualquier usuario logueado las
--     estadísticas de entrega de cualquier creador.
--   - campaigns.min_tier: 0 datos, 0 referencias.
--   - calendar_events.content_piece_id: 0 datos; además su FK era
--     `on delete cascade`, o sea que borrar una tarjeta se llevaba el evento.
--   - content_pieces.record_date: 0 datos; las grabaciones viven en
--     calendar_events desde 20260802320000.
--   - creator_profiles.rate_min/rate_max/avg_reach/avg_views/engagement_rate:
--     0 datos; ningún formulario las llena. Evan decidió borrarlas: si un día
--     hacen falta, van con una spec y un formulario de verdad.
--
-- ⚠️ Correr SOLO con el código de T06–T08 ya desplegado en prod: el código
-- anterior hacía select de estas columnas y se caería.
--
-- Los `if exists` son para que correrla dos veces no falle.

begin;

drop function if exists public.creator_delivery_stats();

drop table if exists public.creator_services;
drop table if exists public.creator_addons;

alter table public.campaigns drop column if exists min_tier;
alter table public.calendar_events drop column if exists content_piece_id;
alter table public.content_pieces drop column if exists record_date;

-- La vista pública expone avg_views y engagement_rate: se recrea sin ellas,
-- idéntica en todo lo demás a 20260825190000 (mismo filtro y mismo grant).
-- `create or replace` no puede quitar columnas de una vista, por eso drop.
drop view if exists public.creator_public_profiles;

alter table public.creator_profiles
  drop column if exists rate_min,
  drop column if exists rate_max,
  drop column if exists avg_reach,
  drop column if exists avg_views,
  drop column if exists engagement_rate;

create view public.creator_public_profiles
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
  p.display_name,
  p.bio,
  p.city,
  p.avatar_url
from public.creator_profiles cp
join public.profiles p on p.id = cp.profile_id
where cp.verified or public.current_app_role() = 'admin';

grant select on public.creator_public_profiles to anon, authenticated;

-- `rls_auto_enable` existe en prod sin migración: la crea el dashboard de
-- Supabase al prender "auto-enable RLS". Queda documentada acá para que nadie
-- la borre creyendo que es un resto.
do $$
declare
  f regprocedure;
begin
  select p.oid::regprocedure into f
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  limit 1;
  if f is not null then
    execute format(
      'comment on function %s is %L',
      f,
      'La crea el dashboard de Supabase al activar "auto-enable RLS" en tablas nuevas. No es de una migración del repo; no borrar.'
    );
  end if;
end $$;

commit;
