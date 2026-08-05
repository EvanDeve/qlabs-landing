/**
 * Reglas del voiceover: topes, modelos y traducción de errores.
 *
 * Módulo isomorfo a propósito —lo importan la pantalla y las rutas por igual—,
 * así que acá NO va ni la API key ni ninguna llamada a ElevenLabs. Eso vive en
 * `elevenlabs.ts`, que es solo de servidor.
 */

export const VOICEOVER_BUCKET = "voiceovers";

/**
 * Tope de caracteres por generación.
 *
 * No es el límite de ElevenLabs (10.000 en Multilingual v2, 40.000 en Flash):
 * es una red contra el accidente de pegar un documento entero y quemar media
 * cuota del mes en una sola tecla. Un guion de UGC ronda los 600-900
 * caracteres, así que 5.000 es holgado para cualquier uso real y sigue por
 * debajo del tope del modelo más restrictivo.
 */
export const MAX_VOICEOVER_CHARS = 5000;

/** Los audios se borran solos a los 30 días. La regla vive en la migración
 *  (`expires_at`); acá está la copia que necesita la pantalla para avisarlo. */
export const VOICEOVER_TTL_DIAS = 30;

export type ModeloDeVoz = {
  id: string;
  nombre: string;
  detalle: string;
  /** Cuántos créditos cuesta cada carácter. Flash cobra la mitad. */
  creditosPorCaracter: number;
};

/**
 * Los dos modelos que tiene sentido ofrecer.
 *
 * Eleven v3 queda afuera a propósito: es el más expresivo pero se maneja con
 * etiquetas de emoción dentro del texto, que es otra herramienta y otra forma
 * de escribir el guion. Si algún día se suma, se suma con su propia UI.
 */
export const MODELOS_DE_VOZ: ModeloDeVoz[] = [
  {
    id: "eleven_multilingual_v2",
    nombre: "Calidad",
    detalle: "La voz más natural. Para lo que se entrega al cliente.",
    creditosPorCaracter: 1,
  },
  {
    id: "eleven_flash_v2_5",
    nombre: "Rápido",
    detalle: "Mitad de créditos y más veloz. Para probar cómo suena.",
    creditosPorCaracter: 0.5,
  },
];

export const MODELO_POR_DEFECTO = MODELOS_DE_VOZ[0].id;

export function modeloDeVoz(id: string): ModeloDeVoz | undefined {
  return MODELOS_DE_VOZ.find((m) => m.id === id);
}

/** Créditos que va a costar el texto. Se redondea para arriba: ElevenLabs no
 *  cobra medio crédito y mostrar 37,5 solo genera dudas. */
export function creditosDe(texto: string, modelId: string): number {
  const modelo = modeloDeVoz(modelId);
  return Math.ceil(texto.length * (modelo?.creditosPorCaracter ?? 1));
}

/** Nombre corto para el historial: el guion entero no entra en 320px. */
export function tituloDeGuion(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= 42) return limpio || "sin texto";
  return `${limpio.slice(0, 42).trimEnd()}…`;
}

/**
 * Días que le quedan al audio antes de que la limpieza se lo lleve.
 * `expires_at` es un instante (timestamptz), no un día del calendario, así que
 * la resta directa es correcta acá — no aplica el manejo de días de `diaCR()`.
 */
export function diasParaVencer(expiresAt: string, ahora = new Date()): number {
  const ms = new Date(expiresAt).getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Deja de un guion mejorado solo lo que se dice en voz alta.
 *
 * Por qué hace falta: el guion que devuelve la herramienta de transcripción es
 * un guion de RODAJE, no un texto para leer. Trae timestamps, acotaciones de
 * cámara entre paréntesis, títulos en markdown y énfasis con asteriscos. Y
 * arriba de todo eso, más de la mitad del archivo no es guion: el prompt del
 * coach le pide al modelo una sección "## Qué cambié y por qué" al final
 * (ver `script-coach.ts`), que es análisis para el creador y no texto para
 * locutar. Medido sobre los guiones reales del equipo, entre las acotaciones y
 * esa sección se va el 60-65% del archivo: mandarlo tal cual hace que
 * ElevenLabs lea "cero cero, a cámara, mirada intensa" y después se ponga a
 * explicar sus propias decisiones en voz alta — y lo cobra todo.
 *
 * Se aplica al TRAER el guion y no al mandarlo, a propósito: así lo que se ve
 * en pantalla es exactamente lo que se va a escuchar, el contador de créditos
 * dice la verdad, y lo que la limpieza se haya llevado de más se puede volver
 * a escribir a mano.
 */
export function limpiarGuionParaVoz(texto: string): string {
  return (
    texto
      // La sección de análisis del final y todo lo que venga después, junto con
      // el separador `---` que suele precederla. El encabezado exacto lo pide
      // el prompt, así que es un contrato y no una coincidencia.
      .replace(/\n\s*(?:-{3,}\s*)?#{1,6}[ \t]*¿?\s*qu[eé] cambi[eé][\s\S]*$/i, "")
      // El "Acá tenés el guion mejorado para X:" con el que arranca el modelo.
      // Solo se saca si es una línea corta terminada en ":" y lo que sigue es
      // un título, un timestamp o una raya — si no, podría ser la primera frase
      // del guion.
      .replace(/^[^\n]{0,120}:[ \t]*\n+(?=[ \t]*(?:#{1,6}[ \t]|\[\d+:\d{2}\]|-{3,}))/, "")
      .replace(/^[ \t]*#{1,6}[ \t].*$/gm, "")
      // Rayas sueltas: separan secciones para quien lee, nunca se dicen.
      .replace(/^[ \t]*(?:-{3,}|_{3,}|\*{3,})[ \t]*$/gm, "")
      .replace(/\[\d+:\d{2}\]/g, "")
      // Acotaciones de cámara. No anida: en estos guiones nunca hay paréntesis
      // adentro de otro, y una regex que lo intente se vuelve ilegible.
      .replace(/\([^()]*\)/g, "")
      .replace(/[*_`]/g, "")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Error de la API de ElevenLabs, con lo justo para poder traducirlo después.
 *  Vive acá y no en `elevenlabs.ts` para que la traducción no arrastre el
 *  módulo de servidor —y con él la API key— hacia el bundle del navegador. */
export class VozError extends Error {
  status?: number;
  codigo?: string;

  constructor(message: string, opciones?: { status?: number; codigo?: string }) {
    super(message);
    this.name = "VozError";
    this.status = opciones?.status;
    this.codigo = opciones?.codigo;
  }
}

/**
 * Traduce el error crudo a algo que el equipo pueda accionar. El mensaje de
 * ElevenLabs viene en inglés y no dice qué hacer al respecto.
 */
export function mensajeDeErrorDeVoz(err: unknown): string {
  const status = err instanceof VozError ? err.status : undefined;
  const codigo = err instanceof VozError ? err.codigo ?? "" : "";
  const crudo = err instanceof Error ? err.message : String(err);

  // El código va ANTES que el status a propósito: ElevenLabs responde la cuota
  // agotada con 401 en algunos planes, y mirando solo el número esto mandaría a
  // renovar una API key que está perfecta.
  if (/quota_exceeded|too_many/i.test(codigo) || status === 429) {
    return "Se acabaron los créditos del mes en ElevenLabs. Se renuevan al empezar el próximo ciclo, o se puede subir de plan.";
  }
  if (status === 401 || status === 403 || /invalid_api_key|unauthorized/i.test(codigo)) {
    return "La API key de ElevenLabs no es válida o se venció. Hay que renovarla en el panel de ElevenLabs y actualizarla en Vercel.";
  }
  if (status === 404 || /voice_not_found/i.test(codigo)) {
    // Cubre los dos casos con el mismo texto: un id mal pegado y una voz que se
    // borró de la cuenta. Decir "ya no está" en el primero manda a buscar un
    // problema que no existe.
    return "No encontré esa voz en ElevenLabs. Revisá el Voice ID, o elegí una de la lista.";
  }
  if (status === 422 || /invalid_content|validation/i.test(codigo)) {
    return "ElevenLabs rechazó el texto. Suele pasar cuando quedan símbolos raros o el guion está casi vacío.";
  }
  if (/abort|timeout|etimedout/i.test(crudo)) {
    return "ElevenLabs tardó demasiado en responder. Probá de nuevo, o con un texto más corto.";
  }
  return "No se pudo generar la voz. Probá de nuevo en un momento.";
}

/**
 * Valida el texto antes de gastar una llamada. Devuelve el motivo del rechazo,
 * o null si está bien. La misma función corre en la pantalla (para desactivar
 * el botón) y en la ruta (que es donde de verdad importa).
 */
export function motivoDeRechazo(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return "Escribí o pegá el texto que querés convertir en voz.";
  if (limpio.length > MAX_VOICEOVER_CHARS) {
    // Sin `toLocaleString`: el separador de miles en español depende del ICU
    // que traiga el runtime (Node devolvía "5 001" con un espacio raro) y acá
    // ningún número pasa de cuatro dígitos, así que no hay nada que agrupar.
    return `El texto tiene ${limpio.length} caracteres y el máximo por generación son ${MAX_VOICEOVER_CHARS}. Partilo en dos.`;
  }
  return null;
}
