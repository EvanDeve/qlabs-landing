-- Bloqueo duro por verificación: una cuenta de creador o de marca no entra al
-- panel hasta que un admin la verifica. Antes entraba y el candado era parcial
-- (podía mirar todo, pero no aplicar ni publicar); ahora no entra del todo.
--
-- El motivo es de negocio: sin esto, cualquiera se registra con un correo
-- cualquiera y ve la plataforma entera por dentro.
--
-- ⚠️ Lo importante de esta migración NO es la pantalla —esa se resuelve en el
-- layout— sino las dos policies de SELECT del final. La llave anónima de
-- Supabase viaja en el HTML de la página, así que una cuenta ficticia puede
-- pedirle datos a la API sin abrir nunca el panel. Un gate que vive solo en el
-- layout no la detiene.

-- ---------- estado: pendiente / verificada / rechazada ----------
-- `verified` sigue siendo la fuente de verdad de "puede operar" (está leído en
-- media app y en varias policies). El rechazo se suma como dos columnas en vez
-- de convertir `verified` en un enum, que habría obligado a tocar todo eso.
--
--   pendiente  = not verified and rejected_at is null
--   verificada = verified
--   rechazada  = not verified and rejected_at is not null

alter table public.creator_profiles
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.brand_profiles
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

-- ---------- solo admin decide el estado ----------
-- Los dos triggers ya protegían `verified`. Sin extenderlos, el dueño de la
-- fila —que tiene UPDATE sobre su propio perfil— podía limpiarse el rechazo
-- solo y volver a la cola de revisión cuantas veces quisiera.

create or replace function public.protect_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
       new.verified is distinct from old.verified
       or new.rejected_at is distinct from old.rejected_at
       or new.rejection_reason is distinct from old.rejection_reason
     )
     and public.current_app_role() <> 'admin' then
    raise exception 'solo admin puede cambiar el estado de verificación';
  end if;
  return new;
end;
$$;

create or replace function public.protect_brand_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
       new.verified is distinct from old.verified
       or new.rejected_at is distinct from old.rejected_at
       or new.rejection_reason is distinct from old.rejection_reason
     )
     and public.current_app_role() <> 'admin' then
    raise exception 'solo admin puede cambiar el estado de verificación de una marca';
  end if;
  return new;
end;
$$;

-- ---------- espejo de current_brand_verified() para el creador ----------
-- security definer porque se llama desde policies de OTRAS tablas: con
-- security invoker, evaluar la policy de `campaigns` volvería a pasar por la
-- policy de `creator_profiles` y se enredan entre sí.

create or replace function public.current_creator_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_profiles
    where profile_id = auth.uid() and verified
  )
$$;

grant execute on function public.current_creator_verified() to authenticated;

-- ---------- el hueco de lectura que abre esta migración ----------
-- Hasta acá, CUALQUIER usuario con rol `creator` leía el brief completo de
-- todas las campañas publicadas: presupuesto, brief, entregables y derechos de
-- uso. Solo pedía el rol, que se elige uno mismo al registrarse. Aplicar sí
-- exigía verificación (20260721170000), pero leer no.

drop policy "campaigns_select_published_creators" on public.campaigns;

create policy "campaigns_select_published_creators"
  on public.campaigns for select
  to authenticated
  using (
    status = 'published'
    and public.current_app_role() = 'creator'
    and public.current_creator_verified()
  );

-- Admin no se pierde nada: tiene su propia policy desde 20260707190000
-- (`campaigns_select_admin`), y por eso sale de la lista de roles de arriba.

-- Mismo agujero en los cupones de Loyalty Loop.
drop policy "coupons_select_publicados_creator" on public.coupons;

create policy "coupons_select_publicados_creator"
  on public.coupons for select
  to authenticated
  using (
    status in ('publicado', 'agotado')
    and public.current_app_role() = 'creator'
    and public.current_creator_verified()
  );

-- La vitrina pública (`campaign_previews`) NO se toca: es security definer y
-- expone a propósito solo marca, título, formato y categoría — lo mismo que ve
-- un visitante sin cuenta. El bloqueo es para el brief, no para la vitrina.

-- ---------- el RPC de reclamar, que se saltea las policies ----------
-- `claim_coupon` es security definer: corre con los permisos del dueño de la
-- función, así que la policy de arriba NO la frena. Chequeaba el rol y el
-- nivel, nunca la verificación. Sin esta línea, cerrar el SELECT solo esconde
-- el catálogo: una cuenta sin verificar que consiguiera un id igual reclamaba.
--
-- Se toca solo este bloque; el resto del cuerpo queda igual que en
-- 20260806020000 (que es de donde sale esta copia).

create or replace function public.claim_coupon(p_coupon uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid := auth.uid();
  v_coupon public.coupons;
  v_usados int;
  v_code text;
  v_expira timestamptz;
  v_row public.redemptions;
begin
  if v_creator is null then
    raise exception 'Necesitás iniciar sesión para reclamar un cupón.';
  end if;

  if public.current_app_role() <> 'creator' then
    raise exception 'Solo las cuentas de creador pueden reclamar cupones.';
  end if;

  if not public.current_creator_verified() then
    raise exception 'Tu cuenta todavía está en revisión.';
  end if;

  select * into v_coupon from public.coupons where id = p_coupon for update;

  if not found then
    raise exception 'Ese cupón ya no existe.';
  end if;

  if v_coupon.status <> 'publicado' then
    raise exception 'Ese cupón ya no está disponible.';
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'Ese cupón ya venció.';
  end if;

  if public.creator_level(v_creator) < v_coupon.min_level then
    raise exception 'Tu nivel todavía no alcanza para este cupón.';
  end if;

  if exists (
    select 1 from public.redemptions
    where coupon_id = p_coupon and creator_id = v_creator
  ) then
    raise exception 'Ya reclamaste este cupón.';
  end if;

  select count(*) into v_usados
  from public.redemptions
  where coupon_id = p_coupon and status in ('reclamado', 'canjeado');

  if v_usados >= v_coupon.stock_total then
    raise exception 'Se agotaron los cupones de esta recompensa.';
  end if;

  -- El unique sobre `code` es la garantía real; el loop solo evita que una
  -- colisión (1 en 887 millones) le explote en la cara al creador.
  loop
    v_code := public.generar_codigo_cupon();
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;

  -- Para un evento el plazo es el evento mismo: un QR que sirve "14 días desde
  -- el reclamo" no significa nada cuando la cena es el jueves.
  v_expira := case
    when v_coupon.type = 'evento' and v_coupon.event_date is not null then v_coupon.event_date
    when v_coupon.claim_validity_days is not null then now() + make_interval(days => v_coupon.claim_validity_days)
    else v_coupon.expires_at
  end;

  -- La vigencia del reclamo nunca puede pasarse del cierre del cupón.
  if v_coupon.expires_at is not null then
    v_expira := least(v_expira, v_coupon.expires_at);
  end if;

  insert into public.redemptions (coupon_id, creator_id, code, expires_at)
  values (p_coupon, v_creator, v_code, v_expira)
  returning * into v_row;

  -- Se marca agotado acá y no con un trigger contando filas: éste es el único
  -- lugar donde nace un reclamo, y el `for update` de arriba ya serializó a
  -- todo el que estuviera intentando lo mismo.
  if v_usados + 1 >= v_coupon.stock_total then
    update public.coupons set status = 'agotado' where id = p_coupon;
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_coupon(uuid) from anon, public;
grant execute on function public.claim_coupon(uuid) to authenticated;
