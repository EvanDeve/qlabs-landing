-- Rol interno nuevo: UGC.
--
-- Gente que entra a Q·OS solo para administrar el marketplace, Loyalty Loop y
-- Close Friends, sin ver nada de la agencia. Los roles de antes NO se tocan
-- todavía (Evan, 2026-10-06): se agrega este y después se ordenan.
--
-- Va sola en su archivo: un valor nuevo de enum no se puede usar en la misma
-- transacción que lo crea, y la migración siguiente lo nombra.
alter type public.staff_role add value if not exists 'ugc';
