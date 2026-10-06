-- Los boards del pipeline pasan a ser datos, y cada uno tiene su gente.
--
-- Hasta hoy las pestañas del tablero (Videos, Cronogramas, IT, Admin) eran
-- cuatro valores fijos en el check de `content_columns.section` y en
-- `SECCIONES_PIPELINE`; agregar una era una migración. Evan pidió
-- (2026-10-06) que el director pueda crear boards y elegir, persona por
-- persona, quién entra a cada uno — no por rol.
--
-- Decisiones de Evan:
--   · el director entra a todos sin tener que agregarse;
--   · los cuatro de hoy arrancan con todo el equipo de la agencia adentro;
--   · un board es de videos o de tareas;
--   · alguien de UGC puede estar en un board (y entonces ve el Pipeline).
--
-- `content_columns.section` NO cambia de forma: sigue siendo texto, ahora con
-- FK al id del board. Los ids de los cuatro de siempre se conservan ('video',
-- 'guion', 'it', 'admin') porque están en las URLs guardadas (?seccion=it) y
-- en el código que pregunta por 'video' para contar publicados.

-- ---------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------
-- El tipo va también en el id de los boards nuevos (`v_…` / `t_…`): no se
-- puede cambiar después de creado, y así el código que decide "¿esto es una
-- tarea?" (`esCarrilDeTareas`) no necesita ir a buscar el board. El check
-- mantiene las dos cosas de acuerdo.
create table public.pipeline_boards (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('videos', 'tareas')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint pipeline_boards_kind_en_id check (
    (kind = 'tareas') = (id in ('it', 'admin') or id like 't\_%')
    and (id in ('video', 'guion', 'it', 'admin') or id ~ '^[vt]_[a-z0-9]{6,}$')
  )
);

comment on table public.pipeline_boards is
  'Las pestañas del Pipeline. content_columns.section apunta acá. Quién entra: pipeline_board_members (el director entra a todos).';

create table public.pipeline_board_members (
  board_id text not null references public.pipeline_boards (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, profile_id)
);

create index pipeline_board_members_profile_idx on public.pipeline_board_members (profile_id);

insert into public.pipeline_boards (id, name, kind, position) values
  ('video', 'Videos', 'videos', 0),
  ('guion', 'Cronogramas', 'videos', 1),
  ('it', 'IT', 'tareas', 2),
  ('admin', 'Admin', 'tareas', 3);

-- Todo el equipo de la agencia en los cuatro, para que nadie pierda acceso el
-- día del cambio. Los directores también: no lo necesitan, pero si mañana
-- dejan de serlo conservan lo que tenían.
insert into public.pipeline_board_members (board_id, profile_id)
select b.id, s.profile_id
from public.pipeline_boards b
cross join public.staff_members s
where s.staff_role::text <> 'ugc';

alter table public.content_columns
  drop constraint content_columns_section_check;

alter table public.content_columns
  add constraint content_columns_section_fkey
  foreign key (section) references public.pipeline_boards (id);

comment on column public.content_columns.section is
  'El board (pipeline_boards.id) al que pertenece la columna. Los conteos por '
  'Hero (publicados del mes, atrasadas) miran solo el board ''video''.';

-- ---------------------------------------------------------------
-- 2. puede_ver_board()
-- ---------------------------------------------------------------
-- Del equipo (cualquier área) y, o director, o miembro del board. security
-- definer: lee pipeline_board_members y staff_members, que tienen RLS propia,
-- y la usan las policies de esas mismas tablas.
create function public.puede_ver_board(p_board text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
    and (
      public.is_director()
      or exists (
        select 1
        from public.pipeline_board_members
        where board_id = p_board
          and profile_id = auth.uid()
      )
    )
$$;

comment on function public.puede_ver_board(text) is
  'true si quien consulta puede entrar a ese board del Pipeline: director, o miembro.';

revoke execute on function public.puede_ver_board(text) from anon;

-- ---------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------
alter table public.pipeline_boards enable row level security;
alter table public.pipeline_board_members enable row level security;

create policy "pipeline_boards_select"
  on public.pipeline_boards for select
  to authenticated
  using (public.puede_ver_board(id));

create policy "pipeline_boards_write_director"
  on public.pipeline_boards for all
  to authenticated
  using (public.is_director())
  with check (public.is_director());

-- Ver quién está en un board es de quien puede entrar a ese board: el
-- tablero ofrece de responsable a la gente del board.
create policy "pipeline_board_members_select"
  on public.pipeline_board_members for select
  to authenticated
  using (public.puede_ver_board(board_id));

create policy "pipeline_board_members_write_director"
  on public.pipeline_board_members for all
  to authenticated
  using (public.is_director())
  with check (public.is_director());

-- Columnas y tarjetas: por board. Reemplaza el corte por área de
-- 20261006110000 en estas dos tablas — puede_ver_board ya exige admin, y que
-- alguien de UGC esté en un board es justamente lo que se pidió.
drop policy "content_columns_all_agencia" on public.content_columns;
create policy "content_columns_all_board"
  on public.content_columns for all
  to authenticated
  using (public.puede_ver_board(section))
  with check (public.puede_ver_board(section));

-- `with check` también por board: mover una tarjeta a una columna de un board
-- donde no estás es sacarla de tu vista y meterla en la de otros.
drop policy "content_pieces_all_agencia" on public.content_pieces;
create policy "content_pieces_all_board"
  on public.content_pieces for all
  to authenticated
  using (
    exists (
      select 1
      from public.content_columns c
      where c.id = content_pieces.column_id
        and public.puede_ver_board(c.section)
    )
  )
  with check (
    exists (
      select 1
      from public.content_columns c
      where c.id = content_pieces.column_id
        and public.puede_ver_board(c.section)
    )
  );

-- ---------------------------------------------------------------
-- 4. staff_directory, de vuelta a todo el equipo
-- ---------------------------------------------------------------
-- 20261006110000 la cerró a la agencia. Con gente de UGC adentro de un board,
-- el tablero tiene que poder pintarles el responsable y ofrecerlos: son
-- nombre, rol y color, sin teléfono.
create or replace view public.staff_directory
with (security_invoker = false) as
  select profile_id, staff_role, color, active
  from public.staff_members
  where public.current_app_role() = 'admin';
