-- El objetivo de McLovin con la gente de afuera no es informar: es que agenden.
--
-- Va aparte de 20260802100000 porque aquella ya está corrida en producción.
-- Editarla en el lugar habría dejado el archivo diciendo una cosa y la base
-- otra, y la próxima persona que levante el proyecto de cero se habría comido
-- una diferencia silenciosa entre su base y la de prod.

alter table public.agent_settings
  -- Cómo lleva la conversación: qué preguntar, cuándo pasar al link, qué no
  -- empujar. Va aparte de `sobre_qlabs` a propósito — uno son hechos y el otro
  -- es comportamiento, y se editan por motivos distintos. Quien quiere más
  -- reuniones toca este, no el otro.
  add column guion_publico text not null default '',

  -- El link donde la persona agenda sola (Calendly o lo que sea).
  --
  -- Se delega a propósito: disponibilidad, zona horaria y recordatorios ya están
  -- resueltos ahí, y así el agente nunca escribe en `calendar_events` ni
  -- confirma un horario que después choque con algo que ya estaba.
  --
  -- Sin link, el agente no inventa uno: dice que el equipo le escribe.
  add column link_agenda text not null default '';

-- Que sea vacío o una URL de verdad. Un "calendly.com/q-labs" sin esquema no es
-- clickeable en WhatsApp, y el agente lo mandaría igual: nadie se enteraría
-- hasta que alguien no pudiera agendar.
alter table public.agent_settings
  add constraint agent_settings_link_agenda_chk
    check (link_agenda = '' or link_agenda ~ '^https://[^ ]+$');
