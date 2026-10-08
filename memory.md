# Memoria del proyecto

> Regla: máximo 50 líneas. Lo que ya quedó en el código o en `docs/constitution.md` se borra de acá.

## Estado actual (2026-10-08)
- **En prod:** marketplace completo (creador y marca rediseñados estilo iOS), Q·OS (agencia + área UGC rediseñada, mockups 1a–1f), Loyalty Loop, Close Friends (rol `member`, entra por QR), cronogramas mensuales con links para el Hero y para quien graba.
- **Tarea activa:** spec `001-limpieza` — inventario de código, archivos y base de datos que sobran.
- **Recién hecho:**
  - `e586f42` nichos de creador: catálogo de 22, máximo 5, filtro `?nicho=` en Q·OS.
  - `ff9f563` links de acceso con `token_hash` y botón "Continuar" (los filtros de correo corporativos quemaban las invitaciones) + "Reenviar acceso" en Equipo.

## Decisiones y trampas vigentes
- 2026-10-08 — Se adopta SDD (`guia-maestra-claude-code-sdd.md`) con dos carriles: spec completa para lo nuevo, `/feature` para bugs y cambios chicos. El código sigue en español.
- Los correos de acceso los manda la app por Resend; los de Supabase ya no se usan para invitar ni recuperar.
- Supabase guarda un solo token de recuperación por cuenta: un link nuevo invalida el anterior.
- Vercel a veces no promueve el deploy solo: si algo "no cambió" en prod, revisar `vercel ls --prod`.
- Los apuntes del cronograma viven en dos campos: mirar los dos.

## En pausa (no tocar sin que Evan lo pida)
- McLovin (agente de WhatsApp): la salida por WhatsApp está caída desde ~30/8 por un tema de cuenta de Meta, no de código.
- Close Friends paso 5 (vista admin) y el escáner en la app.
- Rediseño general de Q·OS (sidebar/header): espera capturas de Claude Design.

## Próximos pasos
- [ ] Spec 001: Evan revisa el inventario y marca qué se borra.
- [ ] Spec 001: plan y tareas de la limpieza aprobada.
- [ ] Rediseño general de Q·OS cuando lleguen las capturas.
