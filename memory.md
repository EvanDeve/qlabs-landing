# Memoria del proyecto

> Regla: máximo 50 líneas. Lo que ya quedó en el código o en `docs/constitution.md` se borra de acá.

## Estado actual (2026-10-08)
- **En prod:** marketplace completo (creador y marca rediseñados estilo iOS), Q·OS (agencia + área UGC rediseñada, mockups 1a–1f), Loyalty Loop, Close Friends (rol `member`, entra por QR), cronogramas mensuales con links para el Hero y para quien graba.
- **Tarea activa:** ninguna. Spec `001-limpieza` cerrada el 2026-10-08: ~1.100 líneas de código y CSS muerto, 15 documentos/prototipos, 3 dependencias, 2 tablas, 9 columnas y 1 función con hueco de seguridad menos (migración `limpieza_001` en prod).
- **Recién hecho:**
  - La marca ve la nota de entrega del creador: en "Te toca aprobar" y en la tarjeta de cada aplicación.
  - `e586f42` nichos de creador: catálogo de 22, máximo 5, filtro `?nicho=` en Q·OS.
  - `ff9f563` links de acceso con `token_hash` y botón "Continuar" (los filtros de correo corporativos quemaban las invitaciones) + "Reenviar acceso" en Equipo.

## Decisiones y trampas vigentes
- `src/lib/database.types.ts` se mantiene a mano (el CLI de Supabase no tiene sesión): al escribir una migración, actualizarlo; se compara contra prod con el OpenAPI de PostgREST.
- 2026-10-08 — Se adopta SDD (`docs/guia-sdd.md`) con dos carriles: spec completa para lo nuevo, `/feature` para bugs y cambios chicos. El código sigue en español.
- Los correos de acceso los manda la app por Resend; los de Supabase ya no se usan para invitar ni recuperar.
- Supabase guarda un solo token de recuperación por cuenta: un link nuevo invalida el anterior.
- Vercel a veces no promueve el deploy solo: si algo "no cambió" en prod, revisar `vercel ls --prod`.
- Los apuntes del cronograma viven en dos campos a propósito; cuál gana lo decide `apuntesDe` en `src/lib/ugc/apuntes.ts`.

## En pausa (no tocar sin que Evan lo pida)
- McLovin (agente de WhatsApp): la salida por WhatsApp está caída desde ~30/8 por un tema de cuenta de Meta, no de código.
- Close Friends paso 5 (vista admin) y el escáner en la app.
- Rediseño general de Q·OS (sidebar/header): espera capturas de Claude Design.

## Próximos pasos
- [ ] Rediseño general de Q·OS cuando lleguen las capturas.
