# 001 · Limpieza del repo y la base

**Estado:** cerrada 2026-10-08 (T01–T11). Pendiente fuera de la spec: mudar el repo fuera de iCloud (lo hace Evan) y el `/feature` de la nota de entrega.

## Contexto y por qué

Después de meses de construir rápido, Evan siente que el proyecto acumuló código, archivos y estructura de datos que no se usan, y que eso hace más difícil trabajar y razonar sobre el sistema. Antes de seguir con funcionalidades nuevas (rediseño general de Q·OS) se limpia lo que sobra, con evidencia y sin romper nada que esté en uso o en pausa.

El relevamiento completo está en `inventario.md`. Conclusión principal: el repo y la base están más ordenados de lo que parecía; la limpieza es de restos puntuales, no una reestructuración.

## Alcance

**Dentro:** lo marcado `borrar` en `inventario.md` (archivos locales, código sin uso, dependencias, CSS muerto, documentos y prototipos superados, tablas, columnas y funciones sin uso) y los ajustes de orden de la sección D.

**Fuera:** renombres grandes de la base, unificar idioma, fusionar tablas o kanbans, cualquier cambio de comportamiento visible para usuarios, features en pausa (McLovin, Close Friends paso 5) y código estacionado a propósito.

## Requisitos funcionales

- **RF-01** — EL SISTEMA conserva todo el comportamiento visible actual: cada pantalla, link, correo y cron que funciona hoy sigue funcionando igual después de la limpieza.
- **RF-02** — CUANDO se borra un archivo, componente, export o dependencia, EL SISTEMA no conserva ninguna referencia a eso (imports, comentarios que lo nombran, configuración).
- **RF-03** — CUANDO se borra una tabla, columna o función de la base, EL SISTEMA lo hace con una migración versionada que primero deja de usarse en el código (código desplegado antes que migración corrida).
- **RF-04** — SI un objeto de la base tiene datos en prod, ENTONCES EL SISTEMA no lo borra sin una decisión explícita de Evan.
- **RF-05** — EL SISTEMA deja de exponer a usuarios logueados estadísticas de entrega de creadores ajenos.
- **RF-06** — CUANDO se muestran los apuntes de una pieza del cronograma, EL SISTEMA decide cuál mostrar (los de la tarjeta o los del cronograma) en un solo lugar compartido por todas las pantallas.
- **RF-07** — EL SISTEMA tiene los tipos de la base al día con el esquema real de prod.
- **RF-08** — EL SISTEMA queda con `npm test`, `npm run test:rls`, `npm run lint` y `npm run build` en verde, y `tsc --noEmit` sin errores.
- **RF-09** — Los documentos de referencia que se conservan quedan en `docs/` (o en `prototypes/` los de diseño) y la raíz del repo solo tiene configuración y los archivos de gobierno (`CLAUDE.md`, `memory.md`, `roadmap-ugc-crc.md`).

## Casos límite

- Clases CSS armadas dinámicamente (`styles[\`risk${…}\`]`) pueden parecer muertas: se verifican en el navegador antes de borrarlas.
- `content_pieces.record_date` la lee el webhook de McLovin (en pausa): quitarla no debe romper el webhook si se reactiva.
- El repo vive en una carpeta sincronizada por iCloud, que es lo que genera los duplicados en `.next/` y `.git/`: borrarlos sin mover el repo hace que vuelvan.

## Decisiones de Evan (2026-10-08)

1. `testimonios.mp4`: hay otra copia, se borra.
2. `applications.delivery_note`: **corregido en T07** — no era un duplicado, es la única copia de la nota del creador. Se conserva y se le muestra a la marca en un `/feature` aparte.
3. Métricas y tarifas de `creator_profiles`: se borran. Si algún día hacen falta, va una spec con formulario.
4. El repo se muda fuera de iCloud, a `~/Proyects/`, al final de la limpieza.
