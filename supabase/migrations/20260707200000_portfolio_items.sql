-- Fase 2, épica 2.1: book/portfolio del creador

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  category text not null default 'ugc',
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index portfolio_items_creator_id_idx on public.portfolio_items (creator_id, position);

alter table public.portfolio_items enable row level security;

-- las marcas necesitan ver el book al revisar aplicantes, igual que creator_profiles
create policy "portfolio_items_select_authenticated"
  on public.portfolio_items for select
  to authenticated
  using (true);

create policy "portfolio_items_insert_own"
  on public.portfolio_items for insert
  to authenticated
  with check (creator_id = auth.uid());

create policy "portfolio_items_update_own"
  on public.portfolio_items for update
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "portfolio_items_delete_own"
  on public.portfolio_items for delete
  to authenticated
  using (creator_id = auth.uid());

-- el bucket "portfolio" y sus policies de storage.objects viven en
-- 20260707200100_portfolio_bucket.sql (corrida por separado)
