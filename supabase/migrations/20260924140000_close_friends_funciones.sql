-- Close Friends · lo que se hace, y no solo se lee.
--
-- Todo lo que escribe un miembro, salvo editar su nombre, teléfono y alias,
-- pasa por acá: cada función valida de nuevo, sin confiar en lo que la pantalla
-- creía saber, y deja rastro en `member_audit_log`.
--
-- Recordatorio de 20260806000000: `revoke ... from public` NO alcanza en
-- Supabase, hay default privileges por rol. Cada función revoca por rol.

-- ---------------------------------------------------------------
-- La página pública del QR
-- ---------------------------------------------------------------
-- Lo que se muestra en /cf/unirme/[codigo] antes de tener cuenta: el nombre y
-- el logo del negocio. Nada de ids. Un código inactivo, inventado o de una
-- marca sin verificar devuelven lo mismo (null): no se confirma cuál es cuál.
--
-- Solo service role: la página es server-side y cuenta el escaneo en el mismo
-- paso. Abrirla a anon permitiría recorrer códigos sin pasar por el freno.
create function public.invitacion_publica(p_code text, p_contar_escaneo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.brand_invite_codes;
  v_marca public.brand_profiles;
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

  return jsonb_build_object(
    'brand_name', v_marca.brand_name,
    'logo_url', v_marca.logo_url,
    'slug', v_marca.slug
  );
end;
$$;

revoke all on function public.invitacion_publica(text, boolean) from anon, authenticated, public;
grant execute on function public.invitacion_publica(text, boolean) to service_role;

-- ¿Está libre este nombre de agente? Para avisarlo mientras se escribe, antes
-- de mandar el formulario. Solo service role, por lo mismo que la de arriba.
create function public.agente_disponible(p_agent_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.members
    where agent_name_norm = public.normalizar_agente(p_agent_name)
  )
$$;

revoke all on function public.agente_disponible(text) from anon, authenticated, public;
grant execute on function public.agente_disponible(text) to service_role;

-- ---------------------------------------------------------------
-- El freno del registro
-- ---------------------------------------------------------------
-- Devuelve true si el intento entra en el cupo de la ventana, y lo cuenta.
-- Ventana fija: al vencerse, la fila vuelve a cero. El server action la llama
-- dos veces —por IP (hasheada) y por código— y alcanza con que una diga no.
create function public.frenar_registro(p_clave text, p_max int, p_ventana_segundos int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intentos int;
begin
  -- De paso se barren las viejas; no justifica un cron.
  delete from public.member_signup_throttle
  where ventana_inicio < now() - interval '1 day';

  insert into public.member_signup_throttle as t (clave, ventana_inicio, intentos)
  values (p_clave, now(), 1)
  on conflict (clave) do update
    set ventana_inicio = case
          when t.ventana_inicio < now() - make_interval(secs => p_ventana_segundos) then now()
          else t.ventana_inicio
        end,
        intentos = case
          when t.ventana_inicio < now() - make_interval(secs => p_ventana_segundos) then 1
          else t.intentos + 1
        end
  returning intentos into v_intentos;

  return v_intentos <= p_max;
end;
$$;

revoke all on function public.frenar_registro(text, int, int) from anon, authenticated, public;
grant execute on function public.frenar_registro(text, int, int) to service_role;

-- ---------------------------------------------------------------
-- El alta
-- ---------------------------------------------------------------
-- La llama la persona YA con sesión: el correo lo verificó Supabase Auth con
-- el código de 6 dígitos. Recién acá se decide si la cuenta es miembro, y todo
-- pasa en una sola transacción:
--
--   · código de invitación activo y de una marca verificada;
--   · cuenta nueva (sin rol) o que ya es miembro. Una cuenta de creador o de
--     marca no se convierte: cada cuenta tiene un solo rol;
--   · si ya es miembro, SOLO se agrega el vínculo con este negocio. Sus datos
--     no se pisan con lo que llegue en el formulario;
--   · si es nueva: mayor de 18, términos aceptados, alias libre; se crea la
--     ficha con su expediente, los consentimientos y el vínculo.
--
-- Todas las validaciones van ANTES de escribir: un `raise` revierte la
-- transacción entera (ver 20260806040000), así que no hay estado a medias.
create function public.completar_registro_miembro(
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

    -- El formato del nombre, el teléfono y el alias lo validan los CHECK de la
    -- tabla. Acá se traducen a un mensaje que se entienda.
    if coalesce(p_phone, '') !~ '^\+506[245678][0-9]{7}$' then
      raise exception 'Revisá tu WhatsApp: tiene que ser un número de Costa Rica (+506 y 8 dígitos).';
    end if;

    if btrim(coalesce(p_agent_name, '')) !~ '^[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}$' then
      raise exception 'El nombre de agente va de 3 a 20 caracteres: letras, números, punto o guion bajo.';
    end if;

    if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 80 then
      raise exception 'Poné tu nombre.';
    end if;

    -- El rol lo pone esta función y nadie más (ver 20260924100000).
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
    -- El consentimiento de compartir es por negocio: se pregunta cada vez que
    -- alguien se une a uno nuevo.
    insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
    values (v_uid, 'share_with_brand', v_inv.brand_id, coalesce(p_comparte_con_marca, false), p_version_textos);

    update public.brand_invite_codes set signups = signups + 1 where id = v_inv.id;

    if not v_nuevo then
      insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
      values (v_uid, v_uid, 'vinculo', v_inv.brand_id, jsonb_build_object('invite_code_id', v_inv.id));
    end if;
  end if;

  return jsonb_build_object(
    'nuevo', v_nuevo,
    'vinculo_nuevo', v_vinculo_nuevo,
    'expediente_code', v_miembro.expediente_code,
    'agent_name', v_miembro.agent_name
  );
end;
$$;

revoke all on function public.completar_registro_miembro(text, text, text, date, text, boolean, boolean, boolean, text)
  from anon, public;
grant execute on function public.completar_registro_miembro(text, text, text, date, text, boolean, boolean, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------
-- Cambiar un consentimiento opcional
-- ---------------------------------------------------------------
-- Los términos no se "desaceptan" desde acá: eso es pedir la eliminación.
create function public.cambiar_consentimiento(
  p_kind public.consent_kind,
  p_brand uuid,
  p_granted boolean,
  p_version_textos text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.members where profile_id = v_uid) then
    raise exception 'Solo los miembros de Close Friends pueden cambiar esto.';
  end if;

  if p_kind = 'terms' then
    raise exception 'Los términos no se pueden retirar. Si no querés seguir, pedí la eliminación de tu cuenta.';
  end if;

  if coalesce(btrim(p_version_textos), '') = '' then
    raise exception 'Falta la versión de los textos aceptados.';
  end if;

  if p_kind = 'share_with_brand' then
    if p_brand is null or not exists (
      select 1 from public.member_brand_links
      where member_id = v_uid and brand_id = p_brand
    ) then
      raise exception 'No estás vinculado a ese negocio.';
    end if;
  elsif p_brand is not null then
    raise exception 'Ese permiso no es por negocio.';
  end if;

  insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
  values (v_uid, p_kind, p_brand, coalesce(p_granted, false), p_version_textos);

  insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
  values (v_uid, v_uid, 'consentimiento', p_brand,
          jsonb_build_object('kind', p_kind, 'granted', coalesce(p_granted, false), 'version', p_version_textos));
end;
$$;

revoke all on function public.cambiar_consentimiento(public.consent_kind, uuid, boolean, text) from anon, public;
grant execute on function public.cambiar_consentimiento(public.consent_kind, uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------
-- Pedir la eliminación de la cuenta
-- ---------------------------------------------------------------
-- Crea el pedido y marca la ficha. Pedirlo dos veces devuelve el que ya está.
create function public.pedir_eliminacion_miembro(p_reason text)
returns public.member_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.member_deletion_requests;
begin
  if v_uid is null or not exists (select 1 from public.members where profile_id = v_uid) then
    raise exception 'Solo los miembros de Close Friends pueden pedir esto.';
  end if;

  select * into v_row
  from public.member_deletion_requests
  where member_id = v_uid and status = 'pendiente';

  if found then
    return v_row;
  end if;

  insert into public.member_deletion_requests (member_id, reason)
  values (v_uid, nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
  returning * into v_row;

  update public.members set status = 'eliminacion_pedida' where profile_id = v_uid;

  insert into public.member_audit_log (member_id, actor_id, action, detail)
  values (v_uid, v_uid, 'eliminacion_pedida', jsonb_build_object('request_id', v_row.id));

  return v_row;
end;
$$;

revoke all on function public.pedir_eliminacion_miembro(text) from anon, public;
grant execute on function public.pedir_eliminacion_miembro(text) to authenticated;

-- ---------------------------------------------------------------
-- Los miembros de MI marca
-- ---------------------------------------------------------------
-- La marca no tiene SELECT sobre `members` —la RLS autoriza filas, no
-- columnas, y ahí están el teléfono y la fecha de nacimiento—. Ve a sus
-- miembros por acá, con el contacto SOLO si el consentimiento vigente para
-- ESTA marca es true. Sin él, solo el nombre de agente.
--
-- Es una función y no una vista con security_invoker: con invoker la marca
-- necesitaría leer `members` entera, que es justo lo que no tiene que poder.
--
-- ⚠️ `returns table` con los tipos EXACTOS de cada columna (ver trampa del
-- 2026-08-26): `auth.users.email` es varchar(255), por eso el cast a text.
create function public.miembros_de_mi_marca()
returns table (
  member_id uuid,
  agent_name text,
  comparte_contacto boolean,
  full_name text,
  phone text,
  email text,
  joined_at timestamptz,
  origen text,
  reclamados int,
  canjeados int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.profile_id,
    m.agent_name,
    coalesce(c.granted, false),
    case when c.granted then m.full_name end,
    case when c.granted then m.phone end,
    case when c.granted then u.email::text end,
    l.joined_at,
    ic.label,
    (select count(*)::int from public.redemptions r
       join public.coupons cp on cp.id = r.coupon_id
      where r.member_id = m.profile_id and cp.brand_id = l.brand_id),
    (select count(*)::int from public.redemptions r
       join public.coupons cp on cp.id = r.coupon_id
      where r.member_id = m.profile_id and cp.brand_id = l.brand_id and r.status = 'canjeado')
  from public.member_brand_links l
  join public.members m on m.profile_id = l.member_id
  join auth.users u on u.id = m.profile_id
  left join public.brand_invite_codes ic on ic.id = l.invite_code_id
  left join lateral (
    select mc.granted
    from public.member_consents mc
    where mc.member_id = l.member_id
      and mc.kind = 'share_with_brand'
      and mc.brand_id = l.brand_id
    order by mc.created_at desc, mc.id desc
    limit 1
  ) c on true
  where l.brand_id = auth.uid()
    and public.current_app_role() = 'brand'
  order by l.joined_at desc
$$;

revoke all on function public.miembros_de_mi_marca() from anon, public;
grant execute on function public.miembros_de_mi_marca() to authenticated;
