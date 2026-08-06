# Loyalty Loop · Plan de implementación

**Plataforma:** Q Labs / UGC·CRC (qlabsmethod.com)
**Stack:** Next.js 14+ · Supabase (Auth, Postgres + RLS, Storage) · Tailwind · Vercel · Resend
**Responsable:** Evan, con Claude Code
**Referencia visual:** `loyalty-loop-demo.html` (demo aprobado)
**Principio rector:** UNIFICAR, NO DUPLICAR — el módulo se integra sobre el auth, los perfiles y el motor de campañas existentes. No se crea ningún modelo de usuario, marca o sesión nuevo.

---

## 1. Resumen del módulo

Loyalty Loop es el sistema de fidelización *creator-facing* de UGC·CRC:

1. **Puntos y niveles.** Los creadores acumulan puntos por acciones en la plataforma (con peso fuerte en resultados: entregas aprobadas y ratings). Los puntos definen el nivel: Bronce → Plata → Oro → Platino.
2. **Cupones por nivel.** Las marcas verificadas crean cupones (Producto / Servicio / Evento) y definen la audiencia: todos, o nivel mínimo. Marca verificada publica directo, sin revisión de Q Labs.
3. **Canje con QR.** El creador reclama → se genera código único + QR → el staff de la marca valida escaneando o digitando el código → el canje queda registrado y el código quemado.

Reglas fijas del MVP:
- Los puntos **no vencen**; los niveles **no bajan**.
- **Un canje por creador por cupón.**
- Reclamo **sin aprobación manual** (nivel + stock son el control).
- Cupón tipo Evento: el QR es la entrada; leyenda automática no editable: *"Incluye entrada al evento. El consumo dentro del evento corre por cuenta del creador."*
- El **ledger es la fuente de verdad**: el nivel siempre se calcula de la suma de `points_events`, nunca se edita a mano.

---

## 2. Reglas de negocio (valores confirmados)

### 2.1 Tabla de puntos

| Acción | Clave (`action`) | Puntos | Límite anti-farming |
|---|---|---|---|
| Completar perfil al 100% | `profile_completed` | +50 | Una sola vez por creador |
| Subir pieza al book | `book_upload` | +10 | Máx. 5 puntuables/mes (tope +50/mes) |
| Aplicar a promo | `application` | +5 | Máx. 10 puntuables/mes (tope +50/mes) |
| Seleccionado en campaña | `campaign_selected` | +50 | Sin límite |
| Entrega aprobada | `delivery_approved` | +150 | Sin límite |
| Rating 5★ en entrega | `rating_5` | +50 | Por entrega |
| Rating 4★ en entrega | `rating_4` | +20 | Por entrega |

### 2.2 Umbrales de nivel

| Nivel | `level` | Puntos mínimos |
|---|---|---|
| Bronce | 1 | 0 |
| Plata | 2 | 500 |
| Oro | 3 | 1,500 |
| Platino | 4 | 4,000 |

Ambas tablas viven en **configuración de base de datos** (no hardcodeadas en el frontend) para poder ajustar valores sin deploy.

---

## 3. Modelo de datos (Supabase / Postgres)

> Antes de crear nada: **auditar el esquema existente** y reutilizar las tablas reales de creadores, marcas, campañas, aplicaciones y entregas. Los nombres de FK abajo (`creator_id`, `brand_id`) deben mapearse a los IDs reales del esquema actual.

### 3.1 `point_rules` — configuración de puntos
```sql
create table point_rules (
  action        text primary key,          -- 'delivery_approved', 'book_upload', ...
  points        int  not null,
  monthly_cap   int,                       -- null = sin límite; en unidades de eventos/mes
  once_only     boolean not null default false,
  active        boolean not null default true
);
```

### 3.2 `level_thresholds` — configuración de niveles
```sql
create table level_thresholds (
  level      int  primary key,             -- 1..4
  name       text not null,                -- 'Bronce', 'Plata', 'Oro', 'Platino'
  min_points int  not null
);
```

### 3.3 `points_events` — el ledger (fuente de verdad)
```sql
create table points_events (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references <tabla_creadores>(id),
  action         text not null references point_rules(action),
  points         int  not null,            -- snapshot del valor al momento del evento
  reference_type text,                     -- 'delivery' | 'application' | 'book_piece' | ...
  reference_id   uuid,                     -- FK lógica al registro que originó el evento
  created_at     timestamptz not null default now(),
  unique (creator_id, action, reference_id)  -- idempotencia: un evento por acción+referencia
);
create index on points_events (creator_id, created_at);
```

Notas clave:
- `points` se **congela** al insertar (si mañana cambia la regla, la historia no se reescribe).
- La restricción `unique` hace idempotente el otorgamiento: reintentar un webhook/trigger no duplica puntos.
- Los topes mensuales se validan en la función de otorgamiento (contar eventos del mes por acción antes de insertar).

### 3.4 Nivel calculado — view + función
```sql
create view creator_points as
  select creator_id, coalesce(sum(points),0) as total_points
  from points_events group by creator_id;

create function creator_level(p_creator uuid) returns int
language sql stable as $$
  select coalesce(max(lt.level), 1)
  from level_thresholds lt
  where lt.min_points <= (select coalesce(sum(points),0)
                          from points_events where creator_id = p_creator);
$$;
```
(Si el volumen crece, materializar en una columna cacheada actualizada por trigger — no necesario para el MVP.)

### 3.5 `coupons`
```sql
create type coupon_type   as enum ('producto','servicio','evento');
create type coupon_status as enum ('borrador','publicado','pausado','agotado','vencido');

create table coupons (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references <tabla_marcas>(id),
  title               text not null,
  type                coupon_type not null,
  description         text not null,
  image_url           text,
  min_level           int  not null default 1 references level_thresholds(level),
  stock_total         int  not null check (stock_total > 0),
  claim_validity_days int,                 -- vigencia relativa desde el reclamo
  expires_at          timestamptz,         -- o fecha fija (eventos usan esta)
  event_date          timestamptz,         -- solo type='evento'
  event_location      text,                -- solo type='evento'
  conditions          text,                -- condiciones adicionales opcionales
  status              coupon_status not null default 'borrador',
  created_at          timestamptz not null default now(),
  check (claim_validity_days is not null or expires_at is not null),
  check (type != 'evento' or event_date is not null)
);
```

### 3.6 `redemptions` — reclamos y canjes
```sql
create type redemption_status as enum ('reclamado','canjeado','expirado');

create table redemptions (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid not null references coupons(id),
  creator_id   uuid not null references <tabla_creadores>(id),
  code         text not null unique,       -- 'QL-XXXX-XX'
  status       redemption_status not null default 'reclamado',
  claimed_at   timestamptz not null default now(),
  expires_at   timestamptz not null,       -- calculado al reclamar
  redeemed_at  timestamptz,
  validated_by uuid,                       -- usuario de marca que confirmó
  unique (coupon_id, creator_id)           -- un canje por creador por cupón
);
```

Stock disponible = `stock_total - count(redemptions where status in ('reclamado','canjeado'))`. Los `expirado` liberan stock automáticamente por no contar.

### 3.7 RPCs transaccionales (funciones `security definer`)
Estas tres operaciones NUNCA se hacen con inserts directos desde el cliente:

1. **`award_points(creator, action, reference_type, reference_id)`** — valida regla activa, `once_only`, tope mensual; inserta en el ledger con el valor congelado. Se invoca desde los flujos existentes (ver §4, Fase 1).
2. **`claim_coupon(coupon_id)`** — en una transacción con lock sobre el cupón: verifica `status='publicado'`, nivel del creador ≥ `min_level`, no-reclamo previo, y stock disponible; genera código único (charset sin ambiguos: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, formato `QL-XXXX-XX`); calcula `expires_at`; inserta el reclamo.
3. **`redeem_coupon(code)`** — solo ejecutable por usuarios de la marca dueña del cupón: valida que exista, esté `reclamado` y no vencido; marca `canjeado`, sella `redeemed_at` y `validated_by`. Devuelve error tipado si ya fue canjeado o expiró.

### 3.8 RLS (por rol)
- **Creador:** lee sus propios `points_events` y `redemptions`; lee cupones `publicado` (todos — el frontend muestra los de nivel superior como bloqueados 🔒, igual que el demo); nunca inserta directo (solo vía RPC).
- **Marca:** CRUD de sus propios `coupons` (publicar solo si la marca está verificada — reutilizar el flag de verificación existente); lee `redemptions` de sus cupones; ejecuta `redeem_coupon` solo sobre códigos propios.
- **Admin (Q·OS):** lectura global de todo.
- `point_rules` y `level_thresholds`: lectura pública autenticada, escritura solo admin.

### 3.9 Expiración automática
Edge Function con cron (diario): `update redemptions set status='expirado' where status='reclamado' and expires_at < now();` y marcar cupones `vencido`/`agotado` según corresponda.

---

## 4. Fases de implementación

### Fase 1 — Motor de puntos (sin UI nueva)
1. Migraciones: `point_rules`, `level_thresholds` (con seed de los valores de §2), `points_events`, view y función de nivel, RLS.
2. RPC `award_points` con idempotencia y topes mensuales.
3. **Instrumentar los flujos existentes** — localizar en el código actual los puntos exactos donde ocurren: aprobación de entrega, rating de la marca, selección de aplicante, subida al book, aplicación a promo, perfil completado — y llamar a `award_points` ahí. No inventar flujos nuevos.
4. Backfill opcional: otorgar puntos históricos por entregas ya aprobadas (decisión de negocio — dejar el script listo pero no ejecutarlo sin confirmación de Andrés).

✅ **Criterio de aceptación:** aprobar una entrega en staging genera +150 en el ledger una sola vez, aunque el evento se dispare dos veces; el tope mensual de book/aplicaciones se respeta.

### Fase 2 — Lado creador: sección "Recompensas"
1. Nueva entrada "Recompensas" en el sidebar de `/ugc/creador`.
2. Hero de nivel: badge, puntos totales, barra de progreso al siguiente nivel, escalera de rangos (como el demo).
3. Feed de cupones: tarjetas con marca/tipo/audiencia/stock/vigencia; bloqueadas con 🔒 y "te faltan X pts" si el nivel no alcanza; leyenda automática en eventos.
4. Reclamo → RPC `claim_coupon` → modal con QR (lib `qrcode` u similar, encodeando la URL de validación `https://qlabsmethod.com/ugc/marca/validar/{code}`) + código corto + vencimiento.
5. Historial de puntos (tabla del ledger propio).

✅ **Criterio de aceptación:** un creador Plata puede reclamar cupones "Todos"/"Plata" pero no "Oro"; el reclamo descuenta stock; recargar la página conserva el código.

### Fase 3 — Lado marca: panel Loyalty Loop
1. Activar la tarjeta Loyalty Loop del Centro de Mando: de "Conocé más" → "Abrir panel" (`/ugc/marca/loyalty`).
2. KPIs: cupones activos, reclamos, canjes.
3. CRUD de cupones con el formulario del demo (tipo Evento revela fecha/ubicación + leyenda fija). Estados: `borrador → publicado → pausado → agotado/vencido`. Marca no verificada: solo borradores (reutilizar el patrón exacto de campañas).
4. Página de validación `/ugc/marca/validar/[code]`: requiere sesión de la marca dueña; muestra creador (foto, handle, nivel) + cupón + botón "Confirmar canje" → RPC `redeem_coupon`. Fallback: input manual de código en el tab Validar.
5. Tab Canjes: tabla de `redemptions` de la marca.

✅ **Criterio de aceptación:** flujo completo demo-real: reclamar como creador, escanear/pegar código como marca, confirmar; segundo intento con el mismo código devuelve "ya canjeado"; un código de otra marca devuelve "no encontrado".

### Fase 4 — Admin (Q·OS) + operación
1. Vista "Loyalty Loop" en el panel interno: tabla de todos los creadores (puntos, nivel, entregas, canjes, último evento) con drill-down al ledger individual; registro global de canjes.
2. Edge Function cron de expiración (§3.9).
3. Notificaciones por la campana existente (mismo componente compartido): "Subiste a Oro 🥇", "Tu cupón vence en 3 días", "Nuevo canje en tu local" (marca). Email vía Resend solo para subida de nivel (no spamear).

✅ **Criterio de aceptación:** un reclamo vencido pasa a `expirado` y el stock se libera; la tabla admin cuadra con la suma del ledger.

---

## 5. Orden de trabajo sugerido para Claude Code

Sesión por fase, en este orden estricto: **1 → 2 → 3 → 4**. Cada fase termina con sus criterios de aceptación verificados en staging antes de seguir.

Prompt de arranque sugerido (ajustar rutas al repo real):

> Estás trabajando en el monorepo de la plataforma Q Labs (Next.js 14 + Supabase). Vas a implementar el módulo **Loyalty Loop** siguiendo el plan `loyalty-loop-plan-implementacion.md` y el demo visual `loyalty-loop-demo.html` como referencia de UI (respetar el design system existente: Outfit, tokens violeta-índigo, dark OS).
>
> Regla número uno: **UNIFICAR, NO DUPLICAR.** Antes de crear cualquier tabla, componente o helper, auditá el esquema de Supabase y los componentes existentes (tarjetas, tablas, tabs, badges, campana de notificaciones, flag de verificación de marca) y reutilizalos. Los nombres de FK del plan son placeholders — mapealos a las tablas reales.
>
> Implementá SOLO la Fase N. Al terminar, mostrame las migraciones y un resumen de los puntos de integración que tocaste, y esperá mi confirmación antes de aplicar nada en producción.

---

## 6. Fuera de alcance del MVP (fase 2 del módulo, futuro)

- Temporadas / reset de puntos, niveles que bajan
- Más de un canje por creador por cupón (configurable por la marca)
- Puntos negativos / penalizaciones
- Cupones patrocinados o destacados (monetización del módulo)
- Estadísticas avanzadas para la marca (conversión reclamo→canje, alcance por nivel)
- Integración de puntos con Academia y el sistema XP de la fase 3 del roadmap general
