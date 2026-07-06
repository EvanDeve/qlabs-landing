# UGC·CRC — contexto para Claude Code

## Contexto del proyecto

Este repo construye **UGC·CRC**, un marketplace que conecta negocios costarricenses (restaurantes, hoteles) con creadores de contenido UGC verificados. Es parte del ecosistema de Q Labs (qlabsmethod.com), una agencia de marketing digital en Costa Rica. El posicionamiento de marca usa el arquetipo del "guía" (StoryBrand): Q Labs equipa a dos héroes — el negocio que necesita contenido y el creador que necesita ingresos — y el marketplace es el puente entre ambos.

**Referencias de mercado:** Cohley y Aspire.io, pero adaptado a escala local costarricense: más simple, en español, con confianza humana en vez de compliance enterprise.

Ver `roadmap-ugc-crc.md` para el roadmap completo (Fases 1-3, modelo de datos, épicas).

## Stack (no negociable)

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 (tokens vía `@theme` en `src/app/globals.css`, no `tailwind.config.js`)
- Supabase: Postgres, Auth (email + Google OAuth), Storage, con Row Level Security en TODAS las tablas desde el inicio
- Deploy en Vercel
- Emails transaccionales con Resend (desde épica 1.6)

## Design system

**La referencia visual 1:1 es `prototypes/index-legacy.html` — la landing real en producción.** Replicá su lenguaje visual (colores, tipografía, radios, botones pill) en TODO el proyecto, incluido el marketplace `/ugc`. No uses `prototypes/qlabs-final.html` ni `prototypes/final_prototipo_ugc.html` como referencia de diseño: fueron exploraciones descartadas por el usuario por verse "hechas por IA" (paleta lavanda + Space Mono + eyebrows uppercase). Se dejan en el repo solo a modo histórico.

La landing (`/`) es la de siempre — hero, marquee de marcas, stats, servicios, testimonio en video (mockup de celular), CTA final — **sin cambios de contenido**. Lo único que se le agregó es un `<nav>` (el sitio no tenía uno) con un solo link **"UGC·CRC"** que lleva a `/ugc`. No agregues más secciones a la landing sin que el usuario lo pida explícitamente.

El marketplace (`/ugc/*`) debe sentirse como una extensión de esa misma landing, no como un producto SaaS aparte: mismo `Plus Jakarta Sans`, mismo acento violeta, mismos botones pill (`rounded-pill`), fondos blancos/lavanda suaves — evitá look "dashboard genérico" (Space Mono en todos lados, pills de eyebrow, cards con exceso de bordes).

Tokens (definidos en `src/app/globals.css`, disponibles en toda la app vía Tailwind):
- Fuentes: `Plus Jakarta Sans` (peso 800 headings, 400-700 body) es la fuente por default de toda la app. `Space Mono` y `Playfair Display` existen como tokens pero son acentos puntuales, no la base tipográfica del marketplace.
- Colores: `ink #0A0B10`, `ink-soft #5B5570`, `violet #705CF6`, `violet-deep #5641D8`, `periwinkle #8E80F2`, `lavender #F6F4FD`, `lavender-deep #ECE7FB`, `trust #17A673`, `trust-bg #E7F7F1`, `coral #FF6B57`
- Bordes: radius 14px cards (`radius-card`), 999px pills (`radius-pill`). Líneas: `rgba(10,11,16,0.10)` (`color-line`)
- Idioma de toda la UI: español costarricense (voseo: "aplicá", "publicá", "elegí")

## Modelo de datos Fase 1

Ver sección "Modelo de datos" de `roadmap-ugc-crc.md`: `profiles`, `creator_profiles`, `brand_profiles`, `campaigns`, `applications`, `notifications`.

Reglas RLS críticas:
- Un creador solo puede editar su propio perfil
- Una marca solo ve aplicaciones de SUS campañas
- El brief completo de una campaña solo es visible para usuarios autenticados con rol `creator`; la vista pública (`campaign_previews`) solo expone: marca, título, formato, categoría
- Solo admin puede setear `verified=true` en `creator_profiles` (trigger `protect_verified`)
- El rol vive en `profiles.role`, NO en un JWT custom claim — se chequea server-side en los layouts de `/ugc/(dashboard)/*`

## Arquitectura de rutas (un solo proyecto, sin subdominios)

```
/                  → Landing marketing de Q Labs (incluye sección UGC·CRC / #ecosistema)
/ugc               → Vista pública del marketplace
/ugc/login         → Auth (login/registro con selección de rol)
/ugc/creador/*     → Dashboard del creador (protegido, rol creator)
/ugc/marca/*       → Dashboard de la marca (protegido, rol brand)
/ugc/admin         → Panel admin (protegido, rol admin)
```

**Punto de entrada al marketplace:** el nav de la landing tiene un único link "UGC·CRC" → `/ugc`. Desde ahí, la vista pública del marketplace tiene sus propios CTAs de registro que llevan a `/ugc/login?intent=marca|creador`, que a su vez redirige directo al dashboard correspondiente si ya hay sesión activa. La landing permanece 100% estática; el middleware (`src/proxy.ts` — Next.js 16 renombró `middleware.ts` a `proxy.ts`) solo actúa sobre `/ugc/*`.

## Alcance EXACTO de Fase 1 (no construyas más que esto)

Ver "Alcance EXACTO de Fase 1" en `roadmap-ugc-crc.md`. Resumen: setup + auth/onboarding + vista pública + flujo marca + flujo creador + notificaciones + admin mínimo.

**Explícitamente FUERA de Fase 1:** pagos in-app, subida de portfolio/book, niveles/XP/gamificación, Academia, Feed de contenido, suscripción Marca Pro, blog. Estos vienen en Fases 2-3 — no dejes stubs ni tablas a medias para ellos.

## Seed data para desarrollo

Marcas: Zonna (gastrobar, Escazú), Kosta Asiatika (restaurante asiático), La Arboleda, Snowty (postres), Dulce Chilena (repostería), Entrecot (fine dining).
Creadores: `@vale.creates` (12.4K, food & lifestyle, San José), `@pura.vida.foodie` (8.1K, food, Heredia), `@carlosreview.cr` (22K, reviews de restaurantes, San José).
Campañas ejemplo: "Reel de brunch de domingo" (Zonna, ₡150,000, 1 Reel + 3 Stories, 15 días), "UGC unboxing nuevo menú ramen" (Kosta Asiatika, ₡120,000, 1 TikTok, 10 días).

## Forma de trabajo

- Una épica a la vez, en el orden del roadmap. Confirmá el plan de la épica antes de codear.
- Cada épica termina con la app deployable y las migraciones de Supabase versionadas en `/supabase/migrations`.
- Tests mínimos: RLS policies (que un usuario no pueda leer datos ajenos) y el flujo crítico publicar→aplicar→aceptar.
- Preguntá antes de asumir en decisiones de producto; asumí con criterio en decisiones puramente técnicas.
