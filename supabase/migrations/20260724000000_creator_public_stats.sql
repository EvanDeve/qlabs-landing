-- Perfil público del creador (media-kit): la marca que lo abre necesita ver
-- campañas completadas + rating promedio, pero `applications` está bajo RLS
-- (una marca solo ve las aplicaciones de SUS campañas), así que se resuelve
-- con una función security-definer — mismo patrón que creator_delivery_stats
-- y public_marketplace_stats.
create function public.creator_public_stats(p_creator_id uuid)
returns table (
  approved_count bigint,
  delivered_count bigint,
  on_time_ratio numeric,
  avg_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.applications
      where creator_id = p_creator_id and status = 'approved'),
    (select count(*) from public.applications
      where creator_id = p_creator_id and status in ('delivered', 'approved')),
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
     where a.creator_id = p_creator_id and a.delivered_at is not null),
    (select avg(rating)::numeric from public.applications
      where creator_id = p_creator_id and rating is not null),
    (select count(*) from public.applications
      where creator_id = p_creator_id and rating is not null)
$$;

grant execute on function public.creator_public_stats(uuid) to authenticated;
