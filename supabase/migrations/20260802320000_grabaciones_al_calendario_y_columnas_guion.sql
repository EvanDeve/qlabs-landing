-- Dos cosas que cierran la reorganización del pipeline:
--
--   1. Las 7 tarjetas "GRABACION-AGOSTO" (una por Hero) dejan de ser piezas y
--      pasan a ser eventos de calendario. No eran videos: eran la jornada
--      mensual de grabación anotada en el tablero por falta de otro lugar.
--   2. Los guiones SÍ se quedan en el pipeline, pero con dos columnas propias
--      —"Guiones" y "Guiones finalizados"— para poder seguirlos aparte del
--      flujo de video.
--
-- ⚠️ Además arregla un bug de datos: esas 7 piezas tenían `publish_date` IGUAL
-- a `record_date`. Si alguna llegaba a una columna con is_done, el Pase de
-- servicio la contaba como un video publicado de ese Hero e inflaba la meta
-- del mes. Al sacarlas del tablero el problema desaparece.

begin;

-- ---------------------------------------------------------------
-- 1. Los eventos, copiados ANTES de borrar las piezas
-- ---------------------------------------------------------------
-- content_piece_id va explícitamente en NULL. La FK es `on delete cascade`:
-- si el evento apuntara a la pieza, el delete de abajo se llevaría puesto el
-- evento que acabamos de crear.
--
-- La hora es 09:00 de Costa Rica porque `starts_at` es timestamptz y una
-- jornada de grabación sí ocurre a una hora concreta (por eso esa columna no
-- se convirtió a `date` en 20260801000000). Nadie eligió esa hora: es un
-- valor de arranque y se edita desde el calendario.
--
-- La conversión va con `at time zone` explícito y no con un cast pelado, por
-- el mismo motivo que la migración de fechas: un cast usaría el TimeZone de
-- la sesión y daría un día distinto según quién corra esto.
insert into public.calendar_events
  (type, brand_id, content_piece_id, title, starts_at, responsible_id, status)
select
  'grabacion',
  p.brand_id,
  null,
  p.title,
  ((p.record_date::text || ' 09:00:00')::timestamp at time zone 'America/Costa_Rica'),
  p.owner_id,
  'programado'
from public.content_pieces p
where trim(p.title) = 'GRABACION-AGOSTO'
  and p.record_date is not null;

-- El borrado repite la condición de fecha a propósito: si alguna tarjeta no
-- tuviera record_date no se le creó evento, y borrarla igual perdería el dato
-- sin dejar rastro. Esa se queda en el tablero y se ve.
delete from public.content_pieces
where trim(title) = 'GRABACION-AGOSTO'
  and record_date is not null;

-- ---------------------------------------------------------------
-- 2. Las dos columnas de guion, al principio del tablero
-- ---------------------------------------------------------------
-- Van adelante porque el guion precede a la grabación; el tablero queda
-- Guiones → Guiones finalizados → Por grabar → Por editar → Revisión cliente
-- → Terminado → Publicado.
update public.content_columns set position = position + 2;

-- ⚠️ "Guiones finalizados" lleva is_done = true. No es cosmético: las piezas
-- que NO están en una columna is_done alimentan el badge del nav, el conteo
-- de piezas activas por Hero, la detección de atrasadas y la alerta de carga
-- del equipo (admin/page.tsx:193). Sin la bandera, cada guion terminado
-- quedaría contado como trabajo activo para siempre y esos cuatro números se
-- irían inflando mes a mes.
--
-- No afecta al Pase de servicio porque `publishedThisMonth` exige además
-- `publish_date`, y una tarjeta de guion no lleva fecha de publicación.
-- REGLA: no cargarle fecha de publicación a una tarjeta de guion — ahí sí
-- contaría como video publicado del Hero.
insert into public.content_columns
  (name, color, position, sop_code, owner_role, is_done, is_pending_approval)
values
  ('Guiones',             '#9b6cf0', 0, 'SOP-002', 'Guionista', false, false),
  ('Guiones finalizados', '#7c4de0', 1, null,      null,        true,  false);

-- ---------------------------------------------------------------
-- 3. Las tarjetas de guion a su columna
-- ---------------------------------------------------------------
update public.content_pieces
set column_id = (select id from public.content_columns where name = 'Guiones')
where trim(title) = 'GUION-AGOSTO';

commit;
