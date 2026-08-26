-- Los tres datos que el mockup de Transcripción muestra y la tabla no tenía.
--
-- `title` YA EXISTÍA desde la primera migración y nunca se llenó: la lista
-- mostraba el nombre del archivo o `youtube · <id>`. No se agrega, se empieza
-- a usar — el título corto lo propone el mismo modelo que transcribe, en la
-- misma llamada, así que no cuesta nada extra.
--
-- Las dos nuevas van nullable a propósito, y cada una por su motivo:
--
--   `duration_seconds` — la lee el NAVEGADOR del `<video>` antes de subir el
--   archivo (el mismo truco con el que el book detecta si la pieza es
--   horizontal). En un link de YouTube no hay de dónde sacarla sin pegarle a
--   otra API, así que ahí queda en null y el chip de duración no se dibuja.
--   Preferible un chip que falta a un número inventado.
--
--   `language` — código ISO 639-1 que devuelve el modelo. Importa porque la
--   transcripción respeta el idioma original del audio: un creador que graba
--   en inglés para un hotel necesita ver que el texto salió en inglés y no
--   creer que se rompió.

alter table public.creator_transcriptions
  add column if not exists duration_seconds integer,
  add column if not exists language text;

comment on column public.creator_transcriptions.title is
  'Título corto que propone el modelo al transcribir, editable por el creador desde el menú del detalle. Null en las filas viejas y en las que fallaron: ahí la lista cae al nombre del archivo o al host del link.';

comment on column public.creator_transcriptions.duration_seconds is
  'Duración del material, medida en el navegador antes de subir. Null en las transcripciones que vinieron de un link: no se infiere del último timestamp, que es el ARRANQUE del último segmento y siempre queda corto.';

comment on column public.creator_transcriptions.language is
  'Código ISO 639-1 del idioma hablado, según el modelo. Null en las filas anteriores a esta migración.';
