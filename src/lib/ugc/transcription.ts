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

export const TRANSCRIPTION_BUCKET = "transcription-uploads";

/**
 * Tope de subida. Son 20 MB porque es lo que Gemini acepta como dato inline en
 * una sola llamada; más que eso obligaría a usar su API de archivos, que suma
 * una subida y una espera aparte, y no vale la pena para el material de acá:
 * un Reel o un TikTok de 15 a 60 segundos pesa bastante menos.
 */
export const MAX_TRANSCRIPTION_FILE_BYTES = 20 * 1024 * 1024;

export const TIPOS_ACEPTADOS = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
];

/** Extensión → MIME. Algunos navegadores mandan el `type` vacío. */
const MIME_POR_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export function mimeDeArchivo(nombre: string, tipoDeclarado?: string | null): string {
  if (tipoDeclarado && TIPOS_ACEPTADOS.includes(tipoDeclarado)) return tipoDeclarado;
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return MIME_POR_EXT[ext] ?? "video/mp4";
}

export function esArchivoAceptado(nombre: string, tipoDeclarado?: string | null): boolean {
  if (tipoDeclarado && TIPOS_ACEPTADOS.includes(tipoDeclarado)) return true;
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return ext in MIME_POR_EXT;
}

// `pesoLegible` vive ahora en `@/lib/ugc/uploads`, junto al resto de los
// helpers de subida. Este módulo lo importa el route handler, y uploads.ts
// trae el client de navegador de Supabase: mantenerlos separados evita
// arrastrar código de cliente al servidor.

export const TRANSCRIPTION_PROMPT = `Transcribí el audio de este video al español, palabra por palabra.

Empezá SIEMPRE con estas dos líneas, en este orden y con este formato exacto:
TITULO: un título corto y descriptivo del video, máximo 6 palabras, en español.
IDIOMA: el código ISO 639-1 del idioma que se habla (es, en, pt…), en minúscula.

Después, dejá una línea en blanco y transcribí.

Reglas de la transcripción:
- Poné una marca de tiempo [M:SS] cada vez que cambia la idea o hay una pausa clara.
- Transcribí exactamente lo que se dice, sin corregir la gramática ni resumir.
- Si el audio está en otro idioma, transcribilo en ese idioma tal cual se escucha.
- Si no hay nada hablado, respondé exactamente: SIN_AUDIO

Respondé ÚNICAMENTE con esas dos líneas y la transcripción, sin comentarios.

Ejemplo del formato esperado:
TITULO: Receta fácil de tres ingredientes
IDIOMA: es

[0:00] Hola, hoy les traigo la receta más fácil del mundo.
[0:06] Solo necesitan tres ingredientes.`;

/**
 * Separa la cabecera (título e idioma) del cuerpo de la transcripción.
 *
 * Va aparte de `parseSegments` porque son dos fallas distintas: que el modelo
 * se olvide del título no debería costar la transcripción entera. Si la
 * cabecera no vino, se devuelve el texto tal cual y las dos columnas quedan en
 * null — que es exactamente lo que tienen las filas anteriores a esto.
 */
export function parseCabecera(raw: string): {
  title: string | null;
  language: string | null;
  cuerpo: string;
} {
  const title = raw.match(/^\s*TITULO:\s*(.+)$/im)?.[1].trim() || null;
  const idiomaCrudo = raw.match(/^\s*IDIOMA:\s*([a-zA-Z-]{2,8})\s*$/im)?.[1].trim().toLowerCase();

  const cuerpo = raw
    .split("\n")
    .filter((l) => !/^\s*(TITULO|IDIOMA):/i.test(l))
    .join("\n")
    .trim();

  return {
    // El modelo a veces envuelve el título en comillas aunque no se le pida.
    title: title ? title.replace(/^["'«]|["'»]$/g, "").slice(0, 80) : null,
    language: idiomaCrudo ?? null,
    cuerpo,
  };
}

/**
 * Cómo se llama una transcripción en la lista.
 *
 * El orden es el que se puede sostener: el título que puso el creador o
 * propuso el modelo; si no hay, el nombre del archivo —que es lo que muestra
 * el propio mockup en una de sus tres filas—; y si vino de un link, el host.
 * Nunca queda vacío.
 */
export function nombreDeTranscripcion(t: {
  title?: string | null;
  file_name?: string | null;
  source_url?: string | null;
}): string {
  if (t.title?.trim()) return t.title.trim();
  if (t.file_name?.trim()) return t.file_name.trim();
  if (!t.source_url) return "Sin nombre";
  try {
    const u = new URL(t.source_url);
    return u.hostname.replace(/^www\./, "") + u.pathname;
  } catch {
    return t.source_url;
  }
}

/** De dónde salió, como se dice en la lista: "Archivo · 28 jul · 2:14". */
export function fuenteLegible(sourceType: string): string {
  switch (sourceType) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "upload":
      return "Archivo";
    default:
      return "Link";
  }
}

/**
 * Cuántas palabras tiene la transcripción. Es el único de los tres chips del
 * detalle que no necesitó columna: sale de contar lo que ya está guardado.
 */
export function contarPalabras(segments: TranscriptionSegment[] | null | undefined): number {
  if (!segments?.length) return 0;
  return segments.reduce((total, s) => {
    const palabras = s.text.trim().split(/\s+/).filter(Boolean);
    return total + palabras.length;
  }, 0);
}

/**
 * Lee la duración del átomo `mvhd` de un MP4 o un MOV.
 *
 * Existe porque el camino obvio —un `<video>` y su `loadedmetadata`— **no
 * responde con la pestaña en segundo plano**: Chrome suspende la carga de
 * medios ahí, y no dispara ni `loadedmetadata` ni `error`, así que la medición
 * se queda colgada hasta el timeout y devuelve null. Medido el 2026-08-25. En
 * el teléfono eso pasa apenas el creador se va a otra app mientras elige el
 * archivo, que es justo lo que uno hace.
 *
 * Esto no depende del pipeline de medios: son bytes. Cubre mp4 y mov, que es
 * lo que sale de un teléfono; para webm o mkv sigue mandando el `<video>`.
 *
 * Devuelve null ante cualquier cosa rara en vez de tirar: no saber la duración
 * no puede costar la subida.
 */
export function duracionDeMp4(buffer: ArrayBuffer): number | null {
  const v = new DataView(buffer);

  function buscar(ini: number, fin: number): number | null {
    let p = ini;
    // El 8 es el encabezado mínimo de un átomo: tamaño (4) + tipo (4).
    while (p + 8 <= fin) {
      let tam = v.getUint32(p);
      const tipo = String.fromCharCode(
        v.getUint8(p + 4),
        v.getUint8(p + 5),
        v.getUint8(p + 6),
        v.getUint8(p + 7)
      );
      let cab = 8;
      // tamaño 1 = el real viene en 64 bits después del tipo; 0 = hasta el final.
      if (tam === 1) {
        cab = 16;
        tam = Number(v.getBigUint64(p + 8));
      } else if (tam === 0) {
        tam = fin - p;
      }
      if (tam < cab || p + tam > fin) return null;

      if (tipo === "mvhd") {
        const ver = v.getUint8(p + cab);
        // +4 salta el byte de versión y los 3 de flags.
        const base = p + cab + 4;
        if (ver === 1) {
          // v1: creación y modificación son de 64 bits (8+8), después escala.
          const escala = v.getUint32(base + 16);
          const dur = Number(v.getBigUint64(base + 20));
          return escala > 0 ? dur / escala : null;
        }
        // v0: creación y modificación de 32 bits (4+4), después escala.
        const escala = v.getUint32(base + 8);
        const dur = v.getUint32(base + 12);
        return escala > 0 ? dur / escala : null;
      }

      // `mvhd` cuelga de `moov`; los otros dos se recorren por si el archivo
      // trae un orden raro.
      if (tipo === "moov" || tipo === "trak" || tipo === "mdia") {
        const r = buscar(p + cab, p + tam);
        if (r != null) return r;
      }
      p += tam;
    }
    return null;
  }

  try {
    const r = buscar(0, v.byteLength);
    return r != null && Number.isFinite(r) && r > 0 ? r : null;
  } catch {
    return null;
  }
}

/** Segundos a "2:14". Null cuando no se sabe: no se estima. */
export function duracionLegible(segundos: number | null | undefined): string | null {
  if (segundos == null || !Number.isFinite(segundos) || segundos <= 0) return null;
  const total = Math.round(segundos);
  const m = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

// Los idiomas que puede devolver el modelo. `languages.ts` tiene los dos que un
// creador declara hablar (es/en) y ese es otro dato: acá se nombra el idioma de
// UN audio, que puede ser cualquiera. Un código desconocido se muestra en
// mayúsculas —"JA"— en vez de esconderse: dice algo, y es cierto.
const IDIOMAS: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  pt: "Portugués",
  fr: "Francés",
  it: "Italiano",
  de: "Alemán",
  ja: "Japonés",
  zh: "Chino",
};

export function idiomaLegible(code: string | null | undefined): string | null {
  if (!code) return null;
  const limpio = code.trim().toLowerCase().slice(0, 2);
  return IDIOMAS[limpio] ?? limpio.toUpperCase();
}

/**
 * Traduce los errores de Gemini a algo accionable. El mensaje crudo suele ser
 * un stack de la API que no le dice nada a un creador.
 */
export function mensajeDeError(err: unknown, sourceType: SourceType | "upload"): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/SIN_AUDIO/.test(raw)) {
    return "El video no tiene audio hablado para transcribir.";
  }
  // Instagram y TikTok bloquean el acceso desde afuera: no es un fallo nuestro
  // y no hay forma de sortearlo desde el servidor. La salida real es subir el
  // archivo, así que el mensaje manda para allá en vez de dejar al creador
  // reintentando algo que nunca va a andar.
  if (sourceType === "instagram") {
    return "Instagram no deja leer sus videos desde afuera. Descargá el video y subilo con el botón «Subir un archivo» — así sí funciona.";
  }
  if (sourceType === "tiktok") {
    return "TikTok no deja leer sus videos desde afuera. Descargá el video y subilo con el botón «Subir un archivo» — así sí funciona.";
  }
  if (/quota|rate limit|429/i.test(raw)) {
    return "Se alcanzó el límite de transcripciones por ahora. Probá de nuevo en unos minutos.";
  }
  if (/not found|404|unavailable|private/i.test(raw)) {
    return "No se pudo acceder al video. Fijate que el link sea público y que no esté borrado.";
  }
  if (sourceType === "upload") {
    return "No se pudo transcribir el archivo. Fijate que sea un video o audio válido y volvé a intentar.";
  }
  return "No se pudo transcribir el video. Revisá que el link sea correcto y volvé a intentar.";
}
