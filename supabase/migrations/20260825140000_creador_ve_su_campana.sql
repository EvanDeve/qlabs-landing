-- El creador puede leer la campaña de su propia aplicación, sin importar en
-- qué estado esté la campaña.
--
-- Hasta hoy la única puerta del creador a `campaigns` era
-- `campaigns_select_publicadas_creator_verificado`: status = 'published'. Eso
-- alcanza para el feed, pero deja afuera un caso que sí pasa: en cuanto una
-- campaña deja de estar publicada —`markCampaignCompletedAction` la pone en
-- 'completed' desde Q·OS— el creador que trabajó en ella pierde el título, el
-- monto, el brief y los entregables. "Mis aplicaciones" le queda mostrando
-- "Campaña" sin datos, y la hoja de entrega se queda sin cajas.
--
-- No abre el marketplace: la condición no es un estado, es tener una
-- aplicación propia en esa campaña, y una aplicación solo puede existir si la
-- campaña estuvo publicada en su momento. Tampoco pide `verified`, a
-- diferencia de la policy del feed: el gate existe para que un creador sin
-- verificar no navegue campañas ajenas, no para esconderle su propio
-- historial.
create policy "campaigns_select_con_aplicacion_propia"
  on public.campaigns for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.campaign_id = campaigns.id
        and a.creator_id = auth.uid()
    )
  );
