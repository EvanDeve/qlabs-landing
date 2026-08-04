-- El tablero se parte en secciones.
--
-- Hoy las siete columnas van todas en la misma fila horizontal, pero no se
-- usan al mismo tiempo: "Guiones" y "Guiones finalizados" son la tanda de
-- principio de mes y el resto del mes están quietas ocupando la mitad del
-- ancho útil. El equipo vive en las cinco de video.
--
-- La sección NO reemplaza a `position`: adentro de cada sección las columnas
-- siguen ordenándose por posición, y el orden global se conserva para cuando
-- se mira "Todo". Es un filtro, no una jerarquía nueva.
--
-- ⚠️ El check es a propósito y no un texto libre. El equipo crea columnas desde
-- la UI, y con texto libre un "Guión"/"guion"/"Guiones" de más abriría una
-- pestaña fantasma con una sola columna adentro y nadie entendería por qué.
-- Sumar una sección tercera es agregar el valor acá y una etiqueta en
-- src/lib/ugc/content-columns.ts.

begin;

alter table public.content_columns
  add column section text not null default 'video';

alter table public.content_columns
  add constraint content_columns_section_check
  check (section in ('guion', 'video'));

comment on column public.content_columns.section is
  'Pestaña del tablero donde vive la columna. El equipo trabaja en "video" casi todo el mes; "guion" es la tanda de principio de mes.';

-- Se mapea por nombre porque es el único dato estable que dejó la migración
-- 20260802320000, que fue la que creó estas dos. Del resto del tablero no hace
-- falta decir nada: el default ya las deja en 'video'.
--
-- Si alguien las renombró antes de correr esto, quedan en 'video' y se
-- arreglan desde el modal de columna — no se pierde nada.
update public.content_columns
set section = 'guion'
where name in ('Guiones', 'Guiones finalizados');

commit;
