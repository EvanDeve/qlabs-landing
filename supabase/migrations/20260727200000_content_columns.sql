-- Columnas configurables en el pipeline del admin (Q·OS).
--
-- Misma razón que en el tablero del creador: las etapas eran el enum
-- `content_stage` y un enum de Postgres no se puede extender desde la app en
-- runtime. Pasan a ser filas de `content_columns`.
--
-- ⚠️ LO IMPORTANTE DE ESTA MIGRACIÓN son las dos banderas de significado.
-- Había cálculos reales atados al NOMBRE de la etapa:
--   * el Pase de servicio cuenta los publicados del mes con stage='publicado'
--     (de ahí salen meta, ritmo y riesgo de cada Hero)
--   * el KPI "Pend. aprobación" busca 'aprobacion_guion' y 'revision_cliente'
--   * los contadores de piezas activas usan stage <> 'publicado'
-- Con columnas renombrables, buscar por texto dejaría de funcionar en silencio.
-- Por eso cada columna declara QUÉ SIGNIFICA (`is_done`, `is_pending_approval`)
-- y el código lee eso. Así se pueden renombrar, agregar y borrar columnas sin
-- descuadrar ninguna métrica.
--
-- A diferencia de las del creador, estas columnas son UNA SOLA lista para toda
-- la agencia: el pipeline de Q·OS es compartido por todo el equipo.

create table public.content_columns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6d54f3',
  position integer not null default 0,
  -- Antes vivían en CONTENT_STAGE_SOP, en el código.
  sop_code text,
  owner_role text,
  -- Significado, no nombre. Ver el comentario de arriba.
  is_done boolean not null default false,
  is_pending_approval boolean not null default false,
  created_at timestamptz not null default now(),
  -- Solo para mapear las filas viejas más abajo; se borra al final.
  legacy_stage text
);

create index content_columns_position_idx on public.content_columns (position);

alter table public.content_columns enable row level security;

-- Mismo alcance que content_pieces: es el tablero interno de la agencia.
create policy "content_columns_all_admin"
  on public.content_columns for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Las 10 etapas actuales, con los mismos colores que ya usaba el Kanban
-- (las custom properties --st-* de qos.module.css, ahora como hex porque
-- pasan a ser dato configurable).
insert into public.content_columns
  (name, color, position, sop_code, owner_role, is_done, is_pending_approval, legacy_stage)
values
  ('Pendiente',    '#8892a6', 0, null,      null,         false, false, 'pendiente'),
  ('Estrategia',   '#6d54f3', 1, 'SOP-002', 'Estratega',  false, false, 'estrategia'),
  ('Guion',        '#9b6cf0', 2, 'SOP-002', 'Guionista',  false, false, 'guion'),
  ('Aprob. Guion', '#c07414', 3, null,      'Cliente',    false, true,  'aprobacion_guion'),
  ('Grabación',    '#1f9ac9', 4, 'SOP-003', 'Productor',  false, false, 'grabacion'),
  ('Edición',      '#3b6ef5', 5, 'SOP-004', 'Editor',     false, false, 'edicion'),
  ('QA',           '#7c4de0', 6, 'SOP-005', 'QA',         false, false, 'qa'),
  ('Rev. Cliente', '#c9791b', 7, 'SOP-006', 'Cliente',    false, true,  'revision_cliente'),
  ('Programado',   '#14a08a', 8, null,      null,         false, false, 'programado'),
  ('Publicado',    '#14a06a', 9, null,      null,         true,  false, 'publicado');

-- ---------------------------------------------------------------
-- content_pieces: stage (enum) -> column_id (FK)
-- ---------------------------------------------------------------
-- Se agrega nullable, se mapea, y recién ahí se exige not null: así la
-- migración es correcta tenga o no filas la tabla.
alter table public.content_pieces add column column_id uuid;

update public.content_pieces p
set column_id = c.id
from public.content_columns c
where c.legacy_stage = p.stage::text;

-- on delete restrict a propósito, NO cascade: borrar una columna no puede
-- llevarse piezas por delante sin que nadie se entere. El server action las
-- muda a otra columna antes; esto es la red de seguridad.
alter table public.content_pieces
  alter column column_id set not null,
  add constraint content_pieces_column_id_fkey
    foreign key (column_id) references public.content_columns (id) on delete restrict;

create index content_pieces_column_idx on public.content_pieces (column_id);

alter table public.content_pieces drop column stage;
alter table public.content_columns drop column legacy_stage;

drop type content_stage;
