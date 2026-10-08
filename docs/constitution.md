# Constitución de Q Labs (UGC·CRC + Q·OS)

Principios innegociables y arquitectura base. `CLAUDE.md` apunta acá; lo que cambie de esto se cambia primero en este archivo.

## 1. Principios

1. **La spec manda.** Toda funcionalidad nueva pasa por `specs/NNN-nombre/` (spec → plan → tareas) y no se implementa lo que no esté en la spec activa. Si falta una decisión, se para y se le pregunta a Evan.
   - **Carril corto:** bugs y cambios chicos (un par de archivos, sin tabla nueva ni pantalla nueva) van por `/feature`: plan corto, aprobación, código. Sin los tres archivos.
2. **Lógica separada de la interfaz.** La lógica de negocio vive en funciones puras en `src/lib/` (fechas y estado entran por parámetro) y tiene tests. Los componentes y server actions la llaman, no la reescriben.
3. **Tests en verde para avanzar.** `npm test` (y `npm run lint`) pasan antes de marcar una tarea como hecha. Lo que toca RLS lleva su test en `npm run test:rls`.
4. **Los datos se respetan.**
   - RLS en TODAS las tablas desde que nacen. Una policy autoriza la fila, no la columna: lo que el dueño de la fila no puede tocar se protege con trigger.
   - Migraciones versionadas en `supabase/migrations/`, compatibles hacia atrás con lo que ya está en prod. Evan las corre a mano en el SQL Editor.
   - Links que ya salieron (correos, WhatsApp) no se rompen: si una ruta se mueve, queda un 308 en `next.config.ts`.
5. **Idioma:** todo en español, código incluido (nombres, comentarios, specs). La UI en español costarricense con voseo ("aplicá", "elegí").
6. **Simple antes que nuevo.** Nada de dependencias nuevas sin autorización explícita. Antes de crear un helper, buscar si ya existe.
7. **Verificado de verdad.** Un cambio de UI se mira en el navegador antes de darlo por hecho; un cambio de datos se comprueba contra la base, forzando el caso (los datos de prod mienten por omisión).
8. **Git:** se commitea directo a `main` y se pushea; Vercel despliega solo. Sin ramas ni PRs salvo que Evan los pida.

## 2. Stack (no negociable)

Next.js 16 (App Router) + TypeScript · Tailwind CSS v4 (tokens en `@theme` de `src/app/globals.css`) · Supabase (Postgres, Auth, Storage) · Vercel · Resend para correos (`notificaciones@qlabsmethod.com`). El middleware es `src/proxy.ts` (Next 16 renombró `middleware.ts`).

## 3. Rutas (un solo proyecto, sin subdominios)

```
/                    Landing de Q Labs (estática; solo se le agregó un nav con "UGC·CRC")
/ugc                 Vista pública del marketplace
/ugc/login           Login/registro del marketplace (?intent=marca|creador)
/ugc/creador/*       Panel del creador (rol creator)
/ugc/marca/*         Panel de la marca (rol brand)
/admin/login         Puerta de Q·OS (sin registro; al equipo lo invita un director)
/admin/*             Q·OS, el panel del equipo (rol admin)
/cronograma/[token]  Cronograma del mes para el Hero (el token es la credencial)
/grabacion/[token]   Lo que ve quien graba
/cf                  Close Friends (miembros, entran por QR)
/auth/set-password   Definir contraseña (invitación y recuperación)
```

- Lo que no es del marketplace no cuelga de `/ugc`. Las rutas viejas `/ugc/admin/*` siguen con 308.
- El rol vive en `profiles.role` y se chequea server-side en los layouts. Dentro de Q·OS el corte de permisos es `staff_members.staff_role` (director, etc.).
- Las dos puertas usan el mismo `signInAction`; `destinoDeSesion` decide a dónde va cada cuenta.

## 4. Diseño

- **Público y marketplace (`/`, `/ugc/*`):** la referencia 1:1 es `prototypes/index-legacy.html`. Plus Jakarta Sans (800 en títulos), acento violeta, botones pill (`rounded-pill`), fondos blancos/lavanda. Nada de look "dashboard genérico". No usar `qlabs-final.html` ni `final_prototipo_ugc.html` (exploraciones descartadas).
- **Q·OS (`/admin/*`):** sistema propio en `src/styles/qos.module.css` (monocromo, `.temaQos`).
- Tokens: `ink #0A0B10`, `ink-soft #5B5570`, `violet #705CF6`, `violet-deep #5641D8`, `periwinkle #8E80F2`, `lavender #F6F4FD`, `lavender-deep #ECE7FB`, `trust #17A673`, `trust-bg #E7F7F1`, `coral #FF6B57`. Radios: 14px cards, 999px pills. Línea: `rgba(10,11,16,0.10)`.
- Sin dark mode (descartado por Evan). Sin `window.confirm()`: confirmación propia en la página.

## 5. Reglas de datos que ya mordieron

- Los días van en columnas `date` y se comparan con `diaCR()`; los instantes en `timestamptz`. Zona: America/Costa_Rica.
- La vista pública filtra, la tabla no: cada vista pública necesita que la tabla también esté cerrada.
- Solo admin pone `verified=true` (trigger `protect_verified`).
- Subidas grandes van del navegador directo a Storage (Vercel corta el body en 4.5 MB).
- Las notificaciones no guardan URL: se arma al mostrar, con `type` + `payload`.
