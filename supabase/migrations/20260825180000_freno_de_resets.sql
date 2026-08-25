-- El freno del formulario de recuperar contraseña, en la base y no en memoria.
--
-- Estaba en un `Map` del proceso: frenaba el caso tonto —alguien apretando el
-- botón— pero se perdía en cada deploy y no se compartía entre instancias de
-- Vercel, que son varias y arrancan y mueren solas. Como el endpoint es público
-- y manda un correo por request, el freno tenía que sobrevivir a las dos cosas.
--
-- Guarda el email en minúsculas y el último pedido. No guarda intentos ni
-- historial: lo único que hace falta para decir "todavía no" es cuándo fue el
-- anterior, y menos datos personales acumulados es mejor.

create table public.password_reset_throttle (
  email text primary key,
  last_requested_at timestamptz not null default now()
);

comment on table public.password_reset_throttle is
  'Freno del formulario público de recuperar contraseña. Una fila por email, se pisa en cada pedido.';

-- RLS con CERO policies, a propósito: nadie que llegue con una sesión —creador,
-- marca, admin— tiene por qué leer ni escribir acá. La única vía es el server
-- action, que corre con service role y por eso no pasa por estas policies.
-- Sin RLS, cualquiera con la anon key podría listar la tabla y sacar la lista
-- de correos de quienes pidieron recuperar su cuenta.
alter table public.password_reset_throttle enable row level security;

-- Las filas viejas no sirven para nada y son direcciones de correo guardadas de
-- gente que ya resolvió su problema. Se borran en el mismo camino que las
-- escribe (ver `requestPasswordResetAction`), que es más simple que un cron
-- para una tabla que nunca va a tener volumen.
create index password_reset_throttle_viejas_idx
  on public.password_reset_throttle (last_requested_at);
