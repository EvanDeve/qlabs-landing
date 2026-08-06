-- Loyalty Loop · datos de prueba para ver la pantalla de Recompensas
--
-- ⚠️ NO ES UNA MIGRACIÓN. Vive fuera de `supabase/migrations/` para que
-- `db push` no lo toque. Es data, no esquema.
--
-- ⚠️ ESTO ESCRIBE EN PRODUCCIÓN Y SE VE. Un cupón `publicado` le aparece en el
-- feed a TODOS los creadores de la plataforma, no solo a vos. Por eso los
-- títulos llevan el prefijo [PRUEBA]: si @valemoracr entra mientras tanto,
-- tiene que quedarle claro que no vaya al local con ese QR. Cuando quieras
-- mostrárselo a Andrés en serio, sacar el prefijo es un UPDATE.
--
-- Al final del archivo está el bloque para borrar todo lo que esto crea.

-- ---------------------------------------------------------------
-- 1. Cupones — uno por nivel, como el demo
-- ---------------------------------------------------------------
-- Las marcas son reales (verificadas, ya en la base). Los ids se resuelven por
-- nombre para no pegar uuids que mañana no existan.

insert into public.coupons
  (brand_id, title, type, description, min_level, stock_total, claim_validity_days, conditions, status)
select
  b.profile_id,
  '[PRUEBA] 2x1 en cócteles de autor',
  'producto',
  'Válido de lunes a jueves. Aplica a toda la carta de mixología.',
  1, 20, 14,
  'Válido solo de lunes a jueves.',
  'publicado'
from public.brand_profiles b
where b.brand_name = 'Restaurante La Ceiba';

insert into public.coupons
  (brand_id, title, type, description, min_level, stock_total, claim_validity_days, status)
select
  b.profile_id,
  '[PRUEBA] Tour de cocina + degustación',
  'servicio',
  'Recorrido por la cocina con el chef y degustación de 3 tiempos.',
  2, 5, 30,
  'publicado'
from public.brand_profiles b
where b.brand_name = 'Cafetería Los Higuerones';

-- El de evento: la fecha es obligatoria y la vigencia del reclamo la ignora —
-- el QR vale hasta el evento, no 14 días. La leyenda del consumo la pone la
-- pantalla sola, no se guarda en `conditions`.
insert into public.coupons
  (brand_id, title, type, description, min_level, stock_total, event_date, event_location, expires_at, status)
select
  b.profile_id,
  '[PRUEBA] Noche de creadores · Aniversario',
  'evento',
  'Cena de aniversario con música en vivo. Cupo limitado para creadores Oro y Platino.',
  3, 15,
  (now() + interval '20 days'),
  'Local principal, Escazú',
  (now() + interval '20 days'),
  'publicado'
from public.brand_profiles b
where b.brand_name = 'Restaurante La Ceiba';

-- ---------------------------------------------------------------
-- 2. Puntos de prueba para poder reclamar
-- ---------------------------------------------------------------
-- Sin esto todos los creadores están en Bronce (0 pts) y la pantalla se ve
-- entera bloqueada. 600 pts = Plata: alcanza para el cupón de "Todos" y el de
-- Plata, y deja el de Oro bloqueado mostrando "te faltan 900 pts", que es
-- justo lo que hay que poder ver.
--
-- Van marcados con reference_type='prueba' para poder borrarlos después sin
-- tocar los puntos que se hayan ganado de verdad.

insert into public.points_events (creator_id, action, points, reference_type, reference_id)
select c.profile_id, 'delivery_approved', 150, 'prueba', gen_random_uuid()
from public.creator_profiles c, generate_series(1, 4)
where c.handle = '@evanmarin';

-- ---------------------------------------------------------------
-- 3. Deshacer todo
-- ---------------------------------------------------------------
-- Borra los cupones de prueba, sus reclamos (van por cascade) y los puntos
-- inventados. Lo ganado de verdad no se toca.

/*
delete from public.coupons where title like '[PRUEBA]%';
delete from public.points_events where reference_type = 'prueba';
*/
