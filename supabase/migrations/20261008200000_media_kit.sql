-- Spec 002 · Media kit del creador: piezas destacadas, teléfono para marcas
-- verificadas y visitas del kit.
--
-- Todo aditivo: el código que hoy está en prod no lee nada de esto y la vista
-- pública solo gana una columna al final, así que se puede correr antes del
-- deploy. Las guardas (`if not exists`, `drop … if exists`) dejan correrla dos
-- veces sin que rompa.

begin;

-- ───────────── 1. Piezas destacadas (RF-01..05) ─────────────
-- Columna en portfolio_items y no tabla aparte: borrar la pieza borra la marca
-- de destacada (RF-05 sale gratis) y el tope de 3 lo garantiza la base.
alter table public.portfolio_items
  add column if not exists orden_destacada smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portfolio_items_orden_destacada_rango') then
    alter table public.portfolio_items
      add constraint portfolio_items_orden_destacada_rango check (orden_destacada between 1 and 3);
  end if;
  -- UNIQUE con NULLs distintos (default de Postgres): muchas piezas sin
  -- destacar y a lo sumo una en cada lugar 1, 2 y 3 por creador → nunca más
  -- de 3, aunque alguien le pegue a PostgREST directo.
  if not exists (select 1 from pg_constraint where conname = 'portfolio_items_destacada_unica') then
    alter table public.portfolio_items
      add constraint portfolio_items_destacada_unica unique (creator_id, orden_destacada);
  end if;
end $$;

-- Reescribe las destacadas del creador en una sola transacción: destacar,
-- quitar y reordenar son todos "esta es la lista nueva". Invoker: corre con la
-- RLS de quien llama, así que solo puede tocar sus propias filas.
create or replace function public.fijar_destacadas(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n int := coalesce(array_length(p_ids, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;
  if v_n > 3 then
    raise exception 'el máximo de destacadas es 3' using errcode = 'check_violation';
  end if;
  if (select count(distinct x) from unnest(p_ids) x) <> v_n
     or (select count(*) from public.portfolio_items
          where id = any(p_ids) and creator_id = auth.uid()) <> v_n then
    raise exception 'pieza inválida';
  end if;

  -- Primero todas en null y después numeradas: así el unique nunca ve dos
  -- piezas en el mismo lugar a mitad del reordenamiento.
  update public.portfolio_items set orden_destacada = null
   where creator_id = auth.uid() and orden_destacada is not null;
  update public.portfolio_items pi set orden_destacada = t.orden
    from unnest(p_ids) with ordinality as t(id, orden)
   where pi.id = t.id and pi.creator_id = auth.uid();
end;
$$;
-- Supabase le da EXECUTE a anon sobre toda función nueva de public: se saca a mano.
revoke all on function public.fijar_destacadas(uuid[]) from public, anon;
grant execute on function public.fijar_destacadas(uuid[]) to authenticated;

-- ───────────── 2. Teléfono del creador (RF-06..12c) ─────────────
-- Vive en creator_profiles, que ya está cerrada a dueño + admin
-- (`creator_profiles_select_own_or_admin`). La policy de update del dueño le
-- deja editar estas dos columnas, y está bien: son suyas.
alter table public.creator_profiles
  add column if not exists telefono_e164 text,
  add column if not exists mostrar_telefono boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'creator_profiles_telefono_e164_chk') then
    alter table public.creator_profiles
      add constraint creator_profiles_telefono_e164_chk
        check (telefono_e164 is null or telefono_e164 ~ '^\+[1-9][0-9]{7,14}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'creator_profiles_mostrar_requiere_telefono') then
    alter table public.creator_profiles
      add constraint creator_profiles_mostrar_requiere_telefono
        check (not mostrar_telefono or telefono_e164 is not null);
  end if;
end $$;

-- La vista NO lleva el número: solo si hay contacto para ofrecer (RF-09).
-- Mismas columnas y en el mismo orden que en prod, más una al final, que es lo
-- único que `create or replace view` permite. El código de hoy usa select("*")
-- y no se entera.
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
  p.display_name,
  p.bio,
  p.city,
  p.avatar_url,
  (cp.mostrar_telefono and cp.telefono_e164 is not null) as tiene_telefono
from public.creator_profiles cp
join public.profiles p on p.id = cp.profile_id
where cp.verified or public.current_app_role() = 'admin';

grant select on public.creator_public_profiles to anon, authenticated;

-- "Esta marca vio este teléfono este día". Da el dedupe de la notificación
-- (RF-12c) con una PK en vez de un `not exists` sobre el jsonb de
-- notifications, y deja rastro si una marca se pone a juntar números.
create table if not exists public.kit_telefono_vistas (
  creator_id uuid not null references public.profiles (id) on delete cascade,
  brand_id   uuid not null references public.profiles (id) on delete cascade,
  dia        date not null,
  created_at timestamptz not null default now(),
  primary key (creator_id, brand_id, dia)
);
alter table public.kit_telefono_vistas enable row level security;
drop policy if exists "kit_telefono_vistas_select_admin" on public.kit_telefono_vistas;
create policy "kit_telefono_vistas_select_admin"
  on public.kit_telefono_vistas for select
  to authenticated
  using (public.current_app_role() = 'admin');
-- Sin policies de escritura: solo escribe la función de abajo.

-- La única puerta al número para alguien que no es el dueño (RF-08, RF-10).
-- Ver y avisar van en el mismo acto: si la marca leyera el número en un
-- request y el aviso saliera en otro, se podría ver sin avisar.
create or replace function public.ver_telefono_creador(p_creator uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.app_role := public.current_app_role();
  v_tel text;
  v_marca record;
  v_nuevas int;
begin
  if v_uid is null then
    return null;
  end if;

  select cp.telefono_e164 into v_tel
    from public.creator_profiles cp
   where cp.profile_id = p_creator and cp.verified and cp.mostrar_telefono;
  if v_tel is null then
    return null;
  end if;

  -- El equipo lo ve sin avisarle al creador.
  if v_rol = 'admin' then
    return v_tel;
  end if;

  -- `is distinct from` y no `<>`: con rol null, `null <> 'brand'` es null y el
  -- `if` lo deja pasar.
  if v_rol is distinct from 'brand' then
    return null;
  end if;

  -- Una marca que pierde la verificación deja de ver desde ese momento.
  select bp.brand_name, bp.slug into v_marca
    from public.brand_profiles bp
   where bp.profile_id = v_uid and bp.verified;
  if not found then
    return null;
  end if;

  insert into public.kit_telefono_vistas (creator_id, brand_id, dia)
  values (p_creator, v_uid, (now() at time zone 'America/Costa_Rica')::date)
  on conflict do nothing;
  get diagnostics v_nuevas = row_count;

  -- Una notificación por marca + creador + día de Costa Rica (RF-12c).
  if v_nuevas > 0 then
    insert into public.notifications (profile_id, type, payload)
    values (
      p_creator,
      'telefono_visto',
      jsonb_build_object(
        'brand_id', v_uid,
        'brand_name', v_marca.brand_name,
        'brand_slug', v_marca.slug
      )
    );
  end if;

  return v_tel;
end;
$$;
revoke all on function public.ver_telefono_creador(uuid) from public, anon;
grant execute on function public.ver_telefono_creador(uuid) to authenticated;

-- ───────────── 3. Visitas del kit (RF-13..19) ─────────────
-- `huella` = md5(quién:creador:día). Ni el user id ni la cookie anónima se
-- guardan en claro, y la huella no se puede cruzar entre días ni entre
-- creadores: alcanza para "una por persona por día" (RF-16) y cumple lo que
-- promete la política de privacidad (§10).
create table if not exists public.kit_visitas (
  creator_id uuid not null references public.profiles (id) on delete cascade,
  dia        date not null,
  huella     text not null,
  es_marca   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (creator_id, dia, huella)
);
alter table public.kit_visitas enable row level security;
drop policy if exists "kit_visitas_select_admin" on public.kit_visitas;
create policy "kit_visitas_select_admin"
  on public.kit_visitas for select
  to authenticated
  using (public.current_app_role() = 'admin');
-- Sin lectura para el creador: ve los totales por `resumen_visitas_kit` y no
-- filas, que dirían qué día entró cada marca.

create or replace function public.registrar_visita_kit(p_creator uuid, p_anonimo uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.app_role := public.current_app_role();
  v_dia date := (now() at time zone 'America/Costa_Rica')::date;
  v_quien text := coalesce(v_uid::text, p_anonimo::text);
begin
  if v_quien is null then
    return;
  end if;
  -- El propio creador y el equipo no cuentan (RF-14).
  if v_uid is not null and (v_uid = p_creator or v_rol = 'admin') then
    return;
  end if;
  -- Un kit que no se muestra al público no suma visitas (RF-21).
  if not exists (
    select 1 from public.creator_profiles where profile_id = p_creator and verified
  ) then
    return;
  end if;

  insert into public.kit_visitas (creator_id, dia, huella, es_marca)
  values (
    p_creator,
    v_dia,
    md5(v_quien || ':' || p_creator::text || ':' || v_dia::text),
    -- Cualquier cuenta de marca, verificada o no (decisión 4 de la spec).
    v_rol is not distinct from 'brand'
  )
  on conflict do nothing; -- RF-16
end;
$$;
revoke all on function public.registrar_visita_kit(uuid, uuid) from public;
grant execute on function public.registrar_visita_kit(uuid, uuid) to anon, authenticated;

create or replace function public.resumen_visitas_kit(p_creator uuid, p_desde date)
returns table (total bigint, de_marcas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), count(*) filter (where es_marca)
    from public.kit_visitas
   where creator_id = p_creator
     and dia >= p_desde
     -- Solo el dueño y el equipo (RF-19); a cualquier otro le da 0 y 0.
     and (p_creator = auth.uid() or public.current_app_role() = 'admin')
$$;
revoke all on function public.resumen_visitas_kit(uuid, date) from public, anon;
grant execute on function public.resumen_visitas_kit(uuid, date) to authenticated;

commit;
