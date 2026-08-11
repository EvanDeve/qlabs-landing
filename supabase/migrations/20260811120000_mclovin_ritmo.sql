-- El ritmo de McLovin, configurable sin deploy.
--
-- Hasta acá "cuánto ve" vivía en tres constantes de src/lib/ugc/agenda.ts, así
-- que cambiar la ventana de 3 días a una semana era una tarea de programador.
-- Es lo primero que el equipo va a querer mover —depende de cómo trabajen ese
-- mes, no de una decisión técnica— y no tiene por qué pasar por un deploy.
--
-- Los defaults son exactamente los valores que estaban en código, así que
-- aplicar esta migración no cambia ningún comportamiento.
--
-- ⚠️ Lo que NO se hace configurable, a propósito: las reglas fijas y el catálogo
-- de acciones. La configuración puede cambiar QUÉ dice el agente; nunca QUÉ
-- puede tocar. Si eso se editara desde un textarea, un párrafo mal escrito le
-- abriría permisos de escritura y nadie se enteraría hasta que pasara algo.

alter table public.agent_settings
  -- Cuántos días hacia adelante entran en "lo que se viene".
  --
  -- El tope no es capricho: la agenda entera se numera y viaja dentro del
  -- prompt, y el modelo actúa sobre esos números. Una ventana de un año llena el
  -- prompt de ítems, encarece cada mensaje y hace que el modelo se equivoque de
  -- número justo cuando más items hay.
  add column dias_proximas int not null default 3
    constraint agent_settings_dias_proximas_chk check (dias_proximas between 1 and 60),

  -- Cuántos días hacia atrás se miran las vencidas.
  --
  -- Hay un corte a propósito: el WhatsApp diario es un empujón, no una
  -- auditoría. Algo atrasado hace dos meses no se destraba porque aparezca en un
  -- resumen, y arrastrarlo todos los días es exactamente cómo se entrena a
  -- alguien a ignorar el canal.
  add column dias_vencidas int not null default 30
    constraint agent_settings_dias_vencidas_chk check (dias_vencidas between 1 and 180),

  -- Cuántas piezas sin fecha se nombran, como mucho.
  --
  -- Sin tope, alguien con medio tablero sin fechar recibe veinte ítems todos los
  -- días y lo que sí tiene fecha queda sepultado abajo. Las que no entran se
  -- cuentan y se dicen como "y N más": el recorte se avisa, nunca se esconde.
  add column max_sin_fecha int not null default 5
    constraint agent_settings_max_sin_fecha_chk check (max_sin_fecha between 1 and 30);

comment on column public.agent_settings.dias_proximas is
  'Días hacia adelante que mira la agenda del agente. El agente dice esta ventana '
  'cuando le preguntan por algo que cae afuera, para no dar por completa una '
  'lista que no pudo mirar entera.';
