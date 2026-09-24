-- Compartir el contacto es UN permiso para todos los negocios, no uno por cada.
--
-- Decisión de Evan (2026-09-24): con el permiso por negocio, quien se unía a un
-- segundo negocio escaneando su QR desde la app nunca lo había aceptado para
-- ese negocio —el escaneo desde la app no pregunta nada—. Ahora se pregunta una
-- vez, al registrarse: "Compartir mi nombre y contacto con los negocios a los
-- que me una", y se cambia en un solo interruptor del perfil.
--
-- En la base es la misma fila `share_with_brand`, con `brand_id` NULL = "con
-- todos mis negocios". Las filas viejas por negocio quedan como historial (la
-- tabla es append-only), pero ya no deciden nada.

-- ---------------------------------------------------------------
-- La regla de la tabla
-- ---------------------------------------------------------------
-- Antes: share_with_brand ⇔ brand_id no nulo. Ahora share_with_brand admite
-- NULL (el general) además de las filas viejas; los otros tipos siguen sin
-- marca.
alter table public.member_consents
  drop constraint member_consents_marca_solo_si_comparte,
  add constraint member_consents_marca_solo_si_comparte
    check (kind = 'share_with_brand' or brand_id is null);

-- A cada miembro que ya existe se le deja un permiso general con lo último que
-- había elegido para cualquier negocio. Son pocos (piloto) y así nadie pasa a
-- compartir algo que no había dicho que sí.
insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
select distinct on (member_id) member_id, 'share_with_brand', null, granted, 'migracion-general'
from public.member_consents
where kind = 'share_with_brand' and brand_id is not null
order by member_id, created_at desc, id desc;

-- ---------------------------------------------------------------
-- El alta: el permiso se guarda una vez, no por vínculo
-- ---------------------------------------------------------------
-- Copia de 20260924150000 con UN cambio: `share_with_brand` va con la cuenta
-- nueva (brand_id NULL) junto a términos y WhatsApp, y ya no al crear cada
-- vínculo. `p_comparte_con_marca` se sigue llamando así para no cambiar la
-- firma; se ignora si la cuenta ya existía.
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

    -- Los tres permisos, una vez y para todo: términos, WhatsApp y compartir
    -- el contacto con los negocios a los que se una.
    insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
    values
      (v_uid, 'terms', null, true, p_version_textos),
      (v_uid, 'whatsapp_marketing', null, coalesce(p_whatsapp, false), p_version_textos),
      (v_uid, 'share_with_brand', null, coalesce(p_comparte_con_marca, false), p_version_textos);

    insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
    values (v_uid, v_uid, 'alta', v_inv.brand_id,
            jsonb_build_object('invite_code_id', v_inv.id, 'expediente', v_expediente));
  end if;

  insert into public.member_brand_links (member_id, brand_id, invite_code_id)
  values (v_uid, v_inv.brand_id, v_inv.id)
  on conflict (member_id, brand_id) do nothing;
  v_vinculo_nuevo := found;

  if v_vinculo_nuevo then
    update public.brand_invite_codes set signups = signups + 1 where id = v_inv.id;

    if not v_nuevo then
      insert into public.member_audit_log (member_id, actor_id, action, brand_id, detail)
      values (v_uid, v_uid, 'vinculo', v_inv.brand_id, jsonb_build_object('invite_code_id', v_inv.id));
    end if;
  end if;

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

-- ---------------------------------------------------------------
-- Cambiar un permiso: compartir ya no lleva negocio
-- ---------------------------------------------------------------
-- Misma firma que 20260924140000 (p_brand se ignora y se guarda NULL), para no
-- romper nada que la llame.
create or replace function public.cambiar_consentimiento(
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

  insert into public.member_consents (member_id, kind, brand_id, granted, text_version)
  values (v_uid, p_kind, null, coalesce(p_granted, false), p_version_textos);

  insert into public.member_audit_log (member_id, actor_id, action, detail)
  values (v_uid, v_uid, 'consentimiento',
          jsonb_build_object('kind', p_kind, 'granted', coalesce(p_granted, false), 'version', p_version_textos));
end;
$$;

revoke all on function public.cambiar_consentimiento(public.consent_kind, uuid, boolean, text) from anon, public;
grant execute on function public.cambiar_consentimiento(public.consent_kind, uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------
-- Lo que ve la marca: el permiso general
-- ---------------------------------------------------------------
-- Copia de 20260924140000 con UN cambio: el consentimiento vigente es el último
-- `share_with_brand` GENERAL (brand_id NULL), no el de esta marca.
create or replace function public.miembros_de_mi_marca()
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
      and mc.brand_id is null
    order by mc.created_at desc, mc.id desc
    limit 1
  ) c on true
  where l.brand_id = auth.uid()
    and public.current_app_role() = 'brand'
  order by l.joined_at desc
$$;

revoke all on function public.miembros_de_mi_marca() from anon, public;
grant execute on function public.miembros_de_mi_marca() to authenticated;
