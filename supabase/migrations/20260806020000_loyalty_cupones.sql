-- Loyalty Loop · Fase 2: cupones y reclamos.
--
-- Acá está lo que los puntos compran. El motor de la fase 1 acumula; esto
-- gasta. La pantalla que se construye en esta fase es solo la del creador
-- (ver, reclamar, mostrar el QR); el CRUD de la marca y la validación del
-- canje son la fase 3, pero la RLS de las dos partes se define de una sola vez
-- porque es el modelo de seguridad de la tabla, no de la pantalla.

create type coupon_type as enum ('producto', 'servicio', 'evento');
create type coupon_status as enum ('borrador', 'publicado', 'pausado', 'agotado', 'vencido');
create type redemption_status as enum ('reclamado', 'canjeado', 'expirado');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),

  -- La marca es `profiles(id)`, igual que `campaigns.brand_id`.
  brand_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  type coupon_type not null,
  description text not null,
  image_url text,

  -- El gate. `references level_thresholds(level)` para que no se pueda pedir un
  -- nivel 7 que no existe; si mañana se agrega un nivel, el cupón lo puede usar
  -- sin migrar nada.
  min_level int not null default 1 references public.level_thresholds (level),

  stock_total int not null check (stock_total > 0),

  -- Dos formas de vencer, y al menos una es obligatoria (el check de abajo):
  -- relativa al reclamo ("14 días desde que lo reclamaste") o fecha fija. Un
  -- cupón sin vencimiento es stock congelado para siempre: alguien lo reclama,
  -- no va nunca, y ese lugar no se libera.
  claim_validity_days int check (claim_validity_days > 0),
  expires_at timestamptz,

  -- Solo para type='evento'.
  event_date timestamptz,
  event_location text,

  conditions text,

  status coupon_status not null default 'borrador',
  created_at timestamptz not null default now(),

  constraint coupons_tiene_vencimiento
    check (claim_validity_days is not null or expires_at is not null),
  constraint coupons_evento_con_fecha
    check (type <> 'evento' or event_date is not null)
);

create index coupons_brand_idx on public.coupons (brand_id, created_at desc);
-- El feed del creador filtra por publicado y ordena por fecha; es la consulta
-- que más va a correr de esta tabla.
create index coupons_feed_idx on public.coupons (status, created_at desc)
  where status = 'publicado';

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,

  -- Formato QL-XXXX-XX. Es lo que el creador dicta en voz alta cuando el QR no
  -- escanea, así que no lleva caracteres que se confundan al oído o de vista.
  code text not null unique,

  status redemption_status not null default 'reclamado',
  claimed_at timestamptz not null default now(),

  -- Calculado al reclamar, no heredado del cupón: si la marca después alarga
  -- la vigencia, el que ya reclamó tiene el plazo con el que reclamó.
  expires_at timestamptz not null,

  redeemed_at timestamptz,
  validated_by uuid references public.profiles (id),

  -- Un canje por creador por cupón. Regla fija del MVP.
  unique (coupon_id, creator_id)
);

create index redemptions_creator_idx on public.redemptions (creator_id, claimed_at desc);
create index redemptions_coupon_idx on public.redemptions (coupon_id);
-- Para el barrido diario de vencimientos de la fase 4.
create index redemptions_expiran_idx on public.redemptions (expires_at)
  where status = 'reclamado';

-- ---------------------------------------------------------------
-- Stock disponible
-- ---------------------------------------------------------------
-- `security_invoker = false` (corre con permisos del dueño) y NO es un
-- descuido: con invoker, cada creador contaría solo los reclamos que la RLS le
-- deja ver —los suyos— y vería "20 de 20 disponibles" en un cupón agotado.
--
-- Es seguro porque devuelve únicamente números por id: sin acceso a la fila de
-- `coupons` no dice de qué cupón se trata ni quién lo reclamó.
--
-- Los `expirado` no cuentan: liberan el lugar que habían tomado.
create view public.coupon_stock
with (security_invoker = false) as
  select
    c.id as coupon_id,
    c.stock_total,
    count(r.id) filter (where r.status in ('reclamado', 'canjeado'))::int as stock_claimed,
    (c.stock_total - count(r.id) filter (where r.status in ('reclamado', 'canjeado')))::int as stock_available
  from public.coupons c
  left join public.redemptions r on r.coupon_id = c.id
  group by c.id, c.stock_total;

grant select on public.coupon_stock to authenticated;

-- ---------------------------------------------------------------
-- Código del cupón
-- ---------------------------------------------------------------
-- Charset sin caracteres ambiguos: no hay O/0, I/1, L, ni S/5. El código se
-- dicta y se digita en el mostrador de un local, muchas veces con ruido.
create function public.generar_codigo_cupon()
returns text
language plpgsql
volatile
as $$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_s text := '';
  i int;
begin
  for i in 1..6 loop
    v_s := v_s || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return 'QL-' || substr(v_s, 1, 4) || '-' || substr(v_s, 5, 2);
end;
$$;

-- ---------------------------------------------------------------
-- claim_coupon: reclamar es una transacción, no un insert
-- ---------------------------------------------------------------
-- A diferencia de `award_points`, ésta SÍ la llama el usuario: es la acción del
-- creador. Por eso valida todo de nuevo adentro —nivel, stock, estado,
-- reclamo previo— sin confiar en lo que la pantalla creía saber.
--
-- El `for update` sobre la fila del cupón es lo que hace que dos creadores
-- tocando "Reclamar" en el mismo segundo no se lleven los dos el último lugar:
-- el segundo espera, vuelve a contar y se encuentra con el stock en cero.
--
-- Los errores son texto en español y salen tal cual en la pantalla: cada uno
-- explica qué pasó, porque "no se pudo reclamar" no le sirve a nadie.
create function public.claim_coupon(p_coupon uuid)
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

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------

alter table public.coupons enable row level security;
alter table public.redemptions enable row level security;

-- El creador ve TODOS los publicados, no solo los de su nivel: la pantalla
-- muestra los de nivel superior bloqueados con 🔒 y cuántos puntos le faltan.
-- Esconderlos sería esconder justamente el motivo para seguir entregando.
create policy "coupons_select_publicados_creator"
  on public.coupons for select
  to authenticated
  using (status in ('publicado', 'agotado') and public.current_app_role() = 'creator');

create policy "coupons_select_own_brand_or_admin"
  on public.coupons for select
  to authenticated
  using (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  );

-- Mismo gate que las campañas: una marca sin verificar arma borradores pero no
-- los publica. Va en RLS y no solo en la pantalla.
create policy "coupons_insert_own_brand"
  on public.coupons for insert
  to authenticated
  with check (
    brand_id = auth.uid()
    and public.current_app_role() = 'brand'
    and (status <> 'publicado' or public.current_brand_verified())
  );

create policy "coupons_update_own_brand_or_admin"
  on public.coupons for update
  to authenticated
  using (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  )
  with check (
    (
      brand_id = auth.uid()
      and public.current_app_role() = 'brand'
      and (status <> 'publicado' or public.current_brand_verified())
    )
    or public.current_app_role() = 'admin'
  );

create policy "coupons_delete_own_brand"
  on public.coupons for delete
  to authenticated
  using (brand_id = auth.uid() and public.current_app_role() = 'brand');

-- Reclamos: el creador ve los suyos, la marca los de SUS cupones, admin todo.
create policy "redemptions_select_own_creator"
  on public.redemptions for select
  to authenticated
  using (creator_id = auth.uid());

create policy "redemptions_select_brand_owner"
  on public.redemptions for select
  to authenticated
  using (
    exists (
      select 1 from public.coupons c
      where c.id = redemptions.coupon_id and c.brand_id = auth.uid()
    )
  );

create policy "redemptions_select_admin"
  on public.redemptions for select
  to authenticated
  using (public.current_app_role() = 'admin');

-- Sin policy de INSERT, UPDATE ni DELETE a propósito: reclamar es `claim_coupon`
-- y canjear va a ser `redeem_coupon` (fase 3). Un insert directo se saltearía
-- el chequeo de nivel y el de stock.

-- ---------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------
-- La lección de la fase 1: revocar por rol, nunca solo `from public`, porque
-- las default privileges de Supabase le dan EXECUTE a anon y authenticated por
-- separado. `claim_coupon` sí es para el usuario, pero para el que tiene
-- sesión: anon no tiene nada que hacer acá.
revoke all on function public.claim_coupon(uuid) from anon, public;
grant execute on function public.claim_coupon(uuid) to authenticated;

revoke all on function public.generar_codigo_cupon() from anon, authenticated, public;
