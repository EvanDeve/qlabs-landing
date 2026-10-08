# 001 · Tareas

Una a la vez; al terminar cada una: tests en verde, commit a `main` y parar.

- [x] **T01 — Archivos locales** (RF-09)
  Borrar `testimonios.mp4`, `tsconfig.tsbuildinfo`, `.DS_Store`, `.next/` y `.git/index 2`…`7`.
  *Hecho cuando:* no existen y `npx tsc --noEmit` ya no da los errores de duplicados de `.next`.

- [x] **T02 — Documentos y prototipos** (RF-02, RF-09)
  Borrar los superados, mover `Ideas.md` y la guía a `docs/`, commitear `docs/qos-como-producto.html` y ajustar los comentarios y la constitución que los nombran.
  *Hecho cuando:* la raíz tiene solo configuración + `CLAUDE.md`, `memory.md` y `roadmap-ugc-crc.md`, y `grep` de cada nombre borrado da 0.

- [x] **T03 — Componentes, exports y dependencias sin uso** (RF-02, RF-08)
  *Hecho cuando:* `grep` de cada nombre da 0, `npm test`, `npm run lint` y `npm run build` pasan, y las 3 dependencias no están en `package.json`.
  *Nota:* quedan 2 avisos de lint que ya estaban antes (import de `qos.module.css` sin usar en `creador/perfil` y `creador/pipeline`). No se tocan acá: quitar el import de un CSS module puede cambiar qué estilos carga la página; se ven en T04 junto con el CSS. → En T04 se sacaron: el layout `ugc/(dashboard)/layout.tsx` ya importa ese CSS.

- [x] **T04 — CSS muerto de `qos.module.css`** (RF-01, RF-02)
  *Hecho cuando:* se borraron las clases verificadas, el build pasa y la recorrida visual de Q·OS no muestra cambios.

- [x] **T05 — Regla de apuntes en un solo lugar** (RF-06)
  Test primero, después `src/lib/ugc/apuntes.ts`, que usa `/grabacion`.
  *Hecho cuando:* el test pasa y `/grabacion/[token]` muestra lo mismo que antes.

- [x] **T06 — Ficha de admin sin servicios, add-ons ni métricas** (RF-01, RF-03)
  *Hecho cuando:* la ficha del creador abre bien en el navegador y ningún archivo de `src/` nombra esas tablas y columnas.

- [x] **T07 — Fuera `calendar_events.content_piece_id` del código** (RF-03)
  *Hecho cuando:* `grep` da 0 en `src/`.
  *Cambio:* `delivery_note` salió de esta tarea: no era un duplicado sino la única copia de la nota del creador. Evan eligió mostrársela a la marca (`/feature` aparte).

- [x] **T08 — Fuera `content_pieces.record_date` del código** (RF-01, RF-03)
  *Hecho cuando:* `grep` da 0 en `src/`, el test de agenda pasa, y el inicio, el calendario y el kanban de Q·OS se ven igual. Si "reprogramar" de McLovin necesita más que quitar la columna: parar y preguntar.

- [x] **T09 — Migración `limpieza_001`** (RF-03, RF-04, RF-05)
  Se escribe después de que T06–T08 estén **desplegados en prod**. Evan la corre.
  *Hecho cuando:* Evan la corrió, `creator_delivery_stats` responde 404, las tablas no existen y `/ugc` y los perfiles públicos de creador cargan.

- [ ] **T10 — Tipos de la base al día** (RF-07)
  *Hecho cuando:* `database.types.ts` coincide con prod y `npx tsc --noEmit` no da errores.

- [ ] **T11 — Validación final y mudanza** (RF-01, RF-08)
  Los 5 comandos en verde, la recorrida visual completa, `memory.md` al día, y el comando para mudar el repo a `~/Proyects/` entregado a Evan.
  *Hecho cuando:* todo lo anterior está tildado.
