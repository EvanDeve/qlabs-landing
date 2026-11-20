-- =================================================================
-- La fila del editor: todo lo suyo sin terminar, no solo Por editar
-- =================================================================
-- Spec 003, corrección de Evan del 2026-11-20. La fila salía de
-- videos_por_editar (solo la columna Por editar): apenas el editor movía un
-- video a En curso, se le borraba de la fila aunque no estuviera terminado.
--
-- Ahora la fila es todo lo que el editor tiene como responsable en el board
-- video y todavía no llegó a una columna cuenta_como_terminado (Terminado,
-- Publicado), esté en la columna que esté.
--
-- Y para el reparto de la mañana (completar hasta 8) cuenta todo eso MENOS lo
-- que está esperando al cliente (columnas is_pending_approval: hoy En
-- revisión), así una demora del cliente no le frena el trabajo al editor.
-- Se pregunta por la bandera, nunca por el nombre.
--
-- videos_por_editar NO cambia: de ahí siguen saliendo los disponibles (Por
-- editar sin responsable), que es lo único que el reparto asigna.
-- Compatible con el código de hoy: nadie lee esta vista todavía.
-- =================================================================

begin;

create view public.fila_de_edicion
with (security_invoker = true) as
select p.id, p.owner_id, p.title, p.brand_id, p.publish_date, p.publish_time,
       p.platform, p.recorded_at, p.created_at,
       c.id as column_id,
       c.name as columna,
       not c.is_pending_approval as cuenta_para_reparto
from public.content_pieces p
join public.content_columns c
  on c.id = p.column_id and c.section = 'video' and not c.cuenta_como_terminado
left join public.agency_clients a on a.id = p.brand_id
where p.owner_id is not null
  and coalesce(a.archived, false) = false;

comment on view public.fila_de_edicion is
  'La fila de cada editor (spec 003): sus tarjetas del board video sin terminar, en cualquier columna. cuenta_para_reparto = false en las columnas que esperan al cliente.';

revoke all on public.fila_de_edicion from anon;
grant select on public.fila_de_edicion to authenticated;

commit;
