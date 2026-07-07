-- Fase 2, épica 2.6: entrega in-app (reemplaza el "marcar como entregado"
-- a ciegas de la épica 2.3 por una pieza real subida o linkeada)

create table public.application_deliveries (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  storage_path text,
  external_url text,
  note text,
  created_at timestamptz not null default now(),
  constraint application_deliveries_kind_payload check (
    (kind = 'file' and storage_path is not null and external_url is null)
    or (kind = 'link' and external_url is not null and storage_path is null)
  )
);

create index application_deliveries_application_idx on public.application_deliveries (application_id);

alter table public.application_deliveries enable row level security;

-- select: el creador dueño, la marca dueña de la campaña, o admin
create policy "application_deliveries_select"
  on public.application_deliveries for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.id = application_deliveries.application_id and c.brand_id = auth.uid()
    )
    or public.current_app_role() = 'admin'
  );

-- insert: el creador dueño de una aplicación aceptada o ya entregada (permite
-- subir más de una pieza / corregir antes de que la marca apruebe)
create policy "application_deliveries_insert_own"
  on public.application_deliveries for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_deliveries.application_id
        and a.creator_id = auth.uid()
        and a.status in ('accepted', 'delivered')
    )
  );

-- ---------- storage: bucket "deliveries" (privado) ----------
-- a diferencia de "portfolio", esto no es público: la marca no debe poder
-- ver la pieza final antes de aprobarla/pagarla. Acceso vía signed URLs
-- generadas server-side, que Supabase Storage sigue evaluando contra RLS.

insert into storage.buckets (id, name, public)
values ('deliveries', 'deliveries', false)
on conflict (id) do nothing;

create policy "deliveries_bucket_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'deliveries'
    and (
      exists (
        select 1 from public.applications a
        where a.id::text = (storage.foldername(name))[1] and a.creator_id = auth.uid()
      )
      or exists (
        select 1 from public.applications a
        join public.campaigns c on c.id = a.campaign_id
        where a.id::text = (storage.foldername(name))[1] and c.brand_id = auth.uid()
      )
      or public.current_app_role() = 'admin'
    )
  );

create policy "deliveries_bucket_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'deliveries'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.creator_id = auth.uid()
        and a.status in ('accepted', 'delivered')
    )
  );
