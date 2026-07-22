-- Rediseño de dashboards creador/marca: stats reales para "Mi book"
-- (views manuales por pieza) y rating de marca hacia creador al aprobar
-- una entrega. Sin cambios de RLS: las políticas de update por dueño que
-- ya existen sobre portfolio_items y applications cubren estas columnas.

alter table public.portfolio_items add column views int;

alter table public.applications add column rating smallint check (rating between 1 and 5);
