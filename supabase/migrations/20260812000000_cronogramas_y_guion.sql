-- Cronogramas mensuales: el cronograma pasa a ser el objeto que manda.
--
-- Hasta ahora el mes se armaba en un Word, el cliente lo aprobaba, y alguien
-- copiaba los videos al pipeline a mano. Con esto el cronograma se arma en Q·OS
-- y las tarjetas nacen de ahí, con el guion adentro.
--
-- Esta migración prepara el terreno (columnas + candados). La meta mensual
-- sigue saliendo de agency_clients.monthly_target hasta que el Dashboard y el
-- reporte de McLovin lean el cronograma; recién ahí se borra esa columna. Si se
-- borrara acá, las dos pantallas que la leen hoy se caerían entre la migración
-- y el deploy.

-- ---------------------------------------------------------------
-- 1. El guion, estructurado
-- ---------------------------------------------------------------
-- Hasta ahora el guion era `script_url`: un link a Docs. Ese link se queda
-- —nadie abandona Drive de golpe, y agosto entero vive ahí— pero el contenido
-- pasa a vivir en estos cuatro campos, que son los que el equipo ya usa al
-- escribir.
--
-- El hook va en su propia columna y no dentro de la idea central a propósito:
-- es la única línea que se dice tal cual y que no se improvisa en el set
-- (SOP-002). Separado se lo puede mostrar distinto en la tarjeta, y más
-- adelante validarlo o compararlo entre videos. Metido adentro de otro campo
-- sería una convención de redacción que nadie puede hacer cumplir.
alter table public.content_pieces
  add column script_hook text,
  add column script_idea text,
  add column script_desarrollo text,
  add column script_cta text;

-- ---------------------------------------------------------------
-- 2. La hora de publicación
-- ---------------------------------------------------------------
-- Columna aparte, NO metida dentro de publish_date. Esa columna es `date` a
-- propósito desde la migración 20260801000000: guardar un día como instante es
-- exactamente lo que hacía que todo se viera un día antes en Costa Rica.
-- Sumarle la hora ahí sería reabrir ese bug entero.
--
-- `time` sin zona: es la hora local de Costa Rica, igual que el día de al lado.
alter table public.content_pieces add column publish_time time;

-- ---------------------------------------------------------------
-- 3. La pieza pertenece a un cronograma
-- ---------------------------------------------------------------
-- Enlace explícito, y no derivado de la fecha. Si alguien corre un video del 3
-- al 12 de septiembre, la pieza sigue siendo parte del cronograma de
-- septiembre: el cronograma es el registro de LO PROMETIDO, y derivarlo de
-- publish_date lo movería cada vez que se mueve una fecha.
--
-- La FK es compuesta (brand_id, calendar_month) porque un cronograma es de un
-- Hero y un mes: así la base no deja colgar una pieza de Zonna del cronograma
-- de Kosta Asiatika.
--
-- MATCH SIMPLE (el default) es justo lo que se quiere acá: con calendar_month
-- en null la constraint ni se evalúa, así que las piezas sueltas —las 48 que ya
-- están en el tablero, y las que McLovin cree por WhatsApp— siguen viviendo sin
-- cronograma.
alter table public.content_pieces add column calendar_month date;

alter table public.content_pieces
  add constraint content_pieces_calendar_month_fkey
  foreign key (brand_id, calendar_month)
  references public.hero_calendar_months (hero_id, month)
  -- Borrar un cronograma NO borra sus videos: los suelta. La lista de columnas
  -- es obligatoria (PostgreSQL 15+) porque sin ella el SET NULL alcanzaría
  -- también a brand_id, que es NOT NULL, y el delete fallaría siempre.
  on delete set null (calendar_month);

create index content_pieces_calendar_month_idx
  on public.content_pieces (brand_id, calendar_month)
  where calendar_month is not null;

-- Mover una pieza a otro Hero la saca del cronograma.
--
-- Va como trigger y no en el server action porque sin esto el guardado falla
-- con un error de FK crudo: el drawer deja cambiar el Hero de una pieza, y una
-- pieza de Zonna colgada del cronograma de Zonna no puede pasar a Kosta
-- Asiatika sin soltarse primero. Soltarla es además lo correcto — el video
-- dejó de ser parte de lo que se le prometió a esa marca.
create function public.soltar_cronograma_al_cambiar_de_hero()
returns trigger
language plpgsql
as $$
begin
  if new.brand_id is distinct from old.brand_id then
    new.calendar_month := null;
  end if;
  return new;
end;
$$;

create trigger soltar_cronograma_al_cambiar_de_hero
  before update on public.content_pieces
  for each row execute function public.soltar_cronograma_al_cambiar_de_hero();

-- ---------------------------------------------------------------
-- 4. La meta del mes sale del cronograma
-- ---------------------------------------------------------------
-- Mientras el cronograma está 'pendiente' se está armando, así que la meta es
-- el conteo vivo de sus videos y cambia con cada fila que se agrega.
--
-- Al aprobarlo el número se sella acá: a partir de ese momento es lo que el
-- cliente aprobó, y no puede bajar solo porque alguien borró una tarjeta. Esa
-- es justamente la diferencia entre "lo prometido" y "lo que hay hoy en el
-- tablero", que es lo que el Dashboard compara.
alter table public.hero_calendar_months add column target integer;

create function public.sellar_meta_del_cronograma()
returns trigger
language plpgsql
as $$
declare
  recien_aprobado boolean;
begin
  if new.status <> 'aprobado' then
    -- Si el cronograma se reabre para corregirlo, la meta vuelve a ser el
    -- conteo vivo. Dejar el número viejo sellado mientras se editan los videos
    -- daría una meta que no corresponde a ninguna lista.
    new.target := null;
    return new;
  end if;

  -- El INSERT se contempla porque toggleCalendarMonthAction hace `upsert`: la
  -- PRIMERA aprobación de un mes es un insert, no un update. Con el trigger
  -- solo en update, justo esa —la que importa— no sellaba nada.
  --
  -- La rama va con TG_OP y no con un `or` en la misma condición porque en un
  -- trigger de INSERT el registro OLD no está asignado y leerle un campo
  -- revienta; PostgreSQL no garantiza cortar la evaluación del `or`.
  if tg_op = 'INSERT' then
    recien_aprobado := true;
  else
    recien_aprobado := old.status is distinct from 'aprobado';
  end if;

  if recien_aprobado then
    select count(*) into new.target
      from public.content_pieces
     where brand_id = new.hero_id
       and calendar_month = new.month;
  end if;

  return new;
end;
$$;

create trigger sellar_meta_del_cronograma
  before insert or update on public.hero_calendar_months
  for each row execute function public.sellar_meta_del_cronograma();
