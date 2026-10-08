---
description: Paso 2-3 SDD — redactá la spec de una funcionalidad (QUÉ y POR QUÉ)
argument-hint: <NNN-nombre> <idea>
---
Spec: `specs/$1/spec.md`. Idea: $ARGUMENTS

NO escribas código ni nombres de archivos o frameworks en la spec.
1. Leé `docs/constitution.md` y `memory.md`. Mirá `specs/` para tomar el número siguiente si `$1` no lo trae.
2. Investigá lo que ya existe en el producto relacionado con la idea, para no especificar algo que ya está.
3. Hacé de a UNA pregunta por vez (máximo 5) para resolver ambigüedades de producto. Cada pregunta con tu recomendación.
4. Escribí `specs/$1/spec.md` con: contexto y por qué, alcance (dentro / fuera), requisitos funcionales numerados (RF-01…) en notación EARS en español (CUANDO… EL SISTEMA…, SI… ENTONCES EL SISTEMA…, MIENTRAS… EL SISTEMA…, EL SISTEMA…), casos límite y preguntas abiertas.
5. Hacé una pasada de QA sobre tu propia spec: ambigüedades, contradicciones, casos sin cubrir. Mostrámelas y esperá aprobación.
