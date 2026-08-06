-- Loyalty Loop · sacar de `redeem_coupon` un UPDATE que nunca se guardó.
--
-- La versión anterior, ante un código vencido, hacía esto:
--
--     update public.redemptions set status = 'expirado' where id = v_row.id;
--     raise exception 'Este código venció...';
--
-- Y el update no quedaba. `raise exception` aborta la transacción completa, y
-- la función entera corre en una sola transacción: el error se lleva puesto
-- todo lo que se escribió antes, incluido ese update. El test lo mostró — el
-- mensaje salía bien y la fila seguía en 'reclamado'.
--
-- Postgres no tiene transacciones autónomas, así que no hay forma de escribir
-- "por afuera" del rollback sin meter dblink o pg_background, que es mucho
-- aparato para esto.
--
-- Y no hace falta: quién marca `expirado` es el barrido diario, y el lugar que
-- ese reclamo ocupa se libera ahí igual. Nada de lo que ve el usuario depende
-- de que la columna cambie en el instante:
--   · "Mis cupones" calcula el estado con `expires_at`, no con `status`;
--   · esta misma función sigue rechazando el canje por fecha, marcada o no.
--
-- Queda entonces la regla, que vale para cualquier función que valide y avise:
-- si el aviso es una excepción, no escribas nada antes esperando que sobreviva.
create or replace function public.redeem_coupon(p_code text)
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

  -- La fecha manda aunque el barrido todavía no haya pasado: entre corrida y
  -- corrida hay 24 h, y en el mostrador el plazo es el plazo.
  if v_row.status = 'expirado' or v_row.expires_at < now() then
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

revoke all on function public.redeem_coupon(text) from anon, public;
grant execute on function public.redeem_coupon(text) to authenticated;
