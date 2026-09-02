/**
 * Capa de envío de WhatsApp, vía Twilio.
 *
 * Mismo patrón best-effort que src/lib/email/resend.ts: si falta la config o el
 * envío falla, se loguea y se devuelve el error, pero nunca se tira una
 * excepción hacia arriba. Un miembro del equipo que no recibe su recordatorio
 * es un problema; un cron que se cae a la mitad y deja sin avisar a los otros
 * ocho es un problema peor.
 *
 * Se usa `fetch` contra la API REST en vez del SDK de Twilio: es una llamada
 * HTTP con Basic auth y un body urlencoded, y el repo ya resuelve Resend así.
 */

const API_BASE = "https://api.twilio.com/2010-04-01";

/** Cuánto se espera a Twilio por mensaje. Ver el `signal` de enviar(). */
const TIMEOUT_MS = 10_000;

export type EnvioResult =
  | { ok: true; sid: string }
  /**
   * `definitivo` distingue "Twilio lo rechazó" de "no sabemos qué pasó".
   *
   * Importa para poder reintentar sin arriesgar un duplicado: si Twilio
   * contestó con un error, el mensaje NO salió y se puede volver a intentar
   * tranquilo. Si se cortó la red, puede haber salido igual y la respuesta
   * haberse perdido — ahí reintentar significa mandarlo dos veces.
   */
  | { ok: false; error: string; definitivo: boolean };

/** Lo que Twilio contesta cuando se le pregunta por un mensaje ya mandado. */
export type EstadoEnTwilio = {
  /** El estado crudo de Twilio: queued, sent, delivered, undelivered, failed… */
  status: string;
  errorCode: number | null;
  errorMessage: string | null;
};

type TwilioConfig = { accountSid: string; authToken: string; from: string };

function leerConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.warn("[twilio] falta configuración (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)");
    return null;
  }
  // El From va con el prefijo whatsapp:. Se tolera que esté o no en la env var
  // porque olvidarlo devuelve un 21910 de Twilio que no dice nada útil.
  return { accountSid, authToken, from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}` };
}

async function enviar(params: Record<string, string>, to: string): Promise<EnvioResult> {
  const config = leerConfig();
  if (!config) return { ok: false, error: "WhatsApp sin configurar", definitivo: true };

  const body = new URLSearchParams({
    From: config.from,
    To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    ...params,
  });

  try {
    const res = await fetch(`${API_BASE}/Accounts/${config.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      // Sin techo, una llamada colgada se lleva puesta la función entera: en el
      // cron eso es el recordatorio de TODOS los que venían después, porque se
      // mandan en serie. El corte cae en el catch de abajo, que es el camino de
      // "no sabemos si salió" — que es exactamente lo que pasó.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      const error = `${data.code ?? res.status}: ${data.message ?? "error desconocido"}`;
      console.error("[twilio] fallo al enviar:", error);
      // Twilio contestó rechazando: el mensaje no salió, reintentar es seguro.
      return { ok: false, error, definitivo: true };
    }

    return { ok: true, sid: data.sid ?? "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[twilio] error de red:", error);
    // No sabemos si llegó a salir. Se marca como no definitivo para que nadie
    // reintente y termine mandando el mismo recordatorio dos veces.
    return { ok: false, error, definitivo: false };
  }
}

/**
 * Lo que Twilio dice HOY de un mensaje que ya mandamos.
 *
 * Existe porque `sendWhatsAppFreeform` devuelve `ok: true` en cuanto Twilio
 * acepta el mensaje, y aceptar no es entregar. El 2026-09-02 la salida hacia
 * WhatsApp estuvo caída tres días: Twilio aceptaba todo, devolvía un SID, y los
 * mensajes se quedaban en `queued` para siempre sin un solo código de error.
 * Del lado nuestro se veía un éxito perfecto.
 *
 * Devuelve null si no se pudo preguntar (sin config, red caída, 404). Null es
 * "no sé", NO "falló": el llamador tiene que dejar la fila como estaba, porque
 * pisarla con un fracaso inventado es peor que no saber.
 */
export async function consultarEstado(sid: string): Promise<EstadoEnTwilio | null> {
  const config = leerConfig();
  if (!config) return null;

  try {
    const res = await fetch(
      `${API_BASE}/Accounts/${config.accountSid}/Messages/${encodeURIComponent(sid)}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      console.warn(`[twilio] no se pudo consultar ${sid}: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      error_code?: number | null;
      error_message?: string | null;
    };
    if (!data.status) return null;

    return {
      status: data.status,
      errorCode: data.error_code ?? null,
      errorMessage: data.error_message ?? null,
    };
  } catch (err) {
    console.warn("[twilio] error consultando estado:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Texto libre. Solo es válido DENTRO de la ventana de 24 h que abre el último
 * mensaje del usuario; fuera de ella Twilio lo rechaza con un 63016. Por eso lo
 * usa el webhook (donde la ventana acaba de abrirse por definición) y nunca el
 * cron.
 */
export async function sendWhatsAppFreeform(to: string, body: string): Promise<EnvioResult> {
  return enviar({ Body: body.slice(0, MAX_BODY) }, to);
}

/** Tope de un mensaje de WhatsApp. Cortar acá es mejor que que lo corte Meta. */
export const MAX_BODY = 1500;

/**
 * Normaliza a E.164 asumiendo Costa Rica cuando no viene código de país.
 *
 * Acepta lo que la gente escribe de verdad: '8888-7777', '8888 7777',
 * '+506 8888 7777', '50688887777'. Devuelve null si no se puede resolver, para
 * que el server action muestre el error en vez de guardar basura que después
 * falla recién a la hora de mandar.
 */
export function normalizarTelefonoCR(entrada: string): string | null {
  const digitos = entrada.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");

  // Ya viene con código de país explícito.
  if (digitos.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(digitos) ? digitos : null;

  // 506 + 8 dígitos, sin el +.
  if (digitos.length === 11 && digitos.startsWith("506")) return `+${digitos}`;

  // 8 dígitos sueltos: es un número tico. Móviles arrancan en 6, 7 u 8; los
  // fijos en 2. WhatsApp solo sirve en móviles, pero no se rechazan los 2xxx
  // acá — que falle Twilio con su mensaje, no nosotros adivinando.
  if (/^\d{8}$/.test(digitos)) return `+506${digitos}`;

  return null;
}
