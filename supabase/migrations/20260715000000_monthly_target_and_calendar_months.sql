-- Q·OS: "pase de servicio" — seguimiento mensual de videos por Hero.
-- monthly_target: cantidad de videos del paquete contratado (null = sin
-- paquete definido, el Hero queda fuera de los cálculos de ritmo).
-- hero_calendar_months: el cronograma del mes (ideas + fechas) se arma a
-- inicio de mes y el cliente lo aprueba; un registro por Hero por mes, así
-- cada mes arranca en 'pendiente' sin resetear nada a mano.

alter table public.agency_clients add column monthly_target integer;

create type calendar_month_status as enum ('pendiente', 'aprobado');

create table public.hero_calendar_months (
  hero_id uuid not null references public.agency_clients (id) on delete cascade,
  month date not null,
  status calendar_month_status not null default 'pendiente',
  approved_at timestamptz,
  primary key (hero_id, month),
  constraint month_is_first_day check (extract(day from month) = 1)
);

alter table public.hero_calendar_months enable row level security;

create policy "hero_calendar_months_all_admin"
  on public.hero_calendar_months for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
