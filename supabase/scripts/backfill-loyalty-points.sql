-- Loyalty Loop · backfill de puntos históricos
--
-- ⚠️ ESTO NO ES UNA MIGRACIÓN Y NO SE CORRE SOLO. Vive fuera de
-- `supabase/migrations/` a propósito: `db push` no lo toca. Se pega a mano en
-- el SQL editor, y solo cuando Evan y Andrés hayan decidido que sí.
--
-- La decisión de negocio que hay detrás: los creadores que ya vienen
-- trabajando, ¿arrancan en Bronce con 0 como todo el mundo, o entran con el
-- nivel que se ganaron? Regalar el nivel es más justo con ellos; arrancar
-- todos en cero hace que la primera temporada mida algo real. No es una
-- decisión técnica y por eso el script está escrito pero no ejecutado.
--
-- Qué otorga: solo lo que salió de trabajo entregado —selección, entrega
-- aprobada, rating—. NO los +10 por pieza del book ni los +5 por aplicar: son
-- acciones con tope mensual, y meterle de golpe el histórico a alguien con 40
-- piezas le daría 400 puntos que el tope existe justamente para impedir.
--
-- Es idempotente: el índice de idempotencia del ledger hace que correrlo dos
-- veces no duplique nada. Se puede correr sin miedo, pero no sin decisión.

-- ---------------------------------------------------------------
-- PASO 1 — mirar antes de tocar (esto no escribe nada)
-- ---------------------------------------------------------------
-- Cuántos puntos recibiría cada creador y qué nivel le daría. Correr esto
-- solo, leer la salida, y recién ahí decidir si se sigue.

with historico as (
  select a.creator_id, 'campaign_selected' as action
  from public.applications a
  where a.status in ('accepted', 'delivered', 'approved')
  union all
  select a.creator_id, 'delivery_approved'
  from public.applications a
  where a.status = 'approved'
  union all
  select a.creator_id, case when a.rating = 5 then 'rating_5' else 'rating_4' end
  from public.applications a
  where a.status = 'approved' and a.rating in (4, 5)
)
select
  c.handle,
  sum(r.points) as puntos_a_otorgar,
  (select lt.name
     from public.level_thresholds lt
    where lt.min_points <= sum(r.points)
    order by lt.min_points desc
    limit 1) as nivel_resultante
from historico h
join public.point_rules r on r.action = h.action
join public.creator_profiles c on c.profile_id = h.creator_id
group by c.handle
order by puntos_a_otorgar desc;

-- ---------------------------------------------------------------
-- PASO 2 — el backfill (esto SÍ escribe)
-- ---------------------------------------------------------------
-- Descomentar el bloque entero solo cuando la decisión esté tomada.
--
-- `status_changed_at` como fecha del evento y no `now()`: el historial del
-- creador tiene que contar la historia en el orden en que pasó. Si todo
-- entrara con la fecha de hoy, la pantalla de "Historial de puntos" mostraría
-- dos años de trabajo apilados en un mismo minuto.

/*
insert into public.points_events (creator_id, action, points, reference_type, reference_id, created_at)
select
  h.creator_id,
  h.action,
  r.points,           -- el valor VIGENTE hoy; no hay forma de saber cuál regía entonces
  'application',
  h.application_id,
  h.fecha
from (
  select a.creator_id, 'campaign_selected' as action, a.id as application_id, a.status_changed_at as fecha
  from public.applications a
  where a.status in ('accepted', 'delivered', 'approved')
  union all
  select a.creator_id, 'delivery_approved', a.id, a.status_changed_at
  from public.applications a
  where a.status = 'approved'
  union all
  select a.creator_id, case when a.rating = 5 then 'rating_5' else 'rating_4' end, a.id, a.status_changed_at
  from public.applications a
  where a.status = 'approved' and a.rating in (4, 5)
) h
join public.point_rules r on r.action = h.action and r.active
on conflict do nothing;
*/

-- ---------------------------------------------------------------
-- PASO 3 — perfiles ya completos
-- ---------------------------------------------------------------
-- Los +50 de "perfil completo" no se otorgan solos hacia atrás: el trigger
-- espera un UPDATE, y los perfiles que ya estaban completos antes de esta
-- migración no van a recibir ninguno. Esta línea los evalúa a todos; la
-- función es `once_only`, así que a nadie le llega dos veces.

/*
select public.evaluar_perfil_completo(profile_id) from public.creator_profiles;
*/
