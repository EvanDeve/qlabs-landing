-- Close Friends · los cupones de Loyalty Loop, también para miembros.
--
-- No es un segundo sistema de cupones: el mismo `coupons` suma a quién va
-- dirigido, y el mismo `redemptions` acepta a un miembro como quien reclama.
-- El canje en caja (`redeem_coupon`) no cambia: busca el código entre los
-- cupones de la marca, sin mirar quién lo reclamó.

-- ---------------------------------------------------------------
-- A quién va dirigido un cupón
-- ---------------------------------------------------------------
create type public.coupon_audience as enum ('creators', 'members', 'both');
-- brand_members: solo los miembros vinculados a este negocio.
-- all_members:   cualquier miembro de Close Friends, venga del negocio que venga.
create type public.coupon_member_scope as enum ('all_members', 'brand_members');

-- El default deja todo lo que ya existe como estaba: los cupones de hoy son de
-- creadores y ningún miembro los ve.
alter table public.coupons
  add column audience public.coupon_audience not null default 'creators',
  add column member_scope public.coupon_member_scope not null default 'brand_members';

-- ---------------------------------------------------------------
-- Quién reclama: creator_id O member_id
-- ---------------------------------------------------------------
-- Dos FK y un check de "exactamente uno", en vez de renombrar `creator_id` a
-- algo genérico. Los dos apuntan a una cuenta, pero:
--   · renombrar rompe producción entre que corre esta migración (a mano, en el
--     SQL Editor) y termina el deploy: cada consulta que dice `creator_id`
--     fallaría. Con una columna nueva, todo lo de hoy sigue andando igual;
--   · la FK a `members` garantiza que quien reclama ES miembro, cosa que una
--     columna genérica a `profiles` no diría;
--   · las policies y los unique quedan explícitos por tipo.
alter table public.redemptions
  alter column creator_id drop not null,
  add column member_id uuid references public.members (profile_id) on delete cascade,
  add constraint redemptions_un_titular check (num_nonnulls(creator_id, member_id) = 1),
  -- Un canje por miembro por cupón, como ya pasa con el creador.
  add constraint redemptions_coupon_member_key unique (coupon_id, member_id);

create index redemptions_member_idx on public.redemptions (member_id, claimed_at desc)
  where member_id is not null;

-- ---------------------------------------------------------------
-- Quién ve qué cupón
-- ---------------------------------------------------------------
-- El creador: igual que antes, pero ya no los que son solo para miembros.
drop policy "coupons_select_publicados_creator" on public.coupons;

create policy "coupons_select_publicados_creator"
  on public.coupons for select
  to authenticated
  using (
    status in ('publicado', 'agotado')
    and audience in ('creators', 'both')
    and public.current_app_role() = 'creator'
    and public.current_creator_verified()
  );

-- El miembro: los de su audiencia y su alcance. El `exists` sobre
-- `member_brand_links` no cierra ningún ciclo: esa tabla no consulta
-- `coupons` en sus policies (la trampa de 20260806030000 era coupons ↔
-- redemptions).
create policy "coupons_select_publicados_member"
  on public.coupons for select
  to authenticated
  using (
    status in ('publicado', 'agotado')
    and audience in ('members', 'both')
    and public.current_app_role() = 'member'
    and (
      member_scope = 'all_members'
      or exists (
        select 1 from public.member_brand_links l
        where l.member_id = auth.uid() and l.brand_id = coupons.brand_id
      )
    )
  );

create policy "redemptions_select_own_member"
  on public.redemptions for select
  to authenticated
  using (member_id = auth.uid());

-- "Mis cupones" del miembro tiene que poder leer la ficha de un cupón que ya
-- reclamó aunque la marca lo pause: mismo caso que resolvió `tengo_reclamo`
-- para el creador, así que se amplía la misma función.
create or replace function public.tengo_reclamo(p_coupon uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.redemptions
    where coupon_id = p_coupon
      and (creator_id = auth.uid() or member_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------
-- claim_coupon (creador): no reclama lo que es solo para miembros
-- ---------------------------------------------------------------
-- Copia de 20260807000000 con UN cambio: el chequeo de audiencia. La policy de
-- arriba ya le esconde el cupón, pero esta función es security definer y no
-- pasa por policies: con el id a mano lo reclamaría igual.
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

  if not found or v_coupon.audience = 'members' then
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

  -- El stock es uno solo para creadores y miembros: un cupón 'both' de 10
  -- lugares tiene 10, no 10 y 10.
  select count(*) into v_usados
  from public.redemptions
  where coupon_id = p_coupon and status in ('reclamado', 'canjeado');

  if v_usados >= v_coupon.stock_total then
    raise exception 'Se agotaron los cupones de esta recompensa.';
  end if;

  loop
    v_code := public.generar_codigo_cupon();
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;

  v_expira := case
    when v_coupon.type = 'evento' and v_coupon.event_date is not null then v_coupon.event_date
    when v_coupon.claim_validity_days is not null then now() + make_interval(days => v_coupon.claim_validity_days)
    else v_coupon.expires_at
  end;

  if v_coupon.expires_at is not null then
    v_expira := least(v_expira, v_coupon.expires_at);
  end if;

  insert into public.redemptions (coupon_id, creator_id, code, expires_at)
  values (p_coupon, v_creator, v_code, v_expira)
  returning * into v_row;

  if v_usados + 1 >= v_coupon.stock_total then
    update public.coupons set status = 'agotado' where id = p_coupon;
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_coupon(uuid) from anon, public;
grant execute on function public.claim_coupon(uuid) to authenticated;

-- ---------------------------------------------------------------
-- claim_coupon_member: el mismo reclamo, del lado del miembro
-- ---------------------------------------------------------------
-- Función aparte y no un `if` adentro de `claim_coupon`: las reglas son otras
-- (audiencia y vínculo en vez de nivel y verificación) y mezclarlas en una sola
-- deja que un cambio de un lado afloje el otro sin que se note.
--
-- El `for update` sobre el cupón serializa a todos los que reclaman el mismo
-- cupón, creadores y miembros: dos reclamos simultáneos del último lugar no
-- pueden contar los dos "queda 1".
create function public.claim_coupon_member(p_coupon uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := auth.uid();
  v_status public.member_status;
  v_coupon public.coupons;
  v_usados int;
  v_code text;
  v_expira timestamptz;
  v_row public.redemptions;
begin
  if v_member is null then
    raise exception 'Necesitás iniciar sesión para reclamar un cupón.';
  end if;

  select status into v_status from public.members where profile_id = v_member;

  if not found or public.current_app_role() <> 'member' then
    raise exception 'Solo los miembros de Close Friends pueden reclamar estos cupones.';
  end if;

  if v_status <> 'activo' then
    raise exception 'Tu cuenta no puede reclamar cupones en este momento.';
  end if;

  select * into v_coupon from public.coupons where id = p_coupon for update;

  -- Un cupón que no es para miembros, o de un negocio al que no está vinculado,
  -- responde igual que uno que no existe: no se confirma que esté ahí.
  if not found
     or v_coupon.audience = 'creators'
     or (
       v_coupon.member_scope = 'brand_members'
       and not exists (
         select 1 from public.member_brand_links
         where member_id = v_member and brand_id = v_coupon.brand_id
       )
     ) then
    raise exception 'Ese cupón ya no existe.';
  end if;

  if v_coupon.status <> 'publicado' then
    raise exception 'Ese cupón ya no está disponible.';
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'Ese cupón ya venció.';
  end if;

  if exists (
    select 1 from public.redemptions
    where coupon_id = p_coupon and member_id = v_member
  ) then
    raise exception 'Ya reclamaste este cupón.';
  end if;

  select count(*) into v_usados
  from public.redemptions
  where coupon_id = p_coupon and status in ('reclamado', 'canjeado');

  if v_usados >= v_coupon.stock_total then
    raise exception 'Se agotaron estos cupones.';
  end if;

  loop
    v_code := public.generar_codigo_cupon();
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;

  v_expira := case
    when v_coupon.type = 'evento' and v_coupon.event_date is not null then v_coupon.event_date
    when v_coupon.claim_validity_days is not null then now() + make_interval(days => v_coupon.claim_validity_days)
    else v_coupon.expires_at
  end;

  if v_coupon.expires_at is not null then
    v_expira := least(v_expira, v_coupon.expires_at);
  end if;

  insert into public.redemptions (coupon_id, member_id, code, expires_at)
  values (p_coupon, v_member, v_code, v_expira)
  returning * into v_row;

  if v_usados + 1 >= v_coupon.stock_total then
    update public.coupons set status = 'agotado' where id = p_coupon;
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_coupon_member(uuid) from anon, public;
grant execute on function public.claim_coupon_member(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Log de auditoría de reclamos y canjes de miembros
-- ---------------------------------------------------------------
-- Trigger y no una línea en cada función: el canje lo hace `redeem_coupon`,
-- que es de la marca y no tiene por qué saber de miembros.
create function public.auditar_canje_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid;
begin
  if new.member_id is null then
    return null;
  end if;

  select brand_id into v_brand from public.coupons where id = new.coupon_id;

  if tg_op = 'INSERT' then
    insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
    values (new.member_id, auth.uid(), 'reclamo', v_brand,
            jsonb_build_object('coupon_id', new.coupon_id, 'code', new.code));
  elsif new.status = 'canjeado' and old.status is distinct from 'canjeado' then
    insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
    values (new.member_id, auth.uid(), 'canje', v_brand,
            jsonb_build_object('coupon_id', new.coupon_id, 'code', new.code));
  end if;

  return null;
end;
$$;

revoke all on function public.auditar_canje_miembro() from anon, authenticated, public;

create trigger redemptions_auditar_miembro
  after insert or update of status on public.redemptions
  for each row execute function public.auditar_canje_miembro();

-- ---------------------------------------------------------------
-- expirar_loyalty: el aviso "vence en 3 días" era solo para creadores
-- ---------------------------------------------------------------
-- Copia de 20260806030000 con UN cambio: el aviso filtra `creator_id is not
-- null`. Sin eso, el primer reclamo de un miembro a 3 días de vencer metía una
-- notificación con `profile_id` null, el NOT NULL la rechazaba y el error
-- revertía el barrido ENTERO: ningún reclamo expiraba más, de nadie.
--
-- El miembro todavía no tiene campana en /cf; cuando la tenga, esto pasa a
-- `coalesce(r.creator_id, r.member_id)` con el link que corresponda.
create or replace function public.expirar_loyalty()
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

  insert into public.notifications (profile_id, type, payload)
  select
    r.creator_id,
    'coupon_expiring',
    jsonb_build_object('code', r.code, 'coupon_title', c.title, 'expires_at', r.expires_at)
  from public.redemptions r
  join public.coupons c on c.id = r.coupon_id
  where r.status = 'reclamado'
    and r.creator_id is not null
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

revoke all on function public.expirar_loyalty() from anon, authenticated, public;
grant execute on function public.expirar_loyalty() to service_role;
