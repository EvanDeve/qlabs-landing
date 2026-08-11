import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { getStaffAgenda, contarAgenda } from "@/lib/ugc/agenda";
import { redactarNudge, getAjustesAgente } from "@/lib/ugc/agente";
import { sendWhatsAppTemplate, sendWhatsAppFreeform } from "@/lib/whatsapp/twilio";

/**
 * Arma y manda el recordatorio diario de un miembro del equipo.
 *
 * Lo comparten el cron (/api/qos/agente/cron) y el botón "Probar ahora" del
 * panel de Equipo, a propósito: si el botón usara otro camino, probaría otra
 * cosa y no serviría para depurar el envío real.
 */

const CODIGO_UNIQUE_VIOLATION = "23505";

export const PLANTILLA_RECORDATORIO = "recordatorio_diario";

export type MiembroNotificable = {
  profileId: string;
  nombre: string;
  telefono: string;
  reminderHour: number;
};

export type ResultadoRecordatorio =
  | { estado: "enviado"; sid: string }
  | { estado: "salteado"; motivo: "sin_pendientes" | "ya_enviado" }
  | { estado: "fallido"; error: string };

/** Miembros activos, con opt-in y con teléfono. El resto no se toca. */
export async function getMiembrosNotificables(
  admin: SupabaseClient<Database>
): Promise<MiembroNotificable[]> {
  const { data: miembros, error } = await admin
    .from("staff_members")
    .select("profile_id, phone_e164, reminder_hour")
    .eq("active", true)
    .eq("wa_opt_in", true)
    .not("phone_e164", "is", null);

  if (error) {
    console.error("[recordatorios] no se pudo listar el equipo:", error.message);
    return [];
  }
  if (!miembros?.length) return [];

  const { data: perfiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      miembros.map((m) => m.profile_id)
    );
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  return miembros.map((m) => ({
    profileId: m.profile_id,
    // El nombre va en el saludo de la plantilla. "Hola , tu agenda…" se ve
    // roto, así que hay un default en vez de una cadena vacía.
    nombre: nombrePorId.get(m.profile_id) ?? "equipo",
    telefono: m.phone_e164!,
    reminderHour: m.reminder_hour,
  }));
}

/** Milisegundos de la ventana de servicio de WhatsApp. */
export const VENTANA_MS = 24 * 60 * 60 * 1000;

/**
 * ¿Se le puede escribir texto libre a esta persona ahora mismo?
 *
 * WhatsApp abre una ventana de 24 h cada vez que el usuario le escribe al
 * negocio. Dentro de esa ventana el agente habla como una persona; fuera, solo
 * plantillas. El instante del último mensaje entrante sale de `wa_messages`,
 * que lo llena el webhook.
 *
 * Se resta un minuto de margen: entre que se decide el formato y Twilio entrega
 * el mensaje pasa tiempo, y quedar del lado equivocado del borde por segundos
 * significa un 63016 y un recordatorio que no llegó.
 */
export async function ventanaAbierta(
  admin: SupabaseClient<Database>,
  profileId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { data } = await admin
    .from("wa_messages")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  return now.getTime() - new Date(data.created_at).getTime() < VENTANA_MS - 60_000;
}

export async function enviarRecordatorioDiario(
  admin: SupabaseClient<Database>,
  miembro: MiembroNotificable,
  now: Date = new Date()
): Promise<ResultadoRecordatorio> {
  // Los ajustes se leen ANTES de armar la agenda: la ventana configurada decide
  // qué entra, así que pedirla después dejaría el recordatorio mirando siempre
  // los días de fábrica por más que el panel dijera otra cosa.
  const ajustes = await getAjustesAgente(admin);
  const agenda = await getStaffAgenda(admin, miembro.profileId, now, ajustes.ventana);

  // Un "no tenés nada" todos los días es exactamente cómo se le enseña a
  // alguien a dejar de leer los mensajes. Si no hay pendientes, no hay mensaje.
  if (contarAgenda(agenda) === 0) return { estado: "salteado", motivo: "sin_pendientes" };

  const dedupeKey = `daily:${formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd")}`;

  // ---- Ventana inteligente ----
  // Si la persona escribió hace menos de 24 h, WhatsApp deja mandar texto
  // libre: ahí el agente habla como una persona, sin el corsé de la plantilla,
  // y además no se cobra. Solo cuando la ventana está cerrada hay que golpear
  // la puerta con una plantilla aprobada — y aun así el contenido lo redacta
  // el LLM, no es un texto fijo.
  const abierta = await ventanaAbierta(admin, miembro.profileId, now);
  const contentSid = process.env.TWILIO_REMINDER_CONTENT_SID;
  const usaTextoLibre = abierta || !contentSid;

  // La personalidad sale de agent_settings, igual que en la conversación: el
  // recordatorio de la mañana y las respuestas del webhook tienen que sonar a
  // la misma persona.
  const mensaje = await redactarNudge(agenda, miembro.nombre, usaTextoLibre, now, ajustes);

  // La fila se inserta ANTES de llamar a Twilio: es el candado de exactly-once.
  // Si el cron se dispara dos veces (Vercel reintenta ante timeout o 5xx), el
  // segundo intento choca contra wa_messages_dedupe_idx y se va por acá en vez
  // de mandarle a la persona el mismo recordatorio dos veces.
  const { data: fila, error: insertError } = await admin
    .from("wa_messages")
    .insert({
      profile_id: miembro.profileId,
      direction: "out",
      body: mensaje,
      // Queda registrado por cuál de los dos caminos salió: si algún día un
      // envío falla con 63016, esta columna es la que lo explica.
      template_name: usaTextoLibre ? null : PLANTILLA_RECORDATORIO,
      status: "queued",
      dedupe_key: dedupeKey,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === CODIGO_UNIQUE_VIOLATION) return { estado: "salteado", motivo: "ya_enviado" };
    console.error("[recordatorios] no se pudo registrar el envío:", insertError.message);
    return { estado: "fallido", error: insertError.message };
  }

  if (usaTextoLibre && !abierta) {
    console.warn("[recordatorios] ventana cerrada y sin TWILIO_REMINDER_CONTENT_SID — Twilio va a rechazar el texto libre");
  }

  const envio = usaTextoLibre
    ? await sendWhatsAppFreeform(miembro.telefono, mensaje)
    : await sendWhatsAppTemplate(miembro.telefono, contentSid!, { "1": miembro.nombre, "2": mensaje });

  if (!envio.ok) {
    // El dedupe existe para que nadie reciba el mismo recordatorio dos veces,
    // NO para que un fallo se coma el recordatorio del día. Si Twilio rechazó
    // explícitamente, el mensaje no salió: se libera la clave y la corrida
    // siguiente del cron vuelve a intentar. Si en cambio se cortó la red, no
    // sabemos si salió y la clave se conserva — ahí preferimos que falte un
    // aviso antes que mandarlo repetido.
    await admin
      .from("wa_messages")
      .update({ status: "failed", error: envio.error, ...(envio.definitivo ? { dedupe_key: null } : {}) })
      .eq("id", fila.id);
    return { estado: "fallido", error: envio.error };
  }

  await admin.from("wa_messages").update({ status: "sent", provider_sid: envio.sid }).eq("id", fila.id);
  return { estado: "enviado", sid: envio.sid };
}
