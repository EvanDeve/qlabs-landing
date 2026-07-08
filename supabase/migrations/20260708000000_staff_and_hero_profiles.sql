-- Fase 2, épica 2.1: Q·OS — módulo interno de operaciones
-- staff_members (equipo de Q Labs) + hero_profiles (datos de operación de un
-- negocio gestionado por Q Labs). "Hero" sigue siendo la misma fila de
-- profiles/brand_profiles del marketplace — no se duplica la entidad negocio.

create type staff_role as enum (
  'director', 'pm', 'estratega', 'guionista', 'productor', 'editor', 'qa', 'community', 'ventas'
);

create type hero_risk as enum ('onboarding', 'ok', 'warn', 'risk');

create table public.staff_members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  staff_role staff_role not null,
  color text not null default '#705CF6',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.hero_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  is_managed boolean not null default false,
  objetivo text,
  servicios text[] not null default '{}',
  contacts text,
  risk hero_risk not null default 'onboarding',
  client_since date,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
alter table public.hero_profiles enable row level security;

-- Q·OS es admin-only: ni marcas ni creadores ven estas tablas.

create policy "staff_members_all_admin"
  on public.staff_members for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy "hero_profiles_all_admin"
  on public.hero_profiles for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
