---
description: Paso 4-5 SDD — plan técnico y tareas de una spec aprobada
argument-hint: <NNN-nombre>
---
Leé `docs/constitution.md`, `memory.md` y `specs/$1/spec.md`. NO escribas código de la app.

1. Investigá el código actual que toca la spec (podés delegar la búsqueda al agente `planner`).
2. Escribí `specs/$1/plan.md`: archivos a crear/modificar y qué hace cada uno, migraciones (con su RLS), funciones puras y su firma, decisiones técnicas con la alternativa descartada, riesgos, y estrategia de tests que cubra cada RF.
3. Escribí `specs/$1/tasks.md`: tareas atómicas de 20-30 min en orden de dependencia, cada una con `- [ ] T01 — …`, los RF que cubre y una línea `Hecho cuando:` verificable.
4. Mostrame un resumen y esperá aprobación.
