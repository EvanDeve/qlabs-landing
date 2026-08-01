-- Q·OS: agente de recordatorios por WhatsApp para el equipo interno.
--
-- El pipeline y el calendario ya tienen toda la información de "qué me toca y
-- para cuándo", pero solo existe si alguien entra a mirarla. Esto agrega el
-- empuje hacia afuera: un mensaje diario a cada miembro con lo vencido, lo de
-- hoy y lo que se viene.
--
-- Alcance deliberado: SOLO el equipo (`staff_members`). Ni creadores ni marcas
-- reciben WhatsApp — son terceros y eso necesitaría un consentimiento y un
-- flujo de baja propios, no la casilla que marca un admin en el panel.

-- ---------------------------------------------------------------
-- staff_members: teléfono, consentimiento y hora del recordatorio
-- ---------------------------------------------------------------
-- WhatsApp exige opt-in incluso para empleados, y `wa_opt_in` arranca en false
-- a propósito: cargar un número NO es consentir. Son dos actos separados y la
-- fecha del consentimiento queda registrada por si alguna vez hay que probarla.
alter table public.staff_members
  add column phone_e164 text,
  add column wa_opt_in boolean not null default false,
  add column wa_opt_in_at timestamptz,
  -- Hora local de Costa Rica (0-23) a la que le llega el resumen. Por miembro
  -- y no global: el guionista y el productor no arrancan a la misma hora.
  add column reminder_hour smallint not null default 7;

-- E.164 y nada más: es lo que espera la API de WhatsApp y validarlo acá evita
-- que un `8888-7777` escrito a mano llegue hasta Twilio para fallar allá.
alter table public.staff_members
  add constraint staff_members_phone_e164_chk
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

alter table public.staff_members
  add constraint staff_members_reminder_hour_chk
    check (reminder_hour between 0 and 23);

-- Un número no puede estar en dos miembros: el webhook resuelve el remitente
-- justamente por este campo, y si estuviera duplicado no habría forma de saber
-- quién escribió. Parcial porque la mayoría de las filas lo van a tener null.
create unique index staff_members_phone_idx
  on public.staff_members (phone_e164) where phone_e164 is not null;

-- No hacen falta policies nuevas: `staff_members_all_admin` ya cubre la tabla
-- entera, y Q·OS es admin-only.

-- ---------------------------------------------------------------
-- wa_messages: bitácora de todo lo que entra y sale
-- ---------------------------------------------------------------
-- No es un log "por si acaso", hace tres trabajos concretos:
--   1. Idempotencia — que el recordatorio de un día salga UNA vez.
--   2. Ventana de 24 h — WhatsApp solo deja texto libre dentro de las 24 h
--      posteriores al último mensaje del usuario; ese instante se lee de acá.
--   3. Depuración — cruzar un envío con la consola de Twilio por su SID.
create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.staff_members (profile_id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  body text not null,
  -- Null en free-form. Los mensajes que inicia el negocio SIEMPRE van por
  -- plantilla aprobada por Meta; los de adentro de la ventana, no.
  template_name text,
  provider_sid text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'received')),
  error text,
  -- 'daily:2026-08-01'. El índice único de abajo lo convierte en garantía de
  -- exactly-once: la fila se inserta ANTES de llamar a Twilio, así que si el
  -- cron se dispara dos veces (Vercel reintenta ante timeout o 5xx) el segundo
  -- intento choca contra el índice y se saltea en vez de mandar un duplicado.
  dedupe_key text,
  created_at timestamptz not null default now()
);

create unique index wa_messages_dedupe_idx
  on public.wa_messages (profile_id, dedupe_key) where dedupe_key is not null;

-- Sirve al historial del panel y a la lectura de la ventana de 24 h (el último
-- inbound de alguien).
create index wa_messages_inbox_idx
  on public.wa_messages (profile_id, created_at desc);

alter table public.wa_messages enable row level security;

-- Solo select, y solo admin. Sin policy de insert/update a propósito: las filas
-- las escriben el cron y el webhook con el cliente service-role, igual que
-- `notifications`. Ninguna sesión de navegador tiene por qué escribir acá.
create policy "wa_messages_select_admin"
  on public.wa_messages for select
  to authenticated
  using (public.current_app_role() = 'admin');
