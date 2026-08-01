import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { firmaValida } from "@/lib/whatsapp/firma";
import { sendWhatsAppFreeform, normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { getStaffAgenda, itemsDeAgenda } from "@/lib/ugc/agenda";
import { responderMensaje, type AccionAgente, type TurnoPrevio } from "@/lib/ugc/agente";
import type { AgendaItem } from "@/lib/ugc/agenda";

// Lo que Twilio golpea cuando alguien del equipo le contesta al agente.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** La URL tiene que ser EXACTAMENTE la registrada en Twilio: entra en la firma. */
const WEBHOOK_URL = `${SITE_URL}/api/qos/agente/webhook`;

/** Palabras de baja. Se chequean antes que nada, sin pasar por el LLM. */
const BAJAS = ["salir", "stop", "baja", "parar", "cancelar"];

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[agente/webhook] falta TWILIO_AUTH_TOKEN — no se puede validar la firma");
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }

  const params = Object.fromEntries(new URLSearchParams(await request.text())) as Record<string, string>;

  // Antes de mirar el contenido. Sin firma válida esto es un desconocido
  // diciendo ser del equipo, y el webhook escribe en el tablero.
  if (!firmaValida({ url: WEBHOOK_URL, params, firma: request.headers.get("x-twilio-signature"), authToken })) {
    console.warn("[agente/webhook] firma inválida — descartado");
    return NextResponse.json({ error: "firma inválida" }, { status: 403 });
  }

  const telefono = normalizarTelefonoCR((params.From ?? "").replace("whatsapp:", ""));
  const texto = (params.Body ?? "").trim();
  if (!telefono || !texto) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  const { data: miembro } = await admin
    .from("staff_members")
    .select("profile_id, wa_opt_in")
    .eq("phone_e164", telefono)
    .maybeSingle();

  // Número que no es del equipo: 200 y silencio. Contestarle a un desconocido
  // es la vía rápida a que reporten el número y Meta lo bloquee.
  if (!miembro) {
    console.warn("[agente/webhook] mensaje de un número que no es del equipo");
    return NextResponse.json({ ok: true });
  }

  await admin.from("wa_messages").insert({
    profile_id: miembro.profile_id,
    direction: "in",
    body: texto,
    provider_sid: params.MessageSid ?? null,
    status: "received",
  });

  if (BAJAS.includes(texto.toLowerCase().replace(/[^a-záéíóúñ]/gi, ""))) {
    await admin.from("staff_members").update({ wa_opt_in: false }).eq("profile_id", miembro.profile_id);
    await responder(admin, miembro.profile_id, telefono, "Listo, no te escribo más. Si querés volver a activarlo, decile a alguien del equipo que te lo prenda en Q·OS.");
    return NextResponse.json({ ok: true });
  }

  const [{ data: perfil }, { data: columnas }, { data: previos }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", miembro.profile_id).maybeSingle(),
    admin.from("content_columns").select("id, name, is_done").order("position"),
    admin
      .from("wa_messages")
      .select("direction, body")
      .eq("profile_id", miembro.profile_id)
      .order("created_at", { ascending: false })
      .limit(11),
  ]);

  const agenda = await getStaffAgenda(admin, miembro.profile_id);
  const items = itemsDeAgenda(agenda);

  // El más nuevo es el que acabamos de guardar; va aparte como `mensaje`.
  const historial: TurnoPrevio[] = (previos ?? [])
    .slice(1)
    .reverse()
    .map((m) => ({ quien: m.direction === "in" ? "persona" : "agente", texto: m.body }));

  const { respuesta, accion } = await responderMensaje({
    nombre: perfil?.display_name ?? "colega",
    agenda,
    columnas: (columnas ?? []).map((c) => c.name),
    historial,
    mensaje: texto,
  });

  const aplicada = await aplicarAccion(admin, miembro.profile_id, accion, items, columnas ?? []);

  // Estamos dentro de la ventana de 24 h por definición —acaban de escribir—
  // así que acá el agente habla libre, sin plantilla.
  await responder(admin, miembro.profile_id, telefono, aplicada ? respuesta : quitarPromesa(respuesta, accion));

  return NextResponse.json({ ok: true });
}

async function responder(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  telefono: string,
  texto: string
) {
  const envio = await sendWhatsAppFreeform(telefono, texto);
  await admin.from("wa_messages").insert({
    profile_id: profileId,
    direction: "out",
    body: texto,
    provider_sid: envio.ok ? envio.sid : null,
    status: envio.ok ? "sent" : "failed",
    error: envio.ok ? null : envio.error,
  });
}

/**
 * Si el modelo dijo que iba a mover algo y la acción no se pudo aplicar, no se
 * le puede mandar la respuesta tal cual: quedaría afirmando un cambio que no
 * ocurrió, y esa es la peor falla posible acá — alguien confiando en que su
 * tablero se actualizó cuando no.
 */
function quitarPromesa(respuesta: string, accion: AccionAgente): string {
  if (accion.tipo === "ninguna") return respuesta;
  return `${respuesta}\n\n(Ojo: no pude tocar el tablero, hacelo vos desde Q·OS.)`;
}

type ColumnaBasica = { id: string; name: string; is_done: boolean };

/**
 * Ejecuta la acción, con el segundo candado.
 *
 * El primero es que el modelo solo puede nombrar NÚMEROS de la agenda que se le
 * mostró, así que no puede inventar un id. El segundo es este: antes de
 * escribir se verifica contra la base que el ítem siga siendo de esa persona.
 * El cliente es service-role y se saltea RLS, así que esta comprobación es lo
 * que ocupa el lugar de la policy.
 */
async function aplicarAccion(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  accion: AccionAgente,
  items: AgendaItem[],
  columnas: ColumnaBasica[]
): Promise<boolean> {
  if (accion.tipo === "ninguna") return true;

  const item = items[accion.item - 1];
  if (!item) return false;

  try {
    if (item.ref.kind === "piece") {
      const { data: pieza } = await admin
        .from("content_pieces")
        .select("id")
        .eq("id", item.ref.pieceId)
        .eq("owner_id", profileId)
        .maybeSingle();
      if (!pieza) return false;

      if (accion.tipo === "mover_pieza") {
        const columna = columnas.find((c) => c.name === accion.columna);
        if (!columna) return false;
        const { error } = await admin.from("content_pieces").update({ column_id: columna.id }).eq("id", pieza.id);
        return !error;
      }
      if (accion.tipo === "marcar_hecho") {
        // "Hecho" en el tablero de la agencia es la columna marcada is_done, no
        // un estado aparte. Si nadie la marcó, no hay a dónde mover.
        const terminada = columnas.find((c) => c.is_done);
        if (!terminada) return false;
        const { error } = await admin.from("content_pieces").update({ column_id: terminada.id }).eq("id", pieza.id);
        return !error;
      }
      // Reprogramar toca la fecha que originó el aviso, no las dos: el campo
      // viene del ítem, no de lo que el modelo haya querido elegir.
      const cuando = `${accion.fecha}T15:00:00Z`;
      const { error } = await admin
        .from("content_pieces")
        .update(item.ref.campo === "publish_date" ? { publish_date: cuando } : { record_date: cuando })
        .eq("id", pieza.id);
      return !error;
    }

    const { data: evento } = await admin
      .from("calendar_events")
      .select("id")
      .eq("id", item.ref.eventId)
      .eq("responsible_id", profileId)
      .maybeSingle();
    if (!evento) return false;

    if (accion.tipo === "marcar_hecho") {
      const { error } = await admin.from("calendar_events").update({ status: "hecho" }).eq("id", evento.id);
      return !error;
    }
    if (accion.tipo === "reprogramar") {
      const { error } = await admin
        .from("calendar_events")
        .update({ starts_at: `${accion.fecha}T15:00:00Z` })
        .eq("id", evento.id);
      return !error;
    }
    // mover_pieza sobre un evento no existe.
    return false;
  } catch (err) {
    console.error("[agente/webhook] no se pudo aplicar la acción:", err);
    return false;
  }
}
