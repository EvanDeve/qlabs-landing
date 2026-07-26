-- Estados nuevos para las salidas ante conflictos.
--
-- Va SOLO en esta migración, separado de todo lo que los usa: Postgres no
-- permite usar un valor de enum recién agregado dentro de la misma transacción
-- en que se agregó ("unsafe use of new value of enum type"). Las policies y el
-- trigger que los referencian viven en 20260725110000, que se corre después.

alter type application_status add value if not exists 'cancelled';
alter type application_status add value if not exists 'disputed';
