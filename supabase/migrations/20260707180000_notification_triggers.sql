-- Fase 1 / épica 1.6: notificaciones in-app automáticas.
-- notifications no tiene policy de insert para authenticated (por diseño,
-- ver migración de applications/notifications) — se llenan acá vía triggers
-- security-definer, mismo patrón que handle_new_user / protect_verified.

create function public.notify_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_campaign_title text;
begin
  select brand_id, title into v_brand_id, v_campaign_title
  from public.campaigns where id = new.campaign_id;

  insert into public.notifications (profile_id, type, payload)
  values (
    v_brand_id,
    'new_application',
    jsonb_build_object(
      'campaign_id', new.campaign_id,
      'campaign_title', v_campaign_title,
      'application_id', new.id,
      'creator_id', new.creator_id
    )
  );
  return new;
end;
$$;

create trigger applications_notify_brand
  after insert on public.applications
  for each row execute function public.notify_new_application();

create function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_title text;
begin
  if new.status is distinct from old.status then
    select title into v_campaign_title from public.campaigns where id = new.campaign_id;

    insert into public.notifications (profile_id, type, payload)
    values (
      new.creator_id,
      'application_status_changed',
      jsonb_build_object(
        'campaign_id', new.campaign_id,
        'campaign_title', v_campaign_title,
        'application_id', new.id,
        'status', new.status
      )
    );
  end if;
  return new;
end;
$$;

create trigger applications_notify_creator_status
  after update on public.applications
  for each row execute function public.notify_application_status_change();
