-- Los videos del cronograma, antes de ser tarjetas del pipeline.
--
-- La regla que ordena todo esto: los videos nacen en el tablero AL APROBARSE el
-- cronograma, no al escribirlo. Mientras el mes se está armando y el cliente lo
-- revisa, esos videos todavía no son trabajo: son una propuesta. Si vivieran en
-- `content_pieces` desde el minuto uno, el equipo vería en su tablero 10
-- tarjetas de un mes que el cliente todavía no aceptó.
--
-- De ahí que sean una tabla aparte y no una bandera sobre content_pieces. Trae
-- además dos cosas que no se buscaban y valen:
--   1. La superficie que el Hero puede tocar desde su link público queda
--      acotada a esta tabla; el tablero real nunca queda expuesto.
--   2. El cronograma queda como registro de LO PROMETIDO. Cuando después alguien
--      mueva una fecha en el pipeline, esta fila sigue diciendo qué se acordó.

create table public.calendar_month_items (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null,
  month date not null,

  -- El orden en que el equipo los escribió, que es el orden en que el cliente
  -- los va a leer. No se deriva de la fecha: un video sin fecha todavía tiene
  -- que tener un lugar en la lista.
  position integer not null default 0,

  title text not null default '',
  publish_date date,
  publish_time time,
  platform content_platform not null default 'instagram',

  -- El guion, con los mismos cuatro campos que la tarjeta. Se copian tal cual
  -- al aprobar. Ver la migración 20260812000000 para por qué el hook va aparte.
  script_hook text,
  script_idea text,
  script_desarrollo text,
  script_cta text,
  notes text,

  -- Lo que el Hero dejó dicho desde su link. NO puede editar el cronograma
  -- —eso lo decidió el equipo— así que su aporte entra como comentario y lo
  -- aplica una persona. `client_comment_at` es lo que enciende la marca de
  -- "el cliente tocó esto" en el tablero.
  client_comment text,
  client_comment_at timestamptz,

  -- La tarjeta que nació de esta fila al aprobar. Null mientras el cronograma
  -- siga pendiente. Es también el candado contra aprobar dos veces: si ya tiene
  -- pieza, no se vuelve a crear.
  piece_id uuid references public.content_pieces (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Borrar el cronograma se lleva sus videos: sin el mes al que pertenecen no
  -- significan nada. Ojo que es al revés que content_pieces, donde borrar el
  -- cronograma SUELTA las tarjetas en vez de borrarlas — ahí ya son trabajo
  -- hecho y de nadie más.
  foreign key (hero_id, month)
    references public.hero_calendar_months (hero_id, month)
    on delete cascade
);

create index calendar_month_items_mes_idx
  on public.calendar_month_items (hero_id, month, position);

alter table public.calendar_month_items enable row level security;

-- Admin y nadie más. El Hero NO entra por acá: no tiene cuenta (agency_clients
-- es una tabla plana, sin usuario), así que su link público se resuelve del
-- lado del servidor validando el token y NO abriéndole esta tabla a anon.
create policy "calendar_month_items_all_admin"
  on public.calendar_month_items for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create trigger touch_calendar_month_items_updated_at
  before update on public.calendar_month_items
  for each row execute function public.touch_content_piece_updated_at();

-- ---------------------------------------------------------------
-- El link del Hero
-- ---------------------------------------------------------------
-- Un token largo y aleatorio es la credencial: el Hero no tiene cuenta, así que
-- lo que autoriza es conocer la URL. Un uuid v4 son 122 bits al azar, que es
-- suficiente para que no se adivine, pero significa que quien tenga el link
-- entra — de ahí que desde afuera solo se pueda LEER, COMENTAR y APROBAR, y
-- nunca escribir sobre el tablero.
--
-- Va por cronograma y no por Hero para que un link viejo no dé acceso a los
-- meses siguientes.
alter table public.hero_calendar_months
  add column share_token uuid not null default gen_random_uuid();

create unique index hero_calendar_months_share_token_idx
  on public.hero_calendar_months (share_token);

-- ---------------------------------------------------------------
-- La meta cuenta los videos del cronograma, no las tarjetas
-- ---------------------------------------------------------------
-- Corrige el trigger de la migración anterior. Cuando se escribió, los videos
-- del cronograma IBAN a ser content_pieces desde el principio; con la decisión
-- de que nazcan recién al aprobar, contar content_pieces daría cero justo en el
-- momento de aprobar —las tarjetas todavía no existen— y la meta quedaría en 0
-- para todos los meses.
--
-- Se reemplaza la función y no el trigger: la firma es la misma.
create or replace function public.sellar_meta_del_cronograma()
returns trigger
language plpgsql
as $$
declare
  recien_aprobado boolean;
begin
  if new.status <> 'aprobado' then
    new.target := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    recien_aprobado := true;
  else
    recien_aprobado := old.status is distinct from 'aprobado';
  end if;

  if recien_aprobado then
    select count(*) into new.target
      from public.calendar_month_items
     where hero_id = new.hero_id
       and month = new.month;
  end if;

  return new;
end;
$$;
