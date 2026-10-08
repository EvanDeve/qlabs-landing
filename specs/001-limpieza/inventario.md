# 001 · Inventario de lo que no se usa (2026-10-08)

Relevado en solo lectura: knip + grep cruzado sobre `src/`, `tests/` y `supabase/`, `git log` por archivo, y la base de prod (conteos por REST + OpenAPI). Prod coincide con las 98 migraciones.

Columna **Decisión**: `borrar` · `conservar` · `?` (falta que Evan decida).

## A. Archivos locales (no están en git)

| Ruta | Qué es | Decisión |
|---|---|---|
| `testimonios.mp4` (214 MB) | Video original sin comprimir; el sitio usa `public/testimonios_compressed.mp4` | ? — ¿hay otra copia del original? |
| `tsconfig.tsbuildinfo`, `.DS_Store` | Caché y basura de macOS, se regeneran | borrar |
| `.next/` (1,2 GB) | Caché de build con duplicados de iCloud (`routes.d 3.ts`, `server/app 2`…) que rompen `tsc --noEmit` | borrar (se regenera) |
| `.git/index 2` … `index 7` | Copias en conflicto que dejó iCloud (agosto) | borrar |

## B. Código sin uso

| Ruta | Qué es | Decisión |
|---|---|---|
| `src/components/ugc/SignOutButton.tsx` | Botón de logout viejo; nadie lo importa | borrar |
| `src/components/ugc/DesglosePago.tsx` | Desglose de pago; nadie lo importa | borrar |
| ~17 exports muertos | `TarjetaLista`, `reorderColumnsAction`, `reorderContentColumnsAction`, `COLUMNAS_POR_DEFECTO`, `doneColumnIds`, `pendingApprovalColumnIds`, `CONTENT_APPROVAL_STYLE`, `CONTENT_PRIORITY_LABEL/STYLE`, `CALENDAR_EVENT_TYPE_BG`, `diasDe`, `mesesAlrededor`, `aceptaDeSlot`, `guionParaCopiar`, `EMOJI_NIVEL`, `qosIconSvg` | borrar |
| Dependencias `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@gsap/react` | 0 imports | borrar |
| ~105 clases de `src/styles/qos.module.css` (~1.000 líneas) | No aparecen en ningún .ts/.tsx | borrar, verificando en el navegador |
| `src/components/ugc/public/Stats.tsx`, `CampaignsGrid.tsx`, `CampaignCard.tsx` | Desmontados a propósito hasta que haya marcas reales (comentario en `ugc/(public)/page.tsx`) | conservar |
| `signInWithGoogleAction` | Login con Google apagado; el comentario explica cómo reactivarlo | conservar |

Features en pausa (McLovin, voz, transcripción) siguen conectadas a la UI: **no son código muerto**. No hay rutas huérfanas ni tests de cosas que ya no existen.

## C. Documentos y prototipos en git

| Ruta | Qué es | Decisión |
|---|---|---|
| `Q-OS-Centro-de-Mando.html` | Prototipo original de Q·OS, superado | borrar (ajustar 2 comentarios que lo nombran) |
| `pase-de-servicio-dashboard.html` | Referencia de un compañero, ya implementada | borrar |
| `loyalty-loop-demo.html`, `auditoria-loyalty-loop.html`, `loyalty-loop-plan-implementacion.md` | Loyalty ya terminado y auditado | borrar |
| `prototypes/qlabs-final.html`, `prototypes/final_prototipo_ugc.html` | Exploraciones descartadas | borrar |
| `prototypes/qlabs-rewards-prototipo.html`, `prototypes/creadores/`, `prototypes/marcas/`, `prototypes/login/` | Mockups ya implementados | borrar |
| `prototypes/index-legacy.html`, `roadmap-ugc-crc.md` | Referencia de diseño y roadmap | conservar |
| `Ideas.md` | Backlog vivo | conservar, mover a `docs/ideas.md` |
| `docs/` de McLovin (4 archivos) | McLovin está en pausa, no muerto | conservar |
| `docs/plan-rendimiento-y-railway.md`, `docs/brief-diseno-ugc-ios.md`, `docs/auditoria-seguridad-2026-08.md`, `docs/QLabs_Rewards_GuiaDeIngreso.pdf` | Vigentes o referenciados desde el código | conservar |
| `docs/qos-como-producto.html` | Sin trackear | ? |
| `supabase/scripts/backfill-loyalty-points.sql`, `cupones-de-prueba.sql` | Scripts de una sola vez (agosto) | ? — ¿ya se corrieron? |
| `guia-maestra-claude-code-sdd.md` | La guía de trabajo nueva | conservar, mover a `docs/` |

## D. Base de datos (42 tablas, 7 vistas)

**Diagnóstico:** 42 tablas es razonable para ~5 productos sobre una sola base (marketplace 11, Q·OS 9, Close Friends 7, Loyalty 5, McLovin 4, herramientas del creador 4, núcleo 2). Las limpiezas viejas quedaron completas, todas las tablas tienen RLS y las migraciones están bien comentadas. **No hace falta una reescritura.** La sensación de "demasiadas" viene de Close Friends (7 tablas, todavía sin miembros) y de tablas satélite chicas.

| Objeto | Evidencia | Decisión |
|---|---|---|
| Tablas `creator_services`, `creator_addons` | 0 filas, nadie escribe; solo una lectura en la ficha de admin | borrar |
| Función `creator_delivery_stats()` | Nadie la llama (la reemplazó `creator_public_stats`) y le expone estadísticas de cualquier creador a cualquier usuario logueado | borrar |
| `campaigns.min_tier` | 0 datos, 0 referencias | borrar |
| `calendar_events.content_piece_id` | 0 datos; el código solo la pone en null; FK con `on delete cascade` (trampa) | borrar |
| `content_pieces.record_date` | 0 datos desde que las grabaciones pasaron al calendario; ~8 archivos todavía la leen | borrar (riesgo medio) |
| `applications.delivery_note` | Se escribe y nadie la lee; duplica `application_deliveries.note` | ? — ¿mostrarla o borrarla? |
| `creator_profiles.rate_min/rate_max/avg_reach/avg_views/engagement_rate` | 0 datos, ningún formulario las llena; la ficha de admin las muestra vacías | ? — ¿construir el formulario o borrarlas? |
| Notas duplicadas cronograma ↔ tarjeta (`calendar_month_items.notes` / `content_pieces.notes`) | Separación intencional (propuesta vs trabajo real), pero la regla "cuál se muestra" está repartida | Centralizar la regla en un solo lugar; no fusionar |
| `database.types.ts` | Le faltan `member_signup_throttle` y 16 funciones | Regenerar |
| `rls_auto_enable` | Existe en prod sin migración | Documentar en una migración |

**No se tocan (no vale el riesgo ahora):** renombrar `content_pieces.brand_id` a `hero_id`, unificar el idioma de la base, fusionar las tablas de WhatsApp o los dos kanbans, colapsar Close Friends (consentimiento y auditoría tienen peso legal).
