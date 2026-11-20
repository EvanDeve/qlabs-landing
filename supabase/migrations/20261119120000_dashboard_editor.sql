-- =================================================================
-- Dashboard del editor y reparto de la mañana (spec 003)
-- =================================================================
-- Qué agrega (todo compatible con el código de hoy: nada de esto lo lee):
--   1. Banderas en content_columns: es_por_editar (de dónde sale la fila y el
--      reparto) y cuenta_como_terminado (Terminado y Publicado). Por id.
--   2. content_pieces.terminado_at + trigger registrar_terminado: el momento
--      en que la tarjeta llegó a Terminado (o posterior), entre por la puerta
--      que entre. Sin backfill: lo ya terminado no cuenta (CL-08).
--   3. puede_ver_board: el editor activo ve el board video sin ser miembro.
--   4. Vista videos_por_editar: la fila de cada editor y los disponibles.
--   5. Vista videos_esperando_aprobacion: videos de cronogramas sin aprobar.
--   6. Tabla repartos_de_edicion + rpc aplicar_reparto_de_edicion (idempotente
--      por día; solo service role).
--
-- Verificado en prod el 2026-11-20 antes de escribirla: los ids de Por editar,
-- Terminado y Publicado siguen iguales. Hay una columna nueva "Por Grabar"
-- (posición 16, is_done) que NO lleva ninguna bandera: es antes de editar.
-- Si las banderas no quedan exactamente como se espera, se aborta todo.
-- =================================================================

begin;

-- ───────────── 1. Banderas de columna (D-01) ─────────────
alter table public.content_columns
  add column es_por_editar boolean not null default false,
  add column cuenta_como_terminado boolean not null default false;

alter table public.content_columns
  add constraint content_columns_etapa_de_edicion
    check (not (es_por_editar and cuenta_como_terminado));

-- Una sola columna de reparto por board.
create unique index content_columns_un_por_editar
  on public.content_columns (section) where es_por_editar;

comment on column public.content_columns.es_por_editar is
  'De acá sale la fila de cada editor y el reparto de la mañana (spec 003). Una por board; hoy solo se usa en video.';
comment on column public.content_columns.cuenta_como_terminado is
  'Llegar acá desde una columna sin esta bandera registra content_pieces.terminado_at (spec 003). Va en Terminado y en todas las posteriores: una columna nueva después de Publicado hay que marcarla a mano.';

-- Por id y no por nombre (verificados en prod el 2026-11-18). Si no están
-- exactamente esas filas en el board video, se aborta todo.
update public.content_columns set es_por_editar = true
 where id = 'dc307d54-8010-47b9-a546-9978d084b342' and section = 'video';
update public.content_columns set cuenta_como_terminado = true
 where id in ('91e3aa85-a18c-45f6-8ccd-f34ecb6b771c', 'd589083c-3e58-4380-8890-2c40ea4afd70')
   and section = 'video';
do $$
begin
  if (select count(*) from public.content_columns where es_por_editar) <> 1
     or (select count(*) from public.content_columns where cuenta_como_terminado) <> 2 then
    raise exception 'Las columnas del board video no son las esperadas: revisar ids antes de correr';
  end if;
end $$;

-- ───────────── 2. Momento de terminado (RF-01..03, CL-01..04, CL-08) ─────────────
alter table public.content_pieces add column terminado_at timestamptz;

comment on column public.content_pieces.terminado_at is
  'Cuándo entró por última vez a una columna cuenta_como_terminado viniendo de una que no. Lo escribe SOLO el trigger registrar_terminado. Null antes de la spec 003 (2026-11).';

create index content_pieces_terminado_idx
  on public.content_pieces (owner_id, terminado_at) where terminado_at is not null;

create function public.registrar_terminado()
returns trigger
language plpgsql
security definer          -- lee content_columns aunque quien mueve sea UGC o McLovin
set search_path = public
as $$
declare
  v_antes boolean;
  v_ahora boolean;
begin
  if tg_op = 'INSERT' then
    new.terminado_at := null;              -- CL-04: nacer terminado no cuenta
    return new;
  end if;
  if new.column_id is not distinct from old.column_id then
    new.terminado_at := old.terminado_at;  -- nadie lo escribe a mano
    return new;
  end if;
  select coalesce(cuenta_como_terminado, false) into v_antes from public.content_columns where id = old.column_id;
  select coalesce(cuenta_como_terminado, false) into v_ahora from public.content_columns where id = new.column_id;
  if coalesce(v_ahora, false) and not coalesce(v_antes, false) then
    new.terminado_at := now();             -- RF-01, CL-01 (gana el último), CL-03
  elsif not coalesce(v_ahora, false) then
    new.terminado_at := null;              -- RF-02, CL-02
  else
    new.terminado_at := old.terminado_at;  -- RF-03: Terminado → Publicado
  end if;
  return new;
end;
$$;
revoke execute on function public.registrar_terminado() from public, anon, authenticated;

create trigger registrar_terminado
  before insert or update on public.content_pieces
  for each row execute function public.registrar_terminado();

-- ───────────── 3. Acceso de los editores al board video (RF-23, D-03) ─────────────
create or replace function public.puede_ver_board(p_board text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
    and (
      public.is_director()
      or exists (select 1 from public.pipeline_board_members
                  where board_id = p_board and profile_id = auth.uid())
      or (p_board = 'video' and exists (
            select 1 from public.staff_members
             where profile_id = auth.uid() and staff_role = 'editor' and active))
    )
$$;
comment on function public.puede_ver_board(text) is
  'true si quien consulta puede entrar a ese board: director, miembro, o editor activo en el board video (spec 003).';
revoke execute on function public.puede_ver_board(text) from anon;

-- ───────────── 4. Fila y disponibles (D-04) ─────────────
create view public.videos_por_editar
with (security_invoker = true) as
select p.id, p.owner_id, p.title, p.brand_id, p.publish_date, p.publish_time,
       p.platform, p.recorded_at, p.created_at
from public.content_pieces p
join public.content_columns c
  on c.id = p.column_id and c.section = 'video' and c.es_por_editar
left join public.agency_clients a on a.id = p.brand_id
where coalesce(a.archived, false) = false;
revoke all on public.videos_por_editar from anon;
grant select on public.videos_por_editar to authenticated;

-- ───────────── 5. Cronogramas esperando aprobación (RF-30) ─────────────
create view public.videos_esperando_aprobacion
with (security_invoker = true) as
select i.month, count(*)::int as videos
from public.calendar_month_items i
join public.hero_calendar_months m on m.hero_id = i.hero_id and m.month = i.month
left join public.agency_clients a on a.id = i.hero_id
where m.status = 'pendiente' and i.piece_id is null and coalesce(a.archived, false) = false
group by i.month;
revoke all on public.videos_esperando_aprobacion from anon;
grant select on public.videos_esperando_aprobacion to authenticated;

-- ───────────── 6. Reparto del día (RF-04..12, D-05) ─────────────
create table public.repartos_de_edicion (
  dia date primary key,                         -- día CR; la PK es la idempotencia
  asignaciones jsonb not null default '[]'::jsonb,  -- [{piece_id, owner_id}] pedidas
  asignados integer not null default 0,         -- las que de verdad se aplicaron
  created_at timestamptz not null default now()
);
comment on table public.repartos_de_edicion is
  'Un reparto por día hábil (spec 003). La primera fila marca el inicio de la medición del panel de editores.';

alter table public.repartos_de_edicion enable row level security;
create policy "repartos_de_edicion_select_director"
  on public.repartos_de_edicion for select to authenticated
  using (public.is_director());
-- Sin policies de escritura: solo la escribe aplicar_reparto_de_edicion con service role.

create function public.aplicar_reparto_de_edicion(p_dia date, p_asignaciones jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_asignados integer;
begin
  insert into public.repartos_de_edicion (dia, asignaciones)
  values (p_dia, p_asignaciones)
  on conflict (dia) do nothing;
  if not found then
    return 0;                                   -- RF-11: ese día ya se repartió
  end if;

  update public.content_pieces p
     set owner_id = a.owner_id
    from jsonb_to_recordset(p_asignaciones) as a(piece_id uuid, owner_id uuid),
         public.content_columns c,
         public.staff_members s
   where p.id = a.piece_id
     and p.owner_id is null                     -- RF-10: lo que ya tiene responsable no se toca
     and c.id = p.column_id and c.section = 'video' and c.es_por_editar
     and s.profile_id = a.owner_id and s.staff_role = 'editor' and s.active;
  get diagnostics v_asignados = row_count;

  update public.repartos_de_edicion set asignados = v_asignados where dia = p_dia;
  return v_asignados;
end;
$$;
revoke execute on function public.aplicar_reparto_de_edicion(date, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_reparto_de_edicion(date, jsonb) to service_role;

commit;
