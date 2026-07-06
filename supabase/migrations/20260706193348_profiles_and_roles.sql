-- Fase 1: roles, profiles, creator_profiles, brand_profiles + RLS

create type app_role as enum ('creator', 'brand', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role app_role,
  display_name text,
  avatar_url text,
  city text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.creator_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  handle text not null unique,
  followers_count int not null default 0,
  niches text[] not null default '{}',
  languages text[] not null default '{es}',
  instagram_handle text,
  tiktok_handle text,
  rate_min int,
  rate_max int,
  verified boolean not null default false
);

create table public.brand_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  brand_name text not null,
  industry text,
  website text,
  instagram_handle text,
  description text
);

alter table public.profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.brand_profiles enable row level security;

-- ---------- helpers ----------

-- security definer avoids RLS recursion when policies below call this
create function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- creates the profile row for every new auth.users signup (email or OAuth)
-- role comes from raw_user_meta_data on email signup; stays null for OAuth
-- until the onboarding flow (epic 1.2) sets it once
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'role', '')::app_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role is set once by onboarding; only admin may change it afterwards
create function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and old.role is not null
     and public.current_app_role() <> 'admin' then
    raise exception 'no podés cambiar tu rol una vez asignado';
  end if;
  return new;
end;
$$;

create trigger protect_profiles_role
  before update on public.profiles
  for each row execute function public.protect_role_change();

-- only admin may flip verified on a creator profile
create function public.protect_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified is distinct from old.verified
     and public.current_app_role() <> 'admin' then
    raise exception 'solo admin puede cambiar verified';
  end if;
  return new;
end;
$$;

create trigger protect_creator_verified
  before update on public.creator_profiles
  for each row execute function public.protect_verified();

-- ---------- RLS: profiles ----------

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin');

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin')
  with check (id = auth.uid() or public.current_app_role() = 'admin');

-- ---------- RLS: creator_profiles ----------

-- brands need to view applicant profiles; nothing sensitive lives here
create policy "creator_profiles_select_authenticated"
  on public.creator_profiles for select
  to authenticated
  using (true);

create policy "creator_profiles_insert_own"
  on public.creator_profiles for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "creator_profiles_update_own_or_admin"
  on public.creator_profiles for update
  to authenticated
  using (profile_id = auth.uid() or public.current_app_role() = 'admin')
  with check (profile_id = auth.uid() or public.current_app_role() = 'admin');

-- ---------- RLS: brand_profiles ----------

-- brand name/industry appear in public campaign previews
create policy "brand_profiles_select_public"
  on public.brand_profiles for select
  to anon, authenticated
  using (true);

create policy "brand_profiles_insert_own"
  on public.brand_profiles for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "brand_profiles_update_own_or_admin"
  on public.brand_profiles for update
  to authenticated
  using (profile_id = auth.uid() or public.current_app_role() = 'admin')
  with check (profile_id = auth.uid() or public.current_app_role() = 'admin');
