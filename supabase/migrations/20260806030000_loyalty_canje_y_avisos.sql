-- Loyalty Loop · Fases 3 y 4: canje, vencimientos y avisos.
--
-- Cierra el círculo: la fase 2 dejó al creador con un código en la mano y no
-- había forma de quemarlo. Acá está el canje del lado de la marca, el barrido
-- que libera lo que venció, y los avisos que hacen que todo esto se note sin
-- que nadie tenga que entrar a mirar.

-- ---------------------------------------------------------------
-- redeem_coupon: quemar el código
-- ---------------------------------------------------------------
-- Solo la marca dueña del cupón (o admin) puede canjear, y eso NO se chequea
-- con un if: va adentro del WHERE. Un código de otra marca simplemente no
-- aparece, así que la respuesta es "no encontramos ese código" — la misma que
-- para un código inventado.
--
-- Es a propósito: si dijera "este código no es tuyo", cualquier marca podría
-- usar la pantalla de validación para averiguar qué códigos existen en la
-- plataforma probando combinaciones.
create function public.redeem_coupon(p_code text)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.redemptions;
  v_limpio text := upper(btrim(coalesce(p_code, '')));
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión para validar un canje.';
  end if;

  if v_limpio = '' then
    raise exception 'Escribí el código del cupón.';
  end if;

  select r.* into v_row
  from public.redemptions r
  join public.coupons c on c.id = r.coupon_id
  where upper(r.code) = v_limpio
    and (c.brand_id = auth.uid() or public.current_app_role() = 'admin')
  for update of r;

  if not found then
    raise exception 'No encontramos ese código.';
  end if;

  if v_row.status = 'canjeado' then
    raise exception 'Este código ya fue canjeado.';
  end if;

  -- Se vence acá mismo aunque el barrido diario todavía no haya pasado: entre
  -- corrida y corrida hay 24 h, y en el mostrador el plazo es el plazo.
  if v_row.status = 'expirado' or v_row.expires_at < now() then
    update public.redemptions set status = 'expirado' where id = v_row.id;
    raise exception 'Este código venció y ya no se puede canjear.';
  end if;

  update public.redemptions
  set status = 'canjeado',
      redeemed_at = now(),
      validated_by = auth.uid()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------
-- Barrido diario
-- ---------------------------------------------------------------
-- Tres cosas, en este orden porque la tercera depende de la primera:
--   1. los reclamos que se pasaron de fecha pasan a `expirado`;
--   2. los cupones con fecha de cierre pasada pasan a `vencido`;
--   3. un cupón `agotado` cuyos reclamos expiraron vuelve a `publicado` — el
--      lugar que ese creador tomó y no usó se libera para otro.
--
-- Devuelve un resumen en json para que el cron lo loguee: un barrido que no
-- dice cuánto tocó es imposible de verificar sin entrar a la base.
create function public.expirar_loyalty()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reclamos int;
  v_cupones int;
  v_reabiertos int;
  v_avisos int;
begin
  update public.redemptions
  set status = 'expirado'
  where status = 'reclamado' and expires_at < now();
  get diagnostics v_reclamos = row_count;

  update public.coupons
  set status = 'vencido'
  where status in ('publicado', 'pausado', 'agotado')
    and expires_at is not null
    and expires_at < now();
  get diagnostics v_cupones = row_count;

  update public.coupons c
  set status = 'publicado'
  where c.status = 'agotado'
    and (c.expires_at is null or c.expires_at > now())
    and (
      select count(*) from public.redemptions r
      where r.coupon_id = c.id and r.status in ('reclamado', 'canjeado')
    ) < c.stock_total;
  get diagnostics v_reabiertos = row_count;

  -- "Tu cupón vence en 3 días". La comparación es por DÍA de Costa Rica y no
  -- por horas: si no, el aviso saldría o no según a qué hora corrió el cron.
  -- El `not exists` evita repetirlo si el barrido corre dos veces el mismo día.
  insert into public.notifications (profile_id, type, payload)
  select
    r.creator_id,
    'coupon_expiring',
    jsonb_build_object('code', r.code, 'coupon_title', c.title, 'expires_at', r.expires_at)
  from public.redemptions r
  join public.coupons c on c.id = r.coupon_id
  where r.status = 'reclamado'
    and (r.expires_at at time zone 'America/Costa_Rica')::date
        = ((now() at time zone 'America/Costa_Rica')::date + 3)
    and not exists (
      select 1 from public.notifications n
      where n.profile_id = r.creator_id
        and n.type = 'coupon_expiring'
        and n.payload->>'code' = r.code
    );
  get diagnostics v_avisos = row_count;

  return jsonb_build_object(
    'reclamos_expirados', v_reclamos,
    'cupones_vencidos', v_cupones,
    'cupones_reabiertos', v_reabiertos,
    'avisos_por_vencer', v_avisos
  );
end;
$$;

-- ---------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------

-- "Subiste a Oro 🥇". El nivel no se guarda en ningún lado, así que la única
-- forma de saber que cambió es comparar el total CON este evento contra el
-- total SIN él. Por eso se resta `new.points` en vez de leer un valor anterior
-- que no existe.
create function public.notify_level_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_antes int;
  v_despues int;
  v_nombre text;
begin
  select coalesce(sum(points), 0) into v_total
  from public.points_events where creator_id = new.creator_id;

  select coalesce(max(level), 1) into v_despues
  from public.level_thresholds where min_points <= v_total;

  select coalesce(max(level), 1) into v_antes
  from public.level_thresholds where min_points <= (v_total - new.points);

  if v_despues > v_antes then
    select name into v_nombre from public.level_thresholds where level = v_despues;

    insert into public.notifications (profile_id, type, payload)
    values (
      new.creator_id,
      'level_up',
      jsonb_build_object('level', v_despues, 'level_name', v_nombre)
    );
  end if;

  return null;
end;
$$;

create trigger points_events_notify_level_up
  after insert on public.points_events
  for each row execute function public.notify_level_up();

-- "Nuevo canje en tu local". Le llega a la marca dueña aunque haya sido su
-- propio staff el que escaneó: quien valida en el mostrador no siempre es quien
-- lleva la cuenta del negocio.
create function public.notify_coupon_redeemed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid;
  v_title text;
begin
  if new.status = 'canjeado' and old.status is distinct from 'canjeado' then
    select brand_id, title into v_brand, v_title
    from public.coupons where id = new.coupon_id;

    insert into public.notifications (profile_id, type, payload)
    values (
      v_brand,
      'coupon_redeemed',
      jsonb_build_object('coupon_title', v_title, 'code', new.code)
    );
  end if;
  return null;
end;
$$;

create trigger redemptions_notify_redeemed
  after update on public.redemptions
  for each row execute function public.notify_coupon_redeemed();

-- ---------------------------------------------------------------
-- "Mis cupones": ver lo que reclamé, pase lo que pase con el cupón
-- ---------------------------------------------------------------
-- La policy de la fase 2 le deja ver al creador los cupones `publicado` y
-- `agotado`. Falta un caso que aparece solo: la marca pausa el cupón —o el
-- cupón vence— y al creador que ya lo reclamó se le queda un código en la mano
-- cuya ficha ya no puede leer. En la pantalla eso es una fila sin título.
--
-- La comprobación va adentro de una función security definer y no como un
-- `exists` en la policy. Si fuera un exists, evaluar la policy de `coupons`
-- consultaría `redemptions`, cuya propia policy consulta `coupons`, y Postgres
-- entraría en recursión infinita. La función corre como dueño y corta el ciclo.
create function public.tengo_reclamo(p_coupon uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.redemptions
    where coupon_id = p_coupon and creator_id = auth.uid()
  );
$$;

create policy "coupons_select_reclamados_por_mi"
  on public.coupons for select
  to authenticated
  using (public.tengo_reclamo(id));

grant execute on function public.tengo_reclamo(uuid) to authenticated;
revoke all on function public.tengo_reclamo(uuid) from anon;

-- ---------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------
revoke all on function public.redeem_coupon(text) from anon, public;
grant execute on function public.redeem_coupon(text) to authenticated;

-- El barrido no es del usuario: lo corre el cron con service-role.
revoke all on function public.expirar_loyalty() from anon, authenticated, public;
grant execute on function public.expirar_loyalty() to service_role;
