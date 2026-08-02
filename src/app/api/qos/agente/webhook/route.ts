import { NextResponse, after } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { firmaValida } from "@/lib/whatsapp/firma";
import { sendWhatsAppFreeform, normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { getStaffAgenda, itemsDeAgenda } from "@/lib/ugc/agenda";
import {
  responderMensaje,
  getAjustesAgente,
  describirPropuesta,
  esValidaParaConfirmar,
  type AccionAgente,
  type PropuestaPieza,
  type TurnoPrevio,
} from "@/lib/ugc/agente";
import {
  responderPublico,
  hablaDemasiado,
  partirEnMensajes,
  demoraDeEscritura,
} from "@/lib/ugc/agente-publico";
import { CONTACTO_WA_NUEVO } from "@/lib/ugc/admin-alerts";
import { diaCR } from "@/lib/ugc/calendar";
import type { AgendaItem } from "@/lib/ugc/agenda";
import type { WaActionKind } from "@/lib/database.types";

// Lo que Twilio golpea cuando alguien del equipo le contesta al agente.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// El trabajo de after() —redactar, esperar y mandar hasta dos mensajes— corre
// después de responderle a Twilio, pero sigue contando contra la duración de la
// función. Con el tope por defecto de 10 s, una respuesta larga partida en dos
// se cortaría a la mitad y el segundo mensaje nunca saldría.
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const RUTA = "/api/qos/agente/webhook";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Las URLs contra las que se prueba la firma.
 *
 * Twilio calcula el HMAC sobre la URL EXACTA que tiene configurada, así que
 * cualquier diferencia —un `www` de más, una barra final, http vs https— hace
 * que todo se rechace con 403 y sin ninguna pista de por qué. Este dominio
 * tiene las dos formas (qlabsmethod.com redirige a www con 308), o sea que era
 * cuestión de tiempo.
 *
 * Por eso se prueban dos: la configurada en NEXT_PUBLIC_SITE_URL y la que se
 * deduce del request real. No afloja la seguridad — las dos siguen exigiendo un
 * HMAC válido hecho con el auth token, que es el secreto. Lo único que se
 * elimina es que una diferencia de configuración rompa el webhook en silencio.
 */
function urlsPosibles(request: Request): string[] {
  const configurada = `${SITE_URL.replace(/\/$/, "")}${RUTA}`;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const delRequest = host ? `${proto}://${host}${RUTA}` : null;

  return [...new Set([configurada, delRequest].filter((u): u is string => Boolean(u)))];
}

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
  const firma = request.headers.get("x-twilio-signature");
  if (!urlsPosibles(request).some((url) => firmaValida({ url, params, firma, authToken }))) {
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

  if (!miembro) {
    await atenderDesconocido(admin, telefono, texto, params.MessageSid ?? null);
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

  const [{ data: perfil }, { data: columnas }, { data: clientes }, { data: previos }, ajustes] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", miembro.profile_id).maybeSingle(),
    admin.from("content_columns").select("id, name, is_done").order("position"),
    admin.from("agency_clients").select("id, name").order("name"),
    admin
      .from("wa_messages")
      .select("direction, body")
      .eq("profile_id", miembro.profile_id)
      .order("created_at", { ascending: false })
      .limit(11),
    getAjustesAgente(admin),
  ]);

  const propuesta = await leerPropuestaViva(admin, miembro.profile_id);

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
    clientes: (clientes ?? []).map((c) => c.name),
    historial,
    mensaje: texto,
    propuesta: propuesta?.pieza ?? null,
    ajustes,
  });

  const aplicada = await aplicarAccion(admin, {
    profileId: miembro.profile_id,
    accion,
    items,
    columnas: columnas ?? [],
    clientes: clientes ?? [],
    propuesta,
  });

  // Estamos dentro de la ventana de 24 h por definición —acaban de escribir—
  // así que acá el agente habla libre, sin plantilla.
  await responder(admin, miembro.profile_id, telefono, redactarSalida(respuesta, accion, aplicada));

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------
// Gente de afuera del equipo
// ---------------------------------------------------------------

/** Cuántos turnos previos del hilo se le pasan al modelo. */
const HISTORIAL_PUBLICO = 10;

/**
 * Alguien que no está en `staff_members` escribió al número.
 *
 * El mensaje se guarda SIEMPRE, aunque el agente tenga prohibido contestar: hoy
 * esos mensajes se perdían del todo, y un mensaje al WhatsApp del negocio que no
 * queda en ningún lado es una venta que nadie supo que existió.
 *
 * Lo que está condicionado es la RESPUESTA. Y el agente no inicia nunca una
 * conversación de este lado: solo contesta dentro de la ventana que abrió la
 * persona al escribir, que es justo lo que WhatsApp permite sin plantilla.
 */
async function atenderDesconocido(
  admin: Admin,
  telefono: string,
  texto: string,
  messageSid: string | null
): Promise<void> {
  const { count: previos } = await admin
    .from("wa_public_messages")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", telefono);

  await admin.from("wa_public_messages").insert({
    phone_e164: telefono,
    direction: "in",
    body: texto,
    provider_sid: messageSid,
    status: "received",
  });

  // Solo en el primer mensaje del número. Avisar en cada uno convertiría la
  // campanita en ruido y es la forma conocida de que dejen de mirarla.
  //
  // Se compara contra 0 y no con `!previos` a propósito: si el count falla
  // devuelve null, y con `!previos` cada mensaje de un hilo viejo dispararía un
  // aviso nuevo. Perder un aviso ante un error puntual es más barato que
  // enseñarle al equipo a ignorar la campanita.
  if (previos === 0) await avisarDeContactoNuevo(admin, telefono, texto);

  const ajustes = await getAjustesAgente(admin);
  if (!ajustes.responderDesconocidos) {
    console.warn("[agente/webhook] mensaje de un desconocido — quedó registrado, sin responder");
    return;
  }

  const desdeHoy = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: mensajesHoy } = await admin
    .from("wa_public_messages")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", telefono)
    .eq("direction", "in")
    .gte("created_at", desdeHoy);

  if (hablaDemasiado(mensajesHoy ?? 0)) {
    console.warn("[agente/webhook] número de afuera pasado del tope diario — no se le contesta");
    return;
  }

  const { data: hilo } = await admin
    .from("wa_public_messages")
    .select("direction, body")
    .eq("phone_e164", telefono)
    .order("created_at", { ascending: false })
    .limit(HISTORIAL_PUBLICO + 1);

  // El más nuevo es el que se acaba de guardar; va aparte como `mensaje`.
  const historial: TurnoPrevio[] = (hilo ?? [])
    .slice(1)
    .reverse()
    .map((m) => ({ quien: m.direction === "in" ? "persona" : "agente", texto: m.body }));

  // De acá en adelante nada tiene que hacer esperar a Twilio: la respuesta al
  // webhook sale ya, y redactar y mandar ocurre después. Sin esto, la demora que
  // hace que el agente no conteste en tres segundos competiría con el timeout de
  // 15 s de Twilio, y un Gemini lento se traduciría en un 11200.
  after(async () => {
    const respuesta = await responderPublico({
      cerebro: {
        nombre: ajustes.nombre,
        sobreQlabs: ajustes.sobreQlabs,
        guionPublico: ajustes.guionPublico,
        linkAgenda: ajustes.linkAgenda,
      },
      historial,
      mensaje: texto,
    });

    // null = no hay nada cargado sobre Q Labs. Callarse es correcto: un agente
    // sin información contestando igual improvisa, y lo que improvise queda
    // dicho en nombre de la agencia.
    if (!respuesta) {
      console.warn("[agente/webhook] responder_desconocidos está prendido pero sobre_qlabs está vacío");
      return;
    }

    for (const parte of partirEnMensajes(respuesta)) {
      await esperar(demoraDeEscritura(parte));

      const envio = await sendWhatsAppFreeform(telefono, parte);
      await admin.from("wa_public_messages").insert({
        phone_e164: telefono,
        direction: "out",
        body: parte,
        provider_sid: envio.ok ? envio.sid : null,
        status: envio.ok ? "sent" : "failed",
        error: envio.ok ? null : envio.error,
      });

      // Si el primero no salió, el segundo llegaría suelto y sin contexto.
      if (!envio.ok) break;
    }
  });
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Le avisa al equipo que hay alguien nuevo escribiendo.
 *
 * Best-effort a propósito: que falle el aviso no puede impedir que la persona
 * reciba su respuesta. Se loguea y sigue.
 */
async function avisarDeContactoNuevo(admin: Admin, telefono: string, texto: string): Promise<void> {
  try {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    if (!admins?.length) return;

    const { error } = await admin.from("notifications").insert(
      admins.map((a) => ({
        profile_id: a.id,
        type: CONTACTO_WA_NUEVO,
        payload: { phone_e164: telefono, preview: texto.slice(0, 140) },
      }))
    );
    if (error) console.error("[agente/webhook] no se pudo avisar del contacto nuevo:", error.message);
  } catch (err) {
    console.error("[agente/webhook] error avisando del contacto nuevo:", err);
  }
}

async function responder(admin: Admin, profileId: string, telefono: string, texto: string) {
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

// ---------------------------------------------------------------
// La propuesta pendiente
// ---------------------------------------------------------------

type PropuestaViva = { id: string; pieza: PropuestaPieza };

/**
 * La propuesta que esta persona todavía puede confirmar con un "dale".
 *
 * Si la última venció, se marca `vencida` acá mismo en vez de dejarla colgando:
 * el índice único deja UNA sola fila en estado `propuesta` por persona, así que
 * una propuesta muerta sin cerrar bloquearía la siguiente.
 */
async function leerPropuestaViva(admin: Admin, profileId: string): Promise<PropuestaViva | null> {
  const { data } = await admin
    .from("wa_agent_actions")
    .select("id, payload, created_at")
    .eq("profile_id", profileId)
    .eq("status", "propuesta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  if (!esValidaParaConfirmar(data.created_at)) {
    await admin
      .from("wa_agent_actions")
      .update({ status: "vencida", resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    return null;
  }

  return { id: data.id, pieza: data.payload as unknown as PropuestaPieza };
}

// ---------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------

type Columna = { id: string; name: string; is_done: boolean };
type Cliente = { id: string; name: string };

type Contexto = {
  profileId: string;
  accion: AccionAgente;
  items: AgendaItem[];
  columnas: Columna[];
  clientes: Cliente[];
  propuesta: PropuestaViva | null;
};

/**
 * Ejecuta la acción, con el segundo candado.
 *
 * El primero es que el modelo solo puede nombrar NÚMEROS de la agenda que se le
 * mostró, así que no puede inventar un id. El segundo es este: antes de
 * escribir se verifica contra la base que el ítem siga siendo de esa persona.
 * El cliente es service-role y se saltea RLS, así que esta comprobación es lo
 * que ocupa el lugar de la policy.
 *
 * Todo lo que se ejecuta queda en `wa_agent_actions`. Hasta ahora el agente
 * movía piezas sin dejar rastro de que hubiera sido él: la conversación estaba
 * en wa_messages, pero el efecto sobre el tablero no estaba en ningún lado.
 */
async function aplicarAccion(admin: Admin, ctx: Contexto): Promise<boolean> {
  const { accion } = ctx;
  if (accion.tipo === "ninguna") return true;

  try {
    if (accion.tipo === "proponer_pieza") return await abrirPropuesta(admin, ctx, accion.pieza);
    if (accion.tipo === "descartar") return await cerrarPropuesta(admin, ctx, "descartada");
    if (accion.tipo === "confirmar") return await crearPiezaConfirmada(admin, ctx);
    return await editarItem(admin, ctx, accion);
  } catch (err) {
    console.error("[agente/webhook] no se pudo aplicar la acción:", err);
    await registrar(admin, ctx.profileId, kindDe(accion), { accion }, "fallida", {
      error: err instanceof Error ? err.message : "error desconocido",
    });
    return false;
  }
}

function kindDe(accion: AccionAgente): WaActionKind {
  if (accion.tipo === "mover_pieza" || accion.tipo === "marcar_hecho" || accion.tipo === "reprogramar") {
    return accion.tipo;
  }
  return "crear_pieza";
}

async function registrar(
  admin: Admin,
  profileId: string,
  kind: WaActionKind,
  payload: Record<string, unknown>,
  status: "propuesta" | "ejecutada" | "descartada" | "fallida",
  extra: { targetTable?: string; targetId?: string; error?: string } = {}
): Promise<string | null> {
  const { data, error } = await admin
    .from("wa_agent_actions")
    .insert({
      profile_id: profileId,
      kind,
      payload,
      status,
      target_table: extra.targetTable ?? null,
      target_id: extra.targetId ?? null,
      error: extra.error ?? null,
      // Una propuesta queda abierta esperando respuesta; el resto nace resuelto.
      resolved_at: status === "propuesta" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[agente/webhook] no se pudo registrar la acción:", error.message);
    return null;
  }
  return data.id;
}

/**
 * Guarda lo que se va a crear, sin crear nada todavía.
 *
 * La propuesta anterior se vence antes de abrir la nueva porque el índice
 * `wa_agent_actions_una_propuesta_idx` no admite dos abiertas — que es
 * justamente lo que hace que "dale" no sea ambiguo.
 */
async function abrirPropuesta(admin: Admin, ctx: Contexto, pieza: PropuestaPieza): Promise<boolean> {
  if (ctx.propuesta) await cerrarPropuesta(admin, ctx, "reemplazada");
  const id = await registrar(admin, ctx.profileId, "crear_pieza", pieza as unknown as Record<string, unknown>, "propuesta");
  return id !== null;
}

async function cerrarPropuesta(admin: Admin, ctx: Contexto, status: "descartada" | "reemplazada"): Promise<boolean> {
  if (!ctx.propuesta) return false;
  const { error } = await admin
    .from("wa_agent_actions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", ctx.propuesta.id);
  return !error;
}

/**
 * Crea la pieza a partir de lo GUARDADO, nunca de lo que el modelo reescriba.
 *
 * Es el punto entero del diseño de dos turnos. Si acá se usaran los datos que el
 * modelo devuelve junto con el "confirmar", la persona estaría confirmando un
 * texto y el sistema guardando otro, sin que nada fallara de forma visible.
 */
async function crearPiezaConfirmada(admin: Admin, ctx: Contexto): Promise<boolean> {
  const propuesta = ctx.propuesta;
  if (!propuesta) return false;

  const cliente = ctx.clientes.find((c) => c.name === propuesta.pieza.cliente);
  if (!cliente) return false;

  // Una grabación no es una pieza del tablero: es un hito que ocurre un día.
  // Se planea una vez al mes para todos los videos a la vez, así que no tiene
  // sentido como tarjeta —cruzaría el pipeline entero sin producirse ella
  // misma— y por eso los videos ya no llevan fecha de grabación. Va al
  // calendario, que es donde viven los hitos.
  //
  // Sigue apareciendo en la agenda de quien la anotó: getStaffAgenda lee
  // calendar_events por responsible_id + status 'programado' igual que lee las
  // piezas por owner_id.
  if (propuesta.pieza.tipo === "grabar") {
    return await crearGrabacionConfirmada(admin, ctx, propuesta.id, cliente.id, propuesta.pieza);
  }

  // La primera columna del tablero es donde entra lo que recién se anota: el
  // orden lo define el equipo y `position` ya viene ordenada de la consulta.
  const primera = ctx.columnas[0];
  if (!primera) return false;

  const { data: pieza, error } = await admin
    .from("content_pieces")
    .insert({
      brand_id: cliente.id,
      title: propuesta.pieza.titulo,
      column_id: primera.id,
      // Queda a nombre de quien la pidió: la pieza tiene que aparecer en SU
      // agenda, que es la razón por la que la anotó desde el chat.
      owner_id: ctx.profileId,
      created_by_agent: true,
      publish_date: propuesta.pieza.fecha,
    })
    .select("id")
    .single();

  if (error || !pieza) return await marcarPropuestaFallida(admin, propuesta.id, error?.message);

  await admin
    .from("wa_agent_actions")
    .update({
      status: "ejecutada",
      target_table: "content_pieces",
      target_id: pieza.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", propuesta.id);

  return true;
}

/**
 * La hora que se le pone a una grabación anotada por WhatsApp.
 *
 * `calendar_events.starts_at` es un instante, no un día: por eso esa columna no
 * se convirtió a `date` en 20260801000000, a diferencia de las fechas de las
 * piezas. Pero por chat nadie dicta la hora —se dice "el jueves"—, así que hay
 * que elegir una. Son las 9am de Costa Rica, el mismo valor de arranque que usó
 * la migración que movió las grabaciones de agosto al calendario, y se edita
 * desde el calendario como cualquier otro evento.
 */
const HORA_GRABACION_CR = "09:00:00";

async function crearGrabacionConfirmada(
  admin: Admin,
  ctx: Contexto,
  propuestaId: string,
  brandId: string,
  pieza: PropuestaPieza
): Promise<boolean> {
  // fromZonedTime interpreta el día+hora EN Costa Rica y devuelve el instante.
  // Un `new Date("2026-08-05T09:00:00")` lo leería en la zona del servidor, que
  // en Vercel es UTC, y la grabación quedaría a las 3am hora de acá.
  const startsAt = fromZonedTime(`${pieza.fecha} ${HORA_GRABACION_CR}`, COSTA_RICA_TZ).toISOString();

  const { data: evento, error } = await admin
    .from("calendar_events")
    .insert({
      type: "grabacion",
      brand_id: brandId,
      title: pieza.titulo,
      starts_at: startsAt,
      // Mismo criterio que owner_id en una pieza: queda a nombre de quien la
      // pidió, para que le aparezca en su propia agenda.
      responsible_id: ctx.profileId,
      status: "programado",
      // Sin pieza asociada a propósito: la FK es `on delete cascade`, así que
      // apuntar a una pieza haría que borrarla se llevara puesta la jornada de
      // grabación, que no depende de ningún video en particular.
      content_piece_id: null,
    })
    .select("id")
    .single();

  if (error || !evento) return await marcarPropuestaFallida(admin, propuestaId, error?.message);

  await admin
    .from("wa_agent_actions")
    .update({
      status: "ejecutada",
      target_table: "calendar_events",
      target_id: evento.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", propuestaId);

  return true;
}

async function marcarPropuestaFallida(admin: Admin, propuestaId: string, mensaje?: string): Promise<boolean> {
  await admin
    .from("wa_agent_actions")
    .update({
      status: "fallida",
      error: mensaje ?? "no se pudo crear",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", propuestaId);
  return false;
}

/** Las tres acciones que caen sobre algo que ya existía en la agenda. */
async function editarItem(
  admin: Admin,
  ctx: Contexto,
  accion: Extract<AccionAgente, { item: number }>
): Promise<boolean> {
  const item = ctx.items[accion.item - 1];
  if (!item) return false;

  const ok = await escribirEdicion(admin, ctx, accion, item);
  await registrar(
    admin,
    ctx.profileId,
    kindDe(accion),
    { accion, titulo: item.titulo },
    ok ? "ejecutada" : "fallida",
    ok
      ? {
          targetTable: item.ref.kind === "piece" ? "content_pieces" : "calendar_events",
          targetId: item.ref.kind === "piece" ? item.ref.pieceId : item.ref.eventId,
        }
      : {}
  );
  return ok;
}

async function escribirEdicion(
  admin: Admin,
  ctx: Contexto,
  accion: Extract<AccionAgente, { item: number }>,
  item: AgendaItem
): Promise<boolean> {
  if (item.ref.kind === "piece") {
    const { data: pieza } = await admin
      .from("content_pieces")
      .select("id")
      .eq("id", item.ref.pieceId)
      .eq("owner_id", ctx.profileId)
      .maybeSingle();
    if (!pieza) return false;

    if (accion.tipo === "mover_pieza") {
      const columna = ctx.columnas.find((c) => c.name === accion.columna);
      if (!columna) return false;
      const { error } = await admin.from("content_pieces").update({ column_id: columna.id }).eq("id", pieza.id);
      return !error;
    }
    if (accion.tipo === "marcar_hecho") {
      // "Hecho" en el tablero de la agencia es la columna marcada is_done, no
      // un estado aparte. Si nadie la marcó, no hay a dónde mover.
      const terminada = ctx.columnas.find((c) => c.is_done);
      if (!terminada) return false;
      const { error } = await admin.from("content_pieces").update({ column_id: terminada.id }).eq("id", pieza.id);
      return !error;
    }
    // Reprogramar toca la fecha que originó el aviso, no las dos: el campo
    // viene del ítem, no de lo que el modelo haya querido elegir.
    // Va el día pelado: las columnas son `date`, sin hora que inventar.
    const { error } = await admin
      .from("content_pieces")
      .update(item.ref.campo === "publish_date" ? { publish_date: accion.fecha } : { record_date: accion.fecha })
      .eq("id", pieza.id);
    return !error;
  }

  const { data: evento } = await admin
    .from("calendar_events")
    .select("id")
    .eq("id", item.ref.eventId)
    .eq("responsible_id", ctx.profileId)
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
}

// ---------------------------------------------------------------
// El texto que sale
// ---------------------------------------------------------------

/**
 * Ajusta lo que escribió el modelo a lo que de verdad pasó.
 *
 * Dos trabajos. Cuando se propone una pieza, le pega abajo la línea con los
 * datos exactos que quedaron guardados —el modelo tiene prohibido repetirlos en
 * su prosa justamente para que la única versión que la persona lee sea esta—.
 *
 * Y cuando la acción no se pudo aplicar, avisa. Si el modelo dijo que movió algo
 * y no se movió, mandar su texto tal cual sería la peor falla posible acá:
 * alguien confiando en que su tablero se actualizó cuando no.
 */
function redactarSalida(respuesta: string, accion: AccionAgente, aplicada: boolean): string {
  if (accion.tipo === "proponer_pieza") {
    return aplicada
      ? `${respuesta}\n\n${describirPropuesta(accion.pieza, diaCR(new Date()))}`
      : `${respuesta}\n\n(No me quedó anotado, mejor cargalo desde Q·OS.)`;
  }
  if (aplicada) return respuesta;
  if (accion.tipo === "confirmar") return `${respuesta}\n\n(Ojo: no pude crearla, cargala vos desde Q·OS.)`;
  if (accion.tipo === "descartar") return respuesta;
  if (accion.tipo === "ninguna") return respuesta;
  return `${respuesta}\n\n(Ojo: no pude tocar el tablero, hacelo vos desde Q·OS.)`;
}
