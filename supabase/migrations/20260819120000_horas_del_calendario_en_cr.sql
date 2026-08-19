-- Endereza las horas que el formulario del calendario guardó seis horas antes.
--
-- La causa está arreglada en el código (`instanteCR`, src/lib/ugc/calendar.ts):
-- el `<input type="datetime-local">` manda un string SIN zona
-- ('2026-08-26T08:00') y la server action lo leía con `new Date()`, que lo
-- interpreta en la zona del PROCESO. En la Mac del equipo —Costa Rica— daba
-- bien; en Vercel, que corre en UTC, las 8 de la mañana se guardaban como
-- 08:00Z, o sea las 2 de la madrugada en CR.
--
-- El equipo lo reportó como "se borran los horarios": la grilla de la semana
-- dibuja de 8 a 20 (HORA_INICIO/HORA_FIN), así que una grabación que quedó a
-- las 02:00 se caía a la banda "Sin hora" y la hora parecía haberse perdido.
--
-- ⚠️ Arreglar el código NO arregla estas filas: ya están guardadas mal. Son las
-- 8 que se crearon desde el formulario. Quedan afuera a propósito:
--   - las 7 que insertó 20260802320000, que ya usaban `at time zone`;
--   - la de McLovin (created_by_agent), que siempre usó fromZonedTime.
-- Mezclarlas les correría la hora a filas que hoy están bien.
--
-- Los valores van ABSOLUTOS y no como `starts_at + interval '6 hours'`: si esto
-- llegara a correrse dos veces, un update relativo dejaría los eventos doce
-- horas adelante y el error sería peor que el original. Escrito así, la segunda
-- corrida no cambia nada.
--
-- Cada fila recupera la hora que la persona efectivamente tipeó (+6h la lleva
-- de "leída como UTC" a "leída como CR"). Los ids van explícitos para que se
-- pueda auditar una por una contra lo que el equipo recuerda haber puesto.

begin;

update public.calendar_events e
set starts_at = c.correcto
from (values
    ('5f4acaf5-160b-416c-a1fd-7e500ed5d640'::uuid, timestamptz '2026-07-28 18:00:00+00'),  -- Entrecote: 28/07 06:00 -> 28/07 12:00 CR
    ('45e1723c-0c82-4bf9-be54-3d18346d2bf8'::uuid, timestamptz '2026-07-29 15:00:00+00'),  -- Dulce Chilena: 29/07 03:00 -> 29/07 09:00 CR
    ('6f92bf9e-c2f7-4178-a756-7f4fb07ed522'::uuid, timestamptz '2026-07-29 15:00:00+00'),  -- Zonna: 29/07 03:00 -> 29/07 09:00 CR
    ('e7e6a35b-1bd2-4558-bda2-f03c6a181339'::uuid, timestamptz '2026-08-21 15:00:00+00'),  -- GRABACION-AGOSTO: 21/08 03:00 -> 21/08 09:00 CR
    ('8d9adb92-678c-4d57-97d0-a8562f5458b0'::uuid, timestamptz '2026-08-05 20:00:00+00'),  -- GRABACION-SEPTIEMBRE: 05/08 08:00 -> 05/08 14:00 CR
    ('ce505775-9195-41e5-a6e4-c97fc8b53f22'::uuid, timestamptz '2026-08-26 14:00:00+00')   -- GRABACION: 26/08 02:00 -> 26/08 08:00 CR
) as c(id, correcto)
where e.id = c.id;

-- ---------------------------------------------------------------
-- ⚠️ Al día de hoy (2026-08-19, más tarde) esta migración ya no cambia nada
-- ---------------------------------------------------------------
-- El push del arreglo disparó el deploy y el equipo corrigió los eventos a mano
-- desde la app antes de que esto llegara a correrse. Las filas de abajo YA
-- tienen el valor que este update les pondría, así que aplicarla es un no-op.
-- Se deja igual: son los valores correctos y escritos absolutos, de modo que
-- correrla confirma el estado en vez de moverlo.
--
-- Se le SACÓ una fila que sí habría hecho daño: la GRABACION del 24/08
-- (ec8c4323). La migración la habría puesto a las 21:01 —la hora que se tipeó
-- originalmente— pero el equipo la reprogramó a las 13:00 después de revisarla.
-- Correr la versión vieja le habría pisado esa decisión con un dato viejo.
--
-- Y una que ya no existe: la GRABACION del 26/08 (cb0c4803) se borró y se
-- recreó. El update no encontraba fila y no hacía nada, pero se saca para que
-- el archivo no mienta sobre qué toca.

commit;
