-- Tercera pestaña del pipeline: IT.
--
-- El carril de trabajo técnico (la plataforma, el sitio) no encajaba en Videos
-- ni en Guiones y se mezclaba con el contenido de los Heroes.
--
-- `section` es un check y no un enum a propósito (ver 20260803100000): con
-- texto libre, un "IT " mal tipeado abriría una pestaña fantasma que solo
-- aparece cuando alguien ya perdió una tarjeta adentro. Agregar una sección es
-- exactamente esto —un valor más en el check— más una entrada en
-- SECCIONES_PIPELINE. No hay ningún otro lugar que las enumere.

alter table public.content_columns
  drop constraint content_columns_section_check;

alter table public.content_columns
  add constraint content_columns_section_check
  check (section in ('guion', 'video', 'it'));

comment on column public.content_columns.section is
  'Pestaña del pipeline a la que pertenece la columna: video, guion o it. '
  'Solo la usa el tablero para repartir columnas entre pestañas; los conteos '
  'por Hero (publicados del mes, atrasadas, carga) NO miran la sección, así '
  'que una pieza de IT cuenta igual que una de video salvo que su columna '
  'esté marcada is_done y la pieza no tenga publish_date.';
