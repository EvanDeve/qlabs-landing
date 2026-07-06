-- Fase 1: campaigns + vista pública de preview + RLS

create type campaign_status as enum ('draft', 'published', 'in_progress', 'completed', 'cancelled');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  brief text not null,
  budget_amount numeric not null,
  budget_currency text not null default 'CRC',
  deliverables jsonb not null default '[]',
  target_audience text,
  deadline_days int,
  status campaign_status not null default 'draft',
  min_tier text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index campaigns_status_published_idx on public.campaigns (status, published_at desc);
create index campaigns_brand_idx on public.campaigns (brand_id);

alter table public.campaigns enable row level security;

-- ---------- RLS: campaigns ----------
-- anon has no policy at all on this table — full brief/budget never reach anon.

create policy "campaigns_select_brand_owner"
  on public.campaigns for select
  to authenticated
  using (brand_id = auth.uid());

create policy "campaigns_select_published_creators"
  on public.campaigns for select
  to authenticated
  using (status = 'published' and public.current_app_role() in ('creator', 'admin'));

create policy "campaigns_insert_own_brand"
  on public.campaigns for insert
  to authenticated
  with check (brand_id = auth.uid() and public.current_app_role() = 'brand');

create policy "campaigns_update_own_brand_or_admin"
  on public.campaigns for update
  to authenticated
  using (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  )
  with check (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  );

create policy "campaigns_delete_own_brand"
  on public.campaigns for delete
  to authenticated
  using (brand_id = auth.uid() and public.current_app_role() = 'brand');

-- ---------- public preview ----------
-- security-definer view: only marca, título, formato, categoría — never budget/brief.
-- the blur/lock overlay in the UI is visual only; this is the real data boundary.

create view public.campaign_previews
with (security_invoker = false) as
select
  c.id,
  c.title,
  b.brand_name,
  b.industry,
  (
    select array_agg(d ->> 'type')
    from jsonb_array_elements(c.deliverables) d
  ) as deliverable_types,
  c.published_at
from public.campaigns c
join public.brand_profiles b on b.profile_id = c.brand_id
where c.status = 'published';

grant select on public.campaign_previews to anon, authenticated;
