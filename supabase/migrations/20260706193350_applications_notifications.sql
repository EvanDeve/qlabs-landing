-- Fase 1: applications + notifications + RLS

create type application_status as enum ('pending', 'reviewing', 'accepted', 'rejected', 'delivered', 'approved');

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  pitch_message text,
  status application_status not null default 'pending',
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index applications_campaign_idx on public.applications (campaign_id);
create index applications_creator_idx on public.applications (creator_id);

create function public.touch_application_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger applications_touch_status_changed_at
  before update on public.applications
  for each row execute function public.touch_application_status_changed_at();

alter table public.applications enable row level security;

-- ---------- RLS: applications ----------

create policy "applications_insert_own_creator"
  on public.applications for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and public.current_app_role() = 'creator'
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.status = 'published'
    )
  );

create policy "applications_select_own_creator"
  on public.applications for select
  to authenticated
  using (creator_id = auth.uid());

create policy "applications_select_brand_owner"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

create policy "applications_select_admin"
  on public.applications for select
  to authenticated
  using (public.current_app_role() = 'admin');

create policy "applications_update_brand_owner_or_admin"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
    or public.current_app_role() = 'admin'
  )
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
    or public.current_app_role() = 'admin'
  );

-- ---------- notifications ----------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, read);

alter table public.notifications enable row level security;

-- no insert policy for users: rows are created by triggers or the
-- service-role client in epic 1.6, never directly by a client session

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (profile_id = auth.uid());

create policy "notifications_update_own_read_flag"
  on public.notifications for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
