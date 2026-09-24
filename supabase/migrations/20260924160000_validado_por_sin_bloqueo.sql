-- Borrar una cuenta que validó un canje ya no se traba.
--
-- `redemptions.validated_by` (20260806020000) apuntaba a `profiles` sin
-- `on delete`, o sea NO ACTION: una marca —o un admin— que alguna vez validó un
-- cupón en caja no se podía borrar. Postgres corta con 23503 y la Admin API de
-- Supabase lo devuelve como un 500 con el mensaje vacío ("{}"), así que desde
-- afuera ni siquiera se ve por qué.
--
-- Se encontró el 2026-09-24: la suite de Close Friends es la primera que borra
-- una marca después de un canje, y el teardown dejaba la cuenta colgada. Pero
-- el problema es de Loyalty Loop y ya estaba: una marca que hubiera validado el
-- cupón de un creador tampoco se podía dar de baja.
--
-- `set null` y no `cascade`: borrar a quien validó no tiene por qué borrar el
-- canje, que es del creador o del miembro. Solo se pierde el dato de quién lo
-- validó, que ya no existe.

alter table public.redemptions
  drop constraint redemptions_validated_by_fkey,
  add constraint redemptions_validated_by_fkey
    foreign key (validated_by) references public.profiles (id) on delete set null;
