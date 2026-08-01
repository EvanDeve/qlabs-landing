-- McLovin también le contesta a quien escriba de afuera del equipo.
--
-- Hasta ahora un número que no estuviera en `staff_members` recibía 200 y
-- silencio. Eso era deliberado: escribirle a desconocidos es la vía rápida a
-- que reporten el número y Meta lo bloquee.
--
-- Lo que cambia acá NO es eso. El agente sigue sin iniciar nunca una
-- conversación con nadie de afuera: solo responde a quien le escribió primero,
-- que es exactamente el caso que WhatsApp permite (la ventana de 24 h la abre
-- el usuario). Sigue apagado por default y hay que prenderlo a mano.

-- ---------------------------------------------------------------
-- agent_settings: qué decir afuera, y si decir algo
-- ---------------------------------------------------------------
alter table public.agent_settings
  -- Interruptor general. Apagado por default: prenderlo es una decisión que
  -- alguien tiene que tomar mirando lo que dice `sobre_qlabs`, no algo que se
  -- herede de una migración.
  add column responder_desconocidos boolean not null default false,

  -- Lo único que el agente sabe de Q Labs. Si está vacío no contesta aunque el
  -- interruptor esté prendido: un agente sin nada que decir contestando de
  -- todos modos es peor que uno callado — improvisa.
  add column sobre_qlabs text not null default '',

  -- Cómo lleva la conversación: qué preguntar, cuándo pasar al link, qué no
  -- empujar. Va aparte de `sobre_qlabs` a propósito — uno son hechos y el otro
  -- es comportamiento, y se editan por motivos distintos. Quien quiere más
  -- reuniones toca este, no el otro.
  add column guion_publico text not null default '',

  -- El link donde la persona agenda sola (Calendly o lo que sea). Se delega a
  -- propósito: disponibilidad, zona horaria y recordatorios ya están resueltos
  -- ahí, y el agente nunca escribe en el calendario del equipo.
  --
  -- Sin link, el agente no lo inventa: dice que el equipo le escribe.
  add column link_agenda text not null default '';

-- Que sea vacío o una URL de verdad. Un "calendly.com/q-labs" sin esquema no es
-- clickeable en WhatsApp, y el agente lo mandaría igual sin que nadie se entere
-- hasta que alguien no pueda agendar.
alter table public.agent_settings
  add constraint agent_settings_link_agenda_chk
    check (link_agenda = '' or link_agenda ~ '^https://[^ ]+$');

-- ---------------------------------------------------------------
-- wa_public_messages: las conversaciones con gente de afuera
-- ---------------------------------------------------------------
-- Tabla aparte y no `wa_messages` por dos razones. Una técnica: aquella cuelga
-- de `staff_members` con profile_id NOT NULL, y acá del otro lado hay un número
-- suelto sin cuenta. Y una de fondo: el historial del equipo y el de un
-- desconocido no tienen por qué convivir — el panel de Equipo cruza cada
-- mensaje con el nombre de quien lo mandó, y estos no tienen nombre.
create table public.wa_public_messages (
  id uuid primary key default gen_random_uuid(),

  -- El hilo es el número. No hay cuenta ni perfil del otro lado.
  phone_e164 text not null
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),

  direction text not null check (direction in ('out', 'in')),
  body text not null,
  provider_sid text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'received')),
  error text,
  created_at timestamptz not null default now()
);

-- Las dos lecturas: el hilo de un número (para darle contexto al modelo y para
-- contar cuántos mensajes mandó hoy) y la actividad reciente del panel.
create index wa_public_messages_hilo_idx
  on public.wa_public_messages (phone_e164, created_at desc);

create index wa_public_messages_recientes_idx
  on public.wa_public_messages (created_at desc);

alter table public.wa_public_messages enable row level security;

-- Solo lectura y solo admin, igual que wa_messages. Las filas las escribe el
-- webhook con service-role.
--
-- Ojo con quién NO tiene que ver esto: acá adentro puede haber un número de
-- teléfono y el nombre de alguien que preguntó por un presupuesto. Un creador o
-- una marca del marketplace no tienen nada que hacer leyendo eso.
create policy "wa_public_messages_select_admin"
  on public.wa_public_messages for select
  to authenticated
  using (public.current_app_role() = 'admin');
