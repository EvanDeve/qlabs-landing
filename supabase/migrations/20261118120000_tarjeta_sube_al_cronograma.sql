-- =================================================================
-- Lo que se edita en la tarjeta sube al video del cronograma
-- =================================================================
-- Bajar ya bajaba: guardarVideoAction copia la fila a su tarjeta desde el
-- 2026-08-13. Subir no existía, y el equipo reprograma en la tarjeta (la
-- ficha del Pipeline, y McLovin cuando le piden mover una fecha). Medido en
-- prod el 2026-11-18: 81 de 237 videos con tarjeta tenían otra fecha, hora,
-- título, plataforma o guion en el cronograma, y en los 81 la tarjeta era lo
-- más nuevo. El Hero y quien graba seguían viendo la fecha vieja.
--
-- Va en la base y no en la acción para cubrir todas las puertas que escriben
-- una tarjeta: la ficha, McLovin y las que vengan.
--
-- - Suben los mismos campos que bajan: título, fecha, hora, plataforma y los
--   cuatro del guion. Los apuntes NO, igual que al bajar (son dos campos a
--   propósito, ver src/lib/ugc/apuntes.ts).
-- - security definer: UGC puede editar tarjetas por board pero no pasa
--   es_equipo_agencia(), la policy de los videos (mismo caso que el trigger
--   de borrado de 20261106120000). Solo toca la fila ligada a ESA tarjeta.
-- - Sin bucle: al bajar, la acción deja la tarjeta igual a la fila, así que
--   acá no hay nada distinto que copiar y el update no toca ninguna fila.
--   La tabla de videos no tiene trigger que escriba tarjetas.
-- - Un título vacío no existe en la tarjeta (NOT NULL), así que siempre sube.

create function public.subir_tarjeta_al_cronograma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.calendar_month_items i
     set title             = new.title,
         publish_date      = new.publish_date,
         publish_time      = new.publish_time,
         platform          = new.platform,
         script_hook       = new.script_hook,
         script_idea       = new.script_idea,
         script_desarrollo = new.script_desarrollo,
         script_cta        = new.script_cta
   where i.piece_id = new.id
     and (i.title, i.publish_date, i.publish_time, i.platform,
          i.script_hook, i.script_idea, i.script_desarrollo, i.script_cta)
         is distinct from
         (new.title, new.publish_date, new.publish_time, new.platform,
          new.script_hook, new.script_idea, new.script_desarrollo, new.script_cta);
  return null;
end;
$$;

revoke execute on function public.subir_tarjeta_al_cronograma() from public, anon, authenticated;

create trigger subir_tarjeta_al_cronograma
  after update of title, publish_date, publish_time, platform,
                  script_hook, script_idea, script_desarrollo, script_cta
  on public.content_pieces
  for each row
  when ((old.title, old.publish_date, old.publish_time, old.platform,
         old.script_hook, old.script_idea, old.script_desarrollo, old.script_cta)
        is distinct from
        (new.title, new.publish_date, new.publish_time, new.platform,
         new.script_hook, new.script_idea, new.script_desarrollo, new.script_cta))
  execute function public.subir_tarjeta_al_cronograma();

-- ---------------------------------------------------------------
-- Corrección de lo que ya se separó: gana la tarjeta (en los 81 casos
-- medidos era lo más nuevo).
-- ---------------------------------------------------------------
update public.calendar_month_items i
   set title             = p.title,
       publish_date      = p.publish_date,
       publish_time      = p.publish_time,
       platform          = p.platform,
       script_hook       = p.script_hook,
       script_idea       = p.script_idea,
       script_desarrollo = p.script_desarrollo,
       script_cta        = p.script_cta
  from public.content_pieces p
 where i.piece_id = p.id
   and (i.title, i.publish_date, i.publish_time, i.platform,
        i.script_hook, i.script_idea, i.script_desarrollo, i.script_cta)
       is distinct from
       (p.title, p.publish_date, p.publish_time, p.platform,
        p.script_hook, p.script_idea, p.script_desarrollo, p.script_cta);
