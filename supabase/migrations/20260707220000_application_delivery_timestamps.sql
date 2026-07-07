-- Fase 2, épica 2.3: timestamps de entrega para calcular el trust score
-- (el creador marca "entregado" manualmente por ahora — la subida de
-- archivo in-app es la épica 2.6, todavía no construida)

alter table public.applications
  add column accepted_at timestamptz,
  add column delivered_at timestamptz,
  add column approved_at timestamptz;

create or replace function public.touch_application_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
    if new.status = 'accepted' then
      new.accepted_at = now();
    elsif new.status = 'delivered' then
      new.delivered_at = now();
    elsif new.status = 'approved' then
      new.approved_at = now();
    end if;
  end if;
  return new;
end;
$$;

-- el creador puede marcar su propia aplicación aceptada como entregada
create policy "applications_update_own_creator_deliver"
  on public.applications for update
  to authenticated
  using (creator_id = auth.uid() and status = 'accepted')
  with check (creator_id = auth.uid() and status = 'delivered');

-- al pasar a "delivered" hay que avisarle a la marca, no al creador
-- (que fue quien disparó el cambio)
create or replace function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_title text;
  v_brand_id uuid;
begin
  if new.status is distinct from old.status then
    select title, brand_id into v_campaign_title, v_brand_id
    from public.campaigns where id = new.campaign_id;

    if new.status = 'delivered' then
      insert into public.notifications (profile_id, type, payload)
      values (
        v_brand_id,
        'application_delivered',
        jsonb_build_object(
          'campaign_id', new.campaign_id,
          'campaign_title', v_campaign_title,
          'application_id', new.id,
          'creator_id', new.creator_id
        )
      );
    else
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
  end if;
  return new;
end;
$$;

-- agregado para el trust score: applications no es legible por cualquier
-- autenticado (solo dueño/marca/admin), así que se resuelve el conteo de
-- entregas aprobadas y el % de puntualidad con una función security-definer,
-- mismo patrón que public_marketplace_stats
create function public.creator_delivery_stats(p_creator_id uuid)
returns table (
  approved_count bigint,
  on_time_ratio numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.applications
      where creator_id = p_creator_id and status = 'approved'),
    (select
       case when count(*) filter (where accepted_at is not null and c.deadline_days is not null) = 0
         then null
         else (count(*) filter (
                where accepted_at is not null and c.deadline_days is not null
                  and delivered_at <= accepted_at + (c.deadline_days || ' days')::interval
              ))::numeric
              / count(*) filter (where accepted_at is not null and c.deadline_days is not null)
       end
     from public.applications a
     join public.campaigns c on c.id = a.campaign_id
     where a.creator_id = p_creator_id and a.delivered_at is not null)
$$;

grant execute on function public.creator_delivery_stats(uuid) to authenticated;
