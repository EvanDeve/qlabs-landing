/**
 * ¿Los mensajes de WhatsApp están llegando de verdad?
 *
 * El 2026-09-02 se descubrió que la salida hacia WhatsApp llevaba tres días
 * caída. Twilio aceptaba cada mensaje, devolvía un SID y lo dejaba en `queued`
 * para siempre, sin un solo código de error; nuestra base los anotaba como
 * `sent`. Nadie se enteró hasta que alguien pidió una revisión a mano, y el
 * motivo de fondo es que **nunca preguntamos qué pasó después de mandar**.
 *
 * Dos piezas, en este orden:
 *
 *   1. `reconciliarEnvios` le pregunta a Twilio el estado real de lo que
 *      mandamos y corrige la base. Sin esto, `wa_messages.status` es una
 *      promesa, no un hecho.
 *   2. `evaluarSalud` mira esos estados ya corregidos y decide si hay que
 *      gritar.
 *
 * ⚠️ Se pregunta por API en vez de recibir el `StatusCallback` de Twilio, y es
 * a propósito. El callback es en tiempo real, pero exige una URL pública
 * exactamente correcta — y ESA es la config que más veces se rompió en este
 * proyecto: el ápex `qlabsmethod.com` responde 308 y Twilio no sigue
 * redirecciones, así que un webhook apuntado al lugar casi correcto se come
 * todo en silencio. Ya pasó tres veces. Un vigía que depende de la pieza más
 * frágil no es un vigía. Preguntando desde el cron no hay URL, ni firma, ni
 * nada que se pueda configurar mal: si el cron corre, el chequeo corre.
 *
 * El precio es enterarse una vez por día en lugar de al instante. Con menos de
 * diez mensajes diarios y nadie mirando el panel en tiempo real, es barato.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WaMessageStatus } from "@/lib/database.types";
import { consultarEstado } from "@/lib/whatsapp/twilio";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";
import { WA_SALIDA_TRABADA } from "@/lib/ugc/admin-alerts";

type Admin = SupabaseClient<Database>;

/** Twilio lo tiene; la persona todavía no lo vio. */
export const EN_VUELO: WaMessageStatus[] = ["queued", "accepted", "sending", "sent"];

/** Llegó al teléfono. `read` implica `delivered`. */
export const ENTREGADOS: WaMessageStatus[] = ["delivered", "read"];

/** Ya no va a llegar. */
export const FALLIDOS: WaMessageStatus[] = ["undelivered", "failed", "canceled"];

export type ConteoDeEnvios = {
  entregados: number;
  enVuelo: number;
  fallidos: number;
};

export type Diagnostico =
  | { alerta: false }
  | { alerta: true; motivo: "salida_caida" | "cola_trabada"; texto: string };

/**
 * Cuántos intentos hacen falta para creerle a un cero.
 *
 * Con uno o dos mensajes, "no se entregó ninguno" es ruido: pueden ser dos
 * teléfonos apagados. Con tres ya es un patrón.
 */
export const MINIMO_PARA_ALARMAR = 3;

/** Cuántos pueden quedar en vuelo antes de que sea raro aunque algo se entregue. */
export const MAXIMO_EN_VUELO = 5;

/**
 * La decisión, sin base de datos ni red: conteos entran, veredicto sale.
 *
 * Está separada del resto justamente para poder fijar en un test los casos que
 * importan — sobre todo los dos que NO tienen que alarmar, que son los que
 * convierten un vigía en ruido que la gente aprende a ignorar.
 */
export function evaluarSalud(conteo: ConteoDeEnvios): Diagnostico {
  const intentos = conteo.entregados + conteo.enVuelo + conteo.fallidos;

  // Nadie mandó nada. No es salud ni enfermedad: es un día tranquilo.
  if (intentos === 0) return { alerta: false };

  if (conteo.entregados === 0 && intentos >= MINIMO_PARA_ALARMAR) {
    return {
      alerta: true,
      motivo: "salida_caida",
      texto:
        `De los últimos ${intentos} mensajes de WhatsApp no se entregó ninguno ` +
        `(${conteo.enVuelo} trabados en Twilio, ${conteo.fallidos} fallidos). ` +
        `Mientras esto siga así, McLovin y los avisos de cronograma no le están llegando a nadie.`,
    };
  }

  if (conteo.enVuelo >= MAXIMO_EN_VUELO) {
    return {
      alerta: true,
      motivo: "cola_trabada",
      texto:
        `Hay ${conteo.enVuelo} mensajes de WhatsApp que Twilio aceptó y no entregó ` +
        `(${conteo.entregados} sí llegaron). Puede ser una cola trancada.`,
    };
  }

  return { alerta: false };
}

/** Cuánto para atrás se mira para juzgar la salud. */
const VENTANA_HORAS = 24;

/**
 * Un mensaje recién mandado tiene todo el derecho a estar en `queued`.
 *
 * Sin este colchón, el chequeo corre justo después de los recordatorios del
 * cron y cuenta como "trabado" lo que todavía está saliendo — o sea que se
 * alarmaría solo, todos los días.
 */
const GRACIA_MINUTOS = 15;

/** Cuántos días para atrás se reconcilia. Más allá, Twilio ya no va a cambiar de opinión. */
const RECONCILIAR_DIAS = 3;

/** Techo por corrida: son consultas HTTP en serie dentro de un cron. */
const MAX_A_RECONCILIAR = 100;

const hace = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

/**
 * Le pregunta a Twilio por cada saliente que quedó sin estado final y corrige
 * la fila.
 *
 * Devuelve cuántas filas cambiaron. Un `null` de `consultarEstado` (no se pudo
 * preguntar) deja la fila intacta a propósito: no saber no es lo mismo que
 * fallar, y anotar un fracaso inventado sería exactamente el error que este
 * módulo existe para arreglar.
 */
export async function reconciliarEnvios(admin: Admin, now: Date): Promise<number> {
  const { data: pendientes, error } = await admin
    .from("wa_messages")
    .select("id, provider_sid, status")
    .eq("direction", "out")
    .not("provider_sid", "is", null)
    .in("status", EN_VUELO)
    .gte("created_at", hace(now, RECONCILIAR_DIAS * 24 * 60 * 60 * 1000))
    .order("created_at", { ascending: false })
    .limit(MAX_A_RECONCILIAR);

  if (error) {
    console.error("[wa-salud] no se pudieron leer los envíos pendientes:", error.message);
    return 0;
  }
  if (!pendientes?.length) return 0;

  let corregidos = 0;

  for (const fila of pendientes) {
    if (!fila.provider_sid) continue;

    const real = await consultarEstado(fila.provider_sid);
    if (!real || real.status === fila.status) continue;

    const { error: updateError } = await admin
      .from("wa_messages")
      .update({
        status: real.status as WaMessageStatus,
        // Se pisa siempre, incluso con null: si el mensaje se destrabó y llegó,
        // el error viejo dejó de ser cierto y dejarlo puesto confunde al que
        // después lea la fila buscando por qué no salió.
        error: real.errorCode ? `${real.errorCode}: ${real.errorMessage ?? "sin detalle"}` : null,
      })
      .eq("id", fila.id);

    if (updateError) {
      console.error("[wa-salud] no se pudo actualizar el envío:", updateError.message);
      continue;
    }
    corregidos++;
  }

  return corregidos;
}

/** Cómo quedaron repartidos los salientes de las últimas 24 h. */
export async function contarEnvios(admin: Admin, now: Date): Promise<ConteoDeEnvios> {
  const vacio: ConteoDeEnvios = { entregados: 0, enVuelo: 0, fallidos: 0 };

  const { data, error } = await admin
    .from("wa_messages")
    .select("status")
    .eq("direction", "out")
    .gte("created_at", hace(now, VENTANA_HORAS * 60 * 60 * 1000))
    .lte("created_at", hace(now, GRACIA_MINUTOS * 60 * 1000));

  if (error) {
    console.error("[wa-salud] no se pudieron contar los envíos:", error.message);
    return vacio;
  }

  return (data ?? []).reduce((acc, fila) => {
    if (ENTREGADOS.includes(fila.status)) acc.entregados++;
    else if (FALLIDOS.includes(fila.status)) acc.fallidos++;
    else if (EN_VUELO.includes(fila.status)) acc.enVuelo++;
    return acc;
  }, vacio);
}

/**
 * El aviso.
 *
 * Va por campanita a todos los admins y por email SOLO a los directores, que es
 * el mismo corte que el resto de Q·OS: la campanita es gratis, el email tiene
 * el cupo de Resend. Si no hay ningún director activo se le escribe a todos los
 * admins — un filtro que se puede vaciar tiene que fallar hacia el ruido, no
 * hacia el silencio.
 *
 * Lo que NO hace, y es el punto entero: mandar un WhatsApp. Cuando el canal que
 * se cayó es el que usarías para avisar, el aviso tiene que viajar por otro
 * lado.
 */
async function avisarDelCanalCaido(admin: Admin, texto: string, conteo: ConteoDeEnvios): Promise<void> {
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  if (!admins?.length) {
    console.warn("[wa-salud] no hay admins a quienes avisar");
    return;
  }

  const { error: notifyError } = await admin.from("notifications").insert(
    admins.map((a) => ({
      profile_id: a.id,
      type: WA_SALIDA_TRABADA,
      payload: { texto, ...conteo },
    }))
  );
  if (notifyError) console.error("[wa-salud] no se pudo crear la notificación:", notifyError.message);

  const { data: directores } = await admin
    .from("staff_members")
    .select("profile_id")
    .eq("active", true)
    .eq("staff_role", "director");

  const destinatarios = directores?.length ? directores.map((d) => d.profile_id) : admins.map((a) => a.id);

  await Promise.allSettled(
    destinatarios.map(async (profileId) => {
      const email = await getUserEmail(profileId);
      if (!email) return;
      await sendTransactionalEmail(
        email,
        "WhatsApp no está entregando — McLovin quedó mudo",
        `<p>${texto}</p>
         <p>Últimas 24 h: <strong>${conteo.entregados}</strong> entregados,
            <strong>${conteo.enVuelo}</strong> trabados en Twilio,
            <strong>${conteo.fallidos}</strong> fallidos.</p>
         <p>Esto se detecta preguntándole a Twilio el estado real de cada mensaje.
            Si los trabados están en <code>queued</code> sin código de error, el problema
            está entre Twilio y Meta, no en Q·OS.</p>`
      );
    })
  );
}

export type ResumenDeSalud = ConteoDeEnvios & {
  corregidos: number;
  alerta: string | null;
};

/**
 * Todo junto, para colgarlo del cron diario: reconciliar, contar, juzgar y —si
 * hace falta— avisar por un canal que no sea WhatsApp.
 *
 * Best-effort como el resto del cron: que este chequeo falle no puede tumbar
 * los recordatorios ni la limpieza que corren en la misma pasada.
 */
export async function revisarSaludDeWhatsApp(admin: Admin, now: Date): Promise<ResumenDeSalud> {
  try {
    const corregidos = await reconciliarEnvios(admin, now);
    const conteo = await contarEnvios(admin, now);
    const diagnostico = evaluarSalud(conteo);

    if (diagnostico.alerta) {
      console.error(`[wa-salud] ${diagnostico.motivo}: ${diagnostico.texto}`);
      await avisarDelCanalCaido(admin, diagnostico.texto, conteo);
    }

    return { ...conteo, corregidos, alerta: diagnostico.alerta ? diagnostico.motivo : null };
  } catch (err) {
    console.error("[wa-salud] el chequeo falló:", err instanceof Error ? err.message : err);
    return { entregados: 0, enVuelo: 0, fallidos: 0, corregidos: 0, alerta: null };
  }
}
