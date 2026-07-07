-- Fase 2, épica 2.2: perfil rico del creador (skills, servicios/add-ons,
-- métricas de alcance manuales, marcas anteriores)

alter table public.creator_profiles
  add column avg_views int,
  add column engagement_rate numeric(5, 2),
  add column avg_reach int;

create table public.creator_skills (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  level smallint not null check (level between 1 and 5),
  position int not null default 0
);

create table public.creator_services (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  service text not null,
  unique (creator_id, service)
);

create table public.creator_addons (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  addon text not null,
  unique (creator_id, addon)
);

create table public.creator_past_brands (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  brand_name text not null,
  position int not null default 0
);

create index creator_skills_creator_id_idx on public.creator_skills (creator_id, position);
create index creator_services_creator_id_idx on public.creator_services (creator_id);
create index creator_addons_creator_id_idx on public.creator_addons (creator_id);
create index creator_past_brands_creator_id_idx on public.creator_past_brands (creator_id, position);

alter table public.creator_skills enable row level security;
alter table public.creator_services enable row level security;
alter table public.creator_addons enable row level security;
alter table public.creator_past_brands enable row level security;

-- select: visible para cualquier usuario autenticado, igual que creator_profiles
-- (una marca necesita ver el perfil rico de un creador que aplicó a su campaña)
create policy "creator_skills_select_authenticated"
  on public.creator_skills for select to authenticated using (true);
create policy "creator_services_select_authenticated"
  on public.creator_services for select to authenticated using (true);
create policy "creator_addons_select_authenticated"
  on public.creator_addons for select to authenticated using (true);
create policy "creator_past_brands_select_authenticated"
  on public.creator_past_brands for select to authenticated using (true);

-- insert/update/delete: solo el dueño
create policy "creator_skills_insert_own"
  on public.creator_skills for insert to authenticated with check (creator_id = auth.uid());
create policy "creator_skills_update_own"
  on public.creator_skills for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "creator_skills_delete_own"
  on public.creator_skills for delete to authenticated using (creator_id = auth.uid());

create policy "creator_services_insert_own"
  on public.creator_services for insert to authenticated with check (creator_id = auth.uid());
create policy "creator_services_delete_own"
  on public.creator_services for delete to authenticated using (creator_id = auth.uid());

create policy "creator_addons_insert_own"
  on public.creator_addons for insert to authenticated with check (creator_id = auth.uid());
create policy "creator_addons_delete_own"
  on public.creator_addons for delete to authenticated using (creator_id = auth.uid());

create policy "creator_past_brands_insert_own"
  on public.creator_past_brands for insert to authenticated with check (creator_id = auth.uid());
create policy "creator_past_brands_update_own"
  on public.creator_past_brands for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "creator_past_brands_delete_own"
  on public.creator_past_brands for delete to authenticated using (creator_id = auth.uid());
