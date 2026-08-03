-- El equipo deja de ver todo.
--
-- Hasta hoy los cinco miembros de Q Labs tienen `profiles.role = 'admin'` y
-- toda la RLS del panel pregunta por eso, así que una guionista podía leer las
-- conversaciones de WhatsApp de sus compañeros, sus teléfonos, el cerebro de
-- McLovin y las disputas del marketplace. Ocultar el sidebar no arregla nada:
-- la fila viaja igual a quien pegue la URL o llame al REST.
--
-- El corte es por `staff_members.staff_role = 'director'`, NO por un rol nuevo
-- en profiles. `profiles.role` dice de qué lado del producto está la persona
-- (creador / marca / equipo) y eso no cambia; qué puede tocar adentro del
-- panel es otra pregunta, y ya tenía su tabla.

-- ---------------------------------------------------------------
-- 1. is_director()
-- ---------------------------------------------------------------
-- security definer por la misma razón que current_app_role(): la usan las
-- policies de staff_members y consultar la tabla desde su propia policy sin
-- saltarse RLS sería recursión infinita.
--
-- Pide `active`: a alguien dado de baja se le quitan los permisos junto con el
-- acceso, no en un segundo paso que alguien tiene que acordarse de hacer.
create function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_members
    where profile_id = auth.uid()
      and staff_role = 'director'
      and active
  )
$$;

comment on function public.is_director() is
  'true si quien consulta es un director activo del equipo. El corte de permisos dentro de Q·OS.';

-- ---------------------------------------------------------------
-- 2. staff_members: escribir es de directores; leer, según qué
-- ---------------------------------------------------------------
-- Acá viven los teléfonos y el opt-in de WhatsApp. Pero la tabla también tiene
-- el nombre, el color y el rol de cada quien, y eso lo necesita CUALQUIERA que
-- abra el Pipeline para asignar responsable. Por eso se parte en dos:
--
--   - la tabla queda cerrada a directores (+ la fila propia, que el layout lee
--     para saber qué rol mostrar);
--   - una vista `staff_directory` expone solo las columnas inofensivas.
drop policy "staff_members_all_admin" on public.staff_members;

create policy "staff_members_all_director"
  on public.staff_members for all
  to authenticated
  using (public.is_director())
  with check (public.is_director());

-- Sin esta, el layout del panel no puede leer su propio staff_role y todo el
-- equipo aparecería como "Admin" en el sidebar.
create policy "staff_members_select_self"
  on public.staff_members for select
  to authenticated
  using (profile_id = auth.uid());

-- La vista corre con los permisos de su dueño (security_invoker = false, el
-- default), así que se saltea la RLS de la tabla base a propósito: el filtro
-- de quién puede verla es el WHERE de acá adentro. Mismo patrón que
-- campaign_previews.
--
-- No lleva phone_e164 ni wa_opt_in ni reminder_hour: es justo lo que se está
-- cerrando. Si alguna vez hace falta una columna nueva en el tablero, se
-- agrega acá y no se afloja la policy de arriba.
create view public.staff_directory
with (security_invoker = false) as
  select profile_id, staff_role, color, active
  from public.staff_members
  where public.current_app_role() = 'admin';

comment on view public.staff_directory is
  'staff_members sin los datos de contacto: lo que el tablero necesita para pintar responsables.';

revoke all on public.staff_directory from anon;
grant select on public.staff_directory to authenticated;

-- ---------------------------------------------------------------
-- 3. Las tablas de sistema: solo directores
-- ---------------------------------------------------------------
-- wa_messages y wa_public_messages son conversaciones enteras de gente real
-- —del equipo y de afuera—. wa_agent_actions es qué tocó el agente y a pedido
-- de quién. agent_settings es lo que McLovin dice y a quién le contesta.
drop policy "wa_messages_select_admin" on public.wa_messages;
create policy "wa_messages_select_director"
  on public.wa_messages for select
  to authenticated
  using (public.is_director());

drop policy "wa_public_messages_select_admin" on public.wa_public_messages;
create policy "wa_public_messages_select_director"
  on public.wa_public_messages for select
  to authenticated
  using (public.is_director());

drop policy "wa_agent_actions_select_admin" on public.wa_agent_actions;
create policy "wa_agent_actions_select_director"
  on public.wa_agent_actions for select
  to authenticated
  using (public.is_director());

drop policy "agent_settings_select_admin" on public.agent_settings;
create policy "agent_settings_select_director"
  on public.agent_settings for select
  to authenticated
  using (public.is_director());

drop policy "agent_settings_update_admin" on public.agent_settings;
create policy "agent_settings_update_director"
  on public.agent_settings for update
  to authenticated
  using (public.is_director())
  with check (public.is_director());

-- ---------------------------------------------------------------
-- Lo que NO se toca
-- ---------------------------------------------------------------
-- content_pieces, content_columns, calendar_events, agency_clients,
-- hero_profiles y las transcripciones siguen abiertas a todo el equipo: son el
-- trabajo diario de un guionista, no "el sistema".
--
-- El marketplace (campaigns, applications, disputas) tampoco cambia de RLS:
-- ahí el corte es de UI —el grupo Sistema desaparece del sidebar y las rutas
-- redirigen— porque esas tablas ya las comparten marcas y creadores, y
-- volverlas director-only rompería el otro lado del producto.
