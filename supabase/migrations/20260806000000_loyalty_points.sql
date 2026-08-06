-- Loyalty Loop · Fase 1: el motor de puntos.
--
-- Sin UI todavía: esto es solo el ledger y quién lo alimenta. Las recompensas
-- (cupones, QR, canje) vienen en las fases 2 y 3 y se apoyan en el nivel que
-- se calcula acá.
--
-- Las dos decisiones que gobiernan todo lo demás:
--
-- 1. **El ledger es la fuente de verdad.** No hay columna `puntos` en ningún
--    perfil: el total es la suma de `points_events` y el nivel se deriva de esa
--    suma. Nada que otorgar a mano, nada que se desincronice, y el historial
--    explica siempre por qué alguien tiene los puntos que tiene.
--
-- 2. **Los puntos los otorgan triggers, no el código de la app.** Un punto se
--    gana cuando la fila cambia de estado, no cuando la ejecución pasa por
--    cierto server action. Así el panel de admin, el flujo de disputas y
--    cualquier ruta que se escriba después otorgan igual, sin que nadie tenga
--    que acordarse de llamar nada. El precio es que la regla vive en SQL y no
--    en TypeScript — de ahí que este archivo esté tan comentado.

-- ---------------------------------------------------------------
-- Configuración: reglas y umbrales
-- ---------------------------------------------------------------
-- Van en tablas y no en constantes de TypeScript para poder ajustar la
-- economía sin deploy. Los valores de arranque son los del plan, pero la
-- primera temporada real es la que va a decir si la escalera quedó corta o
-- larga, y ese ajuste tiene que ser un UPDATE, no un release.

create table public.point_rules (
  action text primary key,

  points int not null,

  -- Tope de EVENTOS puntuables por mes (no de puntos). null = sin tope.
  -- Existe para lo que el creador controla solo —subir al book, aplicar— que
  -- si no se limita se convierte en una máquina de farmear nivel sin haber
  -- entregado nunca nada.
  monthly_cap int,

  -- Se otorga una sola vez en la vida de la cuenta.
  once_only boolean not null default false,

  -- Apagar una regla no borra la historia: los eventos ya otorgados siguen
  -- sumando con el valor que tenían.
  active boolean not null default true
);

create table public.level_thresholds (
  level int primary key,
  name text not null,
  min_points int not null
);

-- El peso está a propósito en el resultado: una entrega aprobada con 5★ vale
-- 200 y aplicar vale 5. Sube de nivel el que entrega, no el que se mueve.
insert into public.point_rules (action, points, monthly_cap, once_only) values
  ('profile_completed',  50, null, true),
  ('book_upload',        10,    5, false),
  ('application',         5,   10, false),
  ('campaign_selected',  50, null, false),
  ('delivery_approved', 150, null, false),
  ('rating_5',           50, null, false),
  ('rating_4',           20, null, false);

insert into public.level_thresholds (level, name, min_points) values
  (1, 'Bronce',  0),
  (2, 'Plata',   500),
  (3, 'Oro',     1500),
  (4, 'Platino', 4000);

-- ---------------------------------------------------------------
-- El ledger
-- ---------------------------------------------------------------

create table public.points_events (
  id uuid primary key default gen_random_uuid(),

  -- El creador es `profiles(id)`, igual que `applications.creator_id`: en este
  -- esquema `creator_profiles` cuelga de profiles, no lo reemplaza.
  creator_id uuid not null references public.profiles (id) on delete cascade,

  action text not null references public.point_rules (action),

  -- Snapshot del valor al momento del evento. Si mañana una entrega aprobada
  -- pasa a valer 200, lo ya otorgado no se reescribe: el total de cada creador
  -- tiene que seguir siendo reproducible desde su propio historial.
  points int not null,

  -- FK lógica (sin constraint) al registro que originó el evento: la
  -- aplicación, la pieza del book, el perfil. Sin constraint a propósito —
  -- apunta a tablas distintas según el caso, y borrar una campaña vieja no
  -- debería borrarle los puntos a nadie.
  reference_type text,
  reference_id uuid,

  created_at timestamptz not null default now()
);

create index points_events_creator_idx
  on public.points_events (creator_id, created_at desc);

-- Idempotencia: un evento por acción + referencia. Es lo que hace que el
-- trigger pueda dispararse dos veces (una corrección, un reintento, la marca
-- que aprueba y desaprueba) sin duplicar puntos.
--
-- Va como índice con `coalesce` y no como `unique (creator_id, action,
-- reference_id)`: en Postgres dos NULL son distintos entre sí, así que la
-- constraint natural NO frenaría un segundo `profile_completed` (que no tiene
-- referencia). El UUID de relleno es un valor imposible de generar.
create unique index points_events_idempotent_idx
  on public.points_events (
    creator_id,
    action,
    coalesce(reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

comment on column public.points_events.points is
  'Congelado al insertar. Cambiar point_rules afecta lo que se otorgue de acá en adelante, nunca la historia.';

-- ---------------------------------------------------------------
-- Total y nivel: derivados, nunca almacenados
-- ---------------------------------------------------------------

-- `security_invoker = on` — al revés que `campaign_previews` y
-- `creator_public_profiles`, que corren con permisos del dueño porque su
-- trabajo es exponer un subconjunto curado a gente sin sesión. Acá es lo
-- contrario: la vista tiene que respetar la RLS de `points_events`, para que
-- un creador vea su total y no el del resto.
create view public.creator_points
with (security_invoker = on) as
  select creator_id, coalesce(sum(points), 0)::int as total_points
  from public.points_events
  group by creator_id;

-- Nivel = el umbral más alto que el creador alcanzó. Devolver 1 (Bronce) para
-- el que todavía no tiene ningún evento es lo correcto, no un caso borde.
--
-- `security definer` a propósito: el NIVEL de cualquier creador es visible para
-- cualquiera con sesión, aunque su ledger no lo sea. Es lo que hace falta para
-- que la marca vea "Oro" al lado de un aplicante y para que el gate de cupones
-- por nivel funcione. Lo que sigue sin salir de acá es el detalle: cuántos
-- puntos tiene y de dónde salieron.
create function public.creator_level(p_creator uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(lt.level), 1)
  from public.level_thresholds lt
  where lt.min_points <= (
    select coalesce(sum(points), 0)
    from public.points_events
    where creator_id = p_creator
  );
$$;

-- ---------------------------------------------------------------
-- award_points: el único camino hacia el ledger
-- ---------------------------------------------------------------
-- No es callable por usuarios (ver el revoke al final): la llaman los triggers
-- de abajo, que son security definer. Si algún día hace falta otorgar algo
-- desde el servidor, va con el cliente de service-role.
--
-- Nunca tira error cuando la regla no aplica —tope llegado, ya otorgado,
-- regla apagada—: devuelve null y sigue. Un trigger que reventara por eso
-- haría fallar la aprobación de una entrega, que es lo importante de esa
-- transacción; los puntos son el efecto secundario.
create function public.award_points(
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

-- ---------------------------------------------------------------
-- Perfil completo
-- ---------------------------------------------------------------
-- ⚠️ Estos cuatro chequeos son los mismos de `pasosVerificacionCreador()` en
-- `src/lib/ugc/verificacion.ts`, que es la checklist que el creador VE. Si allá
-- se agrega o se saca un paso, hay que tocar acá también: si no, la pantalla
-- diría "4/4 completo" y los +50 no llegarían nunca (o al revés).
--
-- No hay un evento natural de "completé el perfil": se completa de a poco y
-- desde tres tablas distintas. Por eso se re-evalúa en cada una de ellas y el
-- `once_only` de la regla es lo que impide que se otorgue más de una vez.
create function public.evaluar_perfil_completo(p_creator uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completo boolean;
begin
  select
    p.avatar_url is not null
    and coalesce(btrim(p.bio), '') <> ''
    and coalesce(btrim(p.city), '') <> ''
    and (
      coalesce(btrim(c.instagram_handle), '') <> ''
      or coalesce(btrim(c.tiktok_handle), '') <> ''
    )
    and exists (select 1 from public.portfolio_items pi where pi.creator_id = p.id)
  into v_completo
  from public.profiles p
  join public.creator_profiles c on c.profile_id = p.id
  where p.id = p_creator and p.role = 'creator';

  if coalesce(v_completo, false) then
    -- La referencia es el propio creador: el evento es único por definición y
    -- el índice de idempotencia lo respalda sin depender solo de `once_only`.
    perform public.award_points(p_creator, 'profile_completed', 'profile', p_creator);
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Triggers: dónde se gana cada punto
-- ---------------------------------------------------------------

-- Aplicar a una promo (+5, tope 10/mes).
create function public.puntos_al_aplicar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_points(new.creator_id, 'application', 'application', new.id);
  return null;
end;
$$;

create trigger applications_puntos_insert
  after insert on public.applications
  for each row execute function public.puntos_al_aplicar();

-- Selección (+50), entrega aprobada (+150) y rating (+50 / +20).
--
-- El rating y la aprobación llegan en el MISMO update (así lo hace
-- `approveApplicationAction`), por eso los tres casos viven en un solo trigger.
create function public.puntos_por_estado_de_aplicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.award_points(new.creator_id, 'campaign_selected', 'application', new.id);
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.award_points(new.creator_id, 'delivery_approved', 'application', new.id);
  end if;

  -- Solo la PRIMERA calificación puntúa. Si la marca corrigiera un 4 a un 5
  -- después, sin este `old.rating is null` el creador se llevaría los dos
  -- premios; y no hay forma de restar puntos en el MVP.
  if new.status = 'approved' and old.rating is null and new.rating is not null then
    if new.rating = 5 then
      perform public.award_points(new.creator_id, 'rating_5', 'application', new.id);
    elsif new.rating = 4 then
      perform public.award_points(new.creator_id, 'rating_4', 'application', new.id);
    end if;
  end if;

  return null;
end;
$$;

create trigger applications_puntos_update
  after update on public.applications
  for each row execute function public.puntos_por_estado_de_aplicacion();

-- Subir una pieza al book (+10, tope 5/mes). La primera pieza además puede ser
-- lo que termina de completar el perfil.
create function public.puntos_al_subir_al_book()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_points(new.creator_id, 'book_upload', 'book_piece', new.id);
  perform public.evaluar_perfil_completo(new.creator_id);
  return null;
end;
$$;

create trigger portfolio_items_puntos_insert
  after insert on public.portfolio_items
  for each row execute function public.puntos_al_subir_al_book();

-- Las otras dos puertas al "perfil completo": foto/bio/ciudad viven en
-- `profiles`, las redes en `creator_profiles`.
create function public.revisar_perfil_completo_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluar_perfil_completo(new.id);
  return null;
end;
$$;

create trigger profiles_perfil_completo
  after update on public.profiles
  for each row execute function public.revisar_perfil_completo_profiles();

create function public.revisar_perfil_completo_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluar_perfil_completo(new.profile_id);
  return null;
end;
$$;

create trigger creator_profiles_perfil_completo
  after insert or update on public.creator_profiles
  for each row execute function public.revisar_perfil_completo_creator();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------

alter table public.points_events enable row level security;
alter table public.point_rules enable row level security;
alter table public.level_thresholds enable row level security;

-- Cada creador ve su propio historial; el admin ve todo (lo necesita el panel
-- de la Fase 4). No hay policy de INSERT, UPDATE ni DELETE para nadie: al
-- ledger solo se entra por `award_points`, que corre como dueño y por eso no
-- pasa por estas policies. Sin política de escritura, un creador no puede
-- regalarse puntos ni con la sesión en la mano.
create policy "points_events_select_own_or_admin"
  on public.points_events for select
  to authenticated
  using (creator_id = auth.uid() or public.current_app_role() = 'admin');

-- La economía es información pública para quien tenga sesión: la pantalla de
-- Recompensas necesita mostrar "te faltan X pts para Oro" y la tabla de cómo
-- se ganan puntos. Que se lea no significa que se pueda tocar.
create policy "point_rules_select_authenticated"
  on public.point_rules for select
  to authenticated
  using (true);

create policy "point_rules_write_admin"
  on public.point_rules for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "level_thresholds_select_authenticated"
  on public.level_thresholds for select
  to authenticated
  using (true);

create policy "level_thresholds_write_admin"
  on public.level_thresholds for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------
-- Postgres le da EXECUTE a PUBLIC por defecto. Sobre una función security
-- definer que INSERTA en el ledger, eso sería el agujero entero: cualquiera
-- con sesión podría llamar al RPC y otorgarse `delivery_approved` sin haber
-- entregado nada. Los triggers no la necesitan concedida —también son security
-- definer y corren como el mismo dueño—.
revoke all on function public.award_points(uuid, text, text, uuid) from public;
revoke all on function public.evaluar_perfil_completo(uuid) from public;
grant execute on function public.award_points(uuid, text, text, uuid) to service_role;

-- `creator_level` sí se lee desde la app (el badge de nivel), y no escribe nada.
grant execute on function public.creator_level(uuid) to authenticated, service_role;
