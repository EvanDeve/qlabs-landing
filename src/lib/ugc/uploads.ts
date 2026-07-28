import { createClient } from "@/lib/supabase/client";

/**
 * Subida de archivos DIRECTA del navegador a Supabase Storage.
 *
 * Por qué existe este módulo: mandar un archivo por un Server Action o una
 * ruta de API choca con el tope de body de ~4.5 MB que tienen las funciones en
 * Vercel. Eso no se nota en local —donde no hay tope— y falla recién en
 * producción, que es exactamente la trampa en la que cayeron la entrega del
 * creador y la subida del book. El navegador sube directo a Storage, sin pasar
 * por Vercel, y al servidor solo le llega la ruta del archivo.
 *
 * El patrón se estrenó en la transcripción (`TranscriptionTool`) y acá quedó
 * compartido para que no haya que reinventarlo en cada subida nueva.
 *
 * ⚠️ Módulo de cliente: usa el browser client de Supabase y `crypto.randomUUID`.
 * No importarlo desde un Server Component ni desde un Server Action.
 */

export function pesoLegible(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** La extensión sirve para que el archivo guardado conserve su tipo. */
export function extensionDe(nombre: string, fallback: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase();
  // El `includes(".")` importa: un archivo sin punto devuelve el nombre entero
  // como "extensión" y termina generando rutas como `<uuid>.mivideofinal`.
  return ext && nombre.includes(".") && /^[a-z0-9]{1,5}$/.test(ext) ? ext : fallback;
}

/**
 * Tope real del proyecto Supabase (plan gratis). Medido contra el proyecto en
 * vivo el 2026-07-28: 49 MB entra, 55 MB rebota con 413 "Payload too large".
 * Storage lo aplica aunque el bucket no declare su propio límite, así que
 * ningún tope de la app puede pasarse de acá.
 */
export const MAX_STORAGE_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Traduce el error crudo de Storage a algo que un creador pueda accionar.
 * El mensaje de la API es en inglés y no dice cuánto es el máximo.
 */
export function mensajeDeSubida(raw: string, maxBytes: number): string {
  if (/exceeded the maximum allowed size|payload too large|413/i.test(raw)) {
    return `El archivo pasa el máximo de ${pesoLegible(maxBytes)}. Exportalo con menos calidad, o subilo a Drive y pegá el link acá abajo.`;
  }
  if (/jwt|expired|unauthorized|401/i.test(raw)) {
    return "Se venció la sesión. Volvé a entrar y probá de nuevo.";
  }
  if (/network|failed to fetch/i.test(raw)) {
    return "Se cortó la subida. Revisá la conexión y volvé a intentar.";
  }
  return `No se pudo subir el archivo: ${raw}`;
}

type SubidaArgs = {
  bucket: string;
  /**
   * Primer segmento de la ruta: es lo que miran las policies de storage.
   * Si no se pasa, se usa el uuid del usuario —el caso de casi todos los
   * buckets—. Solo `deliveries` usa otra cosa (el id de la aplicación).
   */
  carpeta?: string;
  file: File;
  maxBytes: number;
  /** Extensión a usar cuando el nombre del archivo no trae una. */
  extFallback?: string;
};

/**
 * Sube el archivo y devuelve la ruta que hay que mandarle al servidor.
 * Tira `Error` con mensaje ya traducido: quien llama solo lo muestra.
 */
export async function subirArchivoDirecto({
  bucket,
  carpeta,
  file,
  maxBytes,
  extFallback = "bin",
}: SubidaArgs): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(
      `El archivo pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(maxBytes)}.`
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Se venció la sesión. Volvé a entrar y probá de nuevo.");

  const prefijo = carpeta ?? user.id;
  const storagePath = `${prefijo}/${crypto.randomUUID()}.${extensionDe(file.name, extFallback)}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (error) throw new Error(mensajeDeSubida(error.message, maxBytes));

  return storagePath;
}
