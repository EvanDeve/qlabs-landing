-- McLovin: el agente pasa a tener nombre, personalidad editable y bitácora.
--
-- Tres cosas que van juntas:
--   1. `agent_settings` — quién es y cómo habla, editable desde el panel sin
--      tocar código ni redeployar.
--   2. `wa_agent_actions` — qué hizo. Hasta hoy `wa_messages` guardaba la
--      CONVERSACIÓN pero no las ACCIONES: si el agente movía una pieza, en la
--      base no quedaba ni rastro de que hubiera sido él.
--   3. `content_pieces.created_by_agent` — de dónde salió una pieza.
--
-- La 2 no es solo bitácora: es también donde vive la propuesta pendiente que
-- hace posible crear piezas desde el chat con una confirmación de verdad.

-- ---------------------------------------------------------------
-- agent_settings: la capa editable de la personalidad
-- ---------------------------------------------------------------
-- Fila única. El patrón del `id boolean primary key check (id)` es la forma más
-- barata de una tabla singleton en Postgres: solo `true` pasa el check y la PK
-- impide que haya dos. Sin esto, un insert de más deja dos personalidades y el
-- agente usa la que devuelva el planner ese día.
create table public.agent_settings (
  id boolean primary key default true check (id),

  -- Cómo se llama. Va dentro del prompt: el modelo tiene que saber su propio
  -- nombre para contestar "¿vos quién sos?" sin inventarse otro.
  nombre text not null default 'McLovin',

  -- Quién es y cómo escribe.
  --
  -- Vacío NO significa "sin personalidad": significa "usá la que trae el
  -- código" (PERSONA_SEED en src/lib/ugc/agente.ts). Así el texto canónico vive
  -- en un solo lugar —el repo, versionado— y esta columna guarda únicamente el
  -- apartamiento deliberado de ese default. El botón "Restaurar" del panel
  -- vuelve a dejarla vacía.
  persona text not null default '',

  -- Lo que el admin quiera agregarle encima: prioridades de la semana, cómo
  -- referirse a un cliente, qué no mencionar.
  instrucciones text not null default '',

  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.agent_settings (id) values (true);

alter table public.agent_settings enable row level security;

-- Q·OS es admin-only y esto define lo que un agente le dice al equipo por
-- WhatsApp: no hay ningún otro rol que tenga por qué leerlo ni escribirlo.
create policy "agent_settings_select_admin"
  on public.agent_settings for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy "agent_settings_update_admin"
  on public.agent_settings for update
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Sin policy de insert ni de delete a propósito: la fila es una sola y la crea
-- esta migración. Nadie debería poder borrarla ni agregar una segunda.

-- ---------------------------------------------------------------
-- wa_agent_actions: lo que el agente propone y lo que ejecuta
-- ---------------------------------------------------------------
create table public.wa_agent_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.staff_members (profile_id) on delete cascade,

  kind text not null
    check (kind in ('mover_pieza', 'marcar_hecho', 'reprogramar', 'crear_pieza')),

  -- Los datos de la acción tal cual se le mostraron a la persona.
  --
  -- Para 'crear_pieza' esto es el contrato entero de la confirmación: cuando
  -- alguien contesta "dale", la pieza se crea LEYENDO ESTE JSON, no lo que el
  -- modelo vuelva a escribir en el segundo turno. Sin eso, la persona confirma
  -- "el jueves" y el modelo puede crear el viernes sin que falle nada visible.
  payload jsonb not null,

  -- `vencida` es que nadie contestó a tiempo; `reemplazada` es que la persona
  -- pidió cambiarle algo y se abrió otra en su lugar. Son cosas distintas y el
  -- panel las muestra distinto: un log que confunde las dos hace parecer que el
  -- equipo ignora al agente cuando en realidad le está corrigiendo los datos.
  status text not null
    check (status in ('propuesta', 'ejecutada', 'descartada', 'vencida', 'reemplazada', 'fallida')),

  -- A qué fila terminó tocando. Null mientras no se haya ejecutado.
  target_table text,
  target_id uuid,

  error text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Sirve a las dos lecturas: buscar la propuesta viva de una persona y listar
-- la actividad reciente en el panel.
create index wa_agent_actions_recientes_idx
  on public.wa_agent_actions (profile_id, created_at desc);

-- Como máximo UNA propuesta viva por persona. Es lo que hace que "sí, dale" no
-- sea ambiguo: si hubiera dos abiertas, la confirmación no sabría a cuál
-- corresponde y el agente crearía la equivocada. El webhook vence la anterior
-- antes de abrir una nueva; este índice lo vuelve una garantía y no una
-- convención.
create unique index wa_agent_actions_una_propuesta_idx
  on public.wa_agent_actions (profile_id) where status = 'propuesta';

alter table public.wa_agent_actions enable row level security;

-- Solo lectura y solo admin, igual que wa_messages: las filas las escribe el
-- webhook con el cliente service-role. Ninguna sesión de navegador escribe acá.
create policy "wa_agent_actions_select_admin"
  on public.wa_agent_actions for select
  to authenticated
  using (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------
-- content_pieces: de dónde salió la pieza
-- ---------------------------------------------------------------
-- Una pieza que apareció en el tablero sin que nadie la cargara a mano necesita
-- decirlo en la cara. No es metadata para auditar después: es lo que permite
-- mirar el Pipeline y entender por qué hay algo ahí.
alter table public.content_pieces
  add column created_by_agent boolean not null default false;
