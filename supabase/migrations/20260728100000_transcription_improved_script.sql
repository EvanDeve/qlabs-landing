-- Guion mejorado a partir de la transcripción.
--
-- Se guarda en la misma fila y no en una tabla aparte porque no tiene vida
-- propia: es una derivación de esa transcripción, muere con ella y nunca se
-- consulta sin ella. Una tabla 1-a-1 solo agregaría un join.
--
-- Se guarda —en vez de tenerlo solo en pantalla— por costo: generarlo es una
-- llamada al modelo, y sin persistirlo el creador la vuelve a pagar cada vez
-- que abre una transcripción vieja. Además el creador puede editarlo a mano,
-- y ese trabajo no se puede perder al cerrar la pestaña.
--
-- No hacen falta policies nuevas: `creator_transcriptions_own` es `for all`
-- sobre `creator_id = auth.uid()`, así que ya cubre el update.

alter table public.creator_transcriptions
  add column if not exists improved_script text,
  add column if not exists improved_script_at timestamptz;

comment on column public.creator_transcriptions.improved_script is
  'Guion mejorado que devolvió el modelo, ya editable por el creador. Null mientras no lo haya pedido: se genera solo al apretar el botón, nunca junto con la transcripción.';

comment on column public.creator_transcriptions.improved_script_at is
  'Cuándo se generó o se guardó por última vez. Sirve para mostrarle al creador si lo que está viendo es de antes de que editara la transcripción.';
