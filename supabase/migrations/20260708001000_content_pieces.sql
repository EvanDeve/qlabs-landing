-- Fase 2, épica 2.1: Q·OS — piezas de contenido ("Videos") y su pipeline de
-- producción (columnas del Kanban). Las etapas son un enum, no una tabla de
-- configuración: mismo patrón que campaign_status/application_status, con
-- labels/SOP/color resueltos en src/lib/ugc/content-stage.ts.

create type content_stage as enum (
  'pendiente', 'estrategia', 'guion', 'aprobacion_guion', 'grabacion',
  'edicion', 'qa', 'revision_cliente', 'programado', 'publicado'
);

create type content_approval as enum ('pendiente', 'correccion', 'revisado');
create type content_priority as enum ('baja', 'media', 'alta');
create type content_platform as enum ('instagram', 'tiktok', 'reels');

create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  code text not null unique,
  stage content_stage not null default 'pendiente',
  approval content_approval not null default 'pendiente',
  owner_id uuid references public.staff_members (profile_id) on delete set null,
  priority content_priority not null default 'media',
  platform content_platform not null default 'instagram',
  publish_date timestamptz,
  record_date timestamptz,
  drive_url text,
  script_url text,
  final_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_pieces enable row level security;

create policy "content_pieces_all_admin"
  on public.content_pieces for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create function public.touch_content_piece_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_content_pieces_updated_at
  before update on public.content_pieces
  for each row execute function public.touch_content_piece_updated_at();
