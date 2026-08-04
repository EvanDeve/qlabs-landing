-- Un Hero se puede archivar.
--
-- El problema: cuando una marca deja de ser cliente, hoy la única salida es
-- borrarla, y `content_pieces.brand_id` es `on delete cascade` — borrar el Hero
-- se lleva puesto todo el trabajo que se le hizo. Así que nadie borra nada, y
-- los Heroes viejos siguen contando en el Pase de servicio: sin videos este mes
-- salen en riesgo "alto" para siempre y el Dashboard se llena de alarmas falsas
-- que el equipo aprende a ignorar. Eso es lo que rompe el tablero, no el ruido
-- visual.
--
-- Archivar es lo contrario de borrar: no se pierde una fila, se saca de las
-- cuentas. Las piezas quedan intactas y siguen consultables.
--
-- ⚠️ Es una bandera de PRESENTACIÓN, no de seguridad: no lleva RLS propia. El
-- equipo entero ya ve todos los Heroes; archivar decide qué se cuenta y qué
-- aparece en los selects, no quién puede leer qué.

alter table public.agency_clients
  add column archived boolean not null default false;

comment on column public.agency_clients.archived is
  'Hero fuera de servicio: no cuenta en KPIs ni en el Pase de servicio, no aparece en los selects ni McLovin lo propone. Sus piezas se conservan.';

-- El índice es parcial y no sobre toda la columna: la consulta que importa es
-- "los activos" y el default deja casi todas las filas en false, así que un
-- índice completo sería una copia inútil de la tabla. Este es chico y sirve
-- para listar los archivados, que es la búsqueda selectiva de verdad.
create index agency_clients_archived_idx
  on public.agency_clients (archived)
  where archived;
