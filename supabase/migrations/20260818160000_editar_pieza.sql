-- McLovin puede editar los campos de una tarjeta, no solo moverla.
--
-- Prioridad, plataforma, hora de publicación, dueño, título, aprobación y
-- apuntes. Hasta ahora las cuatro acciones del CHECK eran las de mover una
-- tarjeta por el tablero; esta es la primera que le cambia lo que la tarjeta
-- DICE, y por eso vale un `kind` propio: en la bitácora no es lo mismo "la pasó
-- a Publicado" que "le cambió el dueño".
--
-- Mismo mecanismo que 20260802400000 para agregar 'crear_evento': el CHECK
-- original se escribió inline en el create table, así que Postgres le puso el
-- nombre él. Se busca por definición y no por nombre — si el auto-nombre fuera
-- otro, un `drop constraint <nombre>` a secas fallaría, o peor, un `if exists`
-- lo dejaría en pie y los insert de 'editar_pieza' seguirían rebotando contra el
-- viejo sin que esta migración se queje.

do $$
declare
  nombre text;
begin
  select conname into nombre
  from pg_constraint
  where conrelid = 'public.wa_agent_actions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%crear_pieza%';

  if nombre is null then
    raise exception 'No se encontró el CHECK de kind en wa_agent_actions';
  end if;

  execute format('alter table public.wa_agent_actions drop constraint %I', nombre);
end $$;

alter table public.wa_agent_actions
  add constraint wa_agent_actions_kind_check
  check (kind in ('mover_pieza', 'marcar_hecho', 'reprogramar', 'crear_pieza', 'crear_evento', 'editar_pieza'));
