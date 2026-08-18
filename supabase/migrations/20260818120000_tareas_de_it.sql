-- Una tarjeta puede no ser de ningún Hero.
--
-- El tablero corre tres carriles y el de IT no es trabajo de un cliente:
-- "actualizar el DNS" o "migrar el Storage" no salen al aire para nadie. Hasta
-- ahora `brand_id` era NOT NULL, así que una tarea interna tenía que colgarse de
-- un Hero cualquiera — y ahí quedaba, contando en su expediente y en sus
-- reportes como si fuera contenido suyo.
--
-- Solo se afloja la restricción; la foreign key sigue igual, así que una tarjeta
-- con Hero sigue teniendo que apuntar a uno que exista. Nada de lo que ya está
-- cargado cambia: las 141 tarjetas actuales tienen su brand_id y lo conservan.
--
-- La policy de content_pieces corta por rol (`current_app_role() = 'admin'`) y
-- no mira brand_id, así que un null acá no abre ninguna puerta.

alter table public.content_pieces
  alter column brand_id drop not null;

comment on column public.content_pieces.brand_id is
  'El Hero dueño de la tarjeta. Null en las tareas internas del carril de IT, que no son de ningún cliente.';
