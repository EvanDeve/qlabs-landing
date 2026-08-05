-- Voiceovers: guion (texto) → audio, con ElevenLabs.
--
-- Es el espejo de `creator_transcriptions`. Aquella convierte video → texto y
-- después genera el guion mejorado; ésta cierra el círculo convirtiendo ese
-- guion en voz sin salir de Q·OS. Hasta ahora ese último paso obligaba a
-- copiar el texto, pegarlo en otra herramienta y volver con un mp3 a mano.
--
-- Por qué el audio SÍ se guarda —a diferencia del video de la transcripción,
-- que se borra apenas termina—: generarlo cuesta créditos de ElevenLabs, así
-- que perder el mp3 al cerrar la pestaña significa pagarlo dos veces. Pero se
-- guarda CON vencimiento: el 1 GB de Storage es el primer techo del proyecto y
-- un histórico eterno de audio es la forma más rápida de llenarlo.

create table public.voiceovers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,

  -- El texto exacto que se locutó. Se guarda para poder regenerarlo con otra
  -- voz sin salir a buscarlo, y para saber después qué fue lo que se cobró.
  text text not null,

  -- El nombre de la voz se copia acá en vez de resolverse contra la API cada
  -- vez que se abre el historial: las voces de la cuenta se renombran y se
  -- borran, y una lista que dice "voz desconocida" no le sirve a nadie.
  voice_id text not null,
  voice_name text not null,
  model_id text not null default 'eleven_multilingual_v2',

  -- Créditos consumidos ≈ caracteres (la mitad con los modelos Flash). Es la
  -- única forma de ver el gasto sin entrar al panel de ElevenLabs.
  char_count integer not null,

  -- De dónde salió el texto, cuando vino de un guion mejorado. `set null` y no
  -- `cascade`: borrar la transcripción no tiene por qué borrar el audio, que
  -- ya se pagó y puede estar en uso en una pieza.
  source_transcription_id uuid references public.creator_transcriptions (id) on delete set null,

  storage_path text,
  bytes integer,

  status text not null default 'processing'
    check (status in ('processing', 'done', 'error')),
  error_message text,

  created_at timestamptz not null default now(),

  -- Explícito en la fila y no calculado al vuelo: así la limpieza diaria es un
  -- `where expires_at < now()` y la pantalla puede decir "se borra en X días"
  -- sin que la regla de los 30 días viva duplicada en dos lados.
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index voiceovers_owner_idx
  on public.voiceovers (owner_id, created_at desc);

-- La limpieza barre por vencimiento sobre toda la tabla, sin filtrar por dueño.
-- El índice parcial deja afuera las filas que ya no tienen archivo que borrar.
create index voiceovers_expires_idx
  on public.voiceovers (expires_at)
  where storage_path is not null;

alter table public.voiceovers enable row level security;

-- Mismo criterio que `creator_transcriptions_own`: es material de trabajo
-- privado de cada cuenta, no una transacción del marketplace.
--
-- Que la herramienta sea SOLO del equipo no se resuelve acá sino en el layout
-- y en la ruta (`profiles.role = 'admin'`). La RLS protege el dato de ojos
-- ajenos; quién ve el menú es otra decisión, y mezclarlas haría que abrirle la
-- herramienta a los creadores algún día requiera tocar la seguridad.
create policy "voiceovers_own"
  on public.voiceovers for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

comment on column public.voiceovers.expires_at is
  'Cuándo lo borra el barrido diario. Por defecto 30 días: el audio se guarda para no pagar dos veces la misma generación, no para archivarlo.';

comment on column public.voiceovers.char_count is
  'Caracteres facturados a ElevenLabs. Con los modelos Flash el costo real en créditos es la mitad de este número.';

-- ---------------------------------------------------------------
-- Bucket `voiceovers` (creado aparte, por el dashboard de Storage)
-- ---------------------------------------------------------------
-- ⚠️ Crear el bucket NO es parte del SQL: hay que hacerlo en el dashboard de
-- Supabase —privado, tope 10 MB, mime permitido `audio/mpeg`— igual que se
-- hizo con `transcription-uploads`. Acá solo van sus policies.
--
-- La ruta es `<owner_id>/<uuid>.mp3`. El archivo lo sube el servidor con la
-- sesión del usuario (no con service-role), así que estas policies son las que
-- gobiernan de verdad quién escribe dónde.

drop policy if exists "voiceovers_insert_own" on storage.objects;
create policy "voiceovers_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voiceovers_select_own" on storage.objects;
create policy "voiceovers_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voiceovers_delete_own" on storage.objects;
create policy "voiceovers_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
