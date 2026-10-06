-- La agencia se cierra para el rol UGC.
--
-- Hasta hoy todas las tablas de la agencia preguntaban lo mismo:
-- `current_app_role() = 'admin'`, o sea "¿está del lado del equipo?". Con el
-- rol `ugc` (20261006100000) eso deja de alcanzar: esa gente es admin —tiene
-- que serlo para administrar el marketplace, que también pregunta por
-- admin— pero no tiene que ver Heroes, tarjetas, cronogramas ni la lista del
-- equipo. Esconderle el menú no arregla nada: la fila viaja igual a quien
-- llame al REST.
--
-- Lo del marketplace, Loyalty y Close Friends NO cambia acá: sigue siendo de
-- cualquier admin, como hasta hoy.
--
-- Pareja en el código: `areasDelRol()` en src/lib/auth/areas.ts. Las dos
-- tienen que decir lo mismo.

-- ---------------------------------------------------------------
-- 1. es_equipo_agencia()
-- ---------------------------------------------------------------
-- Admin y no UGC. Sin fila en staff_members cuenta como agencia, que es lo que
-- veía hasta ahora una cuenta admin sin ficha; dado de baja también, porque
-- `active` nunca cortó el acceso a la agencia (solo a lo de director).
--
-- security definer por lo mismo que is_director(): lee staff_members, que
-- tiene RLS propia.
--
-- `staff_role::text`: así compila aunque esta migración se corra en la misma
-- tanda que la que crea el valor 'ugc'.
create function public.es_equipo_agencia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
    and not exists (
      select 1
      from public.staff_members
      where profile_id = auth.uid()
        and staff_role::text = 'ugc'
    )
$$;

comment on function public.es_equipo_agencia() is
  'true si quien consulta es del equipo y no tiene el rol ugc. El corte de las tablas de la agencia.';

revoke execute on function public.es_equipo_agencia() from anon;

-- ---------------------------------------------------------------
-- 2. Las tablas de la agencia
-- ---------------------------------------------------------------
drop policy "agency_clients_all_admin" on public.agency_clients;
create policy "agency_clients_all_agencia"
  on public.agency_clients for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

drop policy "content_pieces_all_admin" on public.content_pieces;
create policy "content_pieces_all_agencia"
  on public.content_pieces for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

drop policy "content_columns_all_admin" on public.content_columns;
create policy "content_columns_all_agencia"
  on public.content_columns for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

drop policy "calendar_events_all_admin" on public.calendar_events;
create policy "calendar_events_all_agencia"
  on public.calendar_events for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

-- Acá viven además los dos tokens de los links (el del Hero y el de quien
-- graba): leer la fila es poder abrir el cronograma de afuera.
drop policy "hero_calendar_months_all_admin" on public.hero_calendar_months;
create policy "hero_calendar_months_all_agencia"
  on public.hero_calendar_months for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

drop policy "calendar_month_items_all_admin" on public.calendar_month_items;
create policy "calendar_month_items_all_agencia"
  on public.calendar_month_items for all
  to authenticated
  using (public.es_equipo_agencia())
  with check (public.es_equipo_agencia());

-- ---------------------------------------------------------------
-- 3. staff_directory
-- ---------------------------------------------------------------
-- La lista del equipo es para pintar responsables en el Pipeline y el
-- Calendario: es de la agencia. `create or replace` conserva los grants.
create or replace view public.staff_directory
with (security_invoker = false) as
  select profile_id, staff_role, color, active
  from public.staff_members
  where public.es_equipo_agencia();

-- ---------------------------------------------------------------
-- 4. Logos de los Heroes
-- ---------------------------------------------------------------
-- Leer sigue siendo público (el bucket lo es); subir y borrar, de la agencia.
drop policy "hero_logos_bucket_admin_write" on storage.objects;
create policy "hero_logos_bucket_agencia_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'hero-logos' and public.es_equipo_agencia());

drop policy "hero_logos_bucket_admin_delete" on storage.objects;
create policy "hero_logos_bucket_agencia_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'hero-logos' and public.es_equipo_agencia());

-- ---------------------------------------------------------------
-- 5. Cambiar el rol de una cuenta: solo directores
-- ---------------------------------------------------------------
-- Hasta hoy cualquier admin podía cambiarle `profiles.role` a cualquier
-- cuenta desde su sesión (profiles_update_own_or_admin + esta excepción). Con
-- el rol UGC eso es una escalera: alguien de UGC pasa a admin una cuenta de
-- creador propia, y esa cuenta —sin fila en staff_members— entra a la
-- agencia. La app nunca usó este camino: invitar al equipo pone el rol con
-- service-role (`inviteStaffAction`), que no pasa por acá.
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.is_director() then
    return new;
  end if;

  if old.role is not null then
    raise exception 'no podés cambiar tu rol una vez asignado';
  end if;

  if new.role::text not in ('creator', 'brand') then
    raise exception 'ese rol no se puede elegir';
  end if;

  return new;
end;
$$;
