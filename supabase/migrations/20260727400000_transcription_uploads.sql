-- Subida de archivos para transcribir, y borrado de transcripciones.
--
-- Por qué el archivo va a Storage y no directo al servidor: en Vercel las
-- funciones tienen un tope de body de ~4.5 MB, así que mandar un video por un
-- Server Action o una ruta de API no funciona en producción por más que ande
-- en local. El navegador sube DIRECTO a Supabase Storage —sin pasar por
-- Vercel— y al servidor solo le llega la ruta del archivo.
--
-- Esto además es lo que habilita Instagram y TikTok: esas plataformas bloquean
-- el acceso desde afuera y Gemini no puede leer sus URLs. La única vía es que
-- el creador descargue el video y lo suba.

-- source_url deja de ser obligatorio: una transcripción de archivo subido no
-- tiene URL de origen. Se guarda el nombre del archivo aparte, para poder
-- mostrarlo en la lista sin inventar una URL falsa.
alter table public.creator_transcriptions
  alter column source_url drop not null,
  add column if not exists file_name text;

-- ---------------------------------------------------------------
-- Bucket `transcription-uploads` (creado aparte por la API de Storage)
-- ---------------------------------------------------------------
-- Privado y con tope de 20 MB. El archivo es material intermedio: se borra
-- apenas termina la transcripción, porque lo que vale es el texto y guardar
-- videos es justo lo que llena el almacenamiento gratis más rápido.
--
-- Las policies van sobre storage.objects. Cada creador solo toca su propia
-- carpeta, que lleva su uuid: `<creator_id>/<archivo>`.

drop policy if exists "transcription_uploads_insert_own" on storage.objects;
create policy "transcription_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transcription-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "transcription_uploads_select_own" on storage.objects;
create policy "transcription_uploads_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transcription-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "transcription_uploads_delete_own" on storage.objects;
create policy "transcription_uploads_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'transcription-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
