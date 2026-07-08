-- Q·OS: el estado de riesgo de un Hero no tenía ninguna lógica automática
-- detrás (era un campo puramente manual) y el usuario decidió que no aporta
-- valor — se quita del todo en vez de dejarlo a medio usar.

alter table public.agency_clients drop column risk;
drop type hero_risk;
