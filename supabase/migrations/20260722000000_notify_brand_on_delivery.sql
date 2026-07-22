-- Fase 1 ya notifica in-app a la marca cuando llega una aplicación nueva, y
-- al creador cuando cambia el estado de su aplicación (accepted/rejected/
-- approved) — ver 20260707180000_notification_triggers.sql. Pero cuando el
-- creador entrega contenido (status -> 'delivered'), la marca solo recibía
-- un email best-effort (submitDeliveryAction) y nada en la campanita in-app.
-- Este trigger cierra ese hueco.

create function public.notify_brand_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_campaign_title text;
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    select brand_id, title into v_brand_id, v_campaign_title
    from public.campaigns where id = new.campaign_id;

    insert into public.notifications (profile_id, type, payload)
    values (
      v_brand_id,
      'application_delivered',
      jsonb_build_object(
        'campaign_id', new.campaign_id,
        'campaign_title', v_campaign_title,
        'application_id', new.id
      )
    );
  end if;
  return new;
end;
$$;

create trigger applications_notify_brand_on_delivery
  after update on public.applications
  for each row execute function public.notify_brand_on_delivery();
