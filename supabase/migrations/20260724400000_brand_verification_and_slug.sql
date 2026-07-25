-- Verificación de marcas (bloqueo duro para publicar) + slug para su perfil
-- público. Espeja lo que ya existe del lado del creador: RLS como frontera real,
-- trigger que impide auto-verificarse, y admin como único que puede otorgarla.

-- ---------- slug ----------
-- Sin unaccent (la extensión puede no estar habilitada): translate() cubre los
-- acentos del español, que es lo único que aparece en nombres de negocios acá.
create or replace function public.slugify(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(
        coalesce(txt, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  )
$$;

alter table public.brand_profiles
  add column if not exists verified boolean not null default false,
  add column if not exists slug text;

-- Backfill de las marcas existentes, desambiguando colisiones por nombre.
with numbered as (
  select
    profile_id,
    coalesce(nullif(public.slugify(brand_name), ''), 'marca') as base,
    row_number() over (
      partition by coalesce(nullif(public.slugify(brand_name), ''), 'marca')
      order by profile_id
    ) as rn
  from public.brand_profiles
  where slug is null
)
update public.brand_profiles b
set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn end
from numbered n
where b.profile_id = n.profile_id;

create unique index if not exists brand_profiles_slug_key on public.brand_profiles (slug);

-- El slug se asigna una sola vez y NO se regenera al renombrar el negocio: si
-- cambiara, se romperían los links ya compartidos.
create or replace function public.set_brand_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  i int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := coalesce(nullif(public.slugify(new.brand_name), ''), 'marca');
    candidate := base;
    while exists (
      select 1 from public.brand_profiles
      where slug = candidate and profile_id <> new.profile_id
    ) loop
      i := i + 1;
      candidate := base || '-' || i;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end;
$$;

drop trigger if exists brand_profiles_set_slug on public.brand_profiles;
create trigger brand_profiles_set_slug
  before insert or update on public.brand_profiles
  for each row execute function public.set_brand_slug();

-- ---------- verificación ----------
-- Mismo criterio que protect_verified en creator_profiles: solo admin.
create or replace function public.protect_brand_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified is distinct from old.verified
     and public.current_app_role() <> 'admin' then
    raise exception 'solo admin puede verificar una marca';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_brand_profiles_verified on public.brand_profiles;
create trigger protect_brand_profiles_verified
  before update on public.brand_profiles
  for each row execute function public.protect_brand_verified();

create or replace function public.current_brand_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brand_profiles
    where profile_id = auth.uid() and verified
  )
$$;

grant execute on function public.current_brand_verified() to authenticated;

-- ---------- gate de publicación ----------
-- Una marca sin verificar puede crear y editar borradores, pero no publicarlos.
-- Va en RLS, no solo en la UI: el server action además chequea para dar un
-- error amable en vez de una negación cruda.
drop policy "campaigns_insert_own_brand" on public.campaigns;

create policy "campaigns_insert_own_brand"
  on public.campaigns for insert
  to authenticated
  with check (
    brand_id = auth.uid()
    and public.current_app_role() = 'brand'
    and (status <> 'published' or public.current_brand_verified())
  );

drop policy "campaigns_update_own_brand_or_admin" on public.campaigns;

create policy "campaigns_update_own_brand_or_admin"
  on public.campaigns for update
  to authenticated
  using (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  )
  with check (
    (
      brand_id = auth.uid()
      and public.current_app_role() = 'brand'
      and (status <> 'published' or public.current_brand_verified())
    )
    or public.current_app_role() = 'admin'
  );

-- ---------- vista pública ----------
-- Suma slug y verificado para poder linkear al perfil de la marca y mostrar el
-- sello desde la vitrina pública.
drop view if exists public.campaign_previews;

create view public.campaign_previews
with (security_invoker = false) as
select
  c.id,
  c.title,
  b.brand_name,
  b.industry,
  b.logo_url as brand_logo_url,
  b.location as brand_location,
  b.slug as brand_slug,
  b.verified as brand_verified,
  (
    select array_agg(d ->> 'type')
    from jsonb_array_elements(c.deliverables) d
  ) as deliverable_types,
  c.published_at
from public.campaigns c
join public.brand_profiles b on b.profile_id = c.brand_id
where c.status = 'published';

grant select on public.campaign_previews to anon, authenticated;

-- El perfil público de la marca lista sus promos abiertas para un visitante
-- anónimo, que no tiene policy sobre `campaigns`. Se resuelve con una función
-- security-definer que expone SOLO lo mismo que campaign_previews (nunca brief
-- ni presupuesto) — mismo patrón que creator_public_stats.
create or replace function public.brand_public_campaigns(p_slug text)
returns table (
  id uuid,
  title text,
  deliverable_types text[],
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    (select array_agg(d ->> 'type') from jsonb_array_elements(c.deliverables) d),
    c.published_at
  from public.campaigns c
  join public.brand_profiles b on b.profile_id = c.brand_id
  where b.slug = p_slug and c.status = 'published'
  order by c.published_at desc
$$;

grant execute on function public.brand_public_campaigns(text) to anon, authenticated;
