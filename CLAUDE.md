# Q Labs — reglas de trabajo para Claude Code

**Proyecto:** UGC·CRC (marketplace que une negocios costarricenses con creadores UGC) + Q·OS (panel del equipo de la agencia Q Labs) + Loyalty Loop y Close Friends. Un solo repo Next.js + Supabase, desplegado en Vercel.

## Comandos
- Tests: `npm test` · RLS: `npm run test:rls` · Lint: `npm run lint` · Build: `npm run build`
- Dev: `npm run dev` (http://localhost:3000)

## Al empezar cada sesión
1. Leé `memory.md`: estado actual y próximos pasos.
2. Leé `docs/constitution.md`: principios, rutas, diseño y reglas de datos.
3. Si hay una spec activa en `specs/`, leela antes de tocar código.

## Reglas innegociables
- **Cero vibe coding.** Funcionalidad nueva = spec aprobada (`/sdd-spec` → `/sdd-plan` → `/sdd-implement`). Bugs y cambios chicos = `/feature` (plan corto y aprobación).
- **Plan antes que código** cuando algo toca arquitectura, datos o una pantalla nueva. Las decisiones de producto se le preguntan a Evan; las puramente técnicas se toman con criterio.
- **Una tarea a la vez**, tests en verde antes de avanzar, y al terminar la tarea se para.
- **Simple:** nada de dependencias nuevas sin permiso; reusar lo que ya existe.
- **Todo en español**, código incluido; la UI con voseo costarricense.
- **RLS en todas las tablas** y migraciones versionadas en `supabase/migrations/` (Evan las corre a mano).
- **Commits directo a `main`** y push; sin ramas ni PRs salvo pedido.
- **Al cerrar algo relevante**, actualizá `memory.md`.

## Mapa
- `docs/constitution.md` — principios y arquitectura · `specs/` — specs vivas · `memory.md` — estado
- `roadmap-ugc-crc.md` — roadmap original y modelo de datos de Fase 1 (histórico) · `docs/ideas.md` — backlog · `docs/guia-sdd.md` — la guía de esta forma de trabajo
- `.claude/commands/` — `/feature`, `/sdd-spec`, `/sdd-plan`, `/sdd-implement`
- `.claude/agents/` — `planner`, `implementer`, `reviewer`
