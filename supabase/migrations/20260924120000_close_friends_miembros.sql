-- Close Friends · las tablas del miembro.
--
-- Un miembro es un cliente de un negocio que se registró escaneando el QR del
-- local. Es una cuenta más de `auth.users` + `profiles` con rol 'member', igual
-- que creador y marca: no hay un segundo sistema de usuarios. Su ficha va en
-- `members`, con clave `profile_id` como `creator_profiles` y `brand_profiles`.
--
-- Qué puede escribir cada quien, en corto:
--   · el miembro edita nombre, teléfono y nombre de agente de SU fila. Todo lo
--     demás (alta, vínculos, consentimientos, eliminación) pasa por funciones
--     de 20260924140000, que validan y dejan rastro en el log;
--   · la marca crea y etiqueta sus códigos QR, y ve a sus miembros solo por
--     `miembros_de_mi_marca()` —nunca la tabla—, que esconde el contacto de
--     quien no dio consentimiento;
--   · admin lee todo.

-- ---------------------------------------------------------------
-- Códigos que se dictan o se escriben a mano
-- ---------------------------------------------------------------
-- Mismo alfabeto que los cupones (`generar_codigo_cupon`): sin O/0, I/1, L ni
-- S/5. Cada quien arma su formato encima.
create function public.codigo_aleatorio(p_largo int)
returns text
language plpgsql
volatile
as $$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_s text := '';
  i int;
begin
  for i in 1..p_largo loop
    v_s := v_s || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return v_s;
end;
$$;

-- `authenticated` SÍ la necesita: es el default de `brand_invite_codes.code`, y
-- un default corre con los permisos de quien hace el INSERT —la marca—, no
-- con los del dueño de la tabla. Sin este grant, crear un QR daba "permission
-- denied for function codigo_aleatorio". No filtra nada: es un string al azar.
revoke all on function public.codigo_aleatorio(int) from anon, public;
grant execute on function public.codigo_aleatorio(int) to authenticated;

-- "Vale" = "vale" = "Valé". El nombre de agente es único comparado así, para
-- que nadie se haga pasar por otro con una tilde de más.
create function public.normalizar_agente(p text)
returns text
language sql
immutable
as $$
  select lower(translate(
    btrim(coalesce(p, '')),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  ))
$$;

-- ---------------------------------------------------------------
-- members
-- ---------------------------------------------------------------
create type public.member_status as enum ('activo', 'eliminacion_pedida', 'suspendido');

create table public.members (
  profile_id uuid primary key references public.profiles (id) on delete cascade,

  -- CF-XXXXX: 31^5 ≈ 28 millones. Aleatorio y no correlativo, para que el
  -- número no diga cuántos miembros hay ni deje adivinar el de otro.
  expediente_code text not null unique
    check (expediente_code ~ '^CF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$'),

  -- El alias público. Letras, números, punto y guion bajo: se muestra en el
  -- panel de la marca y se va a mostrar en rankings, así que nada de espacios
  -- ni emojis que se prestan a suplantar.
  agent_name text not null
    check (agent_name ~ '^[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}$'),
  -- Lo llena el trigger de abajo. El unique va sobre ESTA columna.
  agent_name_norm text not null unique,

  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  -- WhatsApp de Costa Rica: +506 y 8 dígitos. Móviles empiezan con 5, 6, 7 u 8;
  -- los fijos con 2 y 4, y se aceptan igual —es un dato de contacto, no una
  -- validación de que tenga WhatsApp.
  phone text not null check (phone ~ '^\+506[245678][0-9]{7}$'),
  -- La mayoría de edad se valida al registrarse (`completar_registro_miembro`)
  -- y la fecha no se puede editar después (ver los grants de abajo). Un CHECK
  -- con current_date no sirve: Postgres no lo vuelve a evaluar con el tiempo.
  birthdate date not null,

  status public.member_status not null default 'activo',
  created_at timestamptz not null default now()
);

comment on table public.members is
  'Close Friends: la ficha del cliente de un negocio. Una por cuenta; los negocios cuelgan de member_brand_links.';

create function public.members_normalizar_agente()
returns trigger
language plpgsql
as $$
begin
  new.agent_name := btrim(new.agent_name);
  new.agent_name_norm := public.normalizar_agente(new.agent_name);
  return new;
end;
$$;

create trigger members_normalizar_agente
  before insert or update of agent_name on public.members
  for each row execute function public.members_normalizar_agente();

alter table public.members enable row level security;

create policy "members_select_own_or_admin"
  on public.members for select
  to authenticated
  using (profile_id = auth.uid() or public.current_app_role() = 'admin');

create policy "members_update_own"
  on public.members for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- La policy autoriza la FILA; qué COLUMNAS, lo dicen los grants. Acá sí sirven
-- los grants por columna (en `applications` no, ver 20260825160000): la única
-- sesión que escribe esta tabla es la del propio miembro. Admin y el alta van
-- por service role o por funciones security definer, que no pasan por acá.
--
-- Fuera de la lista, a propósito: el expediente, el estado (lo mueve el pedido
-- de eliminación) y la fecha de nacimiento (editable, el gate de edad no sirve).
revoke insert, update, delete on public.members from anon, authenticated;
grant update (full_name, phone, agent_name) on public.members to authenticated;

-- ---------------------------------------------------------------
-- Consentimientos (Ley 8968) — append-only
-- ---------------------------------------------------------------
-- Cada cambio es una fila nueva; el vigente es el último por
-- (miembro, tipo, marca). Así queda el historial de qué aceptó, cuándo y con
-- qué versión del texto.
--
-- El aviso de que los datos se alojan fuera de Costa Rica va DENTRO del texto
-- de términos que se acepta: es un aviso, no una opción que se pueda negar
-- y seguir usando el servicio.
create type public.consent_kind as enum ('terms', 'share_with_brand', 'whatsapp_marketing');

create table public.member_consents (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members (profile_id) on delete cascade,
  kind public.consent_kind not null,
  -- Solo para share_with_brand: se comparte con UN negocio, no con todos.
  brand_id uuid references public.profiles (id) on delete cascade,
  granted boolean not null,
  text_version text not null check (char_length(text_version) between 1 and 40),
  created_at timestamptz not null default now(),

  constraint member_consents_marca_solo_si_comparte
    check ((kind = 'share_with_brand') = (brand_id is not null))
);

create index member_consents_vigente_idx
  on public.member_consents (member_id, kind, brand_id, created_at desc);

alter table public.member_consents enable row level security;

create policy "member_consents_select_own_or_admin"
  on public.member_consents for select
  to authenticated
  using (member_id = auth.uid() or public.current_app_role() = 'admin');

-- Sin INSERT desde la sesión: el cambio pasa por `cambiar_consentimiento`, que
-- valida el vínculo con la marca y deja rastro en el log.
revoke insert, update, delete on public.member_consents from anon, authenticated;

-- El consentimiento vigente. Invoker: cada quien ve solo lo que su RLS le deja.
create view public.member_consents_vigentes
with (security_invoker = true) as
select distinct on (member_id, kind, brand_id)
  member_id, kind, brand_id, granted, text_version, created_at
from public.member_consents
order by member_id, kind, brand_id, created_at desc, id desc;

grant select on public.member_consents_vigentes to authenticated;

-- ---------------------------------------------------------------
-- Códigos QR de invitación de cada negocio
-- ---------------------------------------------------------------
create table public.brand_invite_codes (
  id uuid primary key default gen_random_uuid(),
  -- La marca es `profiles(id)`, como `coupons.brand_id`. El default hace que
  -- la marca no tenga que (ni pueda, ver grants) mandarlo.
  brand_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Lo único que viaja en la URL del QR. 31^10: no se adivina ni se recorre.
  code text not null unique default public.codigo_aleatorio(10)
    check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$'),
  label text not null default 'General' check (char_length(btrim(label)) between 1 and 40),
  active boolean not null default true,
  -- Los cuentan funciones del servidor; la marca no los puede tocar.
  scans int not null default 0,
  signups int not null default 0,
  created_at timestamptz not null default now()
);

create index brand_invite_codes_brand_idx on public.brand_invite_codes (brand_id, created_at desc);

alter table public.brand_invite_codes enable row level security;

create policy "brand_invite_codes_select_own_or_admin"
  on public.brand_invite_codes for select
  to authenticated
  using (
    (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  );

-- Solo una marca verificada reparte QR: el QR da de alta gente a su nombre.
create policy "brand_invite_codes_insert_own_brand"
  on public.brand_invite_codes for insert
  to authenticated
  with check (
    brand_id = auth.uid()
    and public.current_app_role() = 'brand'
    and public.current_brand_verified()
  );

create policy "brand_invite_codes_update_own_brand"
  on public.brand_invite_codes for update
  to authenticated
  using (brand_id = auth.uid() and public.current_app_role() = 'brand')
  with check (brand_id = auth.uid() and public.current_app_role() = 'brand');

-- Sin DELETE: un código ya impreso se DESACTIVA. Borrarlo se llevaría el
-- registro de qué QR trajo a cada miembro.
revoke insert, update, delete on public.brand_invite_codes from anon, authenticated;
grant insert (label) on public.brand_invite_codes to authenticated;
grant update (label, active) on public.brand_invite_codes to authenticated;

-- ---------------------------------------------------------------
-- Vínculo miembro ↔ negocio
-- ---------------------------------------------------------------
create table public.member_brand_links (
  member_id uuid not null references public.members (profile_id) on delete cascade,
  brand_id uuid not null references public.profiles (id) on delete cascade,
  -- set null: si algún día se borra un código, el miembro sigue vinculado.
  invite_code_id uuid references public.brand_invite_codes (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (member_id, brand_id)
);

create index member_brand_links_brand_idx on public.member_brand_links (brand_id, joined_at desc);

alter table public.member_brand_links enable row level security;

-- La marca ve QUE tiene un vínculo (id y fecha); quién es y cómo contactarlo
-- sale de `miembros_de_mi_marca()`, que mira el consentimiento.
create policy "member_brand_links_select"
  on public.member_brand_links for select
  to authenticated
  using (
    member_id = auth.uid()
    or (brand_id = auth.uid() and public.current_app_role() = 'brand')
    or public.current_app_role() = 'admin'
  );

revoke insert, update, delete on public.member_brand_links from anon, authenticated;

-- ---------------------------------------------------------------
-- Pedidos de eliminación
-- ---------------------------------------------------------------
-- No se borra en caliente: el pedido queda para que Q Labs lo resuelva (hay
-- canjes que la marca tiene que poder seguir viendo hasta cerrar).
create type public.deletion_request_status as enum ('pendiente', 'resuelta');

create table public.member_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (profile_id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  status public.deletion_request_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

-- Un solo pedido abierto por miembro.
create unique index member_deletion_requests_uno_abierto
  on public.member_deletion_requests (member_id) where status = 'pendiente';

alter table public.member_deletion_requests enable row level security;

create policy "member_deletion_requests_select_own_or_admin"
  on public.member_deletion_requests for select
  to authenticated
  using (member_id = auth.uid() or public.current_app_role() = 'admin');

revoke insert, update, delete on public.member_deletion_requests from anon, authenticated;

-- ---------------------------------------------------------------
-- Log de auditoría
-- ---------------------------------------------------------------
-- Sin FK al miembro, a propósito: el rastro de un alta o un canje tiene que
-- sobrevivir a que la cuenta se elimine. Guarda ids y el tipo de evento, no
-- datos personales (ni nombre ni teléfono), para que eliminar la cuenta
-- realmente elimine los datos.
create table public.member_audit_log (
  id bigint generated always as identity primary key,
  member_id uuid not null,
  actor_id uuid,
  action text not null check (action in (
    'alta', 'vinculo', 'consentimiento', 'reclamo', 'canje', 'eliminacion_pedida'
  )),
  brand_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index member_audit_log_member_idx on public.member_audit_log (member_id, created_at desc);

alter table public.member_audit_log enable row level security;

create policy "member_audit_log_select_admin"
  on public.member_audit_log for select
  to authenticated
  using (public.current_app_role() = 'admin');

revoke insert, update, delete on public.member_audit_log from anon, authenticated;

-- ---------------------------------------------------------------
-- Freno del registro público
-- ---------------------------------------------------------------
-- Mismo criterio que `password_reset_throttle`: en la base y no en memoria,
-- porque Vercel reparte los requests entre instancias que nacen y mueren solas.
-- Una fila por clave ('ip:<hash>' o 'code:<codigo>') con una ventana fija.
-- RLS sin policies: solo el servidor, con service role, pasa por acá.
create table public.member_signup_throttle (
  clave text primary key,
  ventana_inicio timestamptz not null default now(),
  intentos int not null default 0
);

create index member_signup_throttle_viejas_idx on public.member_signup_throttle (ventana_inicio);

alter table public.member_signup_throttle enable row level security;
