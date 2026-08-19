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
    ('cb0c4803-1fc0-4ded-8c5b-a2839bd8c7a9'::uuid, timestamptz '2026-08-26 12:00:00+00'),  -- GRABACION: 26/08 00:00 -> 26/08 06:00 CR
    ('ec8c4323-bd17-4e19-a3f1-8d749687c13e'::uuid, timestamptz '2026-08-25 03:01:00+00'),  -- GRABACION: 24/08 15:01 -> 24/08 21:01 CR
    ('ce505775-9195-41e5-a6e4-c97fc8b53f22'::uuid, timestamptz '2026-08-26 14:00:00+00')   -- GRABACION: 26/08 02:00 -> 26/08 08:00 CR
) as c(id, correcto)
where e.id = c.id;

commit;
