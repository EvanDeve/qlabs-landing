-- YouTube como plataforma de los videos de Q·OS.
--
-- El detalle de una pieza, el modal de crear y la fila del cronograma ofrecían
-- Instagram, TikTok y Reels porque el enum nació con esas tres (ver
-- 20260708001000). El equipo ya produce videos para YouTube y no tenía dónde
-- marcarlo: quedaban guardados como "instagram" y el cronograma del Hero los
-- mostraba mal.
--
-- Aditivo, como 20260825170000: no se renombra ni se borra nada, las piezas y
-- los `content_items` que ya existen siguen igual. Las listas de opciones
-- (los selects de Q·OS, `PLATAFORMAS` en agente.ts, `PLATFORMS` en
-- creator-task.ts) son constantes propias: ninguna muestra el valor nuevo hasta
-- que se le agregue a mano.

alter type public.content_platform add value if not exists 'youtube';
