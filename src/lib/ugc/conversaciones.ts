import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Las conversaciones de WhatsApp de McLovin, listas para pintar.
 *
 * Vienen de dos tablas que a propósito no se unieron nunca: `wa_messages`
 * cuelga de un profile_id del equipo y `wa_public_messages` de un número suelto
 * de alguien de afuera. Acá se las trata como lo que son para quien mira —
 * hilos— sin mezclarlas en la base.
 *
 * Solo lectura. Responder desde el panel es otra cosa: WhatsApp únicamente
 * deja mandar texto libre dentro de las 24 h del último mensaje de la persona,
 * y esa regla merece su propia UI, no un campo que a veces anda.
 */

export type Procedencia = "equipo" | "externo";

export type MensajeChat = {
  id: string;
  direction: "in" | "out";
  body: string;
  /** ISO. La hora se formatea en la vista, en zona de Costa Rica. */
  createdAt: string;
  /** 'queued' | 'sent' | 'failed' | 'received'. Pinta los tildes. */
  status: string;
  error: string | null;
  /** Solo los del equipo: si salió por plantilla, salió del cron. */
  plantilla: string | null;
};

export type Conversacion = {
  /** `equipo:<profileId>` o `externo:<+506...>`. Único entre las dos fuentes. */
  id: string;
  procedencia: Procedencia;
  /** Nombre de la persona, o el número si es alguien de afuera. */
  titulo: string;
  /** El número, cuando se sabe. Los del equipo pueden no tenerlo cargado. */
  telefono: string | null;
  mensajes: MensajeChat[];
  /** Denormalizado para ordenar y para la lista, sin recorrer los mensajes. */
  ultimoMensaje: MensajeChat;
};

/**
 * Cuántos mensajes se leen por hilo.
 *
 * Un tope y no todo: un hilo del cron acumula un mensaje por día para siempre,
 * y traerlos completos para pintar una lista sería pagar por historia que
 * nadie va a scrollear. 200 son varios meses de conversación real.
 */
export const MAX_MENSAJES_POR_HILO = 200;

export async function getConversaciones(
  supabase: SupabaseClient<Database>
): Promise<Conversacion[]> {
  const [{ data: equipo }, { data: externos }] = await Promise.all([
    supabase
      .from("wa_messages")
      .select("id, profile_id, direction, body, status, error, template_name, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("wa_public_messages")
      .select("id, phone_e164, direction, body, status, error, created_at")
      .order("created_at", { ascending: true }),
  ]);

  // Los nombres del equipo en una sola consulta, no una por hilo.
  const profileIds = [...new Set((equipo ?? []).map((m) => m.profile_id))];
  const { data: perfiles } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  // El teléfono del equipo sale de staff_members, que también es director-only.
  // Si la consulta no devuelve nada —porque quien mira no es director— el hilo
  // se pinta igual, sin número: la RLS ya habría vaciado los mensajes antes.
  const { data: staff } = profileIds.length
    ? await supabase.from("staff_members").select("profile_id, phone_e164").in("profile_id", profileIds)
    : { data: [] };
  const telefonoPorId = new Map((staff ?? []).map((s) => [s.profile_id, s.phone_e164]));

  const hilos = new Map<string, Conversacion>();

  for (const m of equipo ?? []) {
    const id = `equipo:${m.profile_id}`;
    const mensaje: MensajeChat = {
      id: m.id,
      direction: m.direction as "in" | "out",
      body: m.body,
      createdAt: m.created_at,
      status: m.status,
      error: m.error,
      plantilla: m.template_name,
    };
    empujar(hilos, id, mensaje, () => ({
      id,
      procedencia: "equipo",
      titulo: nombrePorId.get(m.profile_id) ?? "Sin nombre",
      telefono: telefonoPorId.get(m.profile_id) ?? null,
      mensajes: [],
      ultimoMensaje: mensaje,
    }));
  }

  for (const m of externos ?? []) {
    const id = `externo:${m.phone_e164}`;
    const mensaje: MensajeChat = {
      id: m.id,
      direction: m.direction as "in" | "out",
      body: m.body,
      createdAt: m.created_at,
      status: m.status,
      error: m.error,
      plantilla: null,
    };
    empujar(hilos, id, mensaje, () => ({
      id,
      procedencia: "externo",
      // No hay nombre del otro lado: el número ES la identidad del hilo.
      titulo: m.phone_e164,
      telefono: m.phone_e164,
      mensajes: [],
      ultimoMensaje: mensaje,
    }));
  }

  return [...hilos.values()]
    .map((c) => ({
      ...c,
      // El tope se aplica del final: si un hilo se pasa, lo que se recorta es
      // lo más viejo, no lo último que dijeron.
      mensajes: c.mensajes.slice(-MAX_MENSAJES_POR_HILO),
    }))
    .sort((a, b) => b.ultimoMensaje.createdAt.localeCompare(a.ultimoMensaje.createdAt));
}

function empujar(
  hilos: Map<string, Conversacion>,
  id: string,
  mensaje: MensajeChat,
  crear: () => Conversacion
) {
  const hilo = hilos.get(id) ?? crear();
  hilo.mensajes.push(mensaje);
  // Los mensajes llegan en orden ascendente, así que el último que se empuja
  // siempre es el más nuevo del hilo.
  hilo.ultimoMensaje = mensaje;
  hilos.set(id, hilo);
}

/**
 * Agrupa los mensajes por día de Costa Rica, para los separadores.
 *
 * Se usa `diaCR` y no el día del navegador de quien mira: los separadores
 * tienen que decir el día en que pasó la conversación acá, no en la zona de
 * quien la está leyendo.
 */
export function porDia(mensajes: MensajeChat[], diaDe: (iso: string) => string) {
  const grupos: { dia: string; mensajes: MensajeChat[] }[] = [];
  for (const m of mensajes) {
    const dia = diaDe(m.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.mensajes.push(m);
    else grupos.push({ dia, mensajes: [m] });
  }
  return grupos;
}
