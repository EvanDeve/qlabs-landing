# 002 · Plan técnico del media kit

Base: `spec.md` (aprobada el 2026-10-08). Tres piezas independientes —destacadas, contacto, visitas— que comparten una sola migración aditiva, más el reordenamiento visual que espera los mockups de Evan.

## Orden y por qué

1. **Funciones puras primero** (destacadas, contacto, visitas), con sus tests. No tocan la base ni la UI: se pueden commitear y desplegar en cualquier momento.
2. **La migración, antes que cualquier código que la use.** Es puramente aditiva: agrega columnas con default, dos tablas, cuatro funciones y una columna AL FINAL de la vista pública. El código que está hoy en prod no nota nada, así que se puede correr apenas esté escrita.
   - Al revés NO: si se despliega código que llama a `ver_telefono_creador` o lee `orden_destacada` antes de que Evan corra la migración, el kit y el book se rompen en prod. Ninguna tarea posterior a T04 se pushea hasta que Evan confirme que la corrió.
3. **Tipos y tests RLS** contra la base ya migrada: fijan la seguridad antes de construir la UI encima.
4. **Pantallas**, una por tarea: book → kit (destacadas) → perfil (teléfono) → kit (contacto) → campanita → registro de visitas → inicio del creador.
5. **Privacidad, validación final** y, al último, **el reordenamiento** con los mockups.

## Lo que se verificó en el repo (2026-10-08)

- `src/app/ugc/creadores/[handle]/page.tsx`: `force-dynamic`, lee `creator_public_profiles` con `.in("handle", ["@x", "x"])` (RF-20 ya resuelto), `portfolio_items` con `select("*")` y la rpc `creator_public_stats`. Hoy NO llama a `auth.getUser()`.
- La vista `creator_public_profiles` (`20261008180000_limpieza_001.sql`) es `security_invoker = false` y filtra `cp.verified or current_app_role() = 'admin'` (RF-21). Columnas en prod (OpenAPI): `profile_id, handle, followers_count, niches, languages, instagram_handle, tiktok_handle, verified, display_name, bio, city, avatar_url`.
- `creator_profiles` está cerrada a dueño y admin (`creator_profiles_select_own_or_admin`, `20260826140000`). Un teléfono ahí no lo lee ni anon, ni otro creador, ni una marca.
- `portfolio_items`: lectura por `creador_publicado(creator_id)` o dueño; insert/update/delete solo el dueño. Las acciones viven en `src/lib/actions/portfolio.ts` (subir, borrar, mover) y la UI en `src/components/ugc/creador/PortfolioGrid.tsx` (el visor `VisorPieza` ya tiene mover y borrar).
- `notifications.type` es `text` sin check ni enum: sumar un tipo no requiere DDL. No hay policy de insert: se escriben desde triggers o funciones `security definer`. El texto y la URL se arman en `describe()` de `src/components/ugc/NotificationsBell.tsx`.
- Teléfonos: ya existe `normalizarTelefonoCR(entrada)` en `src/lib/whatsapp/twilio.ts` (E.164, +506 por defecto, acepta otros países con `+`), con tests en `tests/unit/whatsapp.test.ts`, y el mismo check SQL `'^\+[1-9][0-9]{7,14}$'` en `staff_members.phone_e164`. Se reusan los dos. `telefonoCR` de `src/lib/cf/registro.ts` NO sirve: solo acepta Costa Rica.
- `diaCR()` y `COSTA_RICA_TZ` están en `src/lib/ugc/calendar.ts`.
- Perfil del creador: `creador/perfil/page.tsx` → `PerfilEditor.tsx` (635 líneas, un form con inputs ocultos) → `updateCreatorProfileDetailsAction` en `src/lib/actions/creator-profile.ts`.
- Compartir: `CompartirPerfil.tsx` (hoja con copiar, WhatsApp, QR; arma la URL con `window.location.origin`) y `CompartirPagina.tsx` (botón del kit).
- Login: `destinoConNext` (`src/lib/ugc/estado-cuenta.ts`) solo deja volver a rutas DENTRO del panel de la cuenta; una marca que entra desde el kit cae en `/ugc/marca`, no vuelve al kit (ver preguntas abiertas).
- `src/proxy.ts` corre en `/ugc/:path*`, `/admin/:path*` y `/cf/:path*`; no en `/api`.
- El equipo de Q Labs es `profiles.role = 'admin'` (el rol `ugc` es un `staff_role`, no un `app_role`).
- La política de privacidad (`src/app/legal/privacidad/page.tsx` §5 y §10) dice que el perfil público es visible para cualquiera y que "las estadísticas de visitas son agregadas y no te identifican individualmente".

## Migración

`supabase/migrations/20261008200000_media_kit.sql`, en una transacción. Todo aditivo y con `if not exists`/`create or replace` donde se pueda, para que correrla dos veces no rompa.

```sql
begin;

-- ───────────── 1. Piezas destacadas (RF-01..05) ─────────────
-- Columna en portfolio_items y no tabla aparte: borrar la pieza borra la
-- marca de destacada (RF-05 sale gratis) y el tope de 3 lo garantiza la base.
alter table public.portfolio_items
  add column if not exists orden_destacada smallint
    constraint portfolio_items_orden_destacada_rango check (orden_destacada between 1 and 3);

-- UNIQUE con NULLs distintos (default de Postgres): muchas piezas sin destacar,
-- y a lo sumo una en cada lugar 1, 2 y 3 por creador → nunca más de 3.
alter table public.portfolio_items
  add constraint portfolio_items_destacada_unica unique (creator_id, orden_destacada);

-- Reescribe las destacadas del creador en una sola transacción (destacar,
-- quitar y reordenar son "esta es la lista nueva"). Invoker: corre con la RLS
-- de quien llama, así que solo puede tocar sus propias filas.
create or replace function public.fijar_destacadas(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n int := coalesce(array_length(p_ids, 1), 0);
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if v_n > 3 then
    raise exception 'el máximo de destacadas es 3' using errcode = 'check_violation';
  end if;
  if (select count(distinct x) from unnest(p_ids) x) <> v_n
     or (select count(*) from public.portfolio_items
          where id = any(p_ids) and creator_id = auth.uid()) <> v_n then
    raise exception 'pieza inválida';
  end if;
  update public.portfolio_items set orden_destacada = null
   where creator_id = auth.uid() and orden_destacada is not null;
  update public.portfolio_items pi set orden_destacada = t.orden
    from unnest(p_ids) with ordinality as t(id, orden)
   where pi.id = t.id and pi.creator_id = auth.uid();
end;
$$;
revoke all on function public.fijar_destacadas(uuid[]) from public, anon;
grant execute on function public.fijar_destacadas(uuid[]) to authenticated;

-- ───────────── 2. Teléfono del creador (RF-06..12c) ─────────────
-- Vive en creator_profiles, que ya está cerrada a dueño + admin. La policy de
-- update del dueño le deja editar estas dos columnas, y está bien: son suyas.
alter table public.creator_profiles
  add column if not exists telefono_e164 text
    constraint creator_profiles_telefono_e164_chk
      check (telefono_e164 is null or telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add column if not exists mostrar_telefono boolean not null default false;
alter table public.creator_profiles
  add constraint creator_profiles_mostrar_requiere_telefono
    check (not mostrar_telefono or telefono_e164 is not null);

-- La vista NO lleva el número: solo si hay contacto para ofrecer (RF-09).
-- Misma lista y mismo orden de columnas que en prod + una al final, que es lo
-- único que `create or replace view` permite. El código viejo usa select("*")
-- y no se entera.
create or replace view public.creator_public_profiles
with (security_invoker = false) as
select
  cp.profile_id, cp.handle, cp.followers_count, cp.niches, cp.languages,
  cp.instagram_handle, cp.tiktok_handle, cp.verified,
  p.display_name, p.bio, p.city, p.avatar_url,
  (cp.mostrar_telefono and cp.telefono_e164 is not null) as tiene_telefono
from public.creator_profiles cp
join public.profiles p on p.id = cp.profile_id
where cp.verified or public.current_app_role() = 'admin';
grant select on public.creator_public_profiles to anon, authenticated;

-- Registro de "esta marca vio este teléfono este día". Da el dedupe de la
-- notificación (RF-12c) con una PK en vez de un `not exists` sobre el jsonb de
-- notifications, y deja rastro si una marca se pone a juntar números.
create table if not exists public.kit_telefono_vistas (
  creator_id uuid not null references public.profiles (id) on delete cascade,
  brand_id   uuid not null references public.profiles (id) on delete cascade,
  dia        date not null,
  created_at timestamptz not null default now(),
  primary key (creator_id, brand_id, dia)
);
alter table public.kit_telefono_vistas enable row level security;
create policy "kit_telefono_vistas_select_admin"
  on public.kit_telefono_vistas for select to authenticated
  using (public.current_app_role() = 'admin');
-- Sin policies de escritura: solo la función de abajo escribe.

-- La única puerta al número para alguien que no es el dueño (RF-08, RF-10).
create or replace function public.ver_telefono_creador(p_creator uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.app_role := public.current_app_role();
  v_tel text;
  v_marca record;
  v_nuevas int;
begin
  if v_uid is null then return null; end if;

  select cp.telefono_e164 into v_tel
    from public.creator_profiles cp
   where cp.profile_id = p_creator and cp.verified and cp.mostrar_telefono;
  if v_tel is null then return null; end if;

  if v_rol = 'admin' then return v_tel; end if;          -- el equipo, sin aviso
  -- OJO: `is distinct from` y no `<>`: con rol null, `null <> 'brand'` es null
  -- y el `if` lo deja pasar.
  if v_rol is distinct from 'brand' then return null; end if;

  select bp.brand_name, bp.slug into v_marca
    from public.brand_profiles bp
   where bp.profile_id = v_uid and bp.verified;          -- pierde la verificación → deja de ver
  if not found then return null; end if;

  insert into public.kit_telefono_vistas (creator_id, brand_id, dia)
  values (p_creator, v_uid, (now() at time zone 'America/Costa_Rica')::date)
  on conflict do nothing;
  get diagnostics v_nuevas = row_count;

  if v_nuevas > 0 then                                   -- una por marca+creador+día CR
    insert into public.notifications (profile_id, type, payload)
    values (p_creator, 'telefono_visto',
            jsonb_build_object('brand_id', v_uid, 'brand_name', v_marca.brand_name,
                               'brand_slug', v_marca.slug));
  end if;

  return v_tel;
end;
$$;
-- Supabase le da EXECUTE a anon sobre toda función nueva de public: se saca a mano.
revoke all on function public.ver_telefono_creador(uuid) from public, anon;
grant execute on function public.ver_telefono_creador(uuid) to authenticated;

-- ───────────── 3. Visitas del kit (RF-13..19) ─────────────
-- `huella` = md5(quien:creador:día). Ni el user id ni la cookie anónima se
-- guardan en claro, y la huella no se puede cruzar entre días ni entre
-- creadores: alcanza para "una por persona por día" (RF-16) y es coherente
-- con lo que promete la política de privacidad (§10).
create table if not exists public.kit_visitas (
  creator_id uuid not null references public.profiles (id) on delete cascade,
  dia        date not null,
  huella     text not null,
  es_marca   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (creator_id, dia, huella)
);
alter table public.kit_visitas enable row level security;
create policy "kit_visitas_select_admin"
  on public.kit_visitas for select to authenticated
  using (public.current_app_role() = 'admin');
-- Sin lectura para el creador: ve los totales por la función de abajo y no
-- filas (que dirían qué marca entró qué día).

create or replace function public.registrar_visita_kit(p_creator uuid, p_anonimo uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.app_role := public.current_app_role();
  v_dia date := (now() at time zone 'America/Costa_Rica')::date;
  v_quien text := coalesce(v_uid::text, p_anonimo::text);
begin
  if v_quien is null then return; end if;
  if v_uid is not null and (v_uid = p_creator or v_rol = 'admin') then return; end if;  -- RF-14
  if not exists (select 1 from public.creator_profiles
                  where profile_id = p_creator and verified) then return; end if;     -- RF-21
  insert into public.kit_visitas (creator_id, dia, huella, es_marca)
  values (p_creator, v_dia, md5(v_quien || ':' || p_creator::text || ':' || v_dia::text),
          v_rol is not distinct from 'brand')                                         -- decisión 4
  on conflict do nothing;                                                             -- RF-16
end;
$$;
revoke all on function public.registrar_visita_kit(uuid, uuid) from public;
grant execute on function public.registrar_visita_kit(uuid, uuid) to anon, authenticated;

create or replace function public.resumen_visitas_kit(p_creator uuid, p_desde date)
returns table (total bigint, de_marcas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), count(*) filter (where es_marca)
    from public.kit_visitas
   where creator_id = p_creator
     and dia >= p_desde
     and (p_creator = auth.uid() or public.current_app_role() = 'admin')   -- RF-19
$$;
revoke all on function public.resumen_visitas_kit(uuid, date) from public, anon;
grant execute on function public.resumen_visitas_kit(uuid, date) to authenticated;

commit;
```

**Antes de escribirla** (T04) se confirma con `grep` en `supabase/migrations/` que ninguna otra vista o función depende de `creator_public_profiles` (para que `create or replace` no choque) y se vuelve a comparar la lista de columnas de la vista con el OpenAPI de prod.

**Cómo se verifica que corrió:** GET al OpenAPI de PostgREST con service role: aparecen `orden_destacada`, `telefono_e164`, `mostrar_telefono`, `tiene_telefono` en la vista, las dos tablas y las cuatro rpc.

## Funciones puras (`src/lib/`)

Todas sin fechas implícitas: el "hoy" entra por parámetro.

**`src/lib/ugc/destacadas.ts`** — test `tests/unit/destacadas.test.ts`

```ts
export const MAX_DESTACADAS = 3;

/** Destaca si no está, la saca si está. Con 3 ya puestas, no agrega y avisa (RF-02). */
export function alternarDestacada(actuales: string[], id: string):
  { ok: true; ids: string[] } | { ok: false; error: string };

/** Sube o baja una destacada un lugar; en los bordes devuelve la lista igual. */
export function moverDestacada(actuales: string[], id: string, direccion: "antes" | "despues"): string[];

/** Parte el book en destacadas (por orden_destacada) y el resto (por position), sin repetir (RF-03, RF-04). */
export function separarDestacadas<T extends { id: string; position: number; orden_destacada: number | null }>(
  items: T[]
): { destacadas: T[]; resto: T[] };
```

**`src/lib/ugc/contacto-kit.ts`** — test `tests/unit/contacto-kit.test.ts`

```ts
export type ModoContacto =
  | "nada"                 // el creador no lo muestra (RF-12)
  | "propio"               // el creador mirando su kit (RF-11)
  | "ver"                  // marca verificada o equipo: botón "Ver teléfono" (RF-08)
  | "pedir-sesion"         // sin sesión (RF-09)
  | "marca-sin-verificar"  // marca con sesión pero sin verificar (RF-09)
  | "solo-marcas";         // otro creador o miembro con sesión (RF-09, sin CTA de login)

export function modoContacto(p: {
  tieneTelefono: boolean;
  creadorId: string;
  visitante: { id: string; rol: string | null; marcaVerificada: boolean } | null;
}): ModoContacto;

/** "+50688887777" → { legible: "+506 8888 7777", whatsapp: "https://wa.me/50688887777", llamar: "tel:+50688887777" } */
export function enlacesDeTelefono(e164: string): { legible: string; whatsapp: string; llamar: string };
```

La normalización (RF-07) NO se reescribe: el action usa `normalizarTelefonoCR` de `src/lib/whatsapp/twilio.ts`, que ya tiene tests. En T02 solo se suman a `tests/unit/whatsapp.test.ts` los casos que esta spec necesita y no estén (vacío → null, número con letras → null).

**`src/lib/ugc/visitas-kit.ts`** — test `tests/unit/visitas-kit.test.ts`

```ts
/** User-agents de lectores de vista previa y buscadores (RF-15). UA vacío o ausente también cuenta como bot. */
export function esBotDeVistaPrevia(userAgent: string | null | undefined): boolean;

/** Primer día de la ventana de N días que termina hoy (inclusive), en 'yyyy-MM-dd'. 30 días = hoy y los 29 anteriores. */
export function inicioVentanaVisitas(hoyCR: string, dias?: number): string;

/** Lo que dice la tarjeta del inicio (RF-17, RF-18), con singular/plural. */
export function textoVisitas(r: { total: number; deMarcas: number }):
  { vacio: true; titulo: string; nota: string } | { vacio: false; titulo: string; nota: string };
```

Lista de `esBotDeVistaPrevia` (regex sin distinguir mayúsculas): `facebookexternalhit`, `facebookcatalog`, `meta-externalagent`, `Facebot`, `^WhatsApp/`, `Twitterbot`, `Slackbot`, `Slack-ImgProxy`, `TelegramBot`, `Googlebot`, `Google-InspectionTool`, `AdsBot-Google`, `bingbot`, `LinkedInBot`, `Discordbot`, `Applebot`, `DuckDuckBot`, `YandexBot`, `Baiduspider`, `SkypeUriPreview`, `Pinterestbot`, `redditbot`, `Embedly`, `HeadlessChrome`, y genéricos `bot/`, `crawler`, `spider`.

- **Trampa:** el navegador interno de Instagram y Facebook (`Instagram 3xx…`, `FBAN/FBAV`) es una PERSONA tocando el link de la bio. El test fija que esos UA reales NO son bot; por eso no hay un `instagram` en la lista.
- `inicioVentanaVisitas` hace la cuenta sobre el texto `yyyy-MM-dd` en UTC puro (`T00:00:00Z`), no con `new Date()` local; los tests cruzan fin de mes, fin de año y un 29 de febrero.

**`src/lib/ugc/handles.ts`** — se suma `urlDelKit(origen: string, handle: string): string`, que hoy está escrita adentro de `CompartirPerfil`; la usan esa hoja y el botón nuevo del inicio. Test en `tests/unit/visitas-kit.test.ts` (con y sin "@").

## Archivos por área

**Destacadas (T09, T10)**
- `src/lib/actions/portfolio.ts`: `alternarDestacadaAction(formData)` y `moverDestacadaAction(formData)`. Leen las destacadas actuales del creador, calculan la lista con las funciones puras y llaman a `fijar_destacadas`. Si la pura devuelve error, el action lo devuelve para mostrarlo (RF-02); si la rpc devuelve `check_violation` (dos pestañas a la vez), el mismo mensaje.
- `deletePortfolioItemAction` no cambia: borrar la fila borra la marca (RF-05).
- `src/components/ugc/creador/PortfolioGrid.tsx`: en `VisorPieza`, botón "Destacar en mi kit" / "Quitar de destacadas", y si está destacada, "Destacada 2 de 3" con mover antes/después. En la grilla, una marca chica en la miniatura destacada. El aviso del tope va con el `Toaster` que ya existe (`useToast`).
- `src/app/ugc/(dashboard)/creador/book/page.tsx`: pasa `orden_destacada` a los tiles.
- `src/components/ugc/creador/CreatorDestacadas.tsx` (nuevo, cliente): el bloque del kit. Reusa `MediaLightbox`. Cada pieza con `onError` en `<img>`/`<video>` que la cambia por un hueco con "No se pudo cargar"; el bloque no se cae (caso límite del video borrado).
- `src/app/ugc/creadores/[handle]/page.tsx`: usa `separarDestacadas`; el bloque solo si hay destacadas (RF-04); `CreatorPublicBook` recibe el resto.

**Contacto (T11–T13)**
- `src/lib/actions/creator-profile.ts`: `guardarContactoAction(prev, formData)` propio, NO dentro de `updateCreatorProfileDetailsAction`. Normaliza con `normalizarTelefonoCR`; si viene vacío borra el número y apaga `mostrar_telefono`; si no se puede normalizar devuelve "Revisá el número: …" sin guardar.
- `src/components/ugc/creador/ContactoDelKit.tsx` (nuevo): sección del perfil con el número, el interruptor "Mostrar mi teléfono en mi kit" (apagado por defecto) y el aviso "Lo ven solo las marcas verificadas, y lo que ven lo pueden anotar". Se monta en `creador/perfil/page.tsx` debajo de `PerfilEditor`.
- `src/components/ugc/creador/CompartirPerfil.tsx`: usa `urlDelKit`; la nota del pie suma "Tu teléfono solo lo ven las marcas verificadas" cuando lo muestra.
- `src/lib/actions/kit.ts` (nuevo): `verTelefonoAction(creadorId)` → llama a `ver_telefono_creador` con la sesión del visitante y devuelve `{ telefono } | { error }`. No usa service role: quién es lo decide la base con `auth.uid()`.
- `src/components/ugc/KitContacto.tsx` (nuevo, cliente): pinta según `ModoContacto`. En "ver", botón "Ver teléfono" → action → número con "Abrir WhatsApp" y "Llamar" (`enlacesDeTelefono`). En "pedir-sesion", links a `/ugc/login?intent=marca`.
- `src/app/ugc/creadores/[handle]/page.tsx`: suma `auth.getUser()`, el rol (`profiles.role`), `brand_profiles.verified` si es marca y, si es el dueño, su `telefono_e164` (la RLS se lo deja leer). Con eso arma `modoContacto`.
- `src/components/ugc/NotificationsBell.tsx`: rama `telefono_visto` → "{marca} vio tu teléfono en tu kit", href `/ugc/marcas/{brand_slug}` (o `/ugc/creador` si no hay slug).

**Visitas (T14, T15)**
- `src/app/api/ugc/visitas-kit/route.ts` (nuevo, `POST`): body `{ creador }` (uuid validado). Si `esBotDeVistaPrevia(UA)` → 204. Si no hay sesión, lee o crea la cookie `ugc_visitante` (`crypto.randomUUID()`, httpOnly, `sameSite: lax`, `secure` en prod, 1 año) y la manda como `p_anonimo`. Llama a `registrar_visita_kit` con el cliente de `@/lib/supabase/server`. Siempre 204: si algo falla, se loguea y la página no se entera.
- `src/components/ugc/RegistrarVisitaKit.tsx` (nuevo, cliente): un `useEffect` con guarda de `useRef` que hace `fetch(..., { method: "POST", keepalive: true })` una vez. No renderiza nada. El kit lo monta solo si quien mira no es el dueño ni admin (ahorra el request; la base igual lo descarta).
- `src/app/ugc/(dashboard)/creador/page.tsx`: llama a `resumen_visitas_kit(user.id, inicioVentanaVisitas(diaCR(new Date())))` dentro del `Promise.all` existente, y pinta una tarjeta con `textoVisitas`. En vacío (RF-18), el botón `CopiarLinkKit`.
- `src/components/ugc/creador/CopiarLinkKit.tsx` (nuevo): un botón que copia `urlDelKit(window.location.origin, handle)` con el mismo respaldo de selección que `CompartirPerfil`. No reusa la hoja entera porque la spec pide "el botón para copiarlo", no dos toques.

**Tipos (T05):** `src/lib/database.types.ts` a mano: columnas nuevas de `portfolio_items` (Row/Insert) y `creator_profiles`, `tiene_telefono` en la vista, las tablas `kit_visitas` y `kit_telefono_vistas`, y las 4 funciones en `Functions`.

**Privacidad (T16):** `src/app/legal/privacidad/page.tsx` §5 (el teléfono, si el creador lo muestra, lo ven solo marcas verificadas) y §10 (una cookie aleatoria para no contar dos veces la misma visita; sin datos personales). El texto lo aprueba Evan antes de commitear.

## Decisiones técnicas

- **Destacadas como columna `orden_destacada` en `portfolio_items`.** RF-05 sale gratis (la marca muere con la fila) y el tope de 3 lo garantizan un `check 1..3` + `unique (creator_id, orden_destacada)`: aunque alguien llame a PostgREST directo, no hay lugar para una cuarta. *Descartado:* tabla `piezas_destacadas`, que pide su propia RLS, un FK con `on delete cascade` para lograr lo mismo, y un join más en el kit.
- **Unique común y no índice parcial:** los NULL no chocan entre sí, que es exactamente "muchas sin destacar". Reordenar se hace en `fijar_destacadas`, que primero pone todas en null y después las numera, así el unique nunca ve dos en el mismo lugar.
- **El teléfono en `creator_profiles` y no en una tabla aparte.** Esa tabla ya está cerrada a dueño + admin desde la auditoría de agosto, y la vista pública lista sus columnas a mano (no `cp.*`), así que una columna nueva no se filtra sola. *Descartado:* `creator_contacto` aparte: más RLS que mantener para el mismo efecto.
- **Revelar el número con una rpc `security definer` que en el mismo acto registra y notifica.** Es la única forma de que "ver" y "avisar" no se puedan separar: si la marca leyera el número por un lado y la notificación saliera de otro request, se podría ver sin avisar. Chequea dentro de la función, con `auth.uid()`, rol, verificación de la marca y del creador y `mostrar_telefono`; sin EXECUTE para anon.
- **Dedupe de la notificación con PK en `kit_telefono_vistas`.** *Descartado:* el `not exists` sobre `notifications.payload` que usan los avisos de cupones: depende del jsonb, tiene carrera con dos clics simultáneos y mezcla el log con la campana.
- **Las visitas se registran desde el navegador, con un POST a un route handler.** *Descartados:*
  - Registrar en el render del Server Component: un Server Component no puede setear la cookie anónima (Next 16), contaría los prefetch y todos los bots que no ejecutan JS.
  - Server action: setear una cookie desde un server action hace que Next vuelva a renderizar la ruta, o sea el kit entero dos veces en la primera visita (egress de Supabase, que es la primera pared).
  - Setear la cookie en `src/proxy.ts`: correría en cada request de `/ugc`.
  - De paso, los lectores de vista previa casi nunca ejecutan JS: el filtro por user-agent es la segunda red, no la única.
- **La identidad del visitante la decide la base.** Con sesión, `registrar_visita_kit` usa `auth.uid()` e ignora `p_anonimo`, así que no se puede hacerse pasar por otro; la exclusión del dueño y del equipo (RF-14) vive en SQL y no solo en el componente.
- **Huella con md5 y día adentro.** Sin guardar ids en claro, coherente con la política de privacidad; `md5` es nativo (no hace falta `pgcrypto`). No es para seguridad, es para no repetir.
- **El creador ve totales por rpc, no filas.** Con lectura de `kit_visitas` podría deducir qué marca entró cada día; la spec deja eso fuera (analítica detallada).
- **La ventana de 30 días se calcula en TS y entra por parámetro** (`p_desde`), para que la regla tenga test unitario; la rpc no la puede abusar porque solo devuelve lo del propio creador.
- **Formulario propio para el teléfono.** *Descartado:* meterlo como input oculto en `PerfilEditor`: un form de edición que no manda el campo lo vacía (ya mordió: "defaultValue fijo = dato borrado"), y un cliente con el bundle viejo durante el deploy borraría todos los teléfonos.

## Riesgos

- **Desplegar código antes de la migración** rompe el kit en prod. Mitigado con el orden: T05 en adelante no se pushea hasta que Evan confirme que corrió T04.
- **`security definer` con huecos** (ya pasó, ver el gate de verificación): mitigado con `search_path` fijo, `revoke ... from public, anon` explícito (Supabase le da EXECUTE a anon a toda función nueva), `is distinct from` para roles null, y un test RLS por cada camino que debe devolver null.
- **Una marca verificada juntando teléfonos de muchos creadores:** la spec lo acepta; `kit_telefono_vistas` deja el rastro para detectarlo.
- **Inflar visitas** llamando a la rpc con uuids anónimos al azar: aceptado por la spec (número orientativo). Cada fila pesa ~100 bytes; si un día molesta, se agrega un tope por IP en el route handler.
- **Bots con JS que se hacen pasar por navegador:** inflan, aceptado.
- **Chrome headless para verificar en navegador** manda `HeadlessChrome` y queda filtrado como bot: para probar visitas hay que usar Chrome normal o pisar el user-agent.
- **El `check_violation` de 3 con dos pestañas abiertas:** el action lo traduce al mismo aviso de RF-02.
- **Tests RLS contra prod:** las notificaciones `telefono_visto` van al creador de prueba y se borran en cascada con él; igual el `afterAll` las borra explícitamente antes de `cleanup()` y verifica que no haya ninguna con `brand_id` de prueba en perfiles reales.

## Tests por RF

Unit = `npm test`. RLS = `npm run test:rls` (habla con PROD; cuentas `makeUser`, `verifyCreator`, `admin`, `anonClient`, `cleanup` de `tests/rls/helpers.ts`). Navegador = recorrida en `localhost:3000` con las cuentas de prueba (marca verificada, marca sin verificar, creador, admin, sin sesión).

| RF | Cómo se verifica |
|---|---|
| RF-01 | Unit `alternarDestacada`/`moverDestacada`. RLS: `fijar_destacadas([a,b,c])` deja 1,2,3 en ese orden; reordenar cambia el orden. Navegador: destacar 3 desde el visor del book |
| RF-02 | Unit: con 3, `alternarDestacada` devuelve error. RLS: `fijar_destacadas` con 4 ids falla; un `update` directo de una cuarta fila a `orden_destacada = 3` choca con el unique; ids de otro creador fallan. Navegador: aviso al intentar la 4ª |
| RF-03 | Unit `separarDestacadas` (orden y sin repetir). Navegador: bloque propio en el kit |
| RF-04 | Unit: sin destacadas → `destacadas` vacío. Navegador: kit sin el bloque |
| RF-05 | RLS: borrar la pieza destacada y releer → las otras siguen, la borrada no está, y se puede destacar otra |
| RF-06 | RLS: el creador guarda su número y `mostrar_telefono`; default `false`; `mostrar_telefono = true` sin número falla por check. Navegador: sección Contacto del perfil |
| RF-07 | Unit `normalizarTelefonoCR` (casos sumados). RLS: un `telefono_e164` inválido rebota en el check. Navegador: "8888 7777" se guarda como +50688887777, "abc" muestra el error |
| RF-08 | Unit `modoContacto` → "ver"; `enlacesDeTelefono`. RLS: marca verificada recibe el número por `ver_telefono_creador`. Navegador: "Ver teléfono" → WhatsApp y Llamar |
| RF-09 | Unit `modoContacto` → "pedir-sesion", "marca-sin-verificar", "solo-marcas". Navegador: sin sesión y con marca sin verificar |
| RF-10 | RLS: anon no puede ejecutar `ver_telefono_creador`; otro creador y marca sin verificar reciben null; anon, otro creador y marca no leen `telefono_e164` de `creator_profiles`; la vista no tiene la columna (pedirla da error) ni anon ni marca; marca que pierde la verificación recibe null; admin recibe el número. curl sin sesión al OpenAPI: la vista no expone el número |
| RF-11 | Unit `modoContacto` → "propio". Navegador: el creador mira su kit y ve su número con la aclaración |
| RF-12 | Unit `modoContacto` → "nada" con `tieneTelefono` false. RLS: con `mostrar_telefono = false`, la marca verificada recibe null y `tiene_telefono` es false. Navegador: sin bloque de contacto |
| RF-12b | RLS: tras `ver_telefono_creador`, el creador tiene 1 notificación `telefono_visto` con `brand_name`. Navegador: la campanita dice qué marca |
| RF-12c | RLS: dos llamadas seguidas de la misma marca → 1 notificación; otra marca → 2 |
| RF-13 | RLS: anon con `p_anonimo` suma 1 visita. Revisión del route handler: la cookie es un uuid aleatorio y la tabla guarda solo la huella |
| RF-14 | RLS: el dueño y un admin llaman a `registrar_visita_kit` → 0 filas nuevas |
| RF-15 | Unit `esBotDeVistaPrevia` con UA reales de cada bot y de Instagram/Facebook in-app, Safari y Chrome. Navegador: `curl -A "facebookexternalhit/1.1" -X POST` al route handler no suma |
| RF-16 | RLS: mismo anon dos veces → 1; otro anon → 2; misma marca dos veces → 1 |
| RF-17 | Unit `inicioVentanaVisitas` y `textoVisitas`. RLS: `resumen_visitas_kit` devuelve total y de_marcas correctos; una visita con `dia` de hace 31 días (insertada con service role) no cuenta |
| RF-18 | Unit `textoVisitas` en cero. Navegador: inicio de un creador sin visitas, el botón copia el link |
| RF-19 | RLS: otro creador y una marca reciben 0/0 de `resumen_visitas_kit` de un creador ajeno; anon no puede ejecutarla; `kit_visitas` da 0 filas a anon, creador y marca; admin ve los totales |
| RF-20 | Navegador: `/ugc/creadores/@handle` y `/ugc/creadores/handle` abren el mismo kit (sin cambio de ruta) |
| RF-21 | RLS: `tablas-de-abajo.test.ts` sigue en verde; `registrar_visita_kit` sobre un creador sin verificar no inserta. curl sin sesión al kit de un creador sin verificar → 404 |

**Limpieza de los tests RLS.** Cada archivo nuevo cierra con un `afterAll` que primero borra lo que no cuelga en cascada de las cuentas de prueba —en particular cualquier `notifications` con `type = 'telefono_visto'` y `payload->>brand_id` de una marca de prueba— y después llama a `cleanup()`. Ninguna de las funciones nuevas notifica a admins, pero el test lo comprueba: después de las llamadas, ningún admin real tiene notificaciones nuevas de tipo `telefono_visto`.

## Verificación en navegador (T17)

- Kit con cada visitante: sin sesión, marca verificada, marca sin verificar, otro creador, el dueño, admin. Mirar destacadas, contacto, que "Ver teléfono" abra WhatsApp con el número correcto y que la campanita del creador muestre una sola notificación aunque la marca toque dos veces.
- Kit con una destacada cuyo archivo se borró de Storage: el bloque se ve con el hueco.
- Book: destacar 3, intentar la 4ª, reordenar, borrar una destacada.
- Perfil: guardar, borrar y ocultar el número; formatos raros.
- Inicio: con cero visitas (estado vacío y copiar) y con visitas de marca.
- Vista previa del link pegado en WhatsApp: sigue armándose y no suma una visita.

## Preguntas abiertas para Evan

El plan toma la opción indicada entre paréntesis hasta que Evan diga otra cosa; ninguna bloquea T01–T08.

1. **RF-11 contra RF-12:** si el creador NO eligió mostrar su teléfono, ¿en su propio kit no ve nada (como cualquiera), o ve un aviso tipo "No mostrás tu teléfono, activalo en tu perfil"? (Nada.)
2. **Destacadas y book:** ¿una pieza destacada sale también en la grilla del book, o solo arriba? "Separadas del resto" se leyó como que no se repite. (Solo arriba.)
3. **Volver al kit después del login:** la marca que entra desde "Ver teléfono" cae en `/ugc/marca`, no vuelve al kit, porque `destinoConNext` solo deja volver dentro del panel (por seguridad contra redirecciones abiertas). ¿Hace falta que vuelva? Sería un `/feature` aparte sobre el login. (No vuelve.)
4. **RF-09 para quien tiene sesión y no es marca** (otro creador, un miembro de Close Friends): ¿se le ofrece "registrate como marca"? (No: solo "lo ven las marcas verificadas".) Y la marca sin verificar ve "Lo vas a poder ver cuando verifiquemos tu marca".
5. **El equipo y el botón "Ver teléfono":** RF-10 permite que el equipo vea el número; el plan les muestra el botón y NO le avisa al creador. ¿Está bien que no se entere? (No se entera.)
6. **Cuánto tiempo se guardan las visitas y los "vio tu teléfono":** el creador solo ve 30 días. ¿Se borran después de un tiempo (por ejemplo 90 días) o quedan? (Quedan hasta que se decida; la política de privacidad §6 debería decirlo.)
7. **Texto de la política de privacidad** (T16): lo aprueba Evan.
8. **"Últimos 30 días"** se tomó como hoy y los 29 días anteriores, en hora de Costa Rica.
