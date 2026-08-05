/**
 * Cliente de ElevenLabs. SOLO de servidor: acá vive la API key.
 *
 * Sin SDK, igual que Resend y Twilio en este repo: son dos endpoints REST y un
 * header. Una dependencia más sería una dependencia más que actualizar.
 *
 * ⚠️ No importar este módulo desde un componente de cliente. Lo que la pantalla
 * necesita (topes, modelos, traducción de errores) vive en `voz.ts`.
 */

import { VozError } from "@/lib/ugc/voz";

const API = "https://api.elevenlabs.io/v1";

/**
 * Corta la espera antes de que lo haga la función de Vercel (300s). Un pedido
 * colgado que agota el tope de la plataforma devuelve un error de infra sin
 * cuerpo JSON, y ahí la pantalla no puede decir qué pasó; cortando acá, el
 * fallo llega traducido y la fila queda marcada como corresponde.
 */
const TIMEOUT_MS = 120_000;

export type VozDisponible = {
  id: string;
  nombre: string;
  /** Muestra de ~10s que sirve la propia ElevenLabs. Escucharla no gasta
   *  créditos: es la forma de elegir voz sin pagar una generación. */
  preview: string | null;
  categoria: string | null;
};

export function hayApiKey(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new VozError("falta ELEVENLABS_API_KEY", { codigo: "sin_configurar" });
  return key;
}

/**
 * Levanta el error de la respuesta con su código adentro, para que
 * `mensajeDeErrorDeVoz` pueda distinguir "se acabaron los créditos" de "la key
 * no sirve" en vez de mostrar siempre el mismo mensaje genérico.
 *
 * El cuerpo de error de ElevenLabs viene de dos formas según el endpoint:
 * `{ detail: { status, message } }` o `{ detail: "texto" }`.
 */
async function comoError(res: Response): Promise<VozError> {
  let codigo = "";
  let mensaje = res.statusText;

  try {
    const body = (await res.json()) as { detail?: { status?: string; message?: string } | string };
    if (typeof body.detail === "string") {
      mensaje = body.detail;
    } else if (body.detail) {
      codigo = body.detail.status ?? "";
      mensaje = body.detail.message ?? mensaje;
    }
  } catch {
    // Respuesta sin JSON (un 502 del borde, por ejemplo): queda el statusText.
  }

  return new VozError(`ElevenLabs ${res.status}: ${mensaje}`, { status: res.status, codigo });
}

/** Las voces de la cuenta, incluidas las clonadas. */
export async function listarVoces(): Promise<VozDisponible[]> {
  const res = await fetch(`${API}/voices`, {
    headers: { "xi-api-key": apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // La lista cambia solo cuando alguien toca la cuenta. Cachearla un rato
    // evita una llamada por cada vez que se abre la pantalla.
    next: { revalidate: 600 },
  });

  if (!res.ok) throw await comoError(res);

  const body = (await res.json()) as {
    voices?: { voice_id: string; name?: string; preview_url?: string; category?: string }[];
  };

  return (body.voices ?? []).map((v) => ({
    id: v.voice_id,
    nombre: v.name ?? "sin nombre",
    preview: v.preview_url ?? null,
    categoria: v.category ?? null,
  }));
}

/**
 * Busca UNA voz por su id.
 *
 * Existe para poder usar una voz que no está en el desplegable: las de la Voice
 * Library, o una clonada que vive en otra cuenta y se comparte por id. Sirve
 * además de validación —si el id no existe, se entera acá y no después de
 * haber pagado una generación— y devuelve la muestra para escucharla antes.
 */
export async function buscarVoz(id: string): Promise<VozDisponible> {
  const res = await fetch(`${API}/voices/${encodeURIComponent(id)}`, {
    headers: { "xi-api-key": apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw await comoError(res);

  const v = (await res.json()) as {
    voice_id: string;
    name?: string;
    preview_url?: string;
    category?: string;
  };

  return {
    id: v.voice_id,
    nombre: v.name ?? "sin nombre",
    preview: v.preview_url ?? null,
    categoria: v.category ?? null,
  };
}

/** Genera el audio y devuelve el mp3 crudo. */
export async function generarVoz({
  text,
  voiceId,
  modelId,
}: {
  text: string;
  voiceId: string;
  modelId: string;
}): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    // 128 kbps es el default y el punto justo: a 44.1 kHz da ~1 MB por minuto,
    // que es material entregable sin inflar el Storage.
    body: JSON.stringify({ text, model_id: modelId, output_format: "mp3_44100_128" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw await comoError(res);

  const audio = await res.arrayBuffer();
  if (audio.byteLength === 0) {
    throw new VozError("ElevenLabs devolvió un audio vacío", { codigo: "audio_vacio" });
  }
  return audio;
}
