-- Pipeline del creador: un tablero de tareas propio.
--
-- Deliberadamente NO reusa `content_pieces`. Esa tabla es el pipeline interno
-- de la agencia sobre sus Heroes: su RLS es `content_pieces_all_admin` (solo
-- admin) y sus etapas —estrategia, aprobacion_guion, revision_cliente— son del
-- flujo de trabajo del equipo con un cliente, no del de un creador solo. Un
-- creador no es staff, así que abrirle esa tabla sería mezclar dos sistemas
-- que nada más se parecen en que ambos se ven como un Kanban.
--
-- Las tarjetas son libres: NO se atan a `applications`. Es decisión de
-- producto — el creador ya ve sus campañas aceptadas en "Mis aplicaciones", y
-- lo que pidió acá es dónde anotar sus tareas en general, incluido contenido
-- propio que no viene de ninguna campaña.

create type creator_task_stage as enum ('idea', 'guion', 'grabacion', 'edicion', 'publicado');

create table public.creator_tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  stage creator_task_stage not null default 'idea',
  notes text,
  -- Se reusa el enum de `content_pieces`: son las mismas plataformas y tener
  -- dos listas que se pueden desincronizar no aporta nada.
  platform content_platform,
  due_date date,
  -- Orden dentro de la columna. El Kanban lo reescribe al soltar una tarjeta.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_tasks_creator_idx on public.creator_tasks (creator_id, stage, position);

alter table public.creator_tasks enable row level security;

-- Una sola policy para todo: es un organizador personal. A diferencia del
-- resto de las tablas del marketplace, acá NO se le da acceso al admin —
-- estas tarjetas son notas privadas de trabajo, no datos de una transacción
-- que Q Labs tenga que arbitrar. Si algún día hace falta (soporte, disputas),
-- que sea una decisión explícita y no algo que se coló por costumbre.
create policy "creator_tasks_own"
  on public.creator_tasks for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create trigger touch_creator_tasks_updated_at
  before update on public.creator_tasks
  for each row execute function public.touch_content_piece_updated_at();
