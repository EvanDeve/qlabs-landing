-- Arregla el corrimiento de un día en las fechas de las piezas, y hace opcional
-- el código.
--
-- ---------------------------------------------------------------
-- 1. publish_date / record_date: timestamptz -> date
-- ---------------------------------------------------------------
-- El bug que se veía: una pieza puesta para el 1 de agosto aparecía en el
-- Kanban, en el Calendario y en el recordatorio del agente como si fuera del
-- 31 de julio.
--
-- La causa no era el formato de salida sino el tipo de la columna. El input del
-- formulario es `type="date"` y manda '2026-08-01' pelado; al entrar en una
-- columna timestamptz, Postgres lo completa con la medianoche UTC. Costa Rica
-- es UTC-6, así que ese instante ES las 18:00 del 31 de julio en CR. Ninguna
-- capa de arriba estaba equivocada: mostraban fielmente un instante que
-- significaba el día anterior.
--
-- El arreglo de fondo es que dejen de ser instantes. Estas dos fechas son días
-- del calendario —no hay hora en el formulario ni se muestra hora en ningún
-- lado— y guardar un día como instante obliga a inventar una hora que nadie
-- eligió. Con `date` no hay zona horaria que convertir y el problema desaparece
-- como categoría, no como síntoma.
--
-- `calendar_events.starts_at` NO se toca: una reunión o una jornada de
-- grabación sí ocurren a una hora concreta.
--
-- La conversión va con `at time zone 'UTC'` explícito y no con un `::date`
-- pelado: el cast simple usa el TimeZone de la sesión, así que el mismo comando
-- daría un día distinto según quién lo corra. Leyendo en UTC se recupera
-- exactamente el día que la persona tipeó en el formulario.
alter table public.content_pieces
  alter column publish_date type date using (publish_date at time zone 'UTC')::date,
  alter column record_date  type date using (record_date  at time zone 'UTC')::date;

-- ---------------------------------------------------------------
-- 2. code deja de ser obligatorio
-- ---------------------------------------------------------------
-- Era `not null unique`. Pedirlo siempre obliga a inventar un código para poder
-- crear una pieza, y termina lleno de valores de relleno que no significan
-- nada. Pasa a ser opcional.
--
-- El unique se conserva: si alguien SÍ pone un código, que siga siendo único.
-- En Postgres un índice único admite varios NULL, así que las piezas sin código
-- no chocan entre sí — pero se deja explícito con un índice parcial para que la
-- intención quede escrita y no dependa de recordar esa regla.
alter table public.content_pieces alter column code drop not null;

alter table public.content_pieces drop constraint content_pieces_code_key;

create unique index content_pieces_code_idx
  on public.content_pieces (code) where code is not null;
