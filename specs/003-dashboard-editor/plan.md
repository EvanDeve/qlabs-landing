# 003 · Plan técnico del dashboard del editor y el panel de editores

Base: `spec.md` (aprobada por Evan, v2, 2026-11-18). Cuatro piezas que comparten una sola migración: el registro de terminado (trigger), el acceso de los editores al board de video, el reparto de cada mañana (cron + función pura) y las dos pantallas (vista del editor en el Dashboard y el panel de editores).

## Orden y por qué

1. **Funciones puras primero** (días hábiles, reparto, fila y avance, panel), con sus tests. No tocan la base ni la UI: se pueden commitear y pushear en cualquier momento.
2. **La migración, antes que cualquier código que la use.** Es compatible con el código de hoy: agrega columnas con default, una tabla, dos vistas, dos funciones y un trigger, y amplía `puede_ver_board` (solo suma acceso). El código actual no lee nada de eso.
   - Desde que Evan la corre, el trigger ya registra terminados: cuanto antes corra, antes hay datos reales.
   - Al revés NO: código que lee `terminado_at`, `videos_por_editar` o llama a `aplicar_reparto_de_edicion` sin la migración rompe el Dashboard. **Ninguna tarea posterior a T05 se pushea hasta que Evan confirme que la corrió.**
3. **Tipos y tests RLS** contra la base ya migrada: fijan el trigger y los permisos antes de construir pantallas encima.
4. **Vista del editor** en el Dashboard.
5. **Reparto** (ejecutor + ruta del cron + `vercel.json`).
6. **Panel de editores** y su item del menú.
7. **Verificación en prod forzando casos** y `memory.md`.

## Lo que se verificó en el repo y en prod (2026-11-18)

- **Columnas del board `video` en prod** (GET a `content_columns`):

  | Columna | id | position | is_ready | is_done | is_pending_approval |
  |---|---|---|---|---|---|
  | Por editar | `dc307d54-8010-47b9-a546-9978d084b342` | 3 | false | false | false |
  | EN CURSO/Revision | `fee3f550-929c-4876-bad7-9f671399ce55` | 4 | **true** | false | true |
  | Terminado | `91e3aa85-a18c-45f6-8ccd-f34ecb6b771c` | 5 | false | false | false |
  | Publicado | `d589083c-3e58-4380-8890-2c40ea4afd70` | 6 | false | true | false |

  ⚠️ `is_ready` lo puso la migración `20260803120000` en "Terminado", pero hoy está en Revisión (alguien lo cambió desde el modal de columna). Con estas banderas "Terminado o posterior" no se puede expresar, y el criterio de la agenda (`!is_ready && !is_done` = sin terminar) hoy da **Revisión como hecha y Terminado como pendiente**. Ver D-01 y "Contradicciones".
- **Tarjetas en Por editar:** 121, de las cuales 118 sin responsable y 3 con (dos dueños distintos). 12 en Terminado.
- **Editores activos en prod: 2**, no 3 (uno desde 2026-07-31, otro desde 2026-11-18). La cuenta de CL-16 ("se reparten 24") con dos editores da 16 menos lo que ya tengan.
- Las tarjetas nacen en la **primera columna del board video por posición** (`aprobarCronograma…` en `src/lib/actions/cronograma-publico.ts:126`), que hoy es Por editar.
- Puertas que cambian `column_id`: `updateContentPieceColumnAction` y el editor de la ficha (`src/lib/actions/content-pieces.ts`), la mudanza al borrar columna (`src/lib/actions/content-columns.ts:138`), el webhook de McLovin (`src/app/api/qos/agente/webhook/route.ts`, con service role) y `src/lib/actions/cronograma-publico.ts:210` (solo carril `guion`). → El registro va por **trigger**.
- `puede_ver_board(p_board)` (`20261006120000_boards_del_pipeline.sql`) = admin y (director o miembro). La usan las policies de `pipeline_boards`, `pipeline_board_members`, `content_columns` y `content_pieces`, y `requirePipeline()` deja pasar a quien vea al menos un board.
- La lista de responsables de la ficha y del Kanban sale de `staff_directory` con `active = true` (`pipeline/page.tsx:73`, `pipeline/[pieceId]/page.tsx:49`), **no** de los miembros del board: un editor nuevo ya aparece para elegir. RF-23 solo tiene que darle la vista.
- `requireArea("agencia")` (`src/lib/auth/areas.ts`) lee `staff_members` pero devuelve solo `areas`. El editor es área `agencia`. `requireDirector()` (`src/lib/auth/require-director.ts`) rebota a `/admin`.
- Menú: `src/app/admin/(panel)/layout.tsx`, `navAgencia` con grupo "Operación"; los grupos se cortan por orden del array.
- Cron: `vercel.json` tiene **un** cron, `0 13 * * *` (7:00 CR) → `/api/qos/agente/cron?todos=1`. El plan es Hobby: 2 slots, uno por día cada uno, con precisión de ±59 min. `vercel.json` no admite comentarios.
- Fechas: `diaCR`, `sumarDias`, `diaCorto`, `COSTA_RICA_TZ` en `src/lib/ugc/calendar.ts`. **No existe** helper de días hábiles.
- PostgREST corta en 1000 filas y no hay ningún `.range(` en `src/`: no hay helper de paginación.
- Tests: unitarios en `tests/unit/**/*.test.ts` (no en `src/`), RLS en `tests/rls/**/*.test.ts` con `makeUser`/`cleanup` de `tests/rls/helpers.ts`. **Escriben en prod** (no hay staging).
- `content_pieces.publish_date` es `date`; `recorded_at` timestamptz; `platform` enum `ContentPlatform`; el Hero se resuelve con `agency_clients.id = brand_id` y `agency_clients.archived`.

## Decisiones técnicas

**D-01 — Cómo se reconocen "Por editar" y "Terminado o posterior": dos banderas nuevas en `content_columns`.**
`es_por_editar boolean` (a lo sumo una por board, índice único parcial) y `cuenta_como_terminado boolean` (en Terminado y en Publicado). El trigger, el reparto y las pantallas preguntan por la bandera, nunca por el nombre ni por la posición. La migración las pone **por id** (verificados arriba) y aborta si no encuentra exactamente esas filas en el board video.
- *Descartado: reusar `is_ready`/`is_done`.* `is_ready` hoy está en Revisión, y aunque estuviera bien puesta, `is_ready` = "silenciá el aviso de McLovin", que es otra pregunta. Cambiarla movería los avisos y los KPIs del Dashboard de la agencia.
- *Descartado: por posición* (`position >= posición de Terminado`). Igual hace falta marcar cuál es Terminado, y reordenar columnas desde el tablero cambiaría en silencio qué cuenta para la meta. Una bandera por columna sobrevive a renombrar y a reordenar.
- *Descartado: una sola bandera en Terminado + "o posterior" por posición.* Mismo problema de reordenar.
- Las banderas **no se exponen** en el modal de columna (por ahora): `is_ready` se desconfiguró justamente por ser editable. Si se agrega una columna nueva después de Publicado, hay que marcarla por SQL (queda en el `comment on column`).

**D-02 — El momento de terminado lo pone un trigger `before insert or update` en `content_pieces`** (`registrar_terminado`), en una columna nueva `terminado_at timestamptz`. Cubre todas las puertas (ficha, Kanban, McLovin, mudanza de columnas) y además protege la columna: en un insert queda null (CL-04) y en un update que no cambia `column_id` se conserva el valor viejo (la policy autoriza la fila, no la columna; nadie puede escribirlo a mano). Sin backfill (CL-08).
- *Descartado: en las acciones.* Son cuatro puertas y McLovin va con service role; la próxima que aparezca no lo haría.

**D-03 — RF-23 se resuelve ampliando `puede_ver_board`:** también da `true` para `p_board = 'video'` si quien consulta es `staff_role = 'editor'` y `active`. Desactivar al editor le saca el acceso solo, y un director no se lo puede sacar por error quitándolo de miembros.
- *Descartado: un trigger en `staff_members` que lo agregue a `pipeline_board_members`.* Se desincroniza: al desactivar queda adentro, y si un director lo saca a mano pierde el acceso que la spec dice que siempre tiene.

**D-04 — "Fila" y "disponibles" salen de una vista `videos_por_editar`** (`security_invoker = true`): tarjetas en la columna `es_por_editar` del board `video`, sin Heroes archivados. Disponibles = `owner_id is null`; fila de X = `owner_id = X`. La usan el reparto, el Dashboard del editor y el panel, así la definición vive en un solo lugar y los conteos se piden con `count: "exact", head: true` sin traer filas.
- Excluir Heroes archivados es la regla del resto de Q·OS (Pipeline, Dashboard, agenda); queda como decisión provisoria P-10.
- *Descartado: filtrar en cada consulta.* Tres lugares que tienen que coincidir, y `not.in` de PostgREST descarta los `brand_id` null en silencio.

**D-05 — El reparto es una función pura + una rpc atómica.** La ruta del cron lee el estado (service role), `repartir()` decide en memoria, y `aplicar_reparto_de_edicion(p_dia, p_asignaciones)` en **una transacción**: inserta la fila del día en `repartos_de_edicion` (PK `dia`; si ya existe no hace nada y devuelve 0 → idempotente, RF-11) y asigna solo las tarjetas que **siguen** sin responsable, en Por editar del board video, a editores activos (si alguien la tomó entre la lectura y la escritura, se saltea). Guarda las asignaciones en `jsonb` para auditar el primer reparto.
- *Descartado: todo el algoritmo en PL/pgSQL.* La constitución pide la lógica en `src/lib` con tests; en SQL no se testea sin base.
- *Descartado: hacer los updates desde la ruta sin rpc.* Dos crons que se pisan (Vercel puede disparar dos veces) repartirían doble.

**D-06 — El reparto tiene su propio cron: `0 12 * * 1-5`** (12:00 UTC = 6:00 CR; CR no tiene horario de verano) → `/api/qos/editores/reparto`, con el mismo `CRON_SECRET`. La ruta además chequea `esDiaHabil(diaCR(now))` (RF-12) por si alguien la llama a mano.
- *Descartado: colgarlo del cron de las 7:00.* Sería a las 7 y no a las 6 (P-02), y mover ese cron cambia la hora del WhatsApp, que está fuera de alcance. Costo: **se usa el último slot del plan Hobby** (riesgo R-01). Si Evan prefiere guardar el slot, la alternativa es llamar a `ejecutarReparto` al principio del cron de las 7:00; el código no cambia.
- Hobby dispara dentro de la hora: el reparto corre entre las 6:00 y las 6:59 CR.

**D-07 — Inicio de la medición (RF-32) = el primer día con reparto** (`min(dia)` de `repartos_de_edicion`). Sin reparto todavía, el panel dice que la medición arranca con el primero. Los terminados del día en que se corre la migración se ven en el Dashboard del editor pero no entran en el historial.
- *Descartado: una constante en código con la fecha de salida.* Hay que acertarle al día en que Evan corre la migración y se olvida.

**D-08 — Terminados del día por rango UTC del día CR**, calculado en la función pura (`rangoUtcDelDia(dia)` con `fromZonedTime`), y agrupados en memoria con `diaCR(terminado_at)`. Las consultas del panel traen desde el primer día del mes anterior, **paginadas de a 1000** (≈ 500 por mes con 3 editores a 8).

**D-09 — La bifurcación del Dashboard** va en `page.tsx` antes de cualquier consulta de la agencia: `requireArea` pasa a devolver también `staff`, y `vistaDelDashboard(staff)` decide. Editor = `staff_role === 'editor' && active` (glosario). El editor nunca dispara las consultas de la agencia (RF-22), no solo no las ve.

**D-10 — Las pantallas reusan `qos.module.css`** (`statCard`, `card`, `sectionHead`, filas de lista). Clases nuevas, si hacen falta, al final del archivo (en 4.200 líneas gana la de más abajo). Sin mockups: es una versión funcional; si Evan quiere diseño propio, va después (P-09).

**Decisiones provisorias de producto** (defaults que dio el orquestador; Evan las confirma o cambia):
P-02 reparto 6:00 CR · P-03 cuenta el responsable actual, no se guarda quién terminó · P-04 los pendientes de un editor desactivado NO se liberan solos · P-05 sin pausa por ausencia · P-06 no se limpian los atrasados antes del primer reparto · P-07 historial de 10 días hábiles (incluye hoy) · jefe de editores fuera de alcance.

## Migración

`supabase/migrations/20261119120000_dashboard_editor.sql`, en una transacción.

```sql
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
```

**RLS, resumen:**
- `content_columns`, `content_pieces`, `pipeline_boards`, `pipeline_board_members`: policies sin cambios; el acceso nuevo entra por `puede_ver_board`.
- `repartos_de_edicion`: RLS activa; lectura solo directores; escritura solo por la rpc (service role).
- Vistas `security_invoker = true`: cada lector ve lo que su RLS le deja ver de `content_pieces`, `calendar_month_items` y `hero_calendar_months`. Cerradas a `anon`.
- `terminado_at`: protegida por trigger (D-02), no por policy.
- Funciones: `registrar_terminado` sin execute para nadie (solo trigger); `aplicar_reparto_de_edicion` solo `service_role`.

**`src/lib/database.types.ts` (a mano, se compara contra el OpenAPI de prod):**
- `content_columns.Row`: `es_por_editar: boolean; cuenta_como_terminado: boolean;` (en `Insert` opcionales).
- `content_pieces.Row`: `terminado_at: string | null;` con comentario "lo escribe solo el trigger". **No** va en `Insert` (y por lo tanto tampoco en `Update`): así el compilador frena a quien intente escribirla.
- `Tables.repartos_de_edicion` (Row/Insert/Update).
- `Views.videos_por_editar` y `Views.videos_esperando_aprobacion`.
- `Functions.aplicar_reparto_de_edicion: { Args: { p_dia: string; p_asignaciones: Json }; Returns: number }`.

## Funciones puras (src/lib)

### `src/lib/ugc/dias-habiles.ts` (días en `'yyyy-MM-dd'` de CR; nada de `new Date()` adentro)
```ts
export function diaDeLaSemana(dia: string): number;               // 0 = domingo … 6 = sábado
export function esDiaHabil(dia: string): boolean;                 // lunes a viernes (sin feriados)
export function sumarDiasAlDia(dia: string, dias: number): string;
export function diasEntre(desde: string, hasta: string): number;  // hasta − desde, en días calendario
export function diasHabilesEntre(desde: string, hasta: string): string[]; // inclusive; [] si desde > hasta
export function ultimosDiasHabiles(hoy: string, n: number): string[];     // incluye hoy si es hábil; el más nuevo primero
export function inicioDeSemana(dia: string): string;              // el lunes de esa semana
export function inicioDeMes(dia: string): string;                 // 'yyyy-MM-01'
export function rangoUtcDelDia(dia: string): { desde: string; hasta: string }; // [00:00 CR, 00:00 CR del siguiente) en ISO
```

### `src/lib/ugc/reparto.ts`
```ts
export const META_DIARIA = 8;
export type VideoParaReparto = { id: string; publishDate: string | null; publishTime: string | null; createdAt: string };
export type EditorParaReparto = { profileId: string; pendientes: number }; // en el orden fijo de desempate
export type Asignacion = { pieceId: string; ownerId: string };

/** RF-05: fecha ascendente (los atrasados salen primero solos), sin fecha al final; desempata hora, creación, id. */
export function compararParaReparto(a: VideoParaReparto, b: VideoParaReparto): number;

/** RF-06, RF-07, RF-09: completa hasta `meta`, cada video al que menos tiene; empate → orden del array. */
export function repartir(
  editores: EditorParaReparto[],
  disponibles: VideoParaReparto[],
  meta?: number
): Asignacion[];
```
`repartir` ordena los disponibles por dentro (quien la llama no se lo puede olvidar), no muta las entradas y es determinista.

### `src/lib/ugc/edicion.ts`
```ts
export type VideoDeFila = {
  id: string; titulo: string; cliente: string | null;
  publishDate: string | null; publishTime: string | null; createdAt: string;
  plataforma: ContentPlatform; grabado: boolean;
};
export type VideoEnFila = VideoDeFila & { diasParaPublicar: number | null }; // negativo = atraso
export type FilaDelEditor = { atrasados: VideoEnFila[]; resto: VideoEnFila[] };

export function vistaDelDashboard(staff: { staff_role: StaffRole; active: boolean } | null): "editor" | "agencia"; // RF-13, CL-11
export function armarFila(videos: VideoDeFila[], hoy: string): FilaDelEditor;              // RF-05, RF-16, RF-17
export function diasDeAdelanto(videos: { publishDate: string | null }[], hoy: string): number | null; // RF-19
export function textoAdelanto(dias: number | null): string | null;  // "N días de adelanto" / "N días de atraso"; null sin fechas
export function avanceDelDia(terminados: number, hoy: string, meta?: number):
  { terminados: number; meta: number | null; texto: string; cumplida: boolean | null };      // RF-14, RF-15, CL-13
export function textoFilaVacia(disponibles: number): string;                                 // RF-20
```

### `src/lib/ugc/panel-editores.ts`
```ts
export type EditorDelPanel = { profileId: string; nombre: string };
export type TerminadoRegistrado = { ownerId: string; terminadoAt: string };
export type PeriodoDelPanel = { desde: string; hasta: string; total: number; meta: number; porcentaje: number | null };
export type FilaDelPanel = {
  profileId: string; nombre: string;
  hoy: { terminados: number; meta: number | null };
  pendientes: number; atrasados: number; diasDeAdelanto: number | null;
  historial: { dia: string; terminados: number; llego: boolean }[];
  semanas: PeriodoDelPanel[];  // actual y anterior (P-08)
  meses: PeriodoDelPanel[];    // actual y anterior (P-08)
};

/** RF-27, RF-28, RF-32: 8 × días hábiles en [max(desde, inicio), min(hasta, hoy)]. */
export function metaDelPeriodo(desde: string, hasta: string, hoy: string, inicioMedicion: string | null, meta?: number):
  { diasHabiles: number; meta: number };

/** RF-25..29, RF-31, RF-32. Los terminados se atribuyen por ownerId (el responsable actual, RF-29). */
export function resumenDelPanel(entrada: {
  editores: EditorDelPanel[];
  fila: { ownerId: string; publishDate: string | null }[];
  terminados: TerminadoRegistrado[];
  hoy: string;
  inicioMedicion: string | null;
  diasHistorial?: number; // default 10 (P-07)
}): FilaDelPanel[];

export function textoInicioMedicion(inicio: string | null): string; // RF-32
```

## Archivos

**Crear**
- `supabase/migrations/20261119120000_dashboard_editor.sql` — lo de arriba.
- `src/lib/ugc/dias-habiles.ts`, `src/lib/ugc/reparto.ts`, `src/lib/ugc/edicion.ts`, `src/lib/ugc/panel-editores.ts` — funciones puras.
- `src/lib/supabase/paginar.ts` — `traerTodas<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>, tamano = 1000): Promise<T[]>` (llama `.range` hasta que vuelve menos de `tamano`).
- `src/lib/ugc/edicion-datos.ts` — lo que habla con la base:
  - `getVistaEditor(supabase, profileId, now)`: fila (`videos_por_editar` con `owner_id`), terminados de hoy (`content_pieces` con `owner_id` y `terminado_at` en `rangoUtcDelDia(hoy)`), disponibles (`count` head sobre `videos_por_editar` con `owner_id is null`), nombres de Heroes (`agency_clients`). Devuelve lo que piden las funciones puras.
  - `getPanelEditores(supabase, now)`: editores activos (`staff_members` + `profiles.display_name`; el director lee la tabla), fila de todos, terminados desde `inicioDeMes(mes anterior)` paginados, disponibles y atrasados disponibles (`count` head, `lt('publish_date', hoy)`), `videos_esperando_aprobacion`, `min(dia)` de `repartos_de_edicion`.
  - `ejecutarReparto(admin, now)`: chequea `esDiaHabil`, sale temprano si ya hay fila del día, lee editores activos ordenados por `created_at`, `videos_por_editar` paginada, arma pendientes y disponibles, llama `repartir` y la rpc. Devuelve `{ dia, estado: 'no-habil' | 'ya-repartido' | 'repartido', pedidas, asignados }`.
- `src/app/api/qos/editores/reparto/route.ts` — GET con `CRON_SECRET` (mismo patrón que `agente/cron`), `createAdminClient()`, `ejecutarReparto`, JSON con el resumen y `console.error` si falla.
- `src/components/ugc/admin/VistaEditor.tsx` — server component: avance del día, días de adelanto, atrasados destacados, fila, terminados de hoy, estado vacío. Cada video es un `Link` a `/admin/pipeline/{id}`.
- `src/app/admin/(panel)/editores/page.tsx` — `requireDirector()`, `getPanelEditores`, `resumenDelPanel`; bloques: equipo (RF-30), hoy por editor (RF-25, RF-31), historial (RF-26), semanas y meses (RF-27, RF-28), aviso de inicio (RF-32).
- `src/app/admin/(panel)/editores/loading.tsx` — skeleton con `Skel`.
- Tests: `tests/unit/dias-habiles.test.ts`, `tests/unit/reparto.test.ts`, `tests/unit/edicion.test.ts`, `tests/unit/panel-editores.test.ts`, `tests/rls/dashboard-editor.test.ts`.

**Modificar**
- `src/lib/database.types.ts` — lo de la sección de la migración.
- `src/lib/auth/areas.ts` — `requireArea` devuelve también `staff` (ya lo lee; sin consulta nueva).
- `src/app/admin/(panel)/(inicio)/page.tsx` — al principio: `if (vistaDelDashboard(staff) === "editor") return <VistaEditor … />`, antes de las consultas de la agencia.
- `src/app/admin/(panel)/layout.tsx` — item "Editores" (`/admin/editores`, icono `film`) solo para `director`, dentro de `navAgencia` después de Heroes (grupo Operación, contiguo).
- `vercel.json` — segundo cron `{ "path": "/api/qos/editores/reparto", "schedule": "0 12 * * 1-5" }` (sin comentarios: el schema los rechaza; la explicación va en la ruta).
- `src/styles/qos.module.css` — solo si hace falta alguna clase nueva, al final.
- `memory.md` — al cerrar.

## Estrategia de tests (RF → test)

| RF / CL | Cómo se prueba |
|---|---|
| RF-01 | RLS: tarjeta en board de prueba Por editar → Terminado con sesión de editor y con service role (McLovin) → `terminado_at` ≈ now. |
| RF-02, CL-02 | RLS: Terminado → Revisión → `terminado_at` null; conserva `owner_id`. Unit: un terminado sin `terminadoAt` no cuenta en `resumenDelPanel`. |
| RF-03 | RLS: Terminado → Publicado conserva el valor exacto. |
| CL-01 | RLS: ida y vuelta → un solo valor, el último (mayor que el primero). |
| CL-03 | RLS: Por editar → Publicado registra. |
| CL-04 | RLS: insert directo en Terminado → null; insert con `terminado_at` puesto → null. |
| CL-08 | Migración sin backfill; verificación en prod: las 12 de Terminado quedan con null. |
| (protección) | RLS: `update` de `terminado_at` a mano sin cambiar columna → no cambia. |
| RF-04 | Unit de `esDiaHabil`; prod: llamar la ruta con `CRON_SECRET` y ver la fila en `repartos_de_edicion`; sin secreto → 401. |
| RF-05 | Unit `compararParaReparto`/`repartir`: atrasado viejo, atrasado nuevo, hoy, futuro, sin fecha; desempate por hora y creación. |
| RF-06 | Unit: editor con 3 recibe 5; con 8 o 12, ninguno. |
| RF-07 | Unit: 2 editores (0 y 4) → los primeros 4 van al de 0, después alternan; empate → orden del array. |
| RF-08 | RLS: la rpc deja `owner_id` en la tarjeta; prod: la tarjeta muestra responsable en el Kanban. |
| RF-09 | Unit: 5 disponibles para 3 editores en 0 → 2/2/1. |
| RF-10 | RLS: rpc con una tarjeta que ya tiene dueño, una en Terminado y una de otro board → no las toca, `asignados` lo refleja; asignación a un no-editor → no se aplica. Unit: la vista no entra (contrato de entrada). |
| RF-11 | RLS: segunda llamada el mismo día → 0 y nada cambia. Unit: `repartir` solo mira el estado que recibe (no hay "deuda" de días anteriores). |
| RF-12 | Unit: sábado y domingo → `esDiaHabil` false; `ejecutarReparto` con `now` en sábado → `no-habil` sin tocar la base (cliente falso). Cron `1-5`. |
| RF-13, CL-11 | Unit `vistaDelDashboard`: editor activo → editor; editor inactivo, director, guionista, null → agencia. Navegador con sesión de editor. |
| RF-14, CL-13 | Unit `avanceDelDia`: día hábil 3 → "Llevás 3 de 8"; 10 → "Llevás 10 de 8", `cumplida` true. |
| RF-15 | Unit: sábado → sin meta (`meta` null), texto sin "de 8". |
| RF-16 | Unit `armarFila`: orden y `diasParaPublicar`; navegador: cliente, título, fecha, plataforma, grabado, link a la ficha. |
| RF-17 | Unit: atrasados separados, con días de atraso, el más viejo primero. |
| RF-18 | Navegador: mover una tarjeta propia a Terminado y recargar → aparece en terminados de hoy y sube N. |
| RF-19 | Unit `diasDeAdelanto`/`textoAdelanto`: futuro, hoy (0), atrasado (negativo → "de atraso"), sin fechas → null; ignora los sin fecha. |
| RF-20 | Unit `textoFilaVacia` con 0 y con N disponibles; navegador con un editor sin fila. |
| RF-21 | Unit: `rangoUtcDelDia` (00:00 CR = 06:00Z); `diaCR` de 23:59 y 00:01 CR del borde; `avanceDelDia` con el `hoy` del parámetro. |
| RF-22 | Revisión de código (el `return` va antes de las consultas de la agencia) + navegador: el editor no ve Pase de servicio ni meta por cliente. |
| RF-23 | RLS: editor activo SIN membresía ve `pipeline_boards` video, sus columnas y una tarjeta de prueba; no ve el board `it`; editor inactivo y guionista sin membresía no ven nada; el editor puede moverla a otra columna del board video. |
| RF-24 | RLS: editor no lee `repartos_de_edicion`, director sí. Navegador: un editor que pega `/admin/editores` rebota a `/admin`; el item no le aparece. |
| RF-25 | Unit `resumenDelPanel`: hoy vs 8, pendientes, atrasados y días de adelanto por editor. |
| RF-26 | Unit: historial de 10 días hábiles, sin fines de semana, con `llego`. |
| RF-27 | Unit: total, meta y porcentaje por semana y por mes (actual y anterior). |
| RF-28 | Unit `metaDelPeriodo`: miércoles a mitad de semana → 3 × 8 (hoy incluido); mes en curso. |
| RF-29, CL-05 | Unit: el terminado cuenta para el `ownerId` que viene (el actual); reasignar cambia el resultado. |
| RF-30 | RLS/humo: `videos_esperando_aprobacion` con director devuelve meses y no da error; anon no la lee. Prod: comparar contra conteo `count` head por mes (706 dic / 579 ene, con lo que haya ese día). Unit: disponibles y atrasados vienen del `count`. |
| RF-31 | Unit: editor sin fila ni terminados aparece con ceros. |
| RF-32 | Unit: días antes de `inicioMedicion` no entran al historial ni a la meta; `inicioMedicion` null → meta 0 y `porcentaje` null; `textoInicioMedicion`. |
| CL-06, CL-12, CL-14, CL-15 | Salen de las definiciones (Revisión no tiene bandera; la vista incluye lo que tiene dueño; las tarjetas nacen en Por editar sin dueño). Prod: forzar CL-12 y CL-14. |
| CL-07 | Unit: editor desactivado no entra (lo filtra la consulta; `repartir` solo recibe activos). RLS: la rpc no asigna a un editor inactivo. |
| CL-09, CL-10, CL-16 | Sin lógica propia (P-05, recorded_at solo se muestra, P-06). Prod: primer reparto revisado en `repartos_de_edicion.asignaciones`. |

Los tests RLS usan un **board de prueba** (`v_rls…` con columnas propias marcadas) para el trigger, así no se mueve nada del board real. RF-10/11/23 necesitan el board `video` real: crean una tarjeta de prueba sin Hero en Por editar (con service role) y la borran en `afterAll`; la rpc se prueba con el día `2099-01-05` (no afecta `min(dia)`) y se borra esa fila. `afterAll` borra en orden: tarjetas, columnas y board de prueba, fila de reparto, después `cleanup()`.

## Riesgos

- **R-01 — Último slot de cron del plan Hobby.** Después de esto no queda ninguno; lo próximo que necesite cron va colgado de uno de los dos (o se pasa a Pro/pg_cron). Alternativa en D-06.
- **R-02 — El WhatsApp de la mañana va a cambiar de contenido sin tocar su código:** la agenda lista las tarjetas con `owner_id`, así que cada editor recibe sus 8 (más las atrasadas). Además, como `is_ready` está en Revisión, la agenda avisa "SIGUE EN TERMINADO" para videos terminados. Hoy la salida de WhatsApp está caída, así que no se nota todavía.
- **R-03 — Prod es el único entorno.** Los tests RLS dejan una tarjeta de prueba unos segundos en el Kanban real, y la primera corrida del reparto en prod reparte de verdad (CL-16). La verificación de T18 se hace con permiso de Evan.
- **R-04 — Cualquiera con acceso al board puede editar y borrar columnas** (pasa hoy con los miembros; ahora también con todo editor). Borrar Terminado muda sus tarjetas a Revisión y les borra el terminado (correcto según RF-02, pero se pierde historial).
- **R-05 — Feriados.** Día hábil = lunes a viernes; un feriado reparte y cuenta meta igual.
- **R-06 — Reasignar después de terminado cambia el historial** (CL-05, P-03 por decisión).
- **R-07 — La silueta de carga** de `(inicio)/loading.tsx` es la del Dashboard de la agencia: el editor la ve un instante antes de su vista.
- **R-08 — La ficha "vuelve" al Pipeline**, no al Dashboard, cuando se abre desde la fila del editor (`hrefDelPipeline(volver)`).
- **R-09 — 1000 filas.** Todo lo que puede crecer va paginado o con `count` head; la paginación necesita orden estable (`order by id`).
- **R-10 — Hobby dispara dentro de la hora:** el reparto cae entre 6:00 y 6:59 CR.

## Contradicciones y huecos de la spec

- **"Reusa el criterio de pendiente y terminado de la agenda"** no se puede cumplir literal: la agenda decide con `is_ready`/`is_done`, que hoy marca Revisión como hecha y Terminado como pendiente, y la spec dice que Revisión NO cuenta. El plan usa las definiciones del glosario (Fila = Por editar; Terminado = Terminado o posterior) con banderas nuevas, y no toca la agenda.
- **Tres editores:** en prod hay dos activos. Los números de capacidad (≈500/mes) y de CL-16 (24 el primer día) bajan a ≈330/mes y 16.
- **Hallazgo fuera de alcance:** el KPI "Terminado" del Dashboard de la agencia usa `is_ready`, así que hoy cuenta lo que está en Revisión. Va como `/feature` aparte si Evan quiere.

## Preguntas abiertas

- **P-08 — Qué semanas y meses muestra el panel:** el plan pone la actual y la anterior de cada uno. ¿Alcanza, o quiere elegir el período?
- **P-09 — Diseño:** las dos pantallas salen con las piezas de Q·OS que ya existen. ¿Evan quiere mandar mockups antes de T10 (vista del editor) y T15 (panel)?
- **P-10 — Heroes archivados:** el plan los deja fuera del reparto, de la fila y de los disponibles, como el resto de Q·OS. ¿Confirma?
- **P-11 — Terminados de fin de semana:** si un editor termina un sábado, ¿suma al total de la semana y del mes? El plan dice que sí (la meta solo cuenta días hábiles).
- **P-12 — "Días de adelanto" y "días para publicarse"** se cuentan en días calendario, no hábiles. ¿Confirma?
- **P-13 — Banderas de columna** (`es_por_editar`, `cuenta_como_terminado`): ¿se quedan fuera del modal de columna, o el director tiene que poder moverlas?
- Siguen abiertas en la spec P-01 a P-07, con los defaults provisorios de "Decisiones técnicas".
