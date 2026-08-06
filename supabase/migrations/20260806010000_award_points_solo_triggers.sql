-- Loyalty Loop · cerrar de verdad la puerta de award_points.
--
-- La migración anterior hizo `revoke all ... from public` creyendo que con eso
-- alcanzaba. No alcanzó, y el test de RLS lo agarró: un creador con sesión pudo
-- llamar al RPC y otorgarse +150 sin haber entregado nada.
--
-- Por qué: Supabase tiene DEFAULT PRIVILEGES sobre el schema `public` que le
-- dan EXECUTE a `anon`, `authenticated` y `service_role` en cada función nueva.
-- Ese grant es explícito para cada rol, así que revocarle a PUBLIC —que es el
-- "todos los demás"— no lo toca. La función quedó expuesta en PostgREST.
--
-- La lección para la próxima función security definer que no deba ser pública:
-- revocar por rol, nunca solo `from public`.

revoke all on function public.award_points(uuid, text, text, uuid)
  from anon, authenticated, public;

revoke all on function public.evaluar_perfil_completo(uuid)
  from anon, authenticated, public;

-- Los triggers no necesitan este grant (son security definer y corren como el
-- mismo dueño). Queda para poder otorgar desde el servidor con service-role si
-- alguna vez hace falta, y para el script de backfill.
grant execute on function public.award_points(uuid, text, text, uuid) to service_role;

-- ---------------------------------------------------------------
-- Segunda defensa, adentro de la función
-- ---------------------------------------------------------------
-- Un permiso mal puesto no debería alcanzar para inflar el nivel de nadie: si
-- mañana alguien corre un `grant execute ... to authenticated` sin pensarlo, o
-- una migración futura vuelve a pisar los privilegios, esto sigue frenando.
--
-- `pg_trigger_depth() > 0` es la forma de saber que la llamada viene de un
-- trigger y no de la API. Para todo lo demás se mira el rol de la conexión:
-- PostgREST hace `set local role authenticated` (o `anon`) antes de ejecutar,
-- y ese GUC sobrevive dentro de una función security definer, donde
-- `current_user` ya no sirve porque pasó a ser el dueño.
create or replace function public.award_points(
  p_creator uuid,
  p_action text,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.point_rules;
  v_usados int;
  v_id uuid;
begin
  if pg_trigger_depth() = 0
     and coalesce(current_setting('role', true), '') in ('anon', 'authenticated') then
    raise exception 'award_points no se llama desde el cliente: los puntos los otorgan los triggers';
  end if;

  if p_creator is null or p_action is null then
    return null;
  end if;

  select * into v_rule
  from public.point_rules
  where action = p_action and active;

  if not found then
    return null;
  end if;

  if v_rule.once_only and exists (
    select 1 from public.points_events
    where creator_id = p_creator and action = p_action
  ) then
    return null;
  end if;

  if v_rule.monthly_cap is not null then
    -- El mes es el mes de Costa Rica, no el de UTC: con el offset de -6 h, un
    -- evento del 30 a las 7 p.m. cae en el mes siguiente si se cuenta en UTC,
    -- y el creador vería su tope reiniciarse un día y medio antes de tiempo.
    select count(*) into v_usados
    from public.points_events
    where creator_id = p_creator
      and action = p_action
      and created_at >= (
        date_trunc('month', (now() at time zone 'America/Costa_Rica'))
        at time zone 'America/Costa_Rica'
      );

    if v_usados >= v_rule.monthly_cap then
      return null;
    end if;
  end if;

  insert into public.points_events (creator_id, action, points, reference_type, reference_id)
  values (p_creator, p_action, v_rule.points, p_reference_type, p_reference_id)
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- Postgres conserva el ACL al hacer `create or replace`, así que en teoría
-- esto sobra. Se repite igual: es una línea, y el modo en que se descubrió el
-- agujero —creyendo que un revoke había alcanzado— no invita a confiar en la
-- teoría sin verificar.
revoke all on function public.award_points(uuid, text, text, uuid)
  from anon, authenticated, public;
grant execute on function public.award_points(uuid, text, text, uuid) to service_role;
