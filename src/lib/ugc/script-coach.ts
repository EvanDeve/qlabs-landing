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
 * El prompt pide TEXTO PLANO con encabezados fijos, y no JSON.
 *
 * Que la pantalla dibuje bloques de colores no cambió esa decisión: el guion
 * lo sigue editando el creador a mano y un JSON adentro de un textarea es
 * intocable; además un JSON mal cerrado se pierde entero, mientras que un
 * encabezado raro solo pierde ese encabezado. `parsearGuion` en `./guion` hace
 * la traducción y cae a texto plano cuando no reconoce nada — que es también
 * lo que salva a los guiones generados con la versión anterior de este prompt.
 *
 * ⚠️ Si se toca el formato de abajo hay que tocar `parsearGuion` con él. Los
 * tests de `guion.test.ts` usan justo este ejemplo como muestra.
 */
export function construirPromptDeGuion(segments: TranscriptionSegment[]): string {
  const transcripcion = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");

  return `${BASE_DE_CONOCIMIENTO}

---

## TU TAREA

Abajo está la transcripción de un video que ya se grabó. Reescribila como un
guion mejorado, listo para volver a grabarse.

Reglas de contenido:
- Mantené el tema, el producto y la intención del original. No inventes datos,
  precios, promociones ni afirmaciones que no estén en la transcripción.
- Trabajá el gancho de los primeros 3 segundos: es donde más se pierde gente.
- Cerrá con un llamado a la acción concreto.
- Lo que va entre comillas es lo que se dice a cámara, palabra por palabra. Lo
  que va sin comillas son indicaciones de qué mostrar mientras se dice.
- Español de Costa Rica, voseo.

Reglas de formato — respetalas EXACTAMENTE, la app las lee:
- Arrancá con dos líneas sueltas: "FORMATO:" con el tipo de pieza y su duración
  total (ejemplo: "FORMATO: Reel · 30 s") y "TONO:" con UNA sola palabra que
  diga cómo hay que decirlo (ejemplo: "TONO: Cercano").
- Después, exactamente tres bloques, cada uno abierto por su encabezado entre
  corchetes con el rango de tiempo: "[GANCHO 0-3 s]", "[CUERPO 3-22 s]",
  "[CIERRE 22-30 s]". Los rangos se encadenan y suman la duración que pusiste
  en FORMATO.
- Al final, una sección abierta por la línea "TOMAS QUE TE FALTAN" con 3 a 5
  viñetas que empiecen con "- ". Cada una es un plano concreto que conviene
  grabar para que este guion funcione. Son sugerencias de producción para la
  próxima grabación, NO descripciones del video original: vos no lo viste.
- Nada de introducción, ni de comentarios, ni de markdown con almohadillas.

Ejemplo exacto de la forma esperada:

FORMATO: Reel · 30 s
TONO: Cercano

[GANCHO 0-3 s]
"El mejor brunch de Escalante no es el que sale en todas las listas."

[CUERPO 3-22 s]
Huevos benedictinos sobre masa madre, café de Tarrazú, y todo el frente ventanal.
Sentate del lado de la ventana: la luz hace el trabajo por vos.

[CIERRE 22-30 s]
"Guardate este si te gusta desayunar sin apuro. ¿A quién llevás?"

TOMAS QUE TE FALTAN
- Detalle del corte del huevo, en cámara lenta
- Plano del ventanal con la mesa servida
- Vos hablando a cámara para el gancho

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
