-- El link del que graba: un segundo token por cronograma.
--
-- El link del Hero (`share_token`) existe para aprobar el mes; el de grabación
-- existe para trabajarlo. Son dos lecturas distintas del mismo cronograma y
-- por eso llevan token propio en vez de compartir uno:
--
--   * Se le puede mandar a un camarógrafo externo sin darle de paso la
--     pantalla donde se aprueba el mes en nombre del cliente.
--   * Si hay que rotar uno de los dos, el otro no se cae.
--
-- `not null default gen_random_uuid()` le genera token también a los
-- cronogramas que ya existen: desde Postgres 11 un default volátil en un
-- `add column` se evalúa fila por fila en vez de rellenar todo con el mismo
-- valor, que acá además chocaría contra el índice único.

alter table public.hero_calendar_months
  add column crew_token uuid not null default gen_random_uuid();

create unique index hero_calendar_months_crew_token_idx
  on public.hero_calendar_months (crew_token);

comment on column public.hero_calendar_months.crew_token is
  'Credencial del link /grabacion/[token], el que se le manda a quien graba. Solo lectura: ve el guion y los apuntes, no puede comentar ni aprobar. Distinto de share_token, que es el del Hero.';
