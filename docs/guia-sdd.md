# GUÍA MAESTRA Y PROTOCOLO DE TRABAJO EN CLAUDE CODE: AGENTIZACIÓN, HARNESS Y SPEC-DRIVEN DEVELOPMENT (SDD)

> **Manual de Gobernanza para el Desarrollo Asistido por IA Profesional**
> Basado en la metodología *IA y El Nuevo Programador* (MoureDev) y adaptado específicamente para el flujo de trabajo con **Claude Code**.

---

## 1. MENTALIDAD Y FUNDAMENTOS DEL NUEVO PROGRAMADOR

### 1.1 El Cambio de Paradigma
El rol del programador ha evolucionado:
* **La IA genera el código sintáctico.**
* **El desarrollador aporta el criterio**, la arquitectura, el análisis de requisitos, la supervisión de calidad y la responsabilidad final del producto.
* **Invariante:** La IA ejecuta, pero el responsable del repositorio y del producto final eres tú.

### 1.2 Adiós al "Vibe Coding"
El *vibe coding* (pedir cambios sin plan, copiar/pegar de chats aislados o modificar código a ciegas) genera deuda técnica inmanejable, alucinaciones y regresiones. En su lugar, adoptamos **Ingeniería de Software Determinista** mediante arneses (*harnesses*), guardarraíles y desarrollo basado en especificaciones (*Spec-Driven Development*).

### 1.3 Las 5 Capas del Desarrollo Profesional con IA
1. **Fundamentos de IA y LLMs:** Comprensión de la naturaleza probabilística, tokens y gestión estricta de la **Ventana de Contexto** (memoria a corto plazo del modelo).
2. **Harness Básico:** Definición de instrucciones globales (`CLAUDE.md`), memoria persistente (`memory.md`) y bifurcación explícita entre *Plan Mode* (razonar/pregunta) y *Build/Execution Mode* (escribir código).
3. **Harness Avanzado:** Automatización con comandos personalizados, habilidades modulares (*Agent Skills*) y protocolos de contexto externo (**MCP - Model Context Protocol**).
4. **Spec-Driven Development (SDD):** Metodología *Spec-Anchored* en 7 pasos para que la especificación sea la fuente viva de verdad del software.
5. **Multiagentes y Orquestación:** Coordinación de un "ejército" de agentes primarios y subagentes especializados que trabajan en paralelo y en bucles seguros de validación.

---

## 2. CONFIGURACIÓN DEL HARNESS EN CLAUDE CODE

Claude Code soporta de manera nativa la arquitectura de gobernanza y contexto a través de archivos Markdown en la raíz del repositorio.

```text
mi-proyecto/
├── CLAUDE.md                   # Instrucciones y reglas globales de Claude Code (< 40 líneas)
├── memory.md                   # Memoria persistente y dinámica (< 50 líneas)
├── docs/
│   └── constitution.md         # Principios arquitectónicos e innegociables
├── .claude/                    # Configuración interna de Claude Code
│   ├── commands/               # Comandos slash personalizados (/feature, /sdd-*)
│   └── agents/                 # Definición de subagentes especializados
│       ├── coordinator.md
│       ├── planner.md
│       ├── implementer.md
│       └── reviewer.md
├── .agents/
│   └── skills/                 # Skills especializadas reutilizables
│       └── [nombre-skill]/
│           └── skill.md
└── specs/                      # Especificaciones vivas del proyecto
    └── 001-[nombre-feature]/
        ├── spec.md             # Qué y por qué (Requisitos funcionales en EARS)
        ├── plan.md             # Cómo (Arquitectura, funciones puras, tests)
        └── tasks.md            # Checklist de tareas atómicas (20-30 min)
```

---

## 3. CONTRATOS BASE DE PROYECTO (PLANTILLAS LISTAS PARA COPIAR)

### 3.1 `CLAUDE.md` (Punto de Entrada Global)
*Ubicación: `./CLAUDE.md`. Archivo que lee Claude Code al iniciar la sesión. Debe ser conciso (30-40 líneas máximo).*

```markdown
# Reglas y Gobernanza de Claude Code

## Stack Tecnológico & Comandos
- **Proyecto:** [Nombre del Proyecto]
- **Stack:** [ej. TypeScript, Node.js, React / Python, FastAPI]
- **Comando de Tests:** `[ej. npm test / pytest / node --test]`
- **Comando de Linter/Formato:** `[ej. npm run lint]`

## Contexto & Archivos Clave
1. **Memoria:** Lee `memory.md` al iniciar cada sesión para conocer el estado actual y decisiones previas.
2. **Gobernanza:** Consulta `docs/constitution.md` para las reglas innegociables de arquitectura.
3. **Especificaciones:** Revisa la spec activa en `specs/` antes de modificar código.

## Reglas Innegociables
- **Cero Vibe Coding:** Prohibido escribir código sin una spec aprobada en `specs/` o usar un comando de planificación.
- **Modo Plan Primero:** Si una petición afecta la arquitectura, razona y pregunta antes de editar código.
- **Simplicidad:** Soluciones simples y mantenibles. Prohibido agregar dependencias sin autorización explícita.
- **Actualización de Memoria:** Al finalizar una tarea relevante, actualiza `memory.md`.
```

---

### 3.2 `memory.md` (Memoria Persistente de Trabajo)
*Ubicación: `./memory.md`. Límite máximo: 50 líneas.*

```markdown
# Memoria del Proyecto

> **Regla para Claude Code:** Mantén este archivo en un máximo de 50 líneas. Resume o elimina contexto antiguo que ya esté consolidado en el código.

## Estado Actual
- **Versión/Hito:** v1.0.0
- **Tarea en Desarrollo:** [Descripción breve de lo que se trabaja actualmente]

## Decisiones de Arquitectura & Aprendizajes
- [Fecha] - **Decisión:** [Razón por la que se tomó una arquitectura X].
- [Fecha] - **Gotcha:** [Especial cuidado con X función o comportamiento de librería].

## Próximos Pasos Pendientes
- [ ] Implementar la spec 002.
- [ ] Refactorizar [módulo].
```

---

### 3.3 `docs/constitution.md` (Principios Innegociables)
*Ubicación: `docs/constitution.md`.*

```markdown
# Constitución del Proyecto

Principios innegociables que rigen todo el desarrollo en este repositorio:

1. **La Spec Manda:** Nada se implementa si no está en la spec activa (`specs/`). Si falta una decisión, se para y se pregunta al desarrollador.
2. **Separación de Lógica e Interfaz:** La lógica de negocio debe consistir en funciones puras independientes de la UI o de frameworks de presentación.
3. **Tests como Filtro:** Prohibido avanzar a la siguiente tarea si los tests están en rojo.
4. **Respeto a los Datos:** Garantizar compatibilidad hacia atrás y manejo seguro de datos del usuario.
5. **Idioma:** Código y comentarios en Inglés; documentación y especificaciones en Español.
```

---

## 4. METODOLOGÍA SPEC-DRIVEN DEVELOPMENT (SDD) EN CLAUDE CODE

El desarrollo asistido por especificaciones (*Spec-Anchored*) consta de 7 pasos estructurados:

```text
[1. Constitución] ──> [2. Especificación (spec.md)] ──> [3. Clarificación (QA)]
                                                              │
[6. Validación] <── [5. Implementación TDD] <── [4. Planificación (plan.md & tasks.md)]
```

### Detalle de los 7 Pasos SDD:

1. **Paso 1: Constitución (`docs/constitution.md`):** Define las reglas innegociables del proyecto (se hace una sola vez por repositorio).
2. **Paso 2: Especificación (`specs/NNN-feature/spec.md`):** Redacta el **QUÉ** y el **POR QUÉ** sin mencionar archivos, frameworks ni detalles de código.
   * **Notación EARS (en español):**
     * `CUANDO <evento>, EL SISTEMA <respuesta>.`
     * `SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.`
     * `MIENTRAS <estado>, EL SISTEMA <respuesta>.`
     * `EL SISTEMA <comportamiento permanente>.`
3. **Paso 3: Clarificación (Revisión QA):** Claude Code actúa como un QA exigente detectando ambigüedades, contradicciones y casos límite sin proponer soluciones prematuras.
4. **Paso 4: Planificación (`specs/NNN-feature/plan.md`):** Define el **CÓMO** técnico:
   * Archivos a crear/modificar y sus responsabilidades.
   * Funciones puras de lógica (pasando estado/fechas como parámetro).
   * Pseudocódigo y decisiones técnicas justificadas con alternativas descartadas.
   * Estrategia de tests que cubra cada Requisito Funcional (RF).
5. **Paso 5: Tareas (`specs/NNN-feature/tasks.md`):** Desglose en tareas atómicas de 20-30 minutos en orden de dependencia con la casilla `Hecho cuando:` verificable.
6. **Paso 6: Implementación (Ciclo TDD):**
   * Claude Code toma **UNA sola tarea** a la vez.
   * Escribe primero el test en rojo (falla).
   * Escribe el código necesario para poner el test en verde.
   * Ejecuta el comando de tests.
   * Marca la tarea como hecha y **SE DETIENE** para aprobación.
7. **Paso 7: Validación:** Revisa la especificación RF por RF ejecutando los tests y verificando la interfaz visual mediante herramientas MCP (ej. Chrome DevTools MCP).

---

## 5. SISTEMA MULTIAGENTE Y ORQUESTRACIÓN EN CLAUDE CODE

Para tareas complejas, Claude Code puede orquestar subagentes especializados mediante sesiones separadas que se ejecutan en segundo plano y devuelven el resultado al agente coordinador.

### 5.1 Los 4 Roles del Ejército Multiagente
* **`@Coordinator` (Agente Primario):** Dirige el flujo SDD, habla con el desarrollador y transfiere el contexto. **No edita código directamente.**
* **`@Planner` (Subagente):** Diseña `spec.md`, `plan.md` y `tasks.md`. Solo puede escribir dentro de `specs/`.
* **`@Implementer` (Subagente):** Ejecuta tareas individuales de código siguiendo la metodología TDD (tests primero).
* **`@Reviewer` (Subagente QA):** Revisa el código, ejecuta los tests, pasa linters y valida con MCPs sin modificar ningún archivo.

### 5.2 Regla de Transmisión de Contexto
Los subagentes nacen en sesiones limpias y **no leen el historial del chat principal**. En cada invocación, el `@Coordinator` debe pasarles explícitamente:
1. La fase exacta en la que están y el objetivo.
2. Las rutas relativas de los archivos que deben leer (`spec.md`, `plan.md`, `tasks.md`, `constitution.md`).
3. El resultado de la fase anterior o las respuestas de clarificación del desarrollador.

---

## 6. COMANDOS SLASH REUTILIZABLES PARA CLAUDE CODE

Crea estos archivos en `.claude/commands/` para ejecutar acciones complejas con una simple barra `/`:

### `/feature` (`.claude/commands/feature.md`)
```markdown
---
description: Planifica una funcionalidad simple en Modo Plan antes de modificar código
---
Analiza la siguiente propuesta: $ARGUMENTS
1. Lee CLAUDE.md y docs/constitution.md.
2. Examina la estructura del proyecto.
3. Presenta un plan con: resumen, archivos afectados, riesgos y preguntas.
4. Espera mi aprobación antes de modificar ningún archivo.
```

### `/sdd-spec` (`.claude/commands/sdd-spec.md`)
```markdown
---
description: Redacta la especificación de una nueva feature (Uso: /sdd-spec 001-nombre idea)
---
NO escribas código. Lee docs/constitution.md y memory.md.
1. Hazme hasta 5 preguntas de UNA en UNA para resolver ambigüedades.
2. Genera `specs/$1/spec.md` con requisitos funcionales en notación EARS.
3. Describe únicamente el QUÉ y el POR QUÉ.
```

### `/sdd-plan` (`.claude/commands/sdd-plan.md`)
```markdown
---
description: Genera el plan técnico y la lista de tareas para una spec aprobada
---
Lee docs/constitution.md y specs/$1/spec.md. NO escribas código.
1. Genera `specs/$1/plan.md` indicando archivos a modificar, funciones puras y estrategia de tests.
2. Genera `specs/$1/tasks.md` con tareas atómicas (< 30 min) y casillas de verificación.
```

### `/sdd-implement` (`.claude/commands/sdd-implement.md`)
```markdown
---
description: Implementa UNA sola tarea de la spec usando TDD
---
Implementa SOLO la tarea $2 de `specs/$1/tasks.md`.
1. Escribe primero los tests y confirma que fallan.
2. Escribe el código hasta que los tests pasen.
3. Ejecuta el comando de pruebas y muestra el resultado.
4. Marca la tarea en `tasks.md` y DETENTE.
```

---

## 7. RESUMEN DE ATRIBUTOS PARA DESARROLLAR CON ÉXITO
* **Instrucciones Breves:** `CLAUDE.md` < 40 líneas, `memory.md` < 50 líneas.
* **Agilidad en Iteración:** Tareas pequeñas de 20 a 30 minutos.
* **Verificación Continua:** Tests unitarios automatizados + validación visual con MCPs.
* **Gobernanza Viva:** Un cambio de requisitos se modifica primero en `spec.md`, luego en `plan.md` y finalmente en el código.
