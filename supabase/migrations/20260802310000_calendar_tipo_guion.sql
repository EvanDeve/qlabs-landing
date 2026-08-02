-- "Guion" como tipo de evento del calendario.
--
-- Al achicar el pipeline a 5 columnas (20260802300000), escribir los guiones
-- dejó de ser una parada del tablero: es una tanda mensual, un hito con fecha.
-- El calendario ya era el lugar de esos hitos —'grabacion', 'reunion',
-- 'entrega'— pero no tenía cómo nombrar al guion, y anotarlo como 'entrega'
-- lo dejaba indistinguible de cualquier otra entrega.
--
-- Va SOLO en esta migración, sin ninguna fila que lo use: Postgres no permite
-- usar un valor de enum recién agregado dentro de la misma transacción en que
-- se agregó ("unsafe use of new value of enum type"). Mismo motivo por el que
-- 20260725100000 y 20260725110000 están separadas.
--
-- El color ya existe como token: --st-guion (#9b6cf0), el violeta que la
-- columna "Guion" usaba en el Kanban. Se mantiene para que el equipo lo
-- reconozca en el calendario.

alter type calendar_event_type add value if not exists 'guion';
