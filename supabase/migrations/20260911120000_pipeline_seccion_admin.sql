-- Cuarta pestaña del pipeline: Admin.
--
-- El trabajo administrativo de la agencia (facturas, contratos, trámites, lo
-- que no es contenido de un Hero ni técnica de la plataforma) no tenía carril
-- y terminaba mezclado en IT o anotado afuera del tablero.
--
-- Mismo mecanismo que IT (ver 20260807100000): un valor más en el check, y en
-- el código una entrada en SECCIONES_PIPELINE. Lo que IT no tenía era una
-- forma de decir "esta sección es de tareas, no de videos": eran cuatro
-- `section === 'it'` sueltos. Con Admin ya son dos carriles de tareas, así que
-- eso pasó a `esCarrilDeTareas()` en content-columns.ts.

alter table public.content_columns
  drop constraint content_columns_section_check;

alter table public.content_columns
  add constraint content_columns_section_check
  check (section in ('guion', 'video', 'it', 'admin'));

comment on column public.content_columns.section is
  'Pestaña del pipeline a la que pertenece la columna: video, guion, it o admin. '
  'Solo la usa el tablero para repartir columnas entre pestañas; los conteos '
  'por Hero (publicados del mes, atrasadas, carga) NO miran la sección, así '
  'que una pieza de IT o Admin cuenta igual que una de video salvo que su '
  'columna esté marcada is_done y la pieza no tenga publish_date.';

-- IT nació sin columnas y la pestaña abría en blanco con un "creá la primera".
-- Admin arranca con las mismas tres que el equipo terminó creando para IT, con
-- las posiciones a continuación de las de IT (7, 8, 9) para que "Todo" las
-- pinte al final. El trigger de 20260818140000 marca "Terminado" como la que
-- cierra el carril por ser la última; no hay que setear is_done.
--
-- Con guarda: si el equipo ya creó columnas en Admin antes de correr esto (no
-- puede, el check lo impide, pero una segunda corrida sí), no se duplican.
insert into public.content_columns (name, color, position, section)
select v.name, v.color, v.position, 'admin'
from (values
  ('Sin Empezar', '#df4650', 10),
  ('En Progreso', '#c07414', 11),
  ('Terminado',   '#14a06a', 12)
) as v (name, color, position)
where not exists (
  select 1 from public.content_columns where section = 'admin'
);
