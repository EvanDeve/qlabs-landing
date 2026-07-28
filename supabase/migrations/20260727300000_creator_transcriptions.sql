-- Transcripción de videos para el creador.
--
-- Portado de q-system-app (la herramienta interna de análisis de contenido),
-- pero SOLO el paso de transcripción: sin reporte de Claude, sin las Skills y
-- sin el "Cerebro de la Agencia" — ese know-how se queda del lado de Q Labs.
--
-- Por qué Gemini y no Whisper: Whisper necesita el archivo de audio, lo que
-- obliga a descargar el video con yt-dlp + ffmpeg. Eso son binarios del sistema
-- que no existen en un entorno serverless. Gemini 2.5 Flash acepta la URL
-- directamente y transcribe desde ahí, así que el flujo entero cabe en una
-- ruta normal de Next.js sin infraestructura extra.

create table public.creator_transcriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  source_url text not null,
  -- Se guarda para poder mostrar de dónde salió y para mensajes de error
  -- específicos (Instagram bloquea el acceso directo, por ejemplo).
  source_type text not null default 'otro',
  title text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  -- [{ timestamp: "0:05", text: "..." }] — mismo formato que q-system-app.
  segments jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index creator_transcriptions_creator_idx
  on public.creator_transcriptions (creator_id, created_at desc);

alter table public.creator_transcriptions enable row level security;

-- Igual que el pipeline de tareas: es material de trabajo privado del creador,
-- no una transacción del marketplace que Q Labs tenga que arbitrar. Sin acceso
-- de admin salvo que algún día se decida explícitamente.
create policy "creator_transcriptions_own"
  on public.creator_transcriptions for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());
