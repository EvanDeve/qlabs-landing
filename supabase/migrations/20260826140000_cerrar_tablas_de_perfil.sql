-- Auditoría del 2026-08-26: las vistas filtran, las tablas de abajo no.
--
-- El proyecto protege lo público con vistas (`creator_public_profiles`,
-- `campaign_previews`) y están bien hechas. Pero en cuatro lugares la tabla
-- cruda quedó abierta al mismo público, así que la vista se saltea pidiendo la
-- tabla directo. Los cuatro se probaron contra producción; ver
-- `docs/auditoria-seguridad-2026-08.md`.

-- ---------------------------------------------------------------
-- 0. Un ayudante: ¿este creador es público?
-- ---------------------------------------------------------------
-- Va `security definer` por la misma razón que `current_app_role()`: lo usan
-- las policies de las tablas hijas, y consultar `creator_profiles` desde ahí
-- con la RLS del visitante devolvería siempre falso —un anónimo no puede leer
-- esa tabla—, así que el filtro no filtraría: escondería todo.
--
-- Repite el criterio de `creator_public_profiles`, admin incluido: el panel
-- abre el perfil público para mirarle el book al creador ANTES de verificarlo.
create or replace function public.creador_publicado(creador uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_profiles cp
    where cp.profile_id = creador
      and (cp.verified or public.current_app_role() = 'admin')
  )
$$;

comment on function public.creador_publicado(uuid) is
  'true si ese creador se puede mostrar afuera. Mismo criterio que creator_public_profiles.';

-- ---------------------------------------------------------------
-- 1. Book, habilidades y marcas previas: solo de creadores publicados
-- ---------------------------------------------------------------
-- Estaban en `using (true)` desde 20260724500000. La vista escondía bien al
-- creador sin verificar y estas tres tablas lo entregaban igual. Probado:
--
--   creator_public_profiles -> 0 filas   (la vista lo oculta)
--   portfolio_items         -> 1 fila    (la tabla lo entrega)
--
-- Y como el bucket `portfolio` es público, con ese `storage_path` el archivo se
-- descargaba sin ninguna llave: 3.6 MB de video, HTTP 200.
drop policy "creator_skills_select_anon" on public.creator_skills;
drop policy "creator_past_brands_select_anon" on public.creator_past_brands;
drop policy "portfolio_items_select_anon" on public.portfolio_items;

create policy "creator_skills_select_anon"
  on public.creator_skills for select to anon
  using (public.creador_publicado(creator_id));

create policy "creator_past_brands_select_anon"
  on public.creator_past_brands for select to anon
  using (public.creador_publicado(creator_id));

create policy "portfolio_items_select_anon"
  on public.portfolio_items for select to anon
  using (public.creador_publicado(creator_id));

-- Lo mismo para quien tiene sesión: un creador no verificado no se le muestra a
-- otro creador ni a una marca. El dueño siempre ve lo suyo.
drop policy "creator_skills_select_authenticated" on public.creator_skills;
drop policy "creator_services_select_authenticated" on public.creator_services;
drop policy "creator_addons_select_authenticated" on public.creator_addons;
drop policy "creator_past_brands_select_authenticated" on public.creator_past_brands;
drop policy "portfolio_items_select_authenticated" on public.portfolio_items;

create policy "creator_skills_select_authenticated"
  on public.creator_skills for select to authenticated
  using (creator_id = auth.uid() or public.creador_publicado(creator_id));

create policy "creator_services_select_authenticated"
  on public.creator_services for select to authenticated
  using (creator_id = auth.uid() or public.creador_publicado(creator_id));

create policy "creator_addons_select_authenticated"
  on public.creator_addons for select to authenticated
  using (creator_id = auth.uid() or public.creador_publicado(creator_id));

create policy "creator_past_brands_select_authenticated"
  on public.creator_past_brands for select to authenticated
  using (creator_id = auth.uid() or public.creador_publicado(creator_id));

create policy "portfolio_items_select_authenticated"
  on public.portfolio_items for select to authenticated
  using (creator_id = auth.uid() or public.creador_publicado(creator_id));

-- ---------------------------------------------------------------
-- 2. creator_profiles deja de entregarle la tarifa a cualquiera
-- ---------------------------------------------------------------
-- La policy era `to authenticated using (true)`: cualquier sesión leía la tabla
-- entera, incluidas las CINCO columnas que la vista esconde a propósito —
-- `rate_min`, `rate_max`, `avg_reach`, `rejected_at`, `rejection_reason`.
--
-- Las tarifas de un creador legibles por sus colegas, y por una marca antes de
-- negociar, es justo lo que un marketplace no puede permitirse. Hoy las cinco
-- están en null en las 7 filas, así que esto no arregla una fuga en curso: la
-- evita el día que se empiecen a usar, sin que nadie tenga que acordarse.
--
-- Quien necesita ver a OTRO creador lee `creator_public_profiles`, que ya trae
-- lo que hace falta para el perfil, el feed y la pantalla de aplicantes.
drop policy "creator_profiles_select_authenticated" on public.creator_profiles;

create policy "creator_profiles_select_own_or_admin"
  on public.creator_profiles for select
  to authenticated
  using (profile_id = auth.uid() or public.current_app_role() = 'admin');

-- ---------------------------------------------------------------
-- 3. brand_profiles: la tabla entera era de lectura anónima
-- ---------------------------------------------------------------
-- `to anon, authenticated using (true)`, desde la primera migración y nunca
-- reemplazada. Todas las filas y todas las columnas para cualquiera con la anon
-- key, que viaja en el HTML de cada página. Probado con una marca rechazada:
--
--   [{"brand_name":"…","verified":false,"rejected_at":"…",
--     "rejection_reason":"MOTIVO INTERNO: sospechamos que el local no existe"}]
--
-- Queda expuesto qué negocios se registraron sin verificar, cuáles se
-- rechazaron y con qué texto — escrito pensando que era interno.
--
-- Mismo tratamiento que ya tenía el creador: la tabla se cierra al dueño y al
-- admin, y afuera va una vista con lo de vitrina.
create or replace view public.brand_public_profiles
with (security_invoker = false) as
select
  bp.profile_id,
  bp.brand_name,
  bp.industry,
  bp.website,
  bp.instagram_handle,
  bp.description,
  bp.logo_url,
  bp.location,
  bp.slug,
  bp.verified
from public.brand_profiles bp
where bp.verified or public.current_app_role() = 'admin';

comment on view public.brand_public_profiles is
  'brand_profiles sin rejected_at ni rejection_reason, y solo marcas verificadas. Lo que se puede mostrar afuera.';

grant select on public.brand_public_profiles to anon, authenticated;

drop policy "brand_profiles_select_public" on public.brand_profiles;

create policy "brand_profiles_select_own_or_admin"
  on public.brand_profiles for select
  to authenticated
  using (profile_id = auth.uid() or public.current_app_role() = 'admin');

-- ---------------------------------------------------------------
-- 4. Los buckets públicos, con tope y con lista de tipos
-- ---------------------------------------------------------------
-- Los cuatro privados ya declaran los dos límites; los cinco públicos no
-- declaraban ninguno. Las policies de escritura sí están bien —cada quien en su
-- carpeta (`(storage.foldername(name))[1] = auth.uid()::text`)— pero sin tope
-- ni tipo, una cuenta verificada sube cualquier archivo, de cualquier tamaño, a
-- una URL pública del proyecto. El primer límite de escala de todo esto es el
-- 1 GB de Storage, así que además de higiene es plata.
--
-- 5 MB alcanza de sobra para un logo o un avatar; las portadas de campaña y las
-- imágenes de cupón van a 8 porque son la pieza grande de la tarjeta.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
 where id in ('avatars', 'brand-logos', 'hero-logos');

update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
 where id in ('coupon-images', 'campaign-covers');
