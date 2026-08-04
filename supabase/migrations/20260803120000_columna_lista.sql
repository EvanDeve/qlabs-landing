-- Tercera bandera de columna: "acá la pieza ya está lista".
--
-- El pedido concreto era que McLovin avise cuando un video sigue por editar y
-- la fecha de publicación está encima. Para eso hay que poder distinguir dos
-- cosas que hoy son idénticas para el sistema:
--
--   * "Por editar" o "Revisión cliente" a dos días de publicar → hay trabajo
--     sin hacer y la fecha no se va a cumplir. Eso es lo que hay que avisar.
--   * "Terminado" a dos días de publicar → el video está hecho y solo espera
--     la fecha. Avisar acá es ruido, y el ruido es lo que hace que el equipo
--     deje de leer los mensajes.
--
-- Las dos están `is_done = false`, así que sin una bandera nueva la única
-- forma de separarlas sería mirar el NOMBRE de la columna — justo lo que el
-- resto del módulo evita, porque el equipo las renombra desde la UI y el aviso
-- se rompería en silencio (ver 20260727200000 y 20260802300000).
--
-- ⚠️ is_ready NO es lo mismo que is_done y no se puede fusionar con ella:
-- is_done alimenta los publicados del mes del Pase de servicio, y un video
-- terminado pero no publicado no es un video publicado. Marcar "Terminado"
-- como is_done inflaría el ritmo y el riesgo de cada Hero — es exactamente el
-- error que 20260802300000 se cuidó de no cometer.

alter table public.content_columns
  add column is_ready boolean not null default false;

comment on column public.content_columns.is_ready is
  'Las piezas acá ya están hechas y solo esperan la fecha. Silencia el aviso de "publica pronto y sigue sin terminar". No cuenta como publicado: eso es is_done.';

-- "Terminado" es hoy la única con ese significado. "Publicado" y "Guiones
-- finalizados" no la necesitan: ya son is_done y el aviso las descarta por ahí.
update public.content_columns
set is_ready = true
where name = 'Terminado';
