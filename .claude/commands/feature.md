---
description: Carril corto — planificá un bug o cambio chico antes de tocar código
argument-hint: <qué hay que arreglar o cambiar>
---
Pedido: $ARGUMENTS

1. Leé `CLAUDE.md`, `memory.md` y `docs/constitution.md`.
2. Investigá el código involucrado y, si es un bug, encontrá la causa con evidencia (datos, logs, reproducción). No adivines.
3. Si resulta que el cambio toca una tabla nueva, una pantalla nueva o más de un dominio, decilo: corresponde `/sdd-spec`, no este carril.
4. Presentá en pocas líneas: causa (si es bug), qué vas a cambiar y en qué archivos, riesgos, y cómo lo vas a verificar.
5. Esperá mi aprobación antes de editar. Aprobado: implementá, corré `npm test` y `npm run lint`, verificá de verdad (navegador o base) y commiteá a `main`.
