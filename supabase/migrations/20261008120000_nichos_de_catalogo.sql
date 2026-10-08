-- Los nichos del creador pasan de texto libre a ids del catálogo de
-- `src/lib/ugc/nichos.ts`, para que el equipo pueda filtrar por nicho en Q·OS.
--
-- 1. Lo que ya estaba escrito se traduce a ids. La tabla de equivalencias sale
--    de los valores que había en prod el 2026-10-08 (comparados en minúscula y
--    sin espacios de más). Lo que no tiene equivalente se descarta.
-- 2. El tope de 5 queda también en la base: el action ya lo aplica, pero la
--    RLS deja que el creador actualice su fila directo por la API.
--
-- La lista en sí NO vive acá: agregar un nicho no necesita migración.

with equivalencias(texto, id) as (
  values
    ('food', 'gastronomia'),
    ('restaurantes', 'gastronomia'),
    ('events', 'eventos'),
    ('brands and fashion', 'moda'),
    ('lifestyle', 'lifestyle'),
    ('fitness', 'fitness'),
    ('corplife', 'negocios'),
    ('negocios', 'negocios'),
    ('tech', 'tecnologia'),
    ('ia', 'tecnologia'),
    ('claude', 'tecnologia'),
    ('agentes', 'tecnologia'),
    ('hoteles', 'hospedaje'),
    ('travel', 'viajes')
),
traducidos as (
  select cp.profile_id,
         coalesce(
           array_agg(distinct e.id) filter (where e.id is not null),
           '{}'
         ) as niches
  from public.creator_profiles cp
  cross join lateral unnest(cp.niches) as n(texto)
  left join equivalencias e on e.texto = lower(trim(n.texto))
  group by cp.profile_id
)
update public.creator_profiles cp
set niches = t.niches[1:5]
from traducidos t
where t.profile_id = cp.profile_id;

alter table public.creator_profiles
  add constraint creator_profiles_niches_max_5 check (cardinality(niches) <= 5);
