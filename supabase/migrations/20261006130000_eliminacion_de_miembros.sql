-- Atender un pedido de eliminación de Close Friends sin borrar de más.
--
-- Evan decidió (2026-10-06) que atender el pedido es borrar la cuenta entera,
-- "la que legalmente sea correcta". Borrar la cuenta (auth.users) ya
-- cascadea a profiles → members → consentimientos, vínculos y bitácora, que
-- es lo que la Ley 8968 pide que desaparezca.
--
-- Pero dos cascadas borraban de más:
--
-- 1. `redemptions.member_id` era `on delete cascade`: al borrar al miembro se
--    iban sus canjes. Esos son registros del NEGOCIO —qué cupón entregó y
--    cuándo— y sacarlos le cambia los conteos y libera stock de un cupón que
--    ya se entregó. La ley deja conservar la transacción si no identifica a
--    nadie: pasa a `set null`, y el canje queda sin titular.
--
-- 2. `member_deletion_requests.member_id` también era cascade: la propia
--    solicitud desaparecía, y con ella la única constancia de que se
--    atendió. Pasa a `set null`: queda la fecha del pedido, la de la
--    resolución y quién la resolvió, sin nada de la persona. El motivo se
--    borra al resolver (lo escribió la persona y puede identificarla).

-- ---------- 1. canjes sin titular ----------
-- "Exactamente uno" pasa a "a lo sumo uno": el canje de alguien que pidió que
-- lo borraran no tiene titular. Todo lo que se crea sigue teniendo uno —lo
-- ponen claim_coupon y reclamar_para_miembro—.
alter table public.redemptions
  drop constraint redemptions_un_titular;
alter table public.redemptions
  add constraint redemptions_un_titular check (num_nonnulls(creator_id, member_id) <= 1);

alter table public.redemptions
  drop constraint redemptions_member_id_fkey;
alter table public.redemptions
  add constraint redemptions_member_id_fkey
  foreign key (member_id) references public.members (profile_id) on delete set null;

-- ---------- 2. la constancia del pedido ----------
alter table public.member_deletion_requests
  alter column member_id drop not null;

alter table public.member_deletion_requests
  drop constraint member_deletion_requests_member_id_fkey;
alter table public.member_deletion_requests
  add constraint member_deletion_requests_member_id_fkey
  foreign key (member_id) references public.members (profile_id) on delete set null;

comment on column public.member_deletion_requests.member_id is
  'Quién lo pidió. Queda en null cuando se atiende: la cuenta se borra y de la solicitud solo sobreviven las fechas y quién la resolvió.';
