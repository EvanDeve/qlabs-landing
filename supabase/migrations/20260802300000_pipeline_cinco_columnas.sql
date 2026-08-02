-- El pipeline pasa de 9 columnas a las 5 que el equipo de edición usa de
-- verdad: Por grabar, Por editar, Revisión cliente, Terminado, Publicado.
--
-- Por qué se achica: una columna de Kanban solo informa si las tarjetas se
-- paran ahí en momentos distintos. Guion, Aprob. Guion y Grabación son tandas
-- mensuales —los guiones de un Hero se escriben de una sentada y se graba una
-- vez al mes—, así que todas las piezas las cruzaban juntas y las tres etapas
-- no distinguían nada. Esos hitos viven en el calendario, que ya los soporta:
-- `calendar_event_type` incluye 'grabacion', 'reunion' y 'entrega', y la vista
-- combina además `content_pieces.record_date`. O sea que sacar la columna
-- "Grabación" NO pierde la fecha de grabación: sigue en la pieza, se ve en la
-- tarjeta y sigue apareciendo en el calendario.
--
-- ⚠️ LAS DOS BANDERAS SON LO DELICADO DE ESTA MIGRACIÓN (misma advertencia que
-- 20260727200000): hay métricas atadas al SIGNIFICADO de la columna, no a su
-- nombre.
--   * `is_done` — el Pase de servicio cuenta los publicados del mes contra el
--     monthly_target de cada Hero (admin/page.tsx). Tiene que quedar en UNA
--     sola columna y esa es Publicado. "Terminado" NO la lleva: un video
--     listo pero todavía no publicado no puede contar como publicado, o el
--     ritmo y el riesgo de cada Hero salen inflados.
--   * `is_pending_approval` — alimenta el KPI "Pend. aprobación". Queda solo
--     en Revisión cliente. Antes también la tenía "Aprob. Guion", así que ese
--     KPI pasa a contar únicamente revisiones de cliente — que es lo correcto
--     ahora que la aprobación del guion es un hito mensual del calendario.
--
-- El orden importa: `content_pieces.column_id` es `on delete restrict`, así
-- que primero se crean las nuevas, después se mudan las piezas y recién al
-- final se borran las viejas.

begin;

-- ---------------------------------------------------------------
-- 1. Las 5 nuevas, en posiciones altas para no chocar con las actuales
-- ---------------------------------------------------------------
insert into public.content_columns
  (name, color, position, sop_code, owner_role, is_done, is_pending_approval)
values
  ('Por grabar',       '#1f9ac9', 100, 'SOP-003', 'Productor', false, false),
  ('Por editar',       '#3b6ef5', 101, 'SOP-004', 'Editor',    false, false),
  ('Revisión cliente', '#c9791b', 102, 'SOP-006', 'Cliente',   false, true),
  ('Terminado',        '#14a08a', 103, null,      null,        false, false),
  ('Publicado',        '#14a06a', 104, null,      null,        true,  false);

-- ---------------------------------------------------------------
-- 2. Mudanza de las piezas
-- ---------------------------------------------------------------
-- Se mapea por significado, no por nombre suelto:
--   Prioridades / Guion / Aprob. Guion / Grabación  -> Por grabar
--     (todo lo que todavía no se grabó; el guion dejó de ser una parada)
--   Edición / QA                                    -> Por editar
--   Rev. Cliente                                    -> Revisión cliente
--   Programado                                      -> Terminado
--     (el video está listo y con fecha; publicado recién cuando salga)
--   Publicado                                       -> Publicado
--
-- Se excluyen por id las columnas nuevas para que un nombre repetido
-- ("Publicado" existe en las dos listas) no se mude sobre sí mismo.
with nuevas as (
  select id, name from public.content_columns where position >= 100
),
viejas as (
  select id, name from public.content_columns where position < 100
),
mapa as (
  select
    v.id as origen,
    (select n.id from nuevas n where n.name = case
      when v.name in ('Prioridades', 'Pendiente', 'Estrategia', 'Guion', 'Aprob. Guion', 'Grabación')
        then 'Por grabar'
      when v.name in ('Edición', 'QA') then 'Por editar'
      when v.name = 'Rev. Cliente' then 'Revisión cliente'
      when v.name = 'Programado' then 'Terminado'
      when v.name = 'Publicado' then 'Publicado'
      -- Cualquier columna que el equipo haya creado a mano y no esté en la
      -- lista cae en "Por grabar" en vez de quedar huérfana y romper el
      -- delete de más abajo.
      else 'Por grabar'
    end) as destino
  from viejas v
)
update public.content_pieces p
set column_id = m.destino
from mapa m
where p.column_id = m.origen;

-- ---------------------------------------------------------------
-- 3. Fuera las viejas y las nuevas a su posición final
-- ---------------------------------------------------------------
delete from public.content_columns where position < 100;

update public.content_columns set position = position - 100 where position >= 100;

commit;
