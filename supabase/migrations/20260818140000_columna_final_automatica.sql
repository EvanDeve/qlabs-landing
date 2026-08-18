-- La columna final de un carril deja de ser una casilla y pasa a ser una regla.
--
-- `is_done` es lo que declara "acá la pieza está cerrada", y de ahí salen los
-- publicados del mes, las piezas activas y el lugar al que McLovin mueve algo
-- cuando le decís que ya lo hiciste. Hasta hoy lo marcaba una persona a mano
-- desde el modal de la columna.
--
-- Eso funcionaba con un solo carril. Con tres no: el tablero corre `guion`,
-- `video` e `it`, la casilla se llama "las piezas acá están publicadas" —
-- vocabulario de video— y el carril de IT nació sin ninguna columna marcada.
-- Nadie se enteró hasta que alguien le pidió a McLovin cerrar una tarea y él
-- contestó que no tenía a dónde moverla. Un carril nuevo no puede nacer roto y
-- avisar por WhatsApp tres semanas después.
--
-- LA REGLA: la última columna de cada carril es la que cierra. Se cumple hoy en
-- los tres —video termina en Publicado, guiones en Cronogramas aprobados, IT en
-- Terminado— y sobrevive a que las renombren, que es justo lo que esta tabla
-- vino a resolver (ver el comentario de 20260727200000). Un carril nuevo queda
-- bien desde su primera columna, sin que nadie tenga que saber nada.
--
-- Las otras dos banderas NO se tocan: `is_pending_approval` y `is_ready` sí son
-- decisiones del equipo —cuál columna es la de esperar al cliente, cuál la de
-- "ya está grabado, falta la fecha"— y solo tienen sentido en video.

create or replace function public.recalcular_columnas_finales()
returns void
language sql
as $$
  update public.content_columns c
     set is_done = deberia.es_final
    from (
      select
        id,
        -- La de más abajo de su carril. El desempate por created_at es para que
        -- dos columnas con la misma posición no se turnen entre recargas.
        id = first_value(id) over (
          partition by section
          order by position desc, created_at desc
        ) as es_final
      from public.content_columns
    ) as deberia
   where c.id = deberia.id
     and c.is_done is distinct from deberia.es_final;
$$;

comment on function public.recalcular_columnas_finales is
  'Marca como is_done la última columna de cada carril y desmarca el resto. La llama el trigger; no hace falta llamarla a mano.';

create or replace function public.marcar_columna_final()
returns trigger
language plpgsql
as $$
begin
  -- El UPDATE de recalcular_columnas_finales() vuelve a disparar este mismo
  -- trigger. Sin el corte por profundidad, la primera reordenada entra en
  -- recursión: cada pasada dispara la siguiente aunque no cambie ninguna fila.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  perform public.recalcular_columnas_finales();
  return null;
end;
$$;

-- Por sentencia y no por fila: reordenar el tablero es UN update de nueve filas,
-- y recalcular una vez al final es lo correcto — hacerlo por fila daría estados
-- intermedios con dos columnas finales en el mismo carril.
--
-- Cubre también el update de `section`: mover una columna de carril cambia el
-- final de los DOS, el que deja y el que recibe.
drop trigger if exists content_columns_columna_final on public.content_columns;

create trigger content_columns_columna_final
after insert or update or delete on public.content_columns
for each statement
execute function public.marcar_columna_final();

-- Y se corre una vez ahora, que es lo que deja al carril de IT cerrable sin que
-- nadie vaya a marcar nada.
select public.recalcular_columnas_finales();
