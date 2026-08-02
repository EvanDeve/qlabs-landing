-- Cierra el cambio de "la grabación es un evento, no una pieza": ahora que
-- McLovin escribe en calendar_events, la bitácora y la procedencia tienen que
-- poder distinguirlo.
--
-- ---------------------------------------------------------------
-- 1. calendar_events.created_by_agent
-- ---------------------------------------------------------------
-- Misma columna que ya tenía content_pieces (20260802000000): de dónde salió
-- la fila. Sin esto, un evento anotado por WhatsApp es indistinguible de uno
-- que alguien creó a mano desde el calendario, y cuando algo sale raro no hay
-- forma de saber si lo entendió mal el agente o lo cargó mal una persona.
--
-- `not null default false` y no nullable: las filas que ya existen las creó
-- una persona a mano —el agente nunca escribió en esta tabla hasta hoy—, así
-- que `false` es el valor correcto para todas, no un "no sabemos".
alter table public.calendar_events
  add column created_by_agent boolean not null default false;

-- ---------------------------------------------------------------
-- 2. wa_agent_actions.kind acepta 'crear_evento'
-- ---------------------------------------------------------------
-- El CHECK original solo conocía 'crear_pieza', de cuando crear era siempre
-- una tarjeta del tablero. Ahora hay dos destinos y la bitácora del panel
-- mentía: decía "crear_pieza" para algo que terminaba en el calendario.
--
-- ⚠️ Las filas viejas NO se migran. Una acción de agosto que creó una pieza
-- con record_date fue exactamente eso en su momento; reescribirla como
-- 'crear_evento' falsearía el historial. El panel sigue sabiendo leer las dos
-- (describirAccion mantiene la rama vieja) y el payload de ambas conserva
-- `tipo: "grabar" | "publicar"`, así que nada se pierde.
-- El CHECK original se escribió inline en el create table, así que Postgres le
-- puso el nombre él. Se busca por definición en vez de asumir el nombre: si el
-- auto-nombre fuera otro, un `drop constraint <nombre>` a secas fallaría —o
-- peor, un `if exists` lo dejaría en pie y los insert de 'crear_evento'
-- seguirían rebotando contra el viejo sin que esta migración se queje.
do $$
declare
  nombre text;
begin
  select conname into nombre
  from pg_constraint
  where conrelid = 'public.wa_agent_actions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%crear_pieza%';

  if nombre is not null then
    execute format('alter table public.wa_agent_actions drop constraint %I', nombre);
  end if;
end $$;

alter table public.wa_agent_actions
  add constraint wa_agent_actions_kind_check
  check (kind in ('mover_pieza', 'marcar_hecho', 'reprogramar', 'crear_pieza', 'crear_evento'));
