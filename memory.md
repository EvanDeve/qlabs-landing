# Memoria del proyecto

> Regla: máximo 50 líneas. Lo que ya quedó en el código o en `docs/constitution.md` se borra de acá.

## Estado actual (2026-10-08)
- **En prod:** marketplace completo (creador y marca rediseñados estilo iOS), Q·OS (agencia + área UGC rediseñada, mockups 1a–1f), Loyalty Loop, Close Friends (rol `member`, entra por QR), cronogramas mensuales con links para el Hero y para quien graba.
- **Tarea activa:** spec `002-media-kit` — T01–T17 en prod (2026-10-08); **T18 bloqueada** hasta que Evan mande los mockups del orden visual del kit. Evan está revisando lo hecho.
- **Recién hecho:**
  - Spec 002, media kit: piezas destacadas (hasta 3, desde el book), teléfono del creador solo para marcas verificadas con aviso en la campanita (una vez por marca y día), visitas del kit en el inicio, política de privacidad 1.3. El kit ahora también abre con `/ugc/creadores/@handle`.
  - La marca ve la nota de entrega del creador: en "Te toca aprobar" y en la tarjeta de cada aplicación.
  - `e586f42` nichos de creador: catálogo de 22, máximo 5, filtro `?nicho=` en Q·OS.
  - `ff9f563` links de acceso con `token_hash` y botón "Continuar" (los filtros de correo corporativos quemaban las invitaciones) + "Reenviar acceso" en Equipo.

## Decisiones y trampas vigentes
- El teléfono del creador NUNCA va en `creator_public_profiles` (solo `tiene_telefono`): la única puerta es la rpc `ver_telefono_creador`, que en el mismo acto avisa. Las visitas se cuentan desde el navegador (`/api/ugc/visitas-kit`); Chrome headless se filtra como bot, para probar hay que pasarle otro user-agent.
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
- [ ] Spec 002 T18: reordenar el kit público cuando lleguen los mockups de Evan.
- [ ] Rediseño general de Q·OS cuando lleguen las capturas.
- [ ] `/feature` chico: la marca que inicia sesión desde un kit no vuelve al kit (`destinoConNext` solo deja volver dentro del panel).
