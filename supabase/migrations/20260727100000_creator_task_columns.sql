-- Columnas configurables en el pipeline del creador.
--
-- Antes las etapas eran el enum `creator_task_stage`. Un enum de Postgres no se
-- puede extender desde la app en runtime (hace falta ALTER TYPE, que es DDL),
-- así que para que cada creador arme sus propias columnas tienen que ser datos,
-- no tipos. `creator_tasks.stage` pasa a ser `column_id`.
--
-- Se puede hacer sin migrar nada porque `creator_tasks` está vacía: se creó
-- hoy mismo y nadie alcanzó a usarla. Si tuviera filas, esto necesitaría un
-- paso intermedio que mapee cada valor del enum a su columna sembrada.

create table public.creator_task_columns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  -- Hex, no una custom property de CSS: ahora esto es dato configurable y el
  -- creador puede elegir un color que no está en la paleta de --st-*.
  color text not null default '#6d54f3',
  position integer not null default 0,
  -- Marca la columna que significa "terminado". La usan el Resumen (tareas
  -- abiertas, tareas atrasadas) y la tarjeta (una tarea terminada no está
  -- atrasada aunque la fecha haya pasado). Es explícito y no "la última
  -- columna": si no, reordenar el tablero cambiaría los números en silencio.
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index creator_task_columns_creator_idx
  on public.creator_task_columns (creator_id, position);

alter table public.creator_task_columns enable row level security;

create policy "creator_task_columns_own"
  on public.creator_task_columns for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- ---------------------------------------------------------------
-- creator_tasks: stage (enum) -> column_id (FK)
-- ---------------------------------------------------------------
alter table public.creator_tasks drop column stage;

-- on delete restrict a propósito, NO cascade: borrar una columna no puede
-- llevarse las tarjetas por delante sin que nadie se entere. El server action
-- las mueve a otra columna primero; esto es la red de seguridad si algún día
-- alguien borra desde el SQL Editor.
alter table public.creator_tasks
  add column column_id uuid not null
  references public.creator_task_columns (id) on delete restrict;

create index creator_tasks_column_idx on public.creator_tasks (column_id, position);

drop type creator_task_stage;
