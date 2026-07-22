-- Refuerza en RLS que solo un creador verificado puede aplicar a campañas
-- (bloqueo duro, no solo de UI) y agrega compensación en producto/descuento
-- como campo opcional de la campaña.

drop policy "applications_insert_own_creator" on public.applications;

create policy "applications_insert_own_creator"
  on public.applications for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and public.current_app_role() = 'creator'
    and exists (
      select 1 from public.creator_profiles cp
      where cp.profile_id = auth.uid() and cp.verified = true
    )
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.status = 'published'
    )
  );

alter table public.campaigns add column compensation_details text;
