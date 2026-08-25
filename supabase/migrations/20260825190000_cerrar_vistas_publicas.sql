-- Dos huecos en las vistas que el linter de Supabase marca como
-- "Security Definer View".
--
-- Antes que nada, sobre el aviso en sí: las cuatro vistas
-- (`campaign_previews`, `creator_public_profiles`, `staff_directory`,
-- `coupon_stock`) declaran `security_invoker = false` A PROPÓSITO y no se
-- pueden pasar a invoker. Existen justamente para dejar ver un pedazo chico de
-- una tabla cerrada: con invoker, la RLS de la tabla base se aplicaría al
-- visitante y las vistas devolverían cero filas — el perfil público del creador
-- y el feed público del marketplace dejarían de funcionar. El aviso es correcto
-- como categoría ("esto saltea RLS") pero la respuesta no es apagarlo: es que
-- cada vista filtre y otorgue bien. Eso es lo que arregla esta migración.

-- ---------------------------------------------------------------
-- 1. coupon_stock estaba abierto a anónimos
-- ---------------------------------------------------------------
-- La migración que la creó hace `grant select ... to authenticated`, pero eso
-- SUMA al grant que Supabase da por defecto a `anon` sobre todo lo nuevo del
-- esquema `public`. Nunca se revocó, así que cualquiera con la anon key —que es
-- pública, va en el navegador— podía listar el stock de todos los cupones.
--
-- No es un dato dramático (números contra un uuid opaco), pero no era la
-- intención, y sirve para saber cuántas promos hay y cuánto se está canjeando.
-- Las tres pantallas que la usan son todas con sesión: Recompensas del creador,
-- Loyalty de la marca y el canje.
revoke select on public.coupon_stock from anon;

-- ---------------------------------------------------------------
-- 2. creator_public_profiles mostraba a los creadores sin aprobar
-- ---------------------------------------------------------------
-- La vista no filtraba nada: publicaba el perfil de CUALQUIER creador con
-- cuenta, aunque estuviera esperando verificación o ya rechazado. Hoy no se
-- nota porque los 7 que hay están verificados, pero el próximo que se registre
-- queda con su nombre, ciudad, bio y redes accesibles sin sesión desde el
-- minuto cero, antes de que nadie lo apruebe.
--
-- El filtro NO puede ser `where verified` a secas: el panel de admin abre este
-- mismo perfil público para mirarle el book al creador **antes** de decidir si
-- lo verifica (ver el comentario en `admin/marketplace/page.tsx`). Cerrarlo del
-- todo rompería la verificación, que es el paso previo a todo lo demás.
--
-- `auth.uid()` sigue siendo el de quien consulta aunque la vista corra como su
-- dueño: lee el claim del request, no del rol. Mismo patrón que ya usa
-- `staff_directory` desde el 2026-08-03.
create or replace view public.creator_public_profiles
with (security_invoker = false) as
select
  cp.profile_id,
  cp.handle,
  cp.followers_count,
  cp.niches,
  cp.languages,
  cp.instagram_handle,
  cp.tiktok_handle,
  cp.verified,
  cp.engagement_rate,
  cp.avg_views,
  p.display_name,
  p.bio,
  p.city,
  p.avatar_url
from public.creator_profiles cp
join public.profiles p on p.id = cp.profile_id
where cp.verified or public.current_app_role() = 'admin';

grant select on public.creator_public_profiles to anon, authenticated;
