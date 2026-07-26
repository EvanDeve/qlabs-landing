-- Salidas ante conflictos: cancelar antes de entregar, y disputar después.
--
-- Hasta ahora una aplicación aceptada no tenía salida: el creador no podía
-- avisar que no iba a poder cumplir (la policy de update solo permitía a la
-- marca o a un admin) y la marca, después de aceptar, tampoco tenía botón.
-- El único final posible era que alguien dejara de responder.
--
-- Regla de producto acordada: se puede CANCELAR mientras no haya entrega; una
-- vez que hay material entregado ya no es cancelación sino DISPUTA, porque hay
-- trabajo hecho y plata de por medio. Las disputas las resuelve Q Labs, que ya
-- es el intermediario del pago.

alter table public.applications
  add column if not exists conflict_reason text,
  add column if not exists conflict_by uuid references public.profiles (id) on delete set null,
  add column if not exists conflict_at timestamptz,
  add column if not exists admin_note text;

comment on column public.applications.conflict_reason is
  'Motivo escrito por quien canceló o abrió la disputa.';
comment on column public.applications.conflict_by is
  'Quién disparó la cancelación o la disputa (creador o marca).';
comment on column public.applications.admin_note is
  'Nota de Q Labs al resolver una disputa.';

-- ---------------------------------------------------------------
-- Transiciones permitidas
-- ---------------------------------------------------------------
-- Esto NO se puede resolver con policies. Postgres evalúa los `using` (fila
-- vieja) y los `with check` (fila nueva) de forma independiente, y con varias
-- policies permisivas los OR entre sí: con una policy por transición, un
-- `delivered -> cancelled` pasaría igual, tomando el `using` de una y el
-- `with check` de otra. Emparejar viejo y nuevo estado exige un trigger.
create or replace function public.enforce_application_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_creator boolean;
  v_is_brand boolean;
  v_pair text;
begin
  -- Sin cambio de estado no hay nada que validar: deja pasar updates de otras
  -- columnas (la marca guardando el rating, por ejemplo).
  if new.status = old.status then
    return new;
  end if;

  -- Sin auth.uid() es el service role o un trigger interno: no se bloquea, si
  -- no las migraciones y los scripts de mantenimiento quedarían atados.
  if v_actor is null then
    return new;
  end if;

  if public.current_app_role() = 'admin' then
    return new;
  end if;

  v_is_creator := (old.creator_id = v_actor);
  v_is_brand := exists (
    select 1 from public.campaigns c
    where c.id = old.campaign_id and c.brand_id = v_actor
  );

  v_pair := old.status::text || '->' || new.status::text;

  if v_is_creator then
    -- El creador entrega, se libera antes de entregar, o disputa lo entregado.
    if v_pair in ('accepted->delivered', 'accepted->cancelled', 'delivered->disputed') then
      return new;
    end if;
    raise exception 'Un creador no puede pasar su aplicación de % a %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if v_is_brand then
    -- Ojo: NO existe delivered->cancelled. Es exactamente el caso que hay que
    -- evitar — cancelar cuando ya se tiene el material en la mano.
    if v_pair in (
      'pending->reviewing', 'pending->accepted', 'pending->rejected',
      'reviewing->accepted', 'reviewing->rejected',
      'accepted->cancelled',
      'delivered->approved', 'delivered->disputed'
    ) then
      return new;
    end if;
    raise exception 'Una marca no puede pasar la aplicación de % a %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  raise exception 'No autorizado para cambiar el estado de esta aplicación'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists applications_enforce_transition on public.applications;
create trigger applications_enforce_transition
  before update on public.applications
  for each row execute function public.enforce_application_transition();

-- ---------------------------------------------------------------
-- El creador necesita poder tocar su propia aplicación
-- ---------------------------------------------------------------
-- La policy vieja solo habilitaba aceptada -> entregada. Se amplía el rango y
-- el emparejamiento fino queda en el trigger de arriba.
drop policy if exists "applications_update_own_creator_deliver" on public.applications;

create policy "applications_update_own_creator"
  on public.applications for update
  to authenticated
  using (creator_id = auth.uid() and status in ('accepted', 'delivered'))
  with check (creator_id = auth.uid() and status in ('delivered', 'cancelled', 'disputed'));

-- ---------------------------------------------------------------
-- Avisarle a Q Labs cuando se abre una disputa
-- ---------------------------------------------------------------
-- Nadie está mirando la tabla: si no se notifica, una disputa puede quedar
-- abierta indefinidamente y ese es justamente el problema que se quiere cerrar.
create or replace function public.notify_admins_on_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_title text;
  v_admin record;
begin
  if new.status <> 'disputed' or old.status = 'disputed' then
    return new;
  end if;

  select title into v_campaign_title from public.campaigns where id = new.campaign_id;

  for v_admin in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (profile_id, type, payload)
    values (
      v_admin.id,
      'application_disputed',
      jsonb_build_object(
        'application_id', new.id,
        'campaign_id', new.campaign_id,
        'campaign_title', coalesce(v_campaign_title, 'una campaña'),
        'reason', coalesce(new.conflict_reason, '')
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists applications_notify_admins_dispute on public.applications;
create trigger applications_notify_admins_dispute
  after update on public.applications
  for each row execute function public.notify_admins_on_dispute();
