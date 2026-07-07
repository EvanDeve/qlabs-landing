-- Fase 1 / épica 1.7: admin necesita ver TODAS las campañas (incluidos
-- borradores de cualquier marca), no solo las publicadas. La policy
-- existente para creator/admin solo cubre status='published'.

create policy "campaigns_select_admin"
  on public.campaigns for select
  to authenticated
  using (public.current_app_role() = 'admin');
