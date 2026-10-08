# 002 · Tareas

Una a la vez; al terminar cada una: `npm test` y `npm run lint` en verde, commit a `main` y parar.
⚠️ T01–T04 se pueden pushear cuando sea. **De T05 en adelante nada se pushea hasta que Evan confirme que corrió la migración de T04**: el código nuevo en prod sin la migración rompe el kit y el book.

- [x] **T01 — Funciones puras de destacadas** (RF-01, RF-02, RF-03, RF-04)
  Test primero (`tests/unit/destacadas.test.ts`), después `src/lib/ugc/destacadas.ts`: `MAX_DESTACADAS`, `alternarDestacada`, `moverDestacada`, `separarDestacadas`.
  *Hecho cuando:* el test cubre agregar, quitar, el tope de 3 con su mensaje, mover en los bordes, separar sin repetir y sin destacadas, y `npm test` pasa.

- [x] **T02 — Funciones puras de contacto** (RF-06, RF-07, RF-08, RF-09, RF-11, RF-12)
  Test primero (`tests/unit/contacto-kit.test.ts`), después `src/lib/ugc/contacto-kit.ts`: `modoContacto` y `enlacesDeTelefono`. Sumar a `tests/unit/whatsapp.test.ts` los casos de `normalizarTelefonoCR` que falten (vacío, letras).
  *Hecho cuando:* hay un caso por cada `ModoContacto` (incluido admin → "ver" y marca sin verificar), los enlaces salen bien para un +506 y un número de otro país, y `npm test` pasa.

- [x] **T03 — Funciones puras de visitas y link del kit** (RF-15, RF-17, RF-18, RF-20)
  Test primero (`tests/unit/visitas-kit.test.ts`), después `src/lib/ugc/visitas-kit.ts` (`esBotDeVistaPrevia`, `inicioVentanaVisitas`, `textoVisitas`) y `urlDelKit` en `src/lib/ugc/handles.ts`. `CompartirPerfil` pasa a usar `urlDelKit` sin cambiar lo que muestra.
  *Hecho cuando:* los UA reales de cada bot de la lista dan `true`; Safari, Chrome, Instagram in-app y Facebook in-app dan `false`; la ventana cruza bien fin de mes, de año y un 29 de febrero; `urlDelKit` da lo mismo con y sin "@"; `npm test` pasa.

- [x] **T04 — Migración `media_kit`** (RF-02, RF-05, RF-06, RF-07, RF-10, RF-12b, RF-12c, RF-13, RF-14, RF-16, RF-19, RF-21)
  Escribir `supabase/migrations/20261008200000_media_kit.sql` como dice el plan. Antes: `grep` de dependencias de `creator_public_profiles` y comparar sus columnas con el OpenAPI de prod. Es aditiva, así que se puede correr con el código de hoy en prod. Evan la corre.
  *Hecho cuando:* Evan la corrió y el OpenAPI de prod muestra `orden_destacada`, `telefono_e164`, `mostrar_telefono`, `tiene_telefono` en la vista, las tablas `kit_visitas` y `kit_telefono_vistas` y las rpc `fijar_destacadas`, `ver_telefono_creador`, `registrar_visita_kit` y `resumen_visitas_kit`; `/ugc` y un kit público siguen cargando.

- [x] **T05 — Tipos de la base** (todos)
  Actualizar `src/lib/database.types.ts` a mano con lo de T04.
  *Hecho cuando:* coincide con el OpenAPI de prod y `npx tsc --noEmit` no da errores.

- [x] **T06 — Tests RLS de destacadas** (RF-01, RF-02, RF-05)
  `tests/rls/media-kit-destacadas.test.ts`: fijar 3 en orden, reordenar, 4 ids fallan, una cuarta por `update` directo choca con el unique, ids de otro creador fallan, anon no ejecuta la rpc, borrar una destacada la saca.
  *Hecho cuando:* `npm run test:rls` pasa y la consulta del README no deja cuentas `rlstest`.

- [x] **T07 — Tests RLS del teléfono** (RF-06, RF-07, RF-10, RF-12, RF-12b, RF-12c)
  `tests/rls/media-kit-telefono.test.ts`: escritura propia y checks; la vista sin el número y con `tiene_telefono`; `ver_telefono_creador` para anon (sin permiso), otro creador, marca sin verificar, marca verificada, admin, creador sin verificar, `mostrar_telefono = false`, y marca a la que se le saca la verificación; una notificación por marca+creador+día y ninguna a admins reales. `afterAll` borra las `telefono_visto` de prueba antes de `cleanup()`.
  *Hecho cuando:* `npm run test:rls` pasa, no quedan cuentas `rlstest` y no queda ninguna notificación `telefono_visto` con `brand_id` de prueba.

- [x] **T08 — Tests RLS de visitas** (RF-13, RF-14, RF-16, RF-17, RF-19, RF-21)
  `tests/rls/media-kit-visitas.test.ts`: anon suma 1 y repite sin sumar; otro anon suma; dueño y admin no suman; marca suma como `de_marcas`; creador sin verificar no suma; una fila de hace 31 días (sembrada con service role) no entra en la ventana; nadie más que el dueño y admin lee totales ni filas.
  *Hecho cuando:* `npm run test:rls` pasa y no quedan cuentas `rlstest`.

- [x] **T09 — Destacar desde el book** (RF-01, RF-02, RF-05)
  `alternarDestacadaAction` y `moverDestacadaAction` en `src/lib/actions/portfolio.ts`; botón, "Destacada N de 3", mover y marca en la miniatura en `PortfolioGrid.tsx`; `book/page.tsx` pasa `orden_destacada`.
  *Hecho cuando:* en el navegador se destacan 3, la 4ª muestra el aviso, se reordenan, y al borrar una destacada desaparece de las destacadas; la base lo confirma.

- [x] **T10 — Bloque de destacadas en el kit** (RF-03, RF-04)
  `CreatorDestacadas.tsx` con respaldo para archivo roto; el kit usa `separarDestacadas` y le pasa el resto a `CreatorPublicBook`. Posición provisoria: arriba del book (la final la deciden los mockups, T18).
  *Hecho cuando:* en el navegador el kit muestra las destacadas en su orden y sin repetirlas abajo, no muestra el bloque sin destacadas, y una destacada con el archivo borrado se ve como hueco sin romper el resto.

- [ ] **T11 — Teléfono en el perfil del creador** (RF-06, RF-07)
  `guardarContactoAction` en `creator-profile.ts`, `ContactoDelKit.tsx` en `creador/perfil/page.tsx`, y la línea del teléfono en la nota de `CompartirPerfil`.
  *Hecho cuando:* en el navegador "8888 7777" queda como +50688887777, un número inválido muestra el error sin guardar, el interruptor arranca apagado, vaciar el número apaga el interruptor, y guardar el resto del perfil NO toca el teléfono.

- [ ] **T12 — Contacto en el kit** (RF-08, RF-09, RF-10, RF-11, RF-12)
  En `creadores/[handle]/page.tsx`: sesión, rol, verificación de la marca y teléfono propio → `modoContacto`. `KitContacto.tsx` y `verTelefonoAction` en `src/lib/actions/kit.ts`.
  *Hecho cuando:* en el navegador cada visitante ve lo suyo (sin sesión, marca sin verificar, otro creador, marca verificada con WhatsApp y Llamar, el dueño con la aclaración, nada si no lo muestra), y `curl` sin sesión al kit no trae el número en el HTML.

- [ ] **T13 — Aviso en la campanita** (RF-12b, RF-12c)
  Rama `telefono_visto` en `NotificationsBell.tsx`.
  *Hecho cuando:* una marca de prueba toca "Ver teléfono" dos veces, el creador ve una sola notificación con el nombre de la marca y al tocarla abre la página pública de la marca.

- [ ] **T14 — Registro de visitas** (RF-13, RF-14, RF-15, RF-16)
  `src/app/api/ugc/visitas-kit/route.ts` y `RegistrarVisitaKit.tsx`, montado en el kit solo para quien no es el dueño ni admin.
  *Hecho cuando:* abrir el kit sin sesión crea la cookie `ugc_visitante` y una fila en `kit_visitas`; recargar no suma; con sesión de marca suma con `es_marca`; como dueño o admin no suma; `curl -A "facebookexternalhit/1.1" -X POST` no suma; la página no muestra errores si el POST falla. (Probar con Chrome normal: el headless se filtra como bot.)

- [ ] **T15 — Visitas en el inicio del creador** (RF-17, RF-18, RF-19)
  `resumen_visitas_kit` en `creador/page.tsx`, tarjeta con `textoVisitas`, y `CopiarLinkKit.tsx` en el estado vacío.
  *Hecho cuando:* en el navegador un creador sin visitas ve el mensaje que invita a compartir y el botón copia el link correcto; con visitas ve el total de 30 días y cuántas fueron de marcas, y coincide con la base.

- [ ] **T16 — Política de privacidad** (RF-06, RF-13)
  Proponerle a Evan el texto para §5 (teléfono visible solo para marcas verificadas) y §10 (cookie aleatoria para no contar dos veces una visita). Se commitea el texto que apruebe.
  *Hecho cuando:* Evan aprobó el texto y la página lo muestra.

- [ ] **T17 — Validación y cierre de la parte funcional** (RF-20, RF-21 y todos)
  `npm test`, `npm run test:rls`, `npm run lint`, `npm run build`, `npx tsc --noEmit` en verde; la recorrida del plan; `/ugc/creadores/@x` y `/ugc/creadores/x` abren el mismo kit; un creador sin verificar sigue en 404 sin sesión; la vista previa del link en WhatsApp se sigue armando; `memory.md` al día.
  *Hecho cuando:* todo lo anterior está tildado salvo T18.

- [ ] **T18 — Reordenamiento visual del kit según los mockups de Evan** (todos los RF de pantalla) — ⛔ **BLOQUEADA hasta que lleguen los mockups**
  Reordenar y vestir `creadores/[handle]/page.tsx` y sus componentes (destacadas, contacto, stats, book, habilidades, marcas, CTA) como digan las capturas. Ojo: los mockups pueden traer campos que no existen; lo que no esté en la base se pregunta, no se inventa.
  *Hecho cuando:* la página en el navegador coincide con los mockups en teléfono y escritorio, no se perdió ningún bloque de RF-03/RF-08/RF-09/RF-11, los 5 comandos siguen en verde y `memory.md` dice que la spec 002 está cerrada.
