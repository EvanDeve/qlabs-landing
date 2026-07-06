# UGC·CRC — Roadmap de desarrollo
**Proyecto:** Marketplace UGC del ecosistema Q Labs
**Stack:** Next.js 14+ (App Router) + Supabase (auth, DB, storage) + Vercel
**Desarrollador:** Andrés + Claude Code
**Última actualización:** Julio 2026

---

## Visión en una línea

Conectar negocios (restaurantes/hoteles de CR) que necesitan contenido real con creadores verificados que necesitan ingresos — con Q Labs como guía y garante de la transacción.

---

## Arquitectura general

```
qlabsmethod.com          → UN SOLO proyecto Next.js:
  /                      → Landing marketing (migrar la actual al repo)
  /ugc                   → El marketplace (vista pública)
  /ugc/creador/*         → Dashboard del creador
  /ugc/marca/*           → Dashboard de la marca
  /ugc/admin             → Panel admin Q Labs
  /recursos/*            → Blog SEO (Fase 3)
```

**Ventajas de esta decisión:** un solo deploy en Vercel, un solo repo, el SEO del marketplace y del blog suman autoridad al dominio principal, y la landing comparte componentes (nav, footer, tokens) con el marketplace. La landing actual (HTML estático con GSAP) se migra al repo Next.js como página estática en la épica 1.1 — o se deja en producción como está y el proyecto arranca sirviendo solo /ugc con rewrites en Vercel, migrando la landing después. Decidir en la primera sesión según lo que sea más rápido.

**Stack confirmado:**
- Next.js 14+ con App Router, TypeScript, Tailwind CSS
- Supabase: Postgres + Auth (email + Google OAuth) + Storage (books/portfolios) + Row Level Security
- Vercel para deploy (mismo hosting del sitio actual)
- Resend o similar para emails transaccionales
- Fase 2: Stripe Connect u ONVO Pay para pagos con escrow

**Design system (ya definido, tokens confirmados de producción):**
- Fuente: Plus Jakarta Sans (800 headers) + Space Mono (labels/data)
- Tinta: #0A0B10 · Violeta: #705CF6 · Violeta profundo: #5641D8
- Lavanda bg: #F6F4FD · Trust green: #17A673 · Coral: #FF6B57
- Prototipo HTML completo existente como referencia visual 1:1

---

## Modelo de datos (Supabase)

### Tablas núcleo (Fase 1)

**profiles** (extiende auth.users)
- id (uuid, FK auth.users), role ('creator' | 'brand' | 'admin')
- display_name, avatar_url, city, bio, created_at

**creator_profiles**
- profile_id (FK), handle, followers_count, niches (text[]), languages (text[])
- instagram_handle, tiktok_handle, rate_min, rate_max
- verified (bool, default false) — verificación manual por admin en Fase 1

**brand_profiles**
- profile_id (FK), brand_name, industry, website, instagram_handle, description

**campaigns**
- id, brand_id (FK), title, brief (text), budget_amount, budget_currency ('CRC')
- deliverables (jsonb: [{type:'reel', qty:1}, ...]), target_audience, deadline_days
- status ('draft' | 'published' | 'in_progress' | 'completed' | 'cancelled')
- min_tier (nullable — Fase 3), created_at, published_at

**applications**
- id, campaign_id (FK), creator_id (FK), pitch_message (text, opcional)
- status ('pending' | 'reviewing' | 'accepted' | 'rejected' | 'delivered' | 'approved')
- created_at, status_changed_at
- UNIQUE(campaign_id, creator_id)

**notifications**
- id, profile_id (FK), type, payload (jsonb), read (bool), created_at

### Tablas Fase 2

**portfolio_items** — creator_id, media_url (Supabase Storage), media_type, category, caption, sort_order
**creator_skills** — creator_id, skill_name, proficiency (1-5)
**creator_services** — creator_id, service_name (catálogo fijo), is_addon (bool)
**payments** — application_id, amount, commission, status ('held' | 'released' | 'refunded'), provider_ref
**subscriptions** — brand_id, plan ('free' | 'pro'), status, provider_ref

### Tablas Fase 3

**xp_events** — profile_id, source ('delivery' | 'course' | 'streak'), amount, created_at
**badges** + **profile_badges**
**courses** + **course_progress** (track, título, duración, xp_reward / profile_id, pct)
**feed_items** — audiencia, tipo (guía/novedad/curso), título, cuerpo, cta_url
**posts** (blog SEO) + **comments**

**RLS desde el día 1:** creadores solo editan su perfil; marcas solo ven aplicaciones de SUS campañas; briefs completos solo visibles a creadores autenticados (la vista pública muestra preview limitado).

---

## FASE 1 — MVP transaccional (validar el negocio)

**Objetivo:** una marca real publica una campaña real, un creador real aplica, la marca acepta. El pago se coordina manualmente fuera de plataforma (Q Labs como escrow humano).

**Criterio de éxito:** 3 campañas reales publicadas + 10 aplicaciones + 1 match completado end-to-end.

### Épicas

**1.1 Fundación** — Setup Next.js + Supabase + Tailwind con design tokens. Schema núcleo + RLS. Layout base (nav, footer) fiel al prototipo. Migración de la landing al repo, incluyendo la **sección UGC·CRC dentro de la landing** (la sección "puente" de los dos héroes ya diseñada): ahí viven los CTAs "Iniciar sesión", "Publicar campaña" (marca) y "Aplicar como creador" — es la puerta de entrada al marketplace, que redirige a /ugc/login o al dashboard según sesión activa.

**1.2 Auth y onboarding** — Registro con selección de rol (creador/marca). Onboarding creador: handle, ciudad, nichos, seguidores, redes, bio (máx 10 campos). Onboarding marca: nombre, industria, web, descripción. Google OAuth + email.

**1.3 Vista pública** — Landing del marketplace con hero + stats + grid de campañas con preview bloqueado (blur + candado como el prototipo) + casos de éxito (estáticos) + FAQ dual + CTAs de registro.

**1.4 Flujo marca** — Dashboard: crear campaña (form del prototipo: título, brief, presupuesto, entregables, audiencia, deadline) → publicar → lista "Mis campañas" con conteo de aplicantes → ver aplicantes → ver perfil del creador → aceptar/rechazar.

**1.5 Flujo creador** — Feed de campañas publicadas (brief completo, ya autenticado) → aplicar (con mensaje opcional) → "Mis aplicaciones" con tracker de estados.

**1.6 Notificaciones** — In-app + email: nueva aplicación (a marca), cambio de estado (a creador). Resend con plantillas simples.

**1.7 Admin mínimo** — Vista para Q Labs: verificar creadores manualmente, ver todas las campañas/aplicaciones, marcar match como "completado". Puede ser una ruta protegida simple, no un panel elaborado.

**Fuera de alcance Fase 1:** pagos in-app, subida de portfolio, niveles/XP, Academia, Feed, Marca Pro, blog.

---

## FASE 2 — Confianza y dinero (monetizar)

**Objetivo:** el dinero fluye por la plataforma y la confianza es visible. UGC·CRC cobra su comisión automáticamente.

**Criterio de éxito:** primer pago procesado in-app con comisión retenida + primera suscripción Marca Pro.

### Épicas

**2.1 Book/Portfolio** — Subida de imágenes/videos a Supabase Storage, grid con categorías y filtros (como el prototipo), gestión (ordenar, eliminar).

**2.2 Perfil rico del creador** — Página completa estilo portfolio (hero oscuro del prototipo): skills con dominio (1-5 puntos), servicios y add-ons del catálogo (contenido orgánico, testimoniales, unboxing, whitelisting, raw footage, rush fee...), métricas de alcance (manual al inicio: vistas prom., engagement, alcance), marcas anteriores por categoría.

**2.3 Trust score v1** — Fórmula simple y transparente: verificación (base) + entregas aprobadas + puntualidad. Anillo visual del prototipo.

**2.4 Pagos con escrow** — Evaluar Stripe Connect vs ONVO Pay (CRC nativo). Flujo: marca paga al aceptar → retenido → creador entrega (sube archivo o link) → marca aprueba → liberación menos comisión (definir %, sugerido 15-20%). Manejo de disputas manual por admin.

**2.5 Marca Pro** — Suscripción mensual: directorio completo de creadores navegable + contacto directo + filtros avanzados. Gate como el prototipo (sección bloqueada en perfil de creador).

**2.6 Entrega in-app** — El creador sube la pieza final a la plataforma (no por WhatsApp), la marca la revisa y aprueba ahí. Esto habilita el escrow y deja registro.

---

## FASE 3 — Retención y crecimiento (escalar)

**Objetivo:** los usuarios vuelven sin que los llames. La plataforma se alimenta de contenido y el SEO trae usuarios nuevos.

**Criterio de éxito:** retención semanal de creadores >40% + primeros registros orgánicos vía blog.

### Épicas

**3.1 Gamificación** — XP por eventos (entrega aprobada, curso completado, racha de puntualidad). Niveles Bronce/Plata/Oro/Platino con umbrales. Campañas con min_tier (bloqueadas como el prototipo). Insignias automáticas. Barra de XP en dashboard y perfil.

**3.2 Academia** — CMS simple de cursos (video YouTube unlisted + texto), tracks por categoría con certificado al completar track, progreso persistente, XP al completar. Versión amplia en dashboard creador + track para marcas.

**3.3 Feed de cuenta (marca)** — Stream de guías, novedades y cursos relevantes en el dashboard de la marca, alimentado por feed_items + posts del blog.

**3.4 Blog SEO / Recursos** — qlabsmethod.com/recursos/[categoría]/[slug]. Video YouTube + artículo + comentarios + relacionados + CTA. Taxonomía de 8 categorías ya definida (~40 temas). Puede ser parte del mismo repo Next.js o repo aparte — decidir al llegar.

**3.5 Analytics** — Dashboard de resultados para marcas (piezas, inversión, alcance) con datos reales de la plataforma.

---

## Reglas de trabajo con Claude Code

1. **Una épica = una sesión de trabajo.** No mezclar épicas en un mismo branch.
2. **Orden estricto dentro de Fase 1:** 1.1 → 1.2 → 1.3/1.4/1.5 (paralelizables) → 1.6 → 1.7.
3. **El prototipo HTML es la referencia visual 1:1.** Claude Code debe replicar los componentes existentes (cards de campaña, tracker de estados, formularios) en React, no rediseñar.
4. **RLS antes que features.** Ninguna tabla sin política de seguridad.
5. **Deploy continuo a Vercel** desde el primer commit — preview URLs para revisar cada épica.
6. **Seeds de demo:** los datos del prototipo (Zonna, Kosta Asiatika, @vale.creates, etc.) sirven como seed data para desarrollo.

---
---

# PROMPT PARA CLAUDE CODE

Copiá todo lo de abajo como primer mensaje en Claude Code (idealmente como CLAUDE.md en la raíz del repo):

---

## Contexto del proyecto

Vas a construir **UGC·CRC**, un marketplace que conecta negocios costarricenses (restaurantes, hoteles) con creadores de contenido UGC verificados. Es parte del ecosistema de Q Labs (qlabsmethod.com), una agencia de marketing digital en Costa Rica. El posicionamiento de marca usa el arquetipo del "guía" (StoryBrand): Q Labs equipa a dos héroes — el negocio que necesita contenido y el creador que necesita ingresos — y el marketplace es el puente entre ambos.

**Referencias de mercado:** Cohley y Aspire.io, pero adaptado a escala local costarricense: más simple, en español, con confianza humana en vez de compliance enterprise.

## Stack (no negociable)

- Next.js 14+ con App Router y TypeScript
- Tailwind CSS con design tokens custom (abajo)
- Supabase: Postgres, Auth (email + Google OAuth), Storage, con Row Level Security en TODAS las tablas desde el inicio
- Deploy en Vercel
- Emails transaccionales con Resend

## Design system

Existen dos prototipos HTML en este repo que son la referencia visual 1:1 — replicá sus componentes en React, no rediseñes:
- **qlabs-final.html** → la landing (/) con la sección UGC·CRC del puente de los dos héroes
- **final_prototipo_ugc.html** → todo el marketplace (/ugc y dashboards)

Tokens:
- Fuentes: 'Plus Jakarta Sans' (weight 800 para headings, 400-700 body) + 'Space Mono' para labels/datos/eyebrows
- Colores: ink #0A0B10, ink-soft #5B5570, violet #705CF6, violet-deep #5641D8, periwinkle #8E80F2, lavender #F6F4FD, lavender-deep #ECE7FB, trust #17A673, trust-bg #E7F7F1, coral #FF6B57
- Bordes: radius 14px cards, 999px pills. Líneas: rgba(10,11,16,0.10)
- Idioma de toda la UI: español costarricense (voseo: "aplicá", "publicá", "elegí")

## Modelo de datos Fase 1

[Copiar la sección "Modelo de datos" del roadmap — tablas profiles, creator_profiles, brand_profiles, campaigns, applications, notifications con sus campos y constraints]

Reglas RLS críticas:
- Un creador solo puede editar su propio perfil
- Una marca solo ve aplicaciones de SUS campañas
- El brief completo de una campaña solo es visible para usuarios autenticados con rol creator; la vista pública solo expone: marca, título, formato, categoría (el resto va bloqueado visualmente con blur)
- Solo admin puede setear verified=true en creator_profiles

## Arquitectura de rutas (un solo proyecto, sin subdominios)

```
/                  → Landing marketing de Q Labs (incluye sección UGC·CRC)
/ugc               → Vista pública del marketplace
/ugc/login         → Auth (login/registro con selección de rol)
/ugc/creador/*     → Dashboard del creador (protegido, rol creator)
/ugc/marca/*       → Dashboard de la marca (protegido, rol brand)
/ugc/admin         → Panel admin (protegido, rol admin)
```

**Punto de entrada al marketplace:** la landing (/) tiene una sección UGC·CRC — el "puente de los dos héroes" del diseño — y AHÍ viven los CTAs principales: "Iniciar sesión", "Publicar campaña" (marca) y "Aplicar como creador". Esos botones redirigen a /ugc/login, o directo al dashboard correspondiente si ya hay sesión activa. La vista pública /ugc también tiene sus propios CTAs de registro.

## Alcance EXACTO de Fase 1 (no construyas más que esto)

1. **Setup:** proyecto Next.js + Supabase + Tailwind con los tokens. Layout base con nav sticky (blur al scroll) y footer, compartidos entre landing y marketplace. Migrar la landing existente (HTML estático, se te dará el archivo) a una página Next.js estática en /, incluyendo la sección UGC·CRC con los CTAs de entrada al marketplace.
2. **Auth:** registro con selección de rol (creador o marca), Google OAuth + email/password. Onboarding por rol: creador (handle, ciudad, nichos multi-select, seguidores, IG/TikTok, bio) — marca (nombre, industria, web, descripción). Al terminar onboarding, redirigir al dashboard del rol.
3. **Vista pública (/ugc):** hero + grid de campañas publicadas con preview bloqueado (título y presupuesto con blur + overlay de candado + CTA de registro, exactamente como el prototipo) + FAQ con tabs creador/marca + sección de casos de éxito con datos estáticos.
4. **Flujo marca (/ugc/marca):** dashboard con sidebar (Mis campañas / Crear campaña / Aplicantes / Perfil). Crear campaña: título, brief, presupuesto en CRC, entregables (tags seleccionables: Reel, TikTok, Stories, Fotos con cantidad), audiencia ideal, deadline en días. Publicar. Ver lista con conteo de aplicantes. Ver aplicantes de una campaña con su perfil. Aceptar o rechazar aplicaciones.
5. **Flujo creador (/ugc/creador):** dashboard con sidebar (Feed de promos / Mis aplicaciones / Perfil). Feed de campañas publicadas con brief completo. Aplicar con mensaje opcional. Tracker de aplicaciones con estados: pendiente → en revisión → aceptada/rechazada.
6. **Notificaciones:** in-app (campana en nav) + email vía Resend: a la marca cuando llega aplicación nueva, al creador cuando cambia el estado de su aplicación.
7. **Admin (/ugc/admin):** ruta protegida (solo rol admin) para: verificar creadores (toggle verified), ver todas las campañas y aplicaciones, marcar matches como completados.

**Explícitamente FUERA de Fase 1:** pagos in-app (se coordinan por fuera), subida de portfolio/book, niveles/XP/gamificación, Academia, Feed de contenido, suscripción Marca Pro, blog. Estos vienen en Fases 2-3 — no dejes stubs ni tablas a medias para ellos.

## Seed data para desarrollo

Marcas: Zonna (gastrobar, Escazú), Kosta Asiatika (restaurante asiático), La Arboleda, Snowty (postres), Dulce Chilena (repostería), Entrecot (fine dining).
Creadores: @vale.creates (12.4K, food & lifestyle, San José), @pura.vida.foodie (8.1K, food, Heredia), @carlosreview.cr (22K, reviews de restaurantes, San José).
Campañas ejemplo: "Reel de brunch de domingo" (Zonna, ₡150,000, 1 Reel + 3 Stories, 15 días), "UGC unboxing nuevo menú ramen" (Kosta Asiatika, ₡120,000, 1 TikTok, 10 días).

## Forma de trabajo

- Trabajá una épica a la vez, en el orden listado. Confirmá el plan de la épica antes de codear.
- Cada épica termina con la app deployable y las migraciones de Supabase versionadas en /supabase/migrations.
- Tests mínimos: RLS policies (que un usuario no pueda leer datos ajenos) y el flujo crítico publicar→aplicar→aceptar.
- Preguntá antes de asumir en decisiones de producto; asumí con criterio en decisiones puramente técnicas.
