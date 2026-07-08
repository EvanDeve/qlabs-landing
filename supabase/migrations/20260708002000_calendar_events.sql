-- Fase 2, épica 2.1: Q·OS — eventos de calendario autónomos (reuniones,
-- entregas, jornadas de grabación). Los eventos de Publicación/Grabación que
-- se derivan de content_pieces.publish_date/record_date NO se materializan
-- acá — la vista de calendario los combina en la query (evita triggers de
-- sincronización y datos que se desactualizan si se edita la fecha).

create type calendar_event_type as enum ('publicacion', 'grabacion', 'reunion', 'entrega');
create type calendar_event_status as enum ('programado', 'hecho', 'pausado');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  type calendar_event_type not null,
  brand_id uuid references public.profiles (id) on delete set null,
  content_piece_id uuid references public.content_pieces (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  responsible_id uuid references public.staff_members (profile_id) on delete set null,
  status calendar_event_status not null default 'programado',
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

create policy "calendar_events_all_admin"
  on public.calendar_events for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
