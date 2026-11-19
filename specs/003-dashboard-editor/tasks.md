# 003 · Tareas

Una a la vez; al terminar cada una: `npm test` y `npm run lint` en verde, commit a `main` y parar. Lo que toca RLS, además `npm run test:rls` y la consulta del README para confirmar que no quedan cuentas `rlstest`.
⚠️ T01–T05 se pueden pushear cuando sea. **De T06 en adelante nada se pushea hasta que Evan confirme que corrió la migración de T05**: el código nuevo sin la migración rompe el Dashboard.

- [ ] **T01 — Días hábiles** (RF-12, RF-15, RF-21, RF-28)
  Test primero (`tests/unit/dias-habiles.test.ts`), después `src/lib/ugc/dias-habiles.ts` con las firmas del plan.
  *Hecho cuando:* hay casos de sábado, domingo y lunes; `diasHabilesEntre` cruza fin de mes, de año y un 29 de febrero; `ultimosDiasHabiles` un lunes salta el fin de semana y un sábado no incluye hoy; `inicioDeSemana` de un domingo da el lunes anterior; `rangoUtcDelDia('2026-11-19')` da `06:00Z` a `06:00Z` del 20; `npm test` pasa.

- [ ] **T02 — Algoritmo del reparto** (RF-05, RF-06, RF-07, RF-09, RF-11)
  Test primero (`tests/unit/reparto.test.ts`), después `src/lib/ugc/reparto.ts`: `META_DIARIA`, `compararParaReparto`, `repartir`.
  *Hecho cuando:* el test cubre orden atrasado viejo → atrasado nuevo → hoy → futuro → sin fecha, desempate por hora y creación; editor con 3 recibe 5; con 8 o más, 0; parejo al que menos tiene; empate por orden del array; 5 disponibles para 3 editores en 0 → 2/2/1; 0 disponibles → []; sin editores → []; las entradas no se mutan; `npm test` pasa.

- [ ] **T03 — Fila, avance y adelanto del editor** (RF-13, RF-14, RF-15, RF-16, RF-17, RF-19, RF-20, RF-21, CL-11, CL-13)
  Test primero (`tests/unit/edicion.test.ts`), después `src/lib/ugc/edicion.ts`: `vistaDelDashboard`, `armarFila`, `diasDeAdelanto`, `textoAdelanto`, `avanceDelDia`, `textoFilaVacia`. Textos con voseo ("Llevás 3 de 8").
  *Hecho cuando:* hay un caso por cada rol de `vistaDelDashboard` (editor activo, editor inactivo, director, guionista, null); "Llevás 10 de 8" con `cumplida` true; sábado sin meta; atrasados separados con sus días; adelanto positivo, 0, negativo ("N días de atraso") y null sin fechas; fila vacía con 0 y con N disponibles; `npm test` pasa.

- [ ] **T04 — Resumen del panel** (RF-25, RF-26, RF-27, RF-28, RF-29, RF-31, RF-32, CL-05)
  Test primero (`tests/unit/panel-editores.test.ts`), después `src/lib/ugc/panel-editores.ts`: `metaDelPeriodo`, `resumenDelPanel`, `textoInicioMedicion`.
  *Hecho cuando:* un miércoles la meta de la semana es 24 (hoy incluido); un mes en curso cuenta solo los días hábiles hasta hoy; los días antes de `inicioMedicion` no suman ni a meta ni a total; `inicioMedicion` null → meta 0 y porcentaje null; el historial tiene 10 días hábiles sin fines de semana y marca `llego`; un editor sin nada aparece en ceros; cambiar el `ownerId` de un terminado lo mueve de editor; `npm test` pasa.

- [ ] **T05 — Migración `dashboard_editor`** (RF-01, RF-02, RF-03, RF-08, RF-10, RF-11, RF-23, RF-24, RF-30, RF-32, CL-04, CL-08)
  Escribir `supabase/migrations/20261119120000_dashboard_editor.sql` como dice el plan. Antes: GET a `content_columns?section=eq.video` para confirmar que los cuatro ids y posiciones siguen iguales, y `grep` de `puede_ver_board` en `supabase/migrations/` para no perder nada de la definición vigente.
  **⏸ PUNTO DE PARADA: Evan corre la migración en el SQL Editor de Supabase.** Es compatible con el código de hoy en prod; desde que corre, el trigger ya registra terminados.
  *Hecho cuando:* Evan la corrió y el OpenAPI de prod muestra `es_por_editar` y `cuenta_como_terminado` en `content_columns`, `terminado_at` en `content_pieces`, la tabla `repartos_de_edicion`, las vistas `videos_por_editar` y `videos_esperando_aprobacion` y la rpc `aplicar_reparto_de_edicion`; un GET muestra Por editar con `es_por_editar` y Terminado/Publicado con `cuenta_como_terminado`; el Pipeline y el Dashboard siguen cargando.

- [ ] **T06 — Tipos de la base** (todos)
  Actualizar `src/lib/database.types.ts` a mano con lo de T05 (`terminado_at` solo en `Row`).
  *Hecho cuando:* coincide con el OpenAPI de prod y `npx tsc --noEmit` no da errores.

- [ ] **T07 — Tests RLS del momento de terminado** (RF-01, RF-02, RF-03, CL-01, CL-02, CL-03, CL-04)
  `tests/rls/dashboard-editor.test.ts` (primer bloque), con un board de prueba `v_rls…` y sus columnas (una `es_por_editar`, una intermedia, dos `cuenta_como_terminado`): Por editar → Terminado registra (con sesión de editor y con service role); vuelta a la intermedia lo borra y conserva `owner_id`; Terminado → Publicado lo conserva exacto; ida y vuelta deja el último; Por editar → Publicado registra; insert en Terminado (también con `terminado_at` puesto) queda null; `update` de `terminado_at` a mano no cambia.
  *Hecho cuando:* `npm run test:rls` pasa, no quedan cuentas `rlstest` ni el board de prueba.

- [ ] **T08 — Tests RLS de acceso, vistas y reparto** (RF-08, RF-10, RF-11, RF-23, RF-24, RF-30, CL-07)
  Segundo bloque del mismo archivo, con una tarjeta de prueba sin Hero en Por editar del board `video` real: editor activo sin membresía ve el board video, sus columnas y la tarjeta, y la puede mover; no ve `it`; editor inactivo y guionista sin membresía no ven nada; `videos_por_editar` la trae para el editor y no para anon; `videos_esperando_aprobacion` responde para director y no para anon; editor no lee `repartos_de_edicion` ni ejecuta la rpc, director lee; la rpc (service role, día `2099-01-05`) asigna la disponible, no toca una con dueño, una en Terminado ni una de otro board, no asigna a un editor inactivo ni a un no-editor, y una segunda llamada el mismo día devuelve 0.
  *Hecho cuando:* `npm run test:rls` pasa; no quedan cuentas `rlstest`, ni la tarjeta de prueba, ni la fila `2099-01-05` en `repartos_de_edicion`.

- [ ] **T09 — Paginación y datos de la vista del editor** (RF-14, RF-16, RF-18, RF-20)
  `src/lib/supabase/paginar.ts` (`traerTodas`) y `getVistaEditor` en `src/lib/ugc/edicion-datos.ts`.
  *Hecho cuando:* `npm test` pasa con un test de `traerTodas` (cliente falso de 2.300 filas → 3 páginas, sin repetir); llamado desde un script de una vez con la sesión de un editor real devuelve su fila, sus terminados de hoy y los disponibles, y coincide con un GET a la base.

- [ ] **T10 — Dashboard bifurcado: avance y adelanto** (RF-13, RF-14, RF-15, RF-19, RF-21, RF-22, CL-11)
  `requireArea` devuelve `staff`; en `(inicio)/page.tsx` el `return <VistaEditor/>` va antes de las consultas de la agencia; `VistaEditor.tsx` con el bloque "Llevás N de 8" y los días de adelanto.
  *Hecho cuando:* en el navegador un editor ve su vista y NO el Pase de servicio ni la meta por cliente; un director y un guionista siguen viendo el Dashboard de la agencia igual que antes; con la hora del server forzada a un sábado (parámetro en `getVistaEditor`, no en la UI) no aparece "de 8".

- [ ] **T11 — Dashboard del editor: fila, atrasados, terminados de hoy y vacío** (RF-16, RF-17, RF-18, RF-20, CL-10, CL-12, CL-14)
  Completar `VistaEditor.tsx`: atrasados destacados arriba con días de atraso, fila con cliente, título, fecha, plataforma, grabado y días para publicarse, link a `/admin/pipeline/{id}`; terminados de hoy; estado vacío con disponibles.
  *Hecho cuando:* en el navegador, con un editor de prueba: el orden coincide con RF-05; abrir un video lleva a la ficha; mover uno propio a Terminado y recargar lo pasa a terminados y sube N; devolverlo a Por editar lo vuelve a la fila (CL-12); ponerse responsable desde la ficha lo agrega (CL-14); sin fila se ve el vacío con el número de disponibles.

- [ ] **T12 — Ejecutor del reparto** (RF-04, RF-06, RF-08, RF-10, RF-11, RF-12, CL-07)
  `ejecutarReparto(admin, now)` en `edicion-datos.ts`, con test unitario (`tests/unit/reparto.test.ts`) usando un cliente falso.
  *Hecho cuando:* `npm test` pasa con casos: sábado → `no-habil` sin llamar a la base; ya hay fila del día → `ya-repartido` sin llamar a la rpc; día hábil → llama a la rpc con las asignaciones de `repartir` y solo con editores activos ordenados por `created_at`.

- [ ] **T13 — Ruta y cron del reparto** (RF-04, RF-12)
  `src/app/api/qos/editores/reparto/route.ts` (mismo control de `CRON_SECRET` que `agente/cron`, explicación del horario en el comentario) y el segundo cron en `vercel.json` (`0 12 * * 1-5`).
  *Hecho cuando:* `npm run build` pasa; en local, sin header → 401 y sin `CRON_SECRET` → 503; tras el deploy, `vercel crons ls` (o el dashboard) muestra los dos crons. **No se llama la ruta con secreto en prod en esta tarea**: el primer reparto real se mira en T18.

- [ ] **T14 — Datos del panel** (RF-25, RF-26, RF-27, RF-29, RF-30, RF-31, RF-32)
  `getPanelEditores` en `edicion-datos.ts`: editores activos con nombre, fila de todos, terminados desde el primer día del mes anterior (paginados), disponibles y atrasados disponibles con `count`, `videos_esperando_aprobacion`, `min(dia)` de repartos.
  *Hecho cuando:* desde un script de una vez con sesión de director, los conteos coinciden con GET `count` a la base (disponibles, atrasados, videos sin aprobar de diciembre y enero) y aparecen los dos editores activos.

- [ ] **T15 — Panel de editores: equipo y hoy** (RF-24, RF-25, RF-30, RF-31)
  `src/app/admin/(panel)/editores/page.tsx` con `requireDirector()`, bloque del equipo (disponibles, atrasados, sin aprobar por mes) y una fila por editor (hoy contra 8, pendientes, atrasados, adelanto); `loading.tsx`.
  *Hecho cuando:* en el navegador un director ve los números de T14 y a todos los editores activos, también con cero; un editor que pega `/admin/editores` rebota a `/admin`.

- [ ] **T16 — Panel de editores: historial y cumplimiento** (RF-26, RF-27, RF-28, RF-29, RF-32)
  Historial de 10 días hábiles por editor (terminados y si llegó a 8), semanas y meses (total, meta, %), y el aviso de desde cuándo se mide.
  *Hecho cuando:* en el navegador los números coinciden con `resumenDelPanel` sobre los datos de T14; antes del primer reparto se ve "la medición arranca con el primer reparto" y no hay porcentajes inventados.

- [ ] **T17 — Item del menú** (RF-24)
  "Editores" en `layout.tsx`, solo para director, en Operación después de Heroes.
  *Hecho cuando:* en el navegador el director lo ve, ilumina bien y el título de la barra dice "Editores"; un editor y un guionista no lo ven; no aparece un segundo encabezado "Operación".

- [ ] **T18 — Verificación en prod forzando casos** (todos)
  Con permiso de Evan y con el deploy promovido (`vercel ls --prod`):
  1. Mover una tarjeta real Por editar → Terminado → Revisión → Terminado → Publicado (ficha y Kanban) y por McLovin si la entrada anda: `terminado_at` aparece, se borra, vuelve con el último momento y se conserva al publicar.
  2. Las 12 que ya estaban en Terminado siguen con `terminado_at` null (CL-08).
  3. El editor nuevo (2026-11-18) ve el board video sin ser miembro.
  4. Primer reparto: esperar el cron de las 6:00 (o llamar la ruta con `CRON_SECRET` si Evan lo pide) y revisar `repartos_de_edicion.asignaciones`: cada editor quedó con 8 pendientes (o lo que alcance), primero los atrasados más viejos, nada con dueño previo ni fuera de Por editar; llamarla otra vez el mismo día devuelve `ya-repartido`.
  5. Un sábado (o con la ruta llamada a mano ese día): `no-habil` y nada cambia.
  6. Dashboard con sesión de cada editor y panel con sesión de director: los números coinciden con consultas `count` a la base.
  *Hecho cuando:* los seis puntos dan lo esperado y cualquier diferencia quedó anotada (y, si es bug, como `/feature`).

- [ ] **T19 — Cierre: memory.md y estado de la spec**
  Actualizar `memory.md` (lo hecho, la migración corrida, el último slot de cron usado, el hallazgo de `is_ready` en Revisión y el efecto en el WhatsApp) y marcar el estado de `spec.md`. Las preguntas que sigan abiertas pasan a "Próximos pasos".
  *Hecho cuando:* `memory.md` sigue en 50 líneas o menos, refleja el commit final y no repite lo que ya está en el código o en la constitución.
