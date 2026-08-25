-- Cada quien escribe SOLO sus campos en `applications`.
--
-- El agujero: desde `20260725110000_application_conflict_exits.sql`, el creador
-- tiene una policy de update con
--   using (creator_id = auth.uid() and status in ('accepted','delivered'))
--   with check (creator_id = auth.uid() and status in ('delivered','cancelled','disputed'))
-- que es correcta para lo que buscaba —cancelar y disputar— pero la RLS de
-- Postgres autoriza la FILA, no la COLUMNA. Con esa fila autorizada, el creador
-- puede escribir cualquier campo con un PATCH directo a PostgREST (la anon key
-- es pública y su token está en su propio navegador). Lo mismo la marca, que
-- tiene su propia policy de fila.
--
-- Verificado contra el proyecto en vivo el 2026-08-25:
--   · un creador se puso `rating = 5` en su propia aplicación y
--     `creator_public_stats` —la que la marca lee en el media-kit— pasó a
--     devolver avg_rating 5.0 con la entrega sin aprobar. El rating es LA señal
--     de confianza del marketplace.
--   · creador y marca escribieron los dos `admin_note`, que la UI de ambos
--     lados muestra como "Resolución de Q Labs".
--
-- Se arregla con un trigger y no con GRANTs por columna porque los grants son
-- por ROL de Postgres y acá los tres —creador, marca y admin— son el mismo rol
-- `authenticated`; lo que los distingue es quién es la fila. Mismo patrón que
-- `protect_role_change` y `protect_verified`.

create function public.protect_application_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin resuelve disputas: escribe admin_note y lo que haga falta.
  if public.current_app_role() = 'admin' then
    return new;
  end if;

  -- Sin sesión no se llega acá por RLS, y los triggers internos del sistema
  -- (service role) tampoco deben verse frenados.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.creator_id then
    -- El creador mueve el estado (entregar, cancelar, disputar), el motivo del
    -- conflicto y su nota de entrega. Nada más.
    if new.rating is distinct from old.rating
       or new.admin_note is distinct from old.admin_note
       or new.pitch_message is distinct from old.pitch_message
       or new.campaign_id is distinct from old.campaign_id
       or new.creator_id is distinct from old.creator_id
       or new.created_at is distinct from old.created_at then
      raise exception 'el creador no puede modificar ese campo de la aplicación';
    end if;

    -- La nota de entrega se escribe UNA vez, en el mismo update que entrega.
    -- Después la pieza es lo que la marca va a aprobar y lo que respalda el
    -- pago: no se reescribe la historia.
    if new.delivery_note is distinct from old.delivery_note and old.status <> 'accepted' then
      raise exception 'la nota de entrega solo se escribe al entregar';
    end if;

    return new;
  end if;

  -- Queda la marca: decide sobre la aplicación y califica la entrega. La
  -- resolución de Q Labs no es suya, y la nota del creador tampoco.
  if new.admin_note is distinct from old.admin_note
     or new.delivery_note is distinct from old.delivery_note
     or new.pitch_message is distinct from old.pitch_message
     or new.campaign_id is distinct from old.campaign_id
     or new.creator_id is distinct from old.creator_id
     or new.created_at is distinct from old.created_at then
    raise exception 'la marca no puede modificar ese campo de la aplicación';
  end if;

  return new;
end;
$$;

-- El nombre arranca con "z" para que corra DESPUÉS de los triggers que rellenan
-- timestamps (`applications_set_delivery_timestamps`): Postgres dispara los
-- BEFORE por orden alfabético, y este tiene que ver el NEW ya completo.
create trigger zprotect_application_columns
  before update on public.applications
  for each row execute function public.protect_application_columns();
