# Memoria del proyecto

> Regla: máximo 50 líneas. Lo que ya quedó en el código o en `docs/constitution.md` se borra de acá.

## Estado actual (2026-11-18)
- **En prod:** marketplace completo (creador y marca rediseñados estilo iOS), Q·OS (agencia + área UGC rediseñada, mockups 1a–1f), Loyalty Loop, Close Friends (rol `member`, entra por QR), cronogramas mensuales con links para el Hero y para quien graba.
- **Tarea activa:** spec `003-dashboard-editor` — T01–T17 en prod el 2026-11-20 (hasta `c63e1bc`); migración `20261119120000` corrida por Evan y verificada. Falta **T18** (verificación en prod: necesita permiso de Evan; el primer reparto real corre solo el lunes 23/11 entre 6:00 y 6:59 CR) y **T19** (cierre). Editor activo real: 1 (Carlos); la cuenta del 18/11 es director. 2026-11-20: "Por Grabar" había nacido al final del board video y se llevó `is_done` de Publicado (Dashboard: 393 atrasadas en vez de 13); ya se pueden reordenar columnas desde el modal, una nueva nace antes de la final, Evan movió Por Grabar al principio, e `is_ready` pasó de Revisión a Terminado. Esa columna se dividió en "En curso" y "En revisión" (la que espera al cliente). La fila del editor sale de la vista `fila_de_edicion` (migración `20261120120000`, corrida): todo lo suyo sin terminar en cualquier columna; para los 8 del reparto no cuenta En revisión (`d92e4e0`). Decisiones provisionales P-02..P-13 en el plan.
- **Spec 002:** `002-media-kit` — T01–T17 en prod (2026-10-08); **T18 bloqueada** hasta que Evan mande los mockups del orden visual del kit. Evan está revisando lo hecho.
- **Recién hecho:**
  - 2026-11-18 `ad85154` cronogramas: lo editado en la TARJETA sube a la fila (trigger `subir_tarjeta_al_cronograma`, security definer, sin apuntes). Bajar ya andaba; subir no existía y el equipo reprograma en la tarjeta: 81 separados, corregidos con la tarjeta ganando. Migración `20261118120000` corrida y verificada (0 separados + mover/devolver con sesión de director).
  - 2026-11-06 cronogramas: borrar una tarjeta borra su video del cronograma (trigger), cualquier video se puede quitar aunque esté aprobado (se lleva su tarjeta), y check de **grabado** (`content_pieces.recorded_at`) en el cronograma, la ficha, el Kanban y el link de grabación. Migración `20261106120000` corrida en prod el 2026-11-06 (limpió 65 videos huérfanos); verificado en prod: trigger, check del cronograma, switch de la ficha y pill en /grabacion.
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
- Cronograma ↔ tarjeta: editar de un lado edita el otro (bajar en `guardarVideoAction`, subir por trigger; gana lo último). Borrar de un lado borra del otro. Tarjeta→video por trigger `before delete` (security definer, porque UGC no pasa la policy de los videos); video→tarjeta en `borrarVideoAction`. No poner el trigger inverso: dos `before delete` que se borran entre sí revientan en Postgres.

## En pausa (no tocar sin que Evan lo pida)
- McLovin (agente de WhatsApp): la salida por WhatsApp está caída desde ~30/8 por un tema de cuenta de Meta, no de código.
- Close Friends paso 5 (vista admin) y el escáner en la app.
- Rediseño general de Q·OS (sidebar/header): espera capturas de Claude Design.

## Próximos pasos
- [ ] `/feature` chico: McLovin, "qué hay en EN CURSO/Revision" trae tarjetas de otras columnas (`leerBusqueda` parte el nombre por espacios pero las palabras también por "/"); rompe `tests/rls/busqueda-humo.test.ts` desde el 2026-11-20.
- [ ] Aprobar un mes desde el Dashboard (botón del equipo, `toggleCalendarMonthAction`) NO crea las tarjetas: los videos quedan sin llegar al pipeline (Delitalia sept, 11). Decidir si debe crearlas.
- [ ] Spec 002 T18: reordenar el kit público cuando lleguen los mockups de Evan.
- [ ] Rediseño general de Q·OS cuando lleguen las capturas.
- [ ] `/feature` chico: la marca que inicia sesión desde un kit no vuelve al kit (`destinoConNext` solo deja volver dentro del panel).
