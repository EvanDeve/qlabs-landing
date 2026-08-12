-- La meta mensual deja de vivir en el expediente del Hero.
--
-- `monthly_target` era un número suelto en `agency_clients`: se escribía una vez
-- al firmar el paquete y después nadie volvía a mirarlo. De ahí que uno de los
-- nueve Heroes tuviera 60 —contra 8 a 11 del resto— y que la alerta de "por
-- debajo del ritmo" viviera prendida para esa cuenta sin que significara nada.
--
-- Ahora la meta la da el cronograma del mes: la cantidad de videos que se
-- planificaron, sellada cuando el cliente los aprueba. Es el mismo número, pero
-- puesto donde el mes se decide de verdad y con alguien que lo acepta.
--
-- Esta migración va DESPUÉS de que el código dejó de leer la columna
-- (admin/page.tsx, reporte.ts, heroes.ts y el expediente del Hero). Corrida
-- antes, esas cuatro pantallas se caerían hasta el deploy.
--
-- Los nueve valores que había se pierden. Es a propósito y está conversado: son
-- números viejos, uno de ellos mal, y el cronograma de septiembre los reemplaza
-- de entrada.

alter table public.agency_clients drop column monthly_target;
