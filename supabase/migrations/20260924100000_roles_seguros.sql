-- El rol de una cuenta ya no lo elige quien se registra, salvo creador o marca.
--
-- Dos huecos, los dos por el mismo lado: la anon key es pública y
-- `/auth/v1/signup` acepta el metadata que le manden, con la confirmación por
-- correo apagada (`mailer_autoconfirm: true`), así que la cuenta queda con
-- sesión en el acto.
--
-- 1. `handle_new_user` copiaba `raw_user_meta_data->>'role'` a `profiles.role`
--    sin filtrar. El formulario solo manda creator|brand, pero ese filtro vive
--    en `signUpAction`, no en la base: un POST directo con
--    `data: {role: "admin"}` dejaba una cuenta admin.
-- 2. `protect_role_change` solo frenaba cuando el rol YA estaba puesto. Una
--    cuenta creada sin rol podía ponerse cualquiera —admin incluido— con un
--    PATCH a su propia fila de `profiles`, que la policy de update le permite.
--
-- Revisado en producción el 2026-09-24 antes de cerrarlo: 6 admins, 5 del
-- equipo, y el sexto es una cuenta de QA del 14/8. Nada indica que se usara.
--
-- Va antes que el rol `member` (20260924110000): sin esto, cualquiera se daba
-- de alta como miembro salteándose el QR del negocio.

-- ---------- 1. el alta ----------
-- Desde el metadata, solo los dos roles que se eligen en el formulario. El
-- resto lo pone quien corresponde después de crear la cuenta:
--   · admin: `inviteStaffAction`, con service role, después de invitar;
--   · member: `completar_registro_miembro`, después de validar el código QR.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := nullif(new.raw_user_meta_data->>'role', '');
begin
  insert into public.profiles (id, role, display_name, avatar_url)
  values (
    new.id,
    case when v_rol in ('creator', 'brand') then v_rol::app_role end,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- ---------- 2. el cambio de rol ----------
-- Pasa a SECURITY INVOKER a propósito: la regla depende de `current_user`, y en
-- una función security definer `current_user` es siempre el dueño.
--
-- Con invoker, `current_user` dice por dónde vino el UPDATE:
--   · 'authenticated' — un PATCH desde la sesión del usuario. Frenado.
--   · 'service_role'  — un server action con la llave de servicio. Libre.
--   · el dueño de una función security definer (postgres) — el RPC que valida
--     el QR y recién ahí pone `member`. Libre.
--
-- Desde la sesión solo se permite lo que hace el onboarding: pasar de sin rol a
-- creator o brand. Admin conserva lo que ya tenía.
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.current_app_role() = 'admin' then
    return new;
  end if;

  if old.role is not null then
    raise exception 'no podés cambiar tu rol una vez asignado';
  end if;

  -- Comparado como texto: esta migración corre antes de que exista 'member' en
  -- el enum, y un literal de enum que todavía no existe no compila.
  if new.role::text not in ('creator', 'brand') then
    raise exception 'ese rol no se puede elegir';
  end if;

  return new;
end;
$$;
