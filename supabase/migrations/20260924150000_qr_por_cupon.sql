-- Close Friends · el QR es del CUPÓN.
--
-- Decisión de Evan (2026-09-24): la marca crea un cupón para miembros ("Torta
-- gratis") y ese cupón trae su QR. Quien lo escanea sin cuenta hace el
-- registro y termina en su wallet con la torta adentro; quien ya es miembro lo
-- escanea desde la app y el cupón se agrega solo. Escanear el QR de un cupón
-- también une a la persona a ese negocio: estuvo ahí.
--
-- Se reusa `brand_invite_codes` en vez de una columna en `coupons`: ya tiene
-- el código aleatorio, la etiqueta, activar/desactivar y los contadores de
-- escaneos y registros que la marca va a querer ver por cupón.

alter table public.brand_invite_codes
  add column coupon_id uuid references public.coupons (id) on delete cascade;

-- Un QR por cupón. Los códigos sin cupón (los de la primera versión) siguen
-- sirviendo para unirse al negocio a secas.
create unique index brand_invite_codes_un_qr_por_cupon
  on public.brand_invite_codes (coupon_id) where coupon_id is not null;

-- ---------------------------------------------------------------
-- El QR nace solo con el cupón
-- ---------------------------------------------------------------
-- Trigger y no el server action: así existe aunque el cupón se cree desde
-- admin, desde un script o cambiando la audiencia de uno viejo, y la marca no
-- necesita permiso para escribir `coupon_id` (ver los grants de
-- 20260924120000, que siguen siendo solo `label`).
create function public.qr_para_cupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience in ('members', 'both') then
    insert into public.brand_invite_codes (brand_id, coupon_id, label)
    values (new.brand_id, new.id, left(new.title, 40))
    on conflict (coupon_id) where coupon_id is not null do nothing;
  end if;
  return null;
end;
$$;

revoke all on function public.qr_para_cupon() from anon, authenticated, public;

create trigger coupons_qr_para_miembros
  after insert or update of audience on public.coupons
  for each row execute function public.qr_para_cupon();

-- ---------------------------------------------------------------
-- Reclamar para un miembro, sin excepciones
-- ---------------------------------------------------------------
-- El núcleo que comparten el reclamo desde el panel (`claim_coupon_member`) y
-- el del QR (`completar_registro_miembro`). Devuelve un resultado en vez de
-- tirar una excepción a propósito: en el registro, un cupón agotado NO puede
-- deshacer el alta — un `raise` revierte la transacción entera (ver
-- 20260806040000), y la persona se quedaría sin cuenta por culpa de la torta.
--
-- `p_por_qr` saltea el alcance `brand_members`: quien escaneó el QR queda
-- vinculado al negocio en la misma transacción, así que el alcance se cumple.
--
-- Resultado: {ok: true, code, redemption_id, nuevo} o
--            {ok: false, motivo: no_existe|no_disponible|vencido|agotado}.
-- Ya tenerlo reclamado es ok:true con nuevo:false: volver a escanear el QR de
-- un cupón que ya está en la wallet no es un error.
create function public.reclamar_para_miembro(p_member uuid, p_coupon uuid, p_por_qr boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons;
  v_previo public.redemptions;
  v_usados int;
  v_code text;
  v_expira timestamptz;
  v_row public.redemptions;
begin
  select * into v_coupon from public.coupons where id = p_coupon for update;

  if not found
     or v_coupon.audience = 'creators'
     or (
       not p_por_qr
       and v_coupon.member_scope = 'brand_members'
       and not exists (
         select 1 from public.member_brand_links
         where member_id = p_member and brand_id = v_coupon.brand_id
       )
     ) then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  select * into v_previo from public.redemptions
  where coupon_id = p_coupon and member_id = p_member;
  if found then
    return jsonb_build_object('ok', true, 'nuevo', false, 'code', v_previo.code, 'redemption_id', v_previo.id);
  end if;

  if v_coupon.status = 'agotado' then
    return jsonb_build_object('ok', false, 'motivo', 'agotado');
  end if;
  if v_coupon.status <> 'publicado' then
    return jsonb_build_object('ok', false, 'motivo', 'no_disponible');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido');
  end if;

  select count(*) into v_usados
  from public.redemptions
  where coupon_id = p_coupon and status in ('reclamado', 'canjeado');

  if v_usados >= v_coupon.stock_total then
    return jsonb_build_object('ok', false, 'motivo', 'agotado');
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
  values (p_coupon, p_member, v_code, v_expira)
  returning * into v_row;

  if v_usados + 1 >= v_coupon.stock_total then
    update public.coupons set status = 'agotado' where id = p_coupon;
  end if;

  return jsonb_build_object('ok', true, 'nuevo', true, 'code', v_row.code, 'redemption_id', v_row.id);
end;
$$;

-- Interna: recibe el miembro por parámetro, así que nadie de afuera la llama.
revoke all on function public.reclamar_para_miembro(uuid, uuid, boolean) from anon, authenticated, public;

-- El reclamo desde el panel: mismo contrato de antes (devuelve la fila o tira
-- un error con el mensaje para la persona), ahora sobre el núcleo común.
create or replace function public.claim_coupon_member(p_coupon uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid := auth.uid();
  v_status public.member_status;
  v_res jsonb;
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

  v_res := public.reclamar_para_miembro(v_member, p_coupon, false);

  if not (v_res->>'ok')::boolean then
    raise exception '%', case v_res->>'motivo'
      when 'agotado' then 'Se agotaron estos cupones.'
      when 'vencido' then 'Ese cupón ya venció.'
      when 'no_disponible' then 'Ese cupón ya no está disponible.'
      else 'Ese cupón ya no existe.'
    end;
  end if;

  if not (v_res->>'nuevo')::boolean then
    raise exception 'Ya reclamaste este cupón.';
  end if;

  select * into v_row from public.redemptions where id = (v_res->>'redemption_id')::uuid;
  return v_row;
end;
$$;

revoke all on function public.claim_coupon_member(uuid) from anon, public;
grant execute on function public.claim_coupon_member(uuid) to authenticated;

-- ---------------------------------------------------------------
-- La página del QR muestra el cupón
-- ---------------------------------------------------------------
-- Suma `cupon` (título, descripción, tipo, imagen) cuando el QR es de un
-- cupón que todavía se puede reclamar. Si no (agotado, pausado, vencido), el
-- QR sigue sirviendo para unirse al negocio y la página lo dice.
create or replace function public.invitacion_publica(p_code text, p_contar_escaneo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.brand_invite_codes;
  v_marca public.brand_profiles;
  v_coupon public.coupons;
  v_cupon jsonb;
begin
  select * into v_inv
  from public.brand_invite_codes
  where code = upper(btrim(coalesce(p_code, ''))) and active;

  if not found then
    return null;
  end if;

  select * into v_marca
  from public.brand_profiles
  where profile_id = v_inv.brand_id and verified;

  if not found then
    return null;
  end if;

  if p_contar_escaneo then
    update public.brand_invite_codes set scans = scans + 1 where id = v_inv.id;
  end if;

  if v_inv.coupon_id is not null then
    select * into v_coupon from public.coupons where id = v_inv.coupon_id;
    v_cupon := jsonb_build_object(
      'title', v_coupon.title,
      'description', v_coupon.description,
      'type', v_coupon.type,
      'image_url', v_coupon.image_url,
      'disponible', v_coupon.status = 'publicado'
        and v_coupon.audience <> 'creators'
        and (v_coupon.expires_at is null or v_coupon.expires_at > now())
    );
  end if;

  return jsonb_build_object(
    'brand_name', v_marca.brand_name,
    'logo_url', v_marca.logo_url,
    'slug', v_marca.slug,
    'cupon', v_cupon
  );
end;
$$;

revoke all on function public.invitacion_publica(text, boolean) from anon, authenticated, public;
grant execute on function public.invitacion_publica(text, boolean) to service_role;

-- ---------------------------------------------------------------
-- El registro (y el escaneo desde la app) reclama el cupón del QR
-- ---------------------------------------------------------------
-- Copia de 20260924140000 con UN cambio al final: si el QR es de un cupón, se
-- reclama en la misma transacción que el alta o el vínculo. El resultado va en
-- `cupon` para que la pantalla diga "se agregó a tu wallet" o por qué no.
create or replace function public.completar_registro_miembro(
  p_code text,
  p_full_name text,
  p_phone text,
  p_birthdate date,
  p_agent_name text,
  p_acepta_terminos boolean,
  p_comparte_con_marca boolean,
  p_whatsapp boolean,
  p_version_textos text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.app_role;
  v_inv public.brand_invite_codes;
  v_marca_verificada boolean;
  v_miembro public.members;
  v_nuevo boolean;
  v_vinculo_nuevo boolean := false;
  v_expediente text;
  v_cupon jsonb;
  v_hoy_cr date := (now() at time zone 'America/Costa_Rica')::date;
begin
  if v_uid is null then
    raise exception 'Necesitás verificar tu correo antes de continuar.';
  end if;

  if coalesce(btrim(p_version_textos), '') = '' then
    raise exception 'Falta la versión de los textos aceptados.';
  end if;

  select * into v_inv
  from public.brand_invite_codes
  where code = upper(btrim(coalesce(p_code, '')))
  for update;

  select exists (
    select 1 from public.brand_profiles
    where profile_id = v_inv.brand_id and verified
  ) into v_marca_verificada;

  if v_inv.id is null or not v_inv.active or not v_marca_verificada then
    raise exception 'Este código de invitación ya no está activo. Pedile al negocio uno nuevo.';
  end if;

  select role into v_rol from public.profiles where id = v_uid;

  if v_rol is not null and v_rol <> 'member' then
    raise exception 'Ese correo ya tiene una cuenta de creador o de marca. Usá otro correo para unirte.';
  end if;

  select * into v_miembro from public.members where profile_id = v_uid;
  v_nuevo := not found;

  if not v_nuevo and v_miembro.status <> 'activo' then
    raise exception 'Tu cuenta no puede sumar negocios ni cupones en este momento.';
  end if;

  if v_nuevo then
    if not coalesce(p_acepta_terminos, false) then
      raise exception 'Para unirte tenés que aceptar los términos y la política de privacidad.';
    end if;

    if p_birthdate is null then
      raise exception 'Poné tu fecha de nacimiento.';
    end if;

    if p_birthdate > v_hoy_cr - interval '18 years' then
      raise exception 'Close Friends es solo para mayores de 18 años.';
    end if;

    if p_birthdate < v_hoy_cr - interval '120 years' then
      raise exception 'Revisá tu fecha de nacimiento.';
    end if;

    if not public.agente_disponible(p_agent_name) then
      raise exception 'Ese nombre de agente ya está tomado. Probá con otro.';
    end if;

    if coalesce(p_phone, '') !~ '^\+506[245678][0-9]{7}$' then
      raise exception 'Revisá tu WhatsApp: tiene que ser un número de Costa Rica (+506 y 8 dígitos).';
    end if;

    if btrim(coalesce(p_agent_name, '')) !~ '^[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}$' then
      raise exception 'El nombre de agente va de 3 a 20 caracteres: letras, números, punto o guion bajo.';
    end if;

    if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 80 then
      raise exception 'Poné tu nombre.';
    end if;

    update public.profiles
    set role = 'member', display_name = btrim(p_agent_name)
    where id = v_uid;

    loop
      v_expediente := 'CF-' || public.codigo_aleatorio(5);
      exit when not exists (select 1 from public.members where expediente_code = v_expediente);
    end loop;

    insert into public.members (profile_id, expediente_code, agent_name, full_name, phone, birthdate)
    values (v_uid, v_expediente, p_agent_name, btrim(p_full_name), p_phone, p_birthdate)
    returning * into v_miembro;

    insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
    values
      (v_uid, 'terms', null, true, p_version_textos),
      (v_uid, 'whatsapp_marketing', null, coalesce(p_whatsapp, false), p_version_textos);

    insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
    values (v_uid, v_uid, 'alta', v_inv.brand_id,
            jsonb_build_object('invite_code_id', v_inv.id, 'expediente', v_expediente));
  end if;

  insert into public.member_brand_links (member_id, brand_id, invite_code_id)
  values (v_uid, v_inv.brand_id, v_inv.id)
  on conflict (member_id, brand_id) do nothing;
  v_vinculo_nuevo := found;

  if v_vinculo_nuevo then
    insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
    values (v_uid, 'share_with_brand', v_inv.brand_id, coalesce(p_comparte_con_marca, false), p_version_textos);

    update public.brand_invite_codes set signups = signups + 1 where id = v_inv.id;

    if not v_nuevo then
      insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
      values (v_uid, v_uid, 'vinculo', v_inv.brand_id, jsonb_build_object('invite_code_id', v_inv.id));
    end if;
  end if;

  -- Lo nuevo: el cupón del QR. Nunca tira excepción (ver arriba), así que un
  -- cupón agotado deja el alta y el vínculo hechos y solo lo informa.
  if v_inv.coupon_id is not null then
    v_cupon := public.reclamar_para_miembro(v_uid, v_inv.coupon_id, true);
  end if;

  return jsonb_build_object(
    'nuevo', v_nuevo,
    'vinculo_nuevo', v_vinculo_nuevo,
    'expediente_code', v_miembro.expediente_code,
    'agent_name', v_miembro.agent_name,
    'cupon', v_cupon
  );
end;
$$;

revoke all on function public.completar_registro_miembro(text, text, text, date, text, boolean, boolean, boolean, text)
  from anon, public;
grant execute on function public.completar_registro_miembro(text, text, text, date, text, boolean, boolean, boolean, text)
  to authenticated;
