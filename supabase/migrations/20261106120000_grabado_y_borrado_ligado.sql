-- Dos deudas entre el cronograma y el pipeline, y una limpieza.
--
-- El modelo del módulo es "el cronograma manda": la fila de
-- calendar_month_items es lo que se le prometió al Hero y la tarjeta de
-- content_pieces es el trabajo que nació de ahí al aprobar. Lo que faltaba era
-- que borrar de un lado se viera del otro.

-- ---------------------------------------------------------------
-- 1. Borrar una tarjeta se lleva su video del cronograma
-- ---------------------------------------------------------------
-- La FK `calendar_month_items.piece_id` es `on delete set null`: al borrar la
-- tarjeta la fila del cronograma quedaba viva, sin tarjeta, y el Hero la
-- seguía viendo en su link como un video prometido. Medido el 2026-11-06: 65
-- videos así en cronogramas aprobados (La Árboleda octubre tenía 8 en el
-- cronograma y 0 en el tablero).
--
-- Va como trigger y no en el server action para cubrir TODOS los caminos de
-- borrado —el drawer hoy, y mañana una cascada o McLovin— sin que cada uno
-- tenga que acordarse.
--
-- `before delete` a propósito. Las acciones de FK corren como triggers AFTER,
-- y entre los AFTER el orden es alfabético: el "RI_ConstraintTrigger_…" de
-- Postgres iría antes que éste, pondría `piece_id` en null, y la fila ya no
-- se encontraría por `piece_id`. En BEFORE la referencia sigue intacta.
--
-- `security definer` porque quien borra la tarjeta puede ser alguien de UGC
-- (la policy de content_pieces es por board) que NO pasa `es_equipo_agencia()`,
-- la policy de calendar_month_items. Sin esto el delete anidado se filtraría
-- en silencio y el huérfano volvería a aparecer. Lo que borra es estrecho: las
-- filas que apuntan a la tarjeta que esa persona ya está autorizada a borrar.
create function public.borrar_video_del_cronograma_con_la_tarjeta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.calendar_month_items where piece_id = old.id;
  return old;
end;
$$;

create trigger borrar_video_del_cronograma_con_la_tarjeta
  before delete on public.content_pieces
  for each row execute function public.borrar_video_del_cronograma_con_la_tarjeta();

-- ---------------------------------------------------------------
-- 2. Grabado: una bandera explícita en la tarjeta
-- ---------------------------------------------------------------
-- No se puede derivar del pipeline: las columnas de video son "Por editar",
-- "En curso", "Terminado" y "Publicado", y ninguna dice si ya se grabó. El
-- equipo lo venía anotando en el título ("NO GRABADO - Testimonio").
--
-- Vive en la tarjeta y no en la fila del cronograma porque grabar es trabajo,
-- como los apuntes: existe recién cuando el video es tarjeta, y así una pieza
-- suelta (McLovin, cargada a mano) también se puede marcar.
--
-- timestamptz y no boolean, como `approved_at` y `client_comment_at`: null es
-- "sin grabar" y el valor dice cuándo.
alter table public.content_pieces add column recorded_at timestamptz;

comment on column public.content_pieces.recorded_at is
  'Cuándo se marcó el video como grabado. Null = sin grabar. Lo marca el equipo desde el cronograma o desde la tarjeta; quien graba lo ve en su link pero no lo toca.';

-- ---------------------------------------------------------------
-- 3. Limpieza: los videos que ya perdieron su tarjeta
-- ---------------------------------------------------------------
-- Las filas que el trigger de arriba habría borrado si hubiera existido:
-- videos sin tarjeta en cronogramas aprobados, creados antes de la aprobación
-- (o sea, tuvieron tarjeta y alguien la borró).
--
-- Se excluyen los meses que aprobó el equipo a mano Y nunca tuvieron una sola
-- tarjeta: `toggleCalendarMonthAction` no crea tarjetas, así que esos videos
-- no perdieron nada — nunca llegaron al pipeline (Delitalia septiembre, 11).
-- Un mes aprobado por el equipo que SÍ tiene otras tarjetas pasó por la
-- aprobación del cliente antes, y sus videos sin tarjeta son huérfanos
-- igual (Snowty septiembre, 4).
--
-- Contado contra prod el 2026-11-06: 65 filas.
delete from public.calendar_month_items i
 using public.hero_calendar_months m
 where m.hero_id = i.hero_id
   and m.month = i.month
   and m.status = 'aprobado'
   and i.piece_id is null
   and i.created_at < m.approved_at
   and (
     m.approved_by = 'cliente'
     or exists (
       select 1
         from public.calendar_month_items o
        where o.hero_id = i.hero_id
          and o.month = i.month
          and o.piece_id is not null
     )
   );
