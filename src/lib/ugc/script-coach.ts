import type { TranscriptionSegment } from "./transcription";

/**
 * Guion mejorado a partir de una transcripción.
 *
 * ⚠️ Diferencia con el proyecto de referencia (q-system-app): allá el prompt
 * recibía un análisis multimodal de Gemini —cortes, texto en pantalla, ritmo
 * visual— porque el modelo veía el video. Acá lo único que existe es la
 * transcripción. Pedirle un diagnóstico visual sobre material que no vio es
 * la receta para que invente, así que el prompt trabaja solo lo que se puede
 * sostener con el texto: gancho, estructura, tensión narrativa, cierre y
 * redacción. Las indicaciones de producción van como sugerencia de lo que
 * convendría grabar, nunca como lectura de lo que ya se grabó.
 */

/**
 * Los dos frameworks del método siguen siendo placeholders en la referencia:
 * nunca se pegó el contenido de los PDFs. Lo que sí es contenido real es la
 * lista de gatillos y la estructura por fases, y con eso alcanza para que el
 * modelo tenga vocabulario y criterio de forma.
 *
 * Para completarlo más adelante: pegar el cuerpo de cada framework debajo de
 * su encabezado. No hace falta tocar nada más — el prompt ya los inyecta.
 */
export const BASE_DE_CONOCIMIENTO = `
# CRITERIO DE CONTENIDO — MÉTODO Q LABS

Sos un estratega senior de contenido y psicología del consumo visual, trabajando
sobre contenido UGC de restaurantes y hoteles en Costa Rica.

## GATILLOS QUE PODÉS NOMBRAR Y USAR
- Pattern Interrupt: romper la expectativa en los primeros segundos para forzar atención.
- Open Loop: una pregunta o tensión que el cerebro necesita cerrar y sostiene el visionado.
- Efecto Contraste: yuxtaponer estados (antes/después, problema/solución) para amplificar el valor percibido.
- Prueba Social: señales de validación colectiva que bajan la fricción de decisión.
- Escasez y Urgencia: pérdida percibida que activa el sesgo de acción inmediata.
- Micro-compromisos: afirmaciones menores encadenadas que construyen inercia de acuerdo.
- Anclaje Emocional: asociar el producto a un estado emocional deseado.

## ESTRUCTURA POR FASES
- GANCHO (0–3 s): mecanismo de captura — Pattern Interrupt, pregunta de alta tensión o afirmación disruptiva.
- DESARROLLO (3 s hasta el 80%): construcción de valor, manejo de objeciones, open loops anidados.
- CIERRE (último 10–20%): activación de la decisión — gratificación inmediata, prueba social final, urgencia.

## FRAMEWORK 1: Ingeniería de la Atención
<!-- Pegar acá el cuerpo del Framework 1 cuando esté disponible. -->

## FRAMEWORK 2: Estructura de Alto Impacto
<!-- Pegar acá el cuerpo del Framework 2 cuando esté disponible. -->

## CÓMO ESCRIBIR
- Directo y accionable. Nada de "es importante que…" ni "recordá que…".
- El guion tiene que ser usable tal cual, no un borrador con huecos.
- Español de Costa Rica, voseo.
`.trim();

/**
 * El prompt pide texto plano y no JSON a propósito: lo único que se devuelve
 * es un guion, y el creador lo va a editar a mano. Envolverlo en JSON solo
 * agrega una forma más de que la respuesta falle a parsear.
 */
export function construirPromptDeGuion(segments: TranscriptionSegment[]): string {
  const transcripcion = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");

  return `${BASE_DE_CONOCIMIENTO}

---

## TU TAREA

Abajo está la transcripción de un video que ya se grabó. Reescribila como un
guion mejorado, listo para volver a grabarse.

Reglas:
- Mantené el tema, el producto y la intención del original. No inventes datos,
  precios, promociones ni afirmaciones que no estén en la transcripción.
- Trabajá el gancho de los primeros 3 segundos: es donde más se pierde gente.
- Marcá los tiempos en el mismo formato [M:SS].
- Poné indicaciones de producción entre paréntesis cuando cambien el resultado
  —(a cámara), (plano del plato), (texto en pantalla: …)—. Son sugerencias de
  lo que conviene grabar, no descripciones del video original: vos no lo viste.
- Cerrá con un llamado a la acción concreto.

Después del guion, agregá una sección "## Qué cambié y por qué" con 3 a 5
puntos, cada uno nombrando el gatillo o la fase que estás corrigiendo.

Respondé solo con el guion y esa sección, sin introducción.

---

## TRANSCRIPCIÓN ORIGINAL

${transcripcion}`;
}

/** Traduce los errores del modelo a algo que le sirva a un creador. */
export function mensajeDeErrorDeGuion(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/quota|rate limit|429/i.test(raw)) {
    return "Se alcanzó el límite de generaciones por ahora. Probá de nuevo en unos minutos.";
  }
  if (/safety|blocked/i.test(raw)) {
    return "El modelo no pudo trabajar sobre esta transcripción. Si el audio venía con ruido o cortado, probá transcribirlo de nuevo.";
  }
  return "No se pudo generar el guion. Probá de nuevo en un momento.";
}
