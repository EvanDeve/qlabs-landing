-- El carril de Guiones pasa a ser el de Cronogramas.
--
-- No es un cambio de nombre cosmético: es el carril que ya funcionaba así. El
-- equipo tenía una sola tarjeta por Hero y por mes (`GUION-AGOSTO`), que no era
-- un guion suelto sino el estado del cronograma mensual — escribiéndose en la
-- primera columna, listo en la segunda. Ahora esa tarjeta la crea el sistema y
-- el nombre dice lo que la cosa siempre fue.
--
-- El id de la sección sigue siendo 'guion': está en el check de content_columns
-- (migraciones 20260803100000 y 20260807100000) y en las URLs que el equipo
-- tiene guardadas. Renombrarlo obligaría a tocar el check, migrar las filas y
-- romper los links, todo para cambiar una palabra que nadie ve.

update public.content_columns
   set name = 'Cronogramas'
 where section = 'guion' and name = 'Guiones';

update public.content_columns
   set name = 'Cronogramas aprobados'
 where section = 'guion' and name = 'Guiones finalizados';

-- ---------------------------------------------------------------
-- Quién aprobó, y cuándo miró el Hero
-- ---------------------------------------------------------------
-- `status` ya dice si está aprobado, pero no si lo aprobó el cliente desde su
-- link o alguien del equipo a mano desde Q·OS. Importa: "el cliente aprobó" es
-- un compromiso suyo, y "lo dimos por aprobado" es una decisión nuestra. Con
-- una sola bandera, a fin de mes no hay forma de distinguirlas.
create type calendar_approved_by as enum ('cliente', 'equipo');

alter table public.hero_calendar_months
  add column approved_by calendar_approved_by,
  -- Cuándo el Hero abrió el link por última vez. Sirve para lo más aburrido y
  -- más útil: saber si no contesta porque no le importa o porque nunca lo vio.
  add column client_seen_at timestamptz;
