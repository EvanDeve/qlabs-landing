-- Arregla la recursión que introdujo 20260825140000.
--
-- Qué pasó: esa migración agregó a `campaigns` una policy que hace
-- `exists (select 1 from applications ...)`. Pero las policies de
-- `applications` a su vez hacen `exists (select 1 from campaigns ...)` para
-- resolver quién es la marca dueña. Postgres evalúa una dentro de la otra y
-- corta con 42P17, "infinite recursion detected in policy". El efecto no fue
-- local: se cayeron `applications`, `campaigns`, `application_deliveries` y
-- TODO Storage, porque las policies del bucket también consultan
-- `applications`.
--
-- La salida es la de siempre para RLS que cruza dos tablas que se miran entre
-- sí: la pregunta se responde en una función `security definer`, que corre
-- como su dueño y por eso NO vuelve a pasar por las policies de
-- `applications`. Mismo patrón que ya usan `current_app_role()` y
-- `current_creator_verified()` en este proyecto.

drop policy if exists "campaigns_select_con_aplicacion_propia" on public.campaigns;

-- Solo puede contestar por el que pregunta: filtra por `auth.uid()` adentro,
-- así que no sirve para espiar las aplicaciones de nadie más.
create or replace function public.tiene_aplicacion_en(p_campaign uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.applications
    where campaign_id = p_campaign
      and creator_id = auth.uid()
  );
$$;

revoke all on function public.tiene_aplicacion_en(uuid) from public;
grant execute on function public.tiene_aplicacion_en(uuid) to authenticated;

-- El propósito es el mismo que el de la migración anterior: que el creador no
-- pierda el título, el monto, el brief ni los entregables de su propia
-- colaboración cuando la campaña deja de estar publicada (Q·OS la pasa a
-- 'completed' al cerrarla).
create policy "campaigns_select_con_aplicacion_propia"
  on public.campaigns for select
  to authenticated
  using (public.tiene_aplicacion_en(id));
