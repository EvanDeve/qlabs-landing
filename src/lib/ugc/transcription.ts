export type TranscriptionSegment = { timestamp: string; text: string };

export type SourceType = "youtube" | "instagram" | "tiktok" | "otro";

export function detectSourceType(url: string): SourceType {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  return "otro";
}

/**
 * Normaliza URLs de YouTube al único formato que Gemini acepta.
 *
 * Los dos casos que fallan si no se normalizan son justo los más comunes:
 * el link corto que da el botón de compartir (youtu.be/…) y el de Shorts,
 * que es de donde sale casi todo el contenido vertical.
 */
export function normalizeVideoUrl(url: string): string {
  let u = url.trim();
  if (!u.startsWith("http")) u = `https://${u}`;
  u = u.replace(/youtu\.be\/([A-Za-z0-9_-]+)/, "www.youtube.com/watch?v=$1");
  u = u.replace(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/, "youtube.com/watch?v=$1");
  return u;
}

/** Valida antes de gastar una llamada a Gemini en algo que no es un link. */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return Boolean(u.hostname) && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Convierte el texto corrido "[0:05] hola [0:09] qué tal" en segmentos.
 * Si Gemini devuelve el texto sin marcas, se guarda como un solo bloque en
 * lugar de perderlo.
 */
export function parseSegments(raw: string): TranscriptionSegment[] {
  // Los \s* de adentro NO son de adorno: Gemini devuelve tanto "[0:00]" como
  // "[ 0:00 ]" y sin tolerar los espacios el parseo devolvía cero segmentos y
  // toda la transcripción caía al bloque único de abajo. Verificado con una
  // llamada real, no supuesto.
  const regex = /\[\s*(\d+:\d{2})\s*\]\s*([^[]+)/g;
  const segments: TranscriptionSegment[] = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const text = match[2].trim();
    if (text) segments.push({ timestamp: match[1], text });
  }
  if (segments.length > 0) return segments;

  const limpio = raw.trim();
  return limpio ? [{ timestamp: "0:00", text: limpio }] : [];
}

/** El texto plano, para el botón de copiar. */
export function segmentsToPlainText(segments: TranscriptionSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}

/** Con timestamps, para pegar en un documento de trabajo. */
export function segmentsToTimestampedText(segments: TranscriptionSegment[]): string {
  return segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
}

export const TRANSCRIPTION_PROMPT = `Transcribí el audio de este video al español, palabra por palabra.

Reglas:
- Poné una marca de tiempo [M:SS] cada vez que cambia la idea o hay una pausa clara.
- Transcribí exactamente lo que se dice, sin corregir la gramática ni resumir.
- Si el audio está en otro idioma, transcribilo en ese idioma tal cual se escucha.
- Si no hay nada hablado, respondé exactamente: SIN_AUDIO

Respondé ÚNICAMENTE con la transcripción, sin introducción ni comentarios.

Ejemplo del formato esperado:
[0:00] Hola, hoy les traigo la receta más fácil del mundo.
[0:06] Solo necesitan tres ingredientes.`;

/**
 * Traduce los errores de Gemini a algo accionable. El mensaje crudo suele ser
 * un stack de la API que no le dice nada a un creador.
 */
export function mensajeDeError(err: unknown, sourceType: SourceType): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (sourceType === "instagram") {
    return "Instagram no deja leer los videos desde afuera. Descargá el video y volvé a intentar con un link de YouTube, o pegá el texto a mano.";
  }
  if (sourceType === "tiktok") {
    return "TikTok no siempre deja leer el video desde su link. Si falla, probá subiéndolo a YouTube como no listado.";
  }
  if (/quota|rate limit|429/i.test(raw)) {
    return "Se alcanzó el límite de transcripciones por ahora. Probá de nuevo en unos minutos.";
  }
  if (/not found|404|unavailable|private/i.test(raw)) {
    return "No se pudo acceder al video. Fijate que el link sea público y que no esté borrado.";
  }
  if (/SIN_AUDIO/.test(raw)) {
    return "El video no tiene audio hablado para transcribir.";
  }
  return "No se pudo transcribir el video. Revisá que el link sea correcto y volvé a intentar.";
}
