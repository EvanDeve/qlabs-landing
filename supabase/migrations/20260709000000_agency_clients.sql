-- Q·OS: separa "Heroes" del marketplace UGC·CRC. Hasta ahora Heroes reusaba
-- profiles/brand_profiles/hero_profiles (las mismas tablas de las marcas que
-- publican campañas UGC). Son conceptualmente cosas distintas: un Hero es un
-- cliente actual de la agencia Q Labs para seguimiento interno de
-- pipeline/calendario, sin relación necesaria con el marketplace público.
-- agency_clients es una tabla propia, sin auth.users asociado.

create table public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  contact_email text,
  logo_url text,
  drive_url text,
  objetivo text,
  servicios text[] not null default '{}',
  contacts text,
  risk hero_risk not null default 'onboarding',
  client_since date,
  created_at timestamptz not null default now()
);

alter table public.agency_clients enable row level security;

create policy "agency_clients_all_admin"
  on public.agency_clients for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Migra los Heroes existentes conservando el mismo id que su profile_id de
-- antes, así content_pieces.brand_id / calendar_events.brand_id (que ya
-- apuntan a esos UUIDs) siguen siendo válidos sin tener que reescribirlos.
insert into public.agency_clients (id, name, industry, website, objetivo, servicios, contacts, risk, client_since)
select bp.profile_id, bp.brand_name, bp.industry, bp.website, hp.objetivo, hp.servicios, hp.contacts, hp.risk, hp.client_since
from public.brand_profiles bp
join public.hero_profiles hp on hp.profile_id = bp.profile_id
where hp.is_managed = true;

alter table public.content_pieces drop constraint content_pieces_brand_id_fkey;
alter table public.content_pieces add constraint content_pieces_brand_id_fkey
  foreign key (brand_id) references public.agency_clients (id) on delete cascade;

alter table public.calendar_events drop constraint calendar_events_brand_id_fkey;
alter table public.calendar_events add constraint calendar_events_brand_id_fkey
  foreign key (brand_id) references public.agency_clients (id) on delete set null;

drop table public.hero_profiles;

-- Bucket de storage para logos de Hero.
insert into storage.buckets (id, name, public)
values ('hero-logos', 'hero-logos', true)
on conflict (id) do nothing;

create policy "hero_logos_bucket_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'hero-logos');

create policy "hero_logos_bucket_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'hero-logos' and public.current_app_role() = 'admin');

create policy "hero_logos_bucket_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'hero-logos' and public.current_app_role() = 'admin');
