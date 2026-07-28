-- Topes de subida explícitos en los buckets de entrega y book.
--
-- Contexto: hasta ahora los dos archivos subían por un Server Action, así que
-- nunca llegaban a Storage en producción — el body de una función en Vercel
-- corta en ~4.5 MB. Al pasarlos a subida directa desde el navegador (ver
-- `src/lib/ugc/uploads.ts`) el archivo sí llega, y ahí aparece el segundo
-- techo: el del proyecto Supabase.
--
-- Medido contra el proyecto en vivo el 2026-07-28: un archivo de 49 MB entra,
-- uno de 55 MB devuelve 413 "Payload too large". O sea el tope global del plan
-- gratis son 50 MB, y ningún bucket puede pasarse de ahí por más que lo
-- declare. Los 200 MB que prometía el formulario de entrega nunca fueron
-- alcanzables.
--
-- Estas líneas no suben nada: dejan por escrito el límite que ya se aplica, y
-- lo alinean con las constantes de la app (MAX_DELIVERY_FILE_BYTES,
-- MAX_PORTFOLIO_FILE_BYTES). Sin esto el rechazo llega igual pero como error
-- genérico del plan, y el código y la base pueden desincronizarse en silencio.
--
-- Si el proyecto pasa a Supabase Pro, el techo global sube a 50 GB: ahí estos
-- números se pueden mover, en este archivo y en las constantes de la app.

update storage.buckets
  set file_size_limit = 52428800  -- 50 MB, el máximo del plan gratis
  where id = 'deliveries';

update storage.buckets
  set file_size_limit = 26214400  -- 25 MB, lo que ya declaraba la app
  where id = 'portfolio';
