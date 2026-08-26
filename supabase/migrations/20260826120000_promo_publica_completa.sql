-- El perfil público de la marca muestra la promo entera, menos el pago.
--
-- Hasta hoy `brand_public_campaigns` devolvía título, formatos y fecha, y nada
-- más: la regla de Fase 1 era que el brief completo solo lo vieran creadores
-- autenticados. Evan la cambió el 2026-08-26 al diseñar esa página, y el
-- razonamiento está en el propio mockup — dice «Registrate como creador para
-- ver el pago y aplicar», o sea que lo que se protege es el MONTO, no el brief.
--
-- Tiene sentido: esa página es la que convierte. Un creador que llega por un
-- link compartido y solo ve un título no tiene con qué decidir si le interesa,
-- y registrarse a ciegas para averiguarlo es justo la fricción que hace que no
-- se registre. El brief de un reel de brunch no es información sensible.
--
-- ⚠️ Lo que NO se abre, y no se abre por descuido de nadie:
--   `budget_amount` y `budget_currency` — el pago sigue exigiendo cuenta.
--   `min_tier` — es criterio interno de selección.
--   La identidad de quién aplicó, que nunca estuvo acá.
--
-- Sigue siendo `security definer` a propósito: la gracia de la función es
-- exponer un pedazo chico de una tabla cerrada. Con `security_invoker`
-- devolvería cero filas. Ver la nota de las cuatro vistas en los pendientes.

-- ⚠️ `create or replace` NO puede cambiar el tipo de retorno de una función que
-- ya existe: Postgres tira 42P13 ("cannot change return type of existing
-- function"). Como acá se le agregan columnas al `returns table`, hay que
-- borrarla antes. El `if exists` deja la migración idempotente, y el `grant` de
-- más abajo vuelve a otorgar el permiso, que el drop se lleva puesto.
drop function if exists public.brand_public_campaigns(text);

create function public.brand_public_campaigns(p_slug text)
returns table (
  id uuid,
  title text,
  deliverable_types text[],
  published_at timestamptz,
  -- Lo que se suma: es lo que un creador necesita para saber si le sirve.
  brief text,
  deliverables jsonb,
  deadline_days integer,
  target_audience text,
  compensation_details text,
  -- Se devuelven como text y se castean abajo: en la tabla son los ENUM
  -- `campaign_usage_scope` y `campaign_usage_duration`, y declarar text sin
  -- castear también revienta la función. Del lado de TypeScript llegan como
  -- string igual, así que castear es más simple que arrastrar los enums.
  usage_rights_scope text,
  usage_rights_duration text,
  -- boolean, no text: el tipo del `returns table` tiene que calzar EXACTO con
  -- el de la columna o la función revienta en cada llamada.
  usage_rights_editing boolean
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
    c.published_at,
    c.brief,
    -- `deliverables` entero y no solo los tipos: la página muestra "1× Reel",
    -- y la cantidad vive en el jsonb. `deliverable_types` se conserva porque
    -- ya lo consume el feed público del marketplace.
    c.deliverables,
    c.deadline_days,
    c.target_audience,
    c.compensation_details,
    c.usage_rights_scope::text,
    c.usage_rights_duration::text,
    c.usage_rights_editing
  from public.campaigns c
  join public.brand_profiles b on b.profile_id = c.brand_id
  where b.slug = p_slug and c.status = 'published'
  order by c.published_at desc
$$;

grant execute on function public.brand_public_campaigns(text) to anon, authenticated;

comment on function public.brand_public_campaigns(text) is
  'La promo como la ve cualquiera en el perfil público de la marca: todo el brief menos el pago. `budget_amount` y `min_tier` NO salen de acá — el monto exige cuenta de creador. Cambiado el 2026-08-26; antes devolvía solo título, formatos y fecha.';
