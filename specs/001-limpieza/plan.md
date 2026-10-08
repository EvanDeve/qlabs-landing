# 001 · Plan técnico de la limpieza

Base: `spec.md` (aprobada) e `inventario.md`. Nada cambia de comportamiento visible (RF-01): cada tarea es borrar o mover, más una función pura chica (RF-06).

## Orden y por qué

1. **Lo que no toca la app** (archivos locales, documentos): cero riesgo, se hace primero.
2. **Código muerto del front** (componentes, exports, dependencias, CSS): sin relación con la base.
3. **Dejar de usar las columnas y tablas que se van**, desplegado a prod.
4. **Recién después, la migración que las borra.** Si la migración corriera antes del deploy, el código viejo en prod haría `select` de columnas que ya no existen y la página se cae (RF-03).
5. Tipos, validación final y mudanza fuera de iCloud.

## Archivos por tarea

**Locales (T01):** borrar `testimonios.mp4`, `tsconfig.tsbuildinfo`, `.DS_Store`, `.next/`, `.git/index 2`…`index 7`. No van en commit porque no están en git.

**Documentos (T02):**
- `git rm` de `Q-OS-Centro-de-Mando.html`, `pase-de-servicio-dashboard.html`, `loyalty-loop-demo.html`, `auditoria-loyalty-loop.html`, `loyalty-loop-plan-implementacion.md`, `prototypes/qlabs-final.html`, `prototypes/final_prototipo_ugc.html`, `prototypes/qlabs-rewards-prototipo.html`, `prototypes/creadores/`, `prototypes/marcas/`, `prototypes/login/` y `supabase/scripts/cupones-de-prueba.sql`.
- Mover `Ideas.md` → `docs/ideas.md` y `guia-maestra-claude-code-sdd.md` → `docs/guia-sdd.md`. Commitear `docs/qos-como-producto.html`.
- Ajustar los comentarios que nombran lo borrado: `src/app/layout.tsx:26` y `src/styles/qos.module.css:2`. También `docs/constitution.md` §4, que nombra los prototipos descartados.

**Código muerto (T03):**
- Borrar `src/components/ugc/SignOutButton.tsx` y `src/components/ugc/DesglosePago.tsx`. Ajustar el comentario de `creador/PromoDetalle.tsx:91`.
- Quitar los ~17 exports de `inventario.md` §B.
- `npm uninstall @dnd-kit/sortable @dnd-kit/utilities @gsap/react`.

**CSS (T04):** borrar de `src/styles/qos.module.css` las clases de `clases-css-candidatas.txt`, en tandas por prefijo.
- Antes de cada tanda: `grep -w` de nuevo, y descartar las que se arman dinámicamente (`styles[\`…${}\`]`, mapas tipo `PRIO_CLASS`).
- Después: build y una recorrida visual de Q·OS en el navegador.

**Apuntes (T05):** función pura nueva en `src/lib/ugc/apuntes.ts`.

```ts
// Qué apuntes ve quien graba: los de la tarjeta si existen (son el trabajo
// real), si no los del cronograma (la propuesta).
export function apuntesDe(delCronograma: string | null, deLaTarjeta: string | null | undefined): string | null
```

- Sale de `src/app/grabacion/[token]/page.tsx:47`, que ya la tiene local, para que la regla viva en un solo lugar.
- Lleva un test en `tests/unit/apuntes.test.ts` para los casos vacío, solo cronograma, solo tarjeta, las dos, y espacios en blanco. Antes de moverla se lee la versión actual para no cambiar su comportamiento.
- `cronogramas/[heroId]/[month]` muestra los dos campos por separado a propósito (uno se edita y el otro se lee), así que no cambia.

**Dejar de usar lo que se borra (T06–T08):**
- **T06**, la ficha de admin `src/app/admin/(panel)/marketplace/creador/[id]/page.tsx`:
  - Sacar las queries a `creator_services` y `creator_addons`.
  - Sacar el bloque de métricas y tarifas (`rate_min`, `rate_max`, `avg_reach`, `avg_views`, `engagement_rate`).
  - Ajustar `tests/rls/tablas-de-abajo.test.ts`.
- **T07:**
  - `calendar_events.content_piece_id`: sale de `calendario/page.tsx` y de `api/qos/agente/webhook/route.ts:1030`.
- **T08**, `content_pieces.record_date`:
  - Sale de `calendario/page.tsx`, `(inicio)/page.tsx`, `webhook/route.ts`, `ContentPieceEditor.tsx` (el campo oculto), `KanbanBoard.tsx`, `busqueda.ts`, `calendar.ts`, `agenda.ts` y `actions/content-pieces.ts`.
  - Se ajusta `tests/unit/agenda.test.ts`.
  - En el webhook, la acción "reprogramar" de McLovin pasa a mover la grabación en `calendar_events`, que es donde viven hoy. Se lee primero cómo funciona y, si cambiarla resulta más que quitar la columna, se frena y se pregunta.

**Migración (T09):** `supabase/migrations/2026100XXXXXXX_limpieza_001.sql`. Se corre recién con T06–T08 en prod.

```sql
drop function if exists public.creator_delivery_stats();
drop table if exists public.creator_services;
drop table if exists public.creator_addons;
alter table public.campaigns drop column if exists min_tier;
alter table public.calendar_events drop column if exists content_piece_id;
alter table public.content_pieces drop column if exists record_date;
-- la vista pública depende de avg_views y engagement_rate: se recrea sin ellas
drop view public.creator_public_profiles;
create view public.creator_public_profiles with (security_invoker = false) as
  select … -- idéntica a 20260825190000 menos esas dos columnas, con sus grants
alter table public.creator_profiles
  drop column rate_min, drop column rate_max, drop column avg_reach,
  drop column avg_views, drop column engagement_rate;
-- documenta rls_auto_enable (la creó el dashboard de Supabase, no una migración)
comment on function public.rls_auto_enable() is '…';
```

- Antes de escribirla se verifica qué otras funciones, vistas o policies mencionan esas columnas (`grep` en migraciones) y cuáles son los grants de la vista.
- Si `drop view` da error por dependencias, se ve cuál es y no se usa `cascade`.

**Tipos (T10):** regenerar `src/lib/database.types.ts`.
- Primero con `npx supabase gen types typescript --project-id xbvwvhklrtdichfavvpi`.
- Si el CLI no tiene sesión, se edita a mano: se quitan los objetos borrados y se agregan los que faltan (`member_signup_throttle` y las funciones).

**Validación y cierre (T11):**
- `npm test`, `npm run test:rls`, `npm run lint`, `npm run build` y `npx tsc --noEmit`, todo en verde (RF-08).
- Recorrida en el navegador: landing, `/ugc`, los paneles de creador y marca, Q·OS (inicio, calendario, kanban, ficha de creador) y `/grabacion`.
- Actualizar `memory.md` y la memoria de Claude.
- Pasarle a Evan el comando para mudar el repo a `~/Proyects/`.

## Decisiones técnicas

- **Borrar en vez de archivar los documentos:** git ya guarda la historia (`git show <commit>:archivo`). Una carpeta `archivo/` sería otra forma de dejar basura a la vista.
- **Una sola migración para todo lo de la base:** son drops independientes y chicos; una sola es más fácil de correr a mano. Descartado: una migración por objeto (9 pegadas en el SQL Editor sin beneficio real).
- **`if exists` en los drops:** si Evan la corre dos veces, no falla.
- **No se usa knip como dependencia:** se corrió con `npx`. Si se quiere en CI es otra decisión.

## Riesgos

- **Clases CSS dinámicas que parecen muertas:** se mitiga con el grep por tanda y la recorrida visual.
- **La acción "reprogramar" de McLovin (en pausa):** puede depender de `record_date` de una forma que no sea solo quitar la columna. T08 frena si es así.
- **Que la migración corra antes del deploy:** se mitiga con el orden de las tareas, y la tarea T09 lo dice explícitamente.

## Tests por RF

| RF | Cómo se verifica |
|---|---|
| RF-01 | Suite completa + recorrida visual de T11 |
| RF-02 | `grep` de cada nombre borrado da 0; knip sin hallazgos nuevos |
| RF-03 | Orden T06–T08 desplegado → T09; la migración se corre después del deploy |
| RF-04 | La migración solo toca objetos con 0 datos (verificado en `inventario.md`) |
| RF-05 | `creator_delivery_stats` no existe: el RPC responde 404 |
| RF-06 | `tests/unit/apuntes.test.ts` |
| RF-07 | `tsc --noEmit` sin errores, los tipos coinciden con el OpenAPI de prod |
| RF-08 | Los 5 comandos en verde |
| RF-09 | `ls` de la raíz |
