-- El tercer rol: los clientes de los negocios que usan la plataforma, los
-- "Miembros Close Friends" (el nombre de la interfaz vive en src/lib/cf/copy.ts).
--
-- Va solo en su archivo: Postgres no deja USAR un valor de enum en la misma
-- transacción que lo agrega, y el SQL Editor corre cada archivo como una sola.
-- Todo lo que nombra 'member' está en 20260924120000 en adelante.
--
-- Nadie se pone este rol a sí mismo (ver 20260924100000): lo pone
-- `completar_registro_miembro` después de validar el código QR del negocio.

alter type public.app_role add value if not exists 'member';
