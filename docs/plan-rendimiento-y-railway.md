# Plan: rendimiento de navegación, emails a directores y migración a Railway

Escrito el **2026-08-01**. Todo lo que sigue está medido contra producción o
verificado en el código — no hay estimaciones a ojo. Las mediciones están al
final para que nadie las repita.

Estado al escribirlo: nada de esto está hecho. Cuatro commits de McLovin en
`main` (`32b1aef` la punta), app corriendo en Vercel Hobby.

---

## Fase A — Percepción · ~45 min · riesgo cero

Es la fase de mejor relación impacto/esfuerzo del plan. El servidor ya responde
en 250-300 ms; lo que está mal es que ese tiempo es pantalla congelada.

### A1. Agregar `loading.tsx`

No existe **ninguno** en toda la app (tampoco `error.tsx` ni `not-found.tsx`).

Crear en:
- `src/app/ugc/loading.tsx`
- `src/app/ugc/(dashboard)/admin/loading.tsx`
- `src/app/ugc/(dashboard)/creador/loading.tsx`
- `src/app/ugc/(dashboard)/marca/loading.tsx`

Que sean **esqueletos con la forma real** de cada página (tarjetas grises de la
misma altura que las de verdad), no spinners. Un spinner dice "esperá"; un
esqueleto dice "ya casi". Reusar las clases de `qos.module.css`.

**Por qué es lo que más pesa, y es un efecto multiplicativo:** en App Router,
`<Link>` prefetchea una ruta dinámica **solo hasta su `loading.tsx` más
cercano**. Sin ese archivo no se descarga nada por adelantado, y sin frontera de
Suspense el router tampoco puede pintar nada: se queda en la página vieja hasta
que llega el RSC completo. Las 27 rutas `force-dynamic` y la falta de
`loading.tsx` se refuerzan entre sí.

### A2. El video del hero

`src/components/marketing/Hero.tsx:51`

```tsx
<video src="/hotels_video.mp4" autoPlay loop muted playsInline />
```

`public/hotels_video.mp4` pesa **10 MB** y baja siempre, sin `preload` ni
`poster`. Cuando el usuario hace clic en UGC·CRC, la request de la página hace
cola detrás del video. Agregar `preload="none"` y un `poster`.

(`public/testimonios_compressed.mp4` son 49 MB pero ya tiene `preload="metadata"`
en `VideoTestimonial.tsx:41` — ese está bien, no tocar.)

### A3. FontAwesome fuera del CDN

`src/app/layout.tsx:65-68` inyecta un `<link rel="stylesheet">` a
`cdnjs.cloudflare.com` en **todas** las páginas, incluido el panel. Es CSS
bloqueante de un tercero: DNS + TLS + descarga antes del primer pintado, en cada
carga completa. Self-hostearlo, o al menos no cargarlo en `/ugc/(dashboard)/*`.

---

## Fase B — Latencia real · ~2 h

### B1. Colapsar las validaciones de sesión

En una carga completa de `/ugc/creador/pipeline` hay **4 `auth.getUser()` en
serie**, cada uno una llamada HTTPS real a Supabase (no decodifica el JWT local):

1. `src/lib/supabase/middleware.ts:31`
2. `src/app/ugc/(dashboard)/layout.tsx:14`
3. `src/lib/auth/require-role.ts:17` (vía el layout del rol)
4. la página

Más el `profiles.select("role")` de `require-role.ts:23`. Nada está memoizado:
`src/lib/supabase/server.ts:5` crea un cliente nuevo en cada llamada.

**Envolver con `React.cache`** el `getUser()` y el cliente de servidor. 4 viajes → 1.

Ojo con el matiz: gracias al *partial rendering*, el layout **no** se re-renderiza
al navegar entre pestañas hermanas. Estos 4 viajes se pagan en cargas completas y
al cruzar de sección, no en cada clic. Lo que sí se paga siempre es el middleware.

### B2. El `await` suelto del layout admin

`src/app/ugc/(dashboard)/admin/layout.tsx:31-34` — el `count` de disputas quedó
fuera del `Promise.all` de la línea 13 y **no depende de nada** de esa ola. Es un
viaje completo de red, gratis, en cada render del layout. Moverlo adentro.

### B3. Paralelizar awaits independientes

| Archivo | Problema |
|---|---|
| `admin/heroes/page.tsx:34` | `content_columns` no depende de nada y va en la 3.ª ola. **Cero `Promise.all` en la página** |
| `admin/heroes/[id]/page.tsx:27` y `:35` | Solo dependen de `id`, deberían ir juntas |
| `marca/page.tsx:42` y `:44` | `profile` y `campaigns` son independientes, van en serie |
| `creador/pipeline/page.tsx:16` y `:20` | `columns` y `tasks` son independientes |

### B4. Que `/ugc` vuelva a ser prefetcheable

`src/components/ugc/public/PublicNav.tsx:8-11` llama a `getUser()` y, si hay
sesión, encadena una consulta a `profiles` (`:18-22`). Eso saca a `/ugc` del
prerender estático: una página de marketing pagando tres viajes de auth.

Meterlo tras un `<Suspense>` o resolver la sesión del lado del cliente.

### B5. Middleware — con una advertencia importante

`src/lib/supabase/middleware.ts:29-31` hace `getUser()` **antes** de comprobar
`isProtected` (`:37-40`), así que también lo paga `/ugc`, `/ugc/login` y los
perfiles públicos, donde el resultado se descarta.

⚠️ **Ese `getUser()` es además lo que refresca el token de sesión** — Supabase lo
documenta explícitamente. Saltearlo en rutas públicas es una optimización real
pero no gratuita: alguien que navegue solo por lo público puede quedar con la
sesión vencida. Hacerlo sabiendo eso.

El matcher (`src/proxy.ts`) tampoco excluye `_next/static` ni `_next/image`.

### B6. Después: `creador/aplicaciones`

`creador/aplicaciones/page.tsx` es la peor del repo: **5 viajes encadenados**,
cada consulta alimentando el `.in()` de la siguiente (`:29`, `:37`, `:45`).
Arreglarla bien necesita aplanar con joins de PostgREST. Ganancia rápida: lanzar
`brand_profiles` (`:38`) en paralelo con `application_deliveries` (`:46`).

---

## Fase C — Emails solo a directores · ~15 min

Hoy `src/lib/ugc/admin-alerts.ts:43` le escribe a **todos los perfiles con rol
admin** — son 5. El equipo tiene 3 directores, 1 pm y 1 guionista.

Filtrar por `staff_members.staff_role = 'director'` y `active = true`.

Dos criterios acordados con Evan:
- **La campanita sigue yendo a todos los admins.** Es gratis y en la app; el
  recurso escaso es el email (Resend: 100/día en el plan gratis).
- **Si no hay ningún director activo, escribirle a todos los admins.** Un filtro
  que puede vaciarse tiene que fallar hacia el ruido, no hacia el silencio.

El otro punto de reparto masivo es `api/qos/agente/webhook/route.ts:298`
(`contacto_wa_nuevo`), pero ese es solo campanita, sin email.

---

## Fase D — Migración a Railway

| Qué | Acción |
|---|---|
| `vercel.json` (cron diario) | **No tiene equivalente.** Ver abajo |
| `@vercel/analytics` (`src/app/layout.tsx:3`) | Sacar o reemplazar |
| `maxDuration` en 3 rutas | Quedan sin efecto — y eso resuelve el techo del cron |
| `after()` (`webhook/route.ts:249`) | Es de Next, funciona igual |
| Build | Agregar `output: 'standalone'` a `next.config.ts` |
| Variables de entorno | Recargar todas, incluida `TWILIO_AUTH_TOKEN` |

### El cron

No recrearlo en Railway: **moverlo a `pg_cron` de Supabase**. Resuelve de paso
dos cosas rotas hoy:
- Recuperás la hora de recordatorio por persona (hoy se guarda y no se respeta,
  porque Hobby solo permite un disparo diario).
- Matás el techo de ~10 personas: hoy `api/qos/agente/cron/route.ts:50` recorre
  al equipo **en serie**, y cada uno se come 3-10 s de Gemini contra el tope de
  duración de la función. Con `pg_cron`, cada envío es una invocación propia.

### ⚠️ El dominio — esto ya mordió tres veces

El webhook de Twilio apunta a `https://www.qlabsmethod.com/api/qos/agente/webhook`
**con `www`**. Hoy el ápex redirige con 308 gracias a Vercel, y **Twilio no sigue
redirecciones**. Si en Railway no se reproduce ese redirect exacto, McLovin deja
de recibir todo en silencio (error 11200 en Twilio, nada en la app).

Después de migrar, verificar con una firma válida — el procedimiento está en la
memoria del proyecto (`project-wa-agent`).

### Lo que se gana y lo que se pierde

Gana: **sin arranques en frío.** El primer Pipeline de 1.010 ms era exactamente
eso; la segunda pasada dio 390 ms.
Pierde: el CDN de Vercel. El landing es estático y hoy sale del borde; en Railway
sale de una sola región.

---

## Limpieza aparte

`@dnd-kit` está en `package.json` (3 paquetes) y **no se importa en ningún
archivo de `src/`** — los tableros usan drag & drop nativo de HTML5. Desinstalar.

---

## Orden recomendado

**A → C → D → B.**

La A es media hora y se lleva casi toda la mejora percibida; conviene hacerla
*antes* de migrar para no medir dos veces y para no confundir la mejora de
Railway con la del `loading.tsx`. La B baja milisegundos de verdad pero toca más
archivos, y conviene hacerla con Railway ya estable.

Evan quería migrar el mismo día. Si se arranca por D, funciona igual — solo que
se migra arrastrando los 869 ms.

---

## Mediciones de referencia (2026-08-01, producción)

No hace falta repetirlas.

**Servidor (curl, TTFB):** `/` 240 ms · `/ugc` ~300 ms · `/ugc/login` 368 ms.
El servidor **no** es el problema.

**Landing → `/ugc` (click real en el navegador):**
- 869 ms hasta el primer cambio visual
- 881 ms hasta el contenido
- O sea: **869 ms de pantalla congelada, sin ningún feedback**

**Pestañas del panel admin** (primer cambio visual / contenido, en ms):

| Ruta | Frío | |
|---|---|---|
| `/pipeline` | 1010 | peor caso, arranque en frío |
| `/calendario` | 483 | |
| `/marketplace` | 375 | |
| `(dashboard)` | 346 | |
| `/heroes` | 341 | |
| `/transcripcion` | 331 | |
| `/disputas` | 288 | |
| `/mclovin` | 230 | |
| `/equipo` | 222 | mejor caso |

**En las nueve, el primer cambio visual coincide con la llegada del contenido.**
Cero feedback intermedio. Ese es el síntoma exacto de la falta de `loading.tsx`.

**Pipeline en caliente:** 390 ms totales = 243 ms esperando al servidor + 136 ms
bajando 5 KB.

**Bundle del cliente: no es el problema.** `date-fns` con named imports, `gsap`
solo en marketing, el único componente cliente del layout es `QosShell` (207
líneas) y usa `<Link>` correctamente. El tiempo es servidor y red.
