-- Fase 1 / épica 1.4: una marca necesita ver el profile (display_name,
-- avatar_url, city, bio) de los creadores que aplicaron a SUS campañas.
-- creator_profiles ya es legible por cualquier authenticated; profiles no lo
-- era (solo dueño o admin) — se abre puntualmente para este caso.

create policy "profiles_select_by_campaign_brand"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.creator_id = profiles.id and c.brand_id = auth.uid()
    )
  );
