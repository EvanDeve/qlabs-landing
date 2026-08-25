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
  /**
   * Avance de la subida, de 0 a 1. Opcional: quien no lo pasa se comporta
   * igual que antes.
   */
  onProgreso?: (fraccion: number) => void;
  /** Para cancelar desde la UI. Aborta la subida de verdad, no la ignora. */
  signal?: AbortSignal;
};

/** Se distingue de un error real: cancelar es una decisión, no una falla. */
export class SubidaCancelada extends Error {
  constructor() {
    super("Subida cancelada");
    this.name = "SubidaCancelada";
  }
}

/**
 * Sube el archivo y devuelve la ruta que hay que mandarle al servidor.
 * Tira `Error` con mensaje ya traducido: quien llama solo lo muestra.
 *
 * Va sobre XMLHttpRequest y no sobre `supabase.storage.upload()` por una razón
 * concreta: el SDK usa `fetch`, que no reporta cuánto subió. Sin eso la barra
 * de la hoja de entrega solo puede girar, y el creador que sube un reel de 40
 * MB por datos móviles no tiene forma de saber si avanza o se colgó. XHR sigue
 * siendo el único camino en el navegador para `upload.onprogress`.
 *
 * Se pega contra el endpoint REST de Storage —el mismo que llama el SDK— con
 * el token de la sesión. Si el día de mañana el SDK expone progreso, esto
 * vuelve a ser dos líneas.
 */
export async function subirArchivoDirecto({
  bucket,
  carpeta,
  file,
  maxBytes,
  extFallback = "bin",
  onProgreso,
  signal,
}: SubidaArgs): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(
      `El archivo pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(maxBytes)}.`
    );
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Se venció la sesión. Volvé a entrar y probá de nuevo.");

  const prefijo = carpeta ?? session.user.id;
  const storagePath = `${prefijo}/${crypto.randomUUID()}.${extensionDe(file.name, extFallback)}`;

  if (signal?.aborted) throw new SubidaCancelada();

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) throw new Error("Falta la configuración de Supabase.");
  const endpoint = `${base}/storage/v1/object/${bucket}/${storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  // Multipart y no el archivo crudo: es exactamente lo que arma
  // `storage-js` en el navegador cuando el cuerpo es un Blob (append de
  // "cacheControl" y del archivo bajo el nombre vacío). Mandar el binario
  // directo es el camino de Node, y contra este servidor no guarda el
  // Content-Type correcto. Ojo: NO se setea el header Content-Type — el
  // navegador tiene que ponerlo con su propio boundary.
  const cuerpo = new FormData();
  cuerpo.append("cacheControl", "3600");
  cuerpo.append("", file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    // El gateway de Supabase pide `apikey` en TODA request, no solo en las de
    // PostgREST. El SDK lo agrega solo; acá hay que ponerlo a mano o la subida
    // vuelve 401 sin haber llegado a las policies.
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");

    const alAbortar = () => xhr.abort();
    signal?.addEventListener("abort", alAbortar);
    const limpiar = () => signal?.removeEventListener("abort", alAbortar);

    if (onProgreso) {
      xhr.upload.onprogress = (e) => {
        // `lengthComputable` es false en algunos navegadores para cuerpos
        // grandes; ahí no se inventa un número, simplemente no se avisa.
        if (e.lengthComputable && e.total > 0) onProgreso(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      limpiar();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgreso?.(1);
        resolve();
      } else {
        let crudo = xhr.responseText || `HTTP ${xhr.status}`;
        try {
          const j = JSON.parse(xhr.responseText);
          crudo = j.message ?? j.error ?? crudo;
        } catch {
          // El cuerpo no siempre es JSON (un 413 del proxy llega en texto).
        }
        reject(new Error(mensajeDeSubida(`${crudo} ${xhr.status}`, maxBytes)));
      }
    };
    xhr.onerror = () => {
      limpiar();
      reject(new Error(mensajeDeSubida("network", maxBytes)));
    };
    xhr.onabort = () => {
      limpiar();
      reject(new SubidaCancelada());
    };

    xhr.send(cuerpo);
  });

  return storagePath;
}
