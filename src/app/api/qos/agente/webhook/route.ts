import { NextResponse, after } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { firmaValida } from "@/lib/whatsapp/firma";
import { sendWhatsAppFreeform, normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { getStaffAgenda, itemsDeAgenda, type AgendaRef } from "@/lib/ugc/agenda";
import {
  responderMensaje,
  getAjustesAgente,
  describirPropuesta,
  describirLoHecho,
  describirCierreHecho,
  normalizarTitulo,
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
import { getReporte, describirReporte } from "@/lib/ugc/reporte";
import { diaCR } from "@/lib/ugc/calendar";
import type { AgendaItem } from "@/lib/ugc/agenda";
import {
  columnaDestino,
  columnaFinalDe,
  columnaDeEntrada,
  type ColumnaDelTablero,
} from "@/lib/ugc/tablero";
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
  const messageSid = params.MessageSid ?? null;

  /**
   * De acá en adelante nada hace esperar a Twilio.
   *
   * Twilio corta el webhook a los 15 segundos y no le importa qué contestemos:
   * lo único que mira es que contestemos rápido. Antes, leer la agenda,
   * consultarle a Gemini, escribir en el tablero y mandar la respuesta pasaban
   * TODO antes de contestarle — así que un Gemini lento se traducía en un
   * `11200` del lado de Twilio y en un mensaje que nunca llegaba del lado de la
   * persona, sin ningún error visible en la app.
   *
   * La rama de los desconocidos ya trabajaba así desde el principio; ahora es
   * una sola puerta para las dos, y por eso `atenderDesconocido` ya no abre su
   * propio after(): estaría anidando uno dentro de otro.
   */
  after(async () => {
    try {
      await atenderEntrante(admin, telefono, texto, messageSid);
    } catch (err) {
      console.error("[agente/webhook] no se pudo atender el mensaje:", err);
    }
  });

  return NextResponse.json({ ok: true });
}

/**
 * Quién escribió y qué se hace con eso. Corre siempre después de haberle
 * contestado a Twilio.
 */
async function atenderEntrante(
  admin: Admin,
  telefono: string,
  texto: string,
  messageSid: string | null
): Promise<void> {
  const { data: miembro } = await admin
    .from("staff_members")
    .select("profile_id, wa_opt_in, staff_role")
    .eq("phone_e164", telefono)
    .maybeSingle();

  if (!miembro) return await atenderDesconocido(admin, telefono, texto, messageSid);

  await admin.from("wa_messages").insert({
    profile_id: miembro.profile_id,
    direction: "in",
    body: texto,
    provider_sid: messageSid,
    status: "received",
  });

  if (BAJAS.includes(texto.toLowerCase().replace(/[^a-záéíóúñ]/gi, ""))) {
    await admin.from("staff_members").update({ wa_opt_in: false }).eq("profile_id", miembro.profile_id);
    await responder(admin, miembro.profile_id, telefono, "Listo, no te escribo más. Si querés volver a activarlo, decile a alguien del equipo que te lo prenda en Q·OS.");
    return;
  }

  const [{ data: perfil }, { data: columnas }, { data: clientes }, { data: previos }, ajustes] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", miembro.profile_id).maybeSingle(),
    // `section` es lo que separa los tres carriles del tablero. Sin él, mover
    // una tarjeta a "Terminado" es ambiguo —hay dos columnas con ese nombre— y
    // dar algo por hecho puede mandarlo al carril equivocado.
    admin.from("content_columns").select("id, name, is_done, section").order("position"),
    // Sin los archivados: esta lista es la de Heroes que McLovin puede nombrar
    // al crear una pieza, y no se le carga trabajo nuevo a un cliente que se
    // fue. Si alguien igual dicta ese nombre, el agente no lo va a encontrar y
    // va a preguntar — que es la salida correcta.
    admin.from("agency_clients").select("id, name").eq("archived", false).order("name"),
    admin
      .from("wa_messages")
      .select("direction, body")
      .eq("profile_id", miembro.profile_id)
      .order("created_at", { ascending: false })
      .limit(11),
    getAjustesAgente(admin),
  ]);

  // Los tres en paralelo: no dependen uno del otro y encadenarlos eran tres
  // viajes a Postgres en fila antes de poder siquiera empezar a redactar. Para
  // un director, el reporte solo es el más lento de los tres, no la suma.
  //
  // El estado de la agencia se arma únicamente si es director. El corte es
  // `staff_members.staff_role` y no `profiles.role`, que es el mismo que usa el
  // resto de Q·OS.
  const [propuesta, agenda, reporte] = await Promise.all([
    leerPropuestaViva(admin, miembro.profile_id),
    getStaffAgenda(admin, miembro.profile_id, new Date(), ajustes.ventana),
    miembro.staff_role === "director" ? armarReporteDirector(admin) : Promise.resolve(null),
  ]);

  const items = itemsDeAgenda(agenda);

  // El más nuevo es el que acabamos de guardar; va aparte como `mensaje`.
  const historial: TurnoPrevio[] = (previos ?? [])
    .slice(1)
    .reverse()
    .map((m) => ({ quien: m.direction === "in" ? "persona" : "agente", texto: m.body }));

  const { respuesta, accion } = await responderMensaje({
    nombre: perfil?.display_name ?? "colega",
    agenda,
    columnas: columnas ?? [],
    clientes: (clientes ?? []).map((c) => c.name),
    historial,
    mensaje: texto,
    pendiente: !propuesta
      ? null
      : propuesta.tipo === "cerrar"
        ? { tipo: "cerrar", titulo: propuesta.titulo }
        : { tipo: "crear", pieza: propuesta.pieza },
    reporte,
    ajustes,
  });

  const resultado = await aplicarAccion(admin, {
    profileId: miembro.profile_id,
    accion,
    items,
    columnas: columnas ?? [],
    clientes: clientes ?? [],
    propuesta,
  });

  // Estamos dentro de la ventana de 24 h por definición —acaban de escribir—
  // así que acá el agente habla libre, sin plantilla.
  await responder(admin, miembro.profile_id, telefono, redactarSalida(respuesta, accion, resultado, items, propuesta));
}

/**
 * El estado de la agencia para un director.
 *
 * El equipo se lee de `staff_members` y no de la vista `staff_directory`, que es
 * lo que usa el Dashboard: la vista filtra por `current_app_role() = 'admin'` y
 * acá el cliente es service-role, sin sesión, así que devolvería CERO filas y el
 * reporte saldría sin nadie del equipo — sin fallar, que es lo peor.
 *
 * Si algo se cae, se devuelve null: que el reporte no salga es molesto; que se
 * caiga el webhook deja al agente mudo para todo el mundo.
 */
async function armarReporteDirector(admin: Admin): Promise<string | null> {
  try {
    const { data: equipo } = await admin
      .from("staff_members")
      .select("profile_id, staff_role")
      .eq("active", true);
    if (!equipo?.length) return null;

    const { data: perfiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", equipo.map((m) => m.profile_id));
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

    const reporte = await getReporte(
      admin,
      equipo.map((m) => ({
        profileId: m.profile_id,
        nombre: nombrePorId.get(m.profile_id) ?? "Sin nombre",
        rol: m.staff_role,
      }))
    );
    return describirReporte(reporte);
  } catch (err) {
    console.error("[agente/webhook] no se pudo armar el reporte:", err);
    return null;
  }
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

  // Redactar y mandar ya no compiten con el timeout de Twilio: esta función
  // entera corre dentro del after() del POST, así que la petición ya se
  // contestó. Antes el after() se abría acá; anidarlo dentro del de arriba
  // sería pedirle a Next que difiera algo que ya está diferido.
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

/**
 * La fila de wa_agent_actions que quedó esperando un "dale".
 *
 * Guarda el `ref` de la pieza a cerrar y no el número del ítem: cuando la
 * persona conteste, la agenda ya puede haberse re-armado y el 3 de hace un
 * minuto puede ser otra tarjeta. Es el mismo motivo por el que crear usa lo
 * guardado y no lo que el modelo repita.
 */
type PropuestaViva =
  | { id: string; tipo: "crear"; pieza: PropuestaPieza }
  | { id: string; tipo: "cerrar"; ref: AgendaRef; titulo: string };

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
    .select("id, kind, payload, created_at")
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

  if (data.kind === "marcar_hecho") {
    const payload = data.payload as unknown as { ref: AgendaRef; titulo: string };
    return { id: data.id, tipo: "cerrar", ref: payload.ref, titulo: payload.titulo };
  }
  return { id: data.id, tipo: "crear", pieza: data.payload as unknown as PropuestaPieza };
}

// ---------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------

type Columna = ColumnaDelTablero;
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
 * Lo que de verdad pasó al aplicar la acción.
 *
 * `nota` existe para los casos que no son ni éxito ni falla técnica: hoy, que la
 * pieza ya estuviera en el tablero. Sin esto, ese caso caía en el aviso genérico
 * de "no pude tocar el tablero", que manda a la persona a Q·OS a hacer a mano
 * algo que en realidad ya estaba hecho.
 */
type ResultadoAccion = { aplicada: boolean; nota?: string };

/**
 * Lo que devolvió una escritura sobre el tablero o el calendario.
 *
 * Antes era un booleano. Dejó de alcanzar cuando una escritura puede fallar por
 * un motivo que la persona puede corregir —pedir una columna de otro carril— y
 * no solo por un error de Postgres: "no pude tocar el tablero" no le dice a
 * nadie qué hacer distinto la próxima vez.
 */
type ResultadoEdicion = { ok: boolean; nota?: string };

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
async function aplicarAccion(admin: Admin, ctx: Contexto): Promise<ResultadoAccion> {
  const { accion } = ctx;
  if (accion.tipo === "ninguna") return { aplicada: true };

  try {
    if (accion.tipo === "proponer_pieza") return await abrirPropuesta(admin, ctx, accion.pieza);
    if (accion.tipo === "descartar") return { aplicada: await cerrarPropuesta(admin, ctx, "descartada") };
    if (accion.tipo === "confirmar") return await ejecutarConfirmado(admin, ctx);
    // Cerrar es la única de las tres que saca la tarjeta de la vista, así que
    // pregunta antes en vez de escribir. Ver el comentario de `Pendiente`.
    if (accion.tipo === "marcar_hecho") return await abrirCierre(admin, ctx, accion.item);
    return await editarItem(admin, ctx, accion);
  } catch (err) {
    console.error("[agente/webhook] no se pudo aplicar la acción:", err);
    await registrar(admin, ctx.profileId, kindDe(accion), { accion }, "fallida", {
      error: err instanceof Error ? err.message : "error desconocido",
    });
    return { aplicada: false };
  }
}

function kindDe(accion: AccionAgente): WaActionKind {
  if (accion.tipo === "mover_pieza" || accion.tipo === "marcar_hecho" || accion.tipo === "reprogramar") {
    return accion.tipo;
  }
  // Una propuesta sabe su destino por `tipo`; el resto de los casos que caen
  // acá (confirmar, descartar, ninguna) se registran solo cuando fallan y no
  // tienen destino propio, así que quedan como 'crear_pieza'.
  if (accion.tipo === "proponer_pieza" && accion.pieza.tipo === "grabar") return "crear_evento";
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
 * Busca una pieza que ya diga lo mismo, en TODO el tablero de ese Hero.
 *
 * Tiene que mirar el tablero entero y no la agenda: el 2026-08-03 se duplicó una
 * tarjeta justamente porque el agente había cerrado la buena treinta segundos
 * antes, y al quedar cerrada salió de la agenda. Lo que él no ve es exactamente
 * lo que hay que ir a buscar.
 *
 * Compara el título normalizado y exacto, no parecido. Un "contiene" tomaría
 * "Reel de brunch 2" como duplicado de "Reel de brunch" y bloquearía una pieza
 * legítima — y un falso positivo acá es peor que un duplicado: el duplicado se
 * borra, la pieza que nunca se creó no se entera nadie.
 */
async function piezaYaExistente(
  admin: Admin,
  brandId: string,
  titulo: string
): Promise<string | null> {
  const { data } = await admin
    .from("content_pieces")
    .select("title")
    .eq("brand_id", brandId)
    .limit(200);

  const buscado = normalizarTitulo(titulo);
  return (data ?? []).find((p) => normalizarTitulo(p.title) === buscado)?.title ?? null;
}

/**
 * Guarda lo que se va a crear, sin crear nada todavía.
 *
 * La propuesta anterior se vence antes de abrir la nueva porque el índice
 * `wa_agent_actions_una_propuesta_idx` no admite dos abiertas — que es
 * justamente lo que hace que "dale" no sea ambiguo.
 */
async function abrirPropuesta(admin: Admin, ctx: Contexto, pieza: PropuestaPieza): Promise<ResultadoAccion> {
  // Antes de proponer nada: si ya está en el tablero, no se abre la propuesta.
  // Avisar acá y no al confirmar es lo que corresponde — la persona se entera
  // antes de decir "dale", no después de tener dos tarjetas.
  if (pieza.tipo === "publicar") {
    const cliente = ctx.clientes.find((c) => c.name === pieza.cliente);
    const repetida = cliente ? await piezaYaExistente(admin, cliente.id, pieza.titulo) : null;
    if (repetida) {
      return {
        aplicada: false,
        nota: `Ojo: "${repetida}" ya está en el tablero de ${pieza.cliente}, así que no la anoté de nuevo. Si igual querés otra, cargala desde Q·OS.`,
      };
    }
  }

  if (ctx.propuesta) await cerrarPropuesta(admin, ctx, "reemplazada");
  // El kind se decide acá, en la propuesta, y no al ejecutarla: el destino ya
  // está definido por `tipo` y así la bitácora dice desde el primer registro
  // qué se iba a crear, aunque la persona nunca conteste.
  const id = await registrar(
    admin,
    ctx.profileId,
    pieza.tipo === "grabar" ? "crear_evento" : "crear_pieza",
    pieza as unknown as Record<string, unknown>,
    "propuesta"
  );
  return { aplicada: id !== null };
}

/**
 * Deja anotado qué se va a cerrar, sin cerrar nada todavía.
 *
 * Guarda el `ref` y el título, no el número del ítem: para cuando llegue el
 * "dale", la agenda se re-arma y ese número puede apuntar a otra tarjeta.
 */
async function abrirCierre(admin: Admin, ctx: Contexto, indice: number): Promise<ResultadoAccion> {
  const item = ctx.items[indice - 1];
  if (!item) return { aplicada: false };

  if (ctx.propuesta) await cerrarPropuesta(admin, ctx, "reemplazada");

  const id = await registrar(
    admin,
    ctx.profileId,
    "marcar_hecho",
    { ref: item.ref, titulo: item.titulo },
    "propuesta"
  );
  return { aplicada: id !== null };
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
function mismoRef(a: AgendaRef, b: AgendaRef): boolean {
  if (a.kind === "piece" && b.kind === "piece") return a.pieceId === b.pieceId;
  if (a.kind === "event" && b.kind === "event") return a.eventId === b.eventId;
  return false;
}

/** Un "dale" cierra lo que haya quedado esperando: una pieza nueva o un cierre. */
async function ejecutarConfirmado(admin: Admin, ctx: Contexto): Promise<ResultadoAccion> {
  if (!ctx.propuesta) return { aplicada: false };
  return ctx.propuesta.tipo === "cerrar"
    ? await cerrarItemConfirmado(admin, ctx, ctx.propuesta)
    : { aplicada: await crearPiezaConfirmada(admin, ctx) };
}

/**
 * Cierra la pieza guardada, revalidando que siga siendo de esa persona.
 *
 * La revalidación no es de más: entre la pregunta y el "dale" pasan minutos, y
 * el cliente es service-role —se saltea RLS—, así que este chequeo ocupa el
 * lugar de la policy igual que en editarItem().
 */
async function cerrarItemConfirmado(
  admin: Admin,
  ctx: Contexto,
  propuesta: Extract<PropuestaViva, { tipo: "cerrar" }>
): Promise<ResultadoAccion> {
  // Se busca por el id y no por `key`: una pieza aparece dos veces en la agenda
  // (grabar y publicar) con keys distintas, y cerrarla es lo mismo desde
  // cualquiera de las dos.
  const item = ctx.items.find((i) => mismoRef(i.ref, propuesta.ref));
  // Si ya no está en la agenda —la cerraron desde Q·OS mientras tanto— no hay
  // nada que hacer, y decir que se cerró sería mentir.
  if (!item) {
    await admin
      .from("wa_agent_actions")
      .update({ status: "fallida", error: "la pieza ya no estaba en la agenda", resolved_at: new Date().toISOString() })
      .eq("id", propuesta.id);
    return { aplicada: false, nota: "Esa ya no estaba en tu agenda — la habrán cerrado desde Q·OS." };
  }

  const { ok, nota } = await escribirEdicion(admin, ctx, { tipo: "marcar_hecho", item: 0 }, item);
  await admin
    .from("wa_agent_actions")
    .update({
      status: ok ? "ejecutada" : "fallida",
      ...(ok ? {} : { error: nota ?? "no se pudo cerrar" }),
      target_table: propuesta.ref.kind === "piece" ? "content_pieces" : "calendar_events",
      target_id: propuesta.ref.kind === "piece" ? propuesta.ref.pieceId : propuesta.ref.eventId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", propuesta.id);
  return { aplicada: ok, nota };
}

async function crearPiezaConfirmada(admin: Admin, ctx: Contexto): Promise<boolean> {
  const propuesta = ctx.propuesta;
  if (!propuesta || propuesta.tipo !== "crear") return false;

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

  // La primera columna DEL CARRIL DE VIDEO es donde entra un video que se acaba
  // de anotar. No la primera del tablero: el carril de guiones arranca antes por
  // posición, así que lo que se pedía por chat nacía en "Cronogramas" —una
  // columna que es para los cronogramas mensuales del Hero, no para videos
  // sueltos— y no aparecía nunca donde el equipo lo iba a buscar.
  const primera = columnaDeEntrada(ctx.columnas);
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
      created_by_agent: true,
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
): Promise<ResultadoAccion> {
  const item = ctx.items[accion.item - 1];
  if (!item) return { aplicada: false };

  const { ok, nota } = await escribirEdicion(admin, ctx, accion, item);
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
      : // El motivo va a la bitácora y no solo al chat: el panel es donde se
        // mira por qué algo no se hizo cuando la conversación ya quedó atrás.
        { error: nota ?? "no se pudo escribir" }
  );
  return { aplicada: ok, nota };
}

async function escribirEdicion(
  admin: Admin,
  ctx: Contexto,
  accion: Extract<AccionAgente, { item: number }>,
  item: AgendaItem
): Promise<ResultadoEdicion> {
  if (item.ref.kind === "piece") {
    const { data: pieza } = await admin
      .from("content_pieces")
      .select("id, column_id")
      .eq("id", item.ref.pieceId)
      .eq("owner_id", ctx.profileId)
      .maybeSingle();
    if (!pieza) return { ok: false };

    if (accion.tipo === "mover_pieza") {
      const destino = columnaDestino(ctx.columnas, pieza.column_id, accion.columna);
      if (!destino.ok) return destino;
      const { error } = await admin.from("content_pieces").update({ column_id: destino.columna.id }).eq("id", pieza.id);
      return { ok: !error };
    }
    if (accion.tipo === "marcar_hecho") {
      // "Hecho" es la columna is_done DEL CARRIL de la tarjeta, no un estado
      // aparte ni la primera que aparezca en el tablero. El porqué, con el caso
      // que lo rompía, está en columnaFinalDe().
      const final = columnaFinalDe(ctx.columnas, pieza.column_id);
      if (!final.ok) return final;
      const { error } = await admin.from("content_pieces").update({ column_id: final.columna.id }).eq("id", pieza.id);
      return { ok: !error };
    }
    // Reprogramar toca la fecha que originó el aviso, no las dos: el campo
    // viene del ítem, no de lo que el modelo haya querido elegir.
    // Va el día pelado: las columnas son `date`, sin hora que inventar.
    const { error } = await admin
      .from("content_pieces")
      .update(item.ref.campo === "publish_date" ? { publish_date: accion.fecha } : { record_date: accion.fecha })
      .eq("id", pieza.id);
    return { ok: !error };
  }

  const { data: evento } = await admin
    .from("calendar_events")
    .select("id")
    .eq("id", item.ref.eventId)
    .eq("responsible_id", ctx.profileId)
    .maybeSingle();
  if (!evento) return { ok: false };

  if (accion.tipo === "marcar_hecho") {
    const { error } = await admin.from("calendar_events").update({ status: "hecho" }).eq("id", evento.id);
    return { ok: !error };
  }
  if (accion.tipo === "reprogramar") {
    const { error } = await admin
      .from("calendar_events")
      .update({ starts_at: `${accion.fecha}T15:00:00Z` })
      .eq("id", evento.id);
    return { ok: !error };
  }
  // mover_pieza sobre un evento no existe.
  return { ok: false, nota: "Eso es un evento del calendario, no una tarjeta del tablero: no tiene columna a la que moverlo." };
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
function redactarSalida(
  respuesta: string,
  accion: AccionAgente,
  resultado: ResultadoAccion,
  items: AgendaItem[],
  /** Lo que estaba esperando confirmación ANTES de aplicar, para poder nombrarlo. */
  pendiente: PropuestaViva | null
): string {
  const { aplicada, nota } = resultado;

  // Cuando algo NO se pudo hacer, la explicación va SOLA: la prosa del modelo se
  // escribió antes de ejecutar, dando por hecho que iba a salir bien, así que
  // pegarle la explicación abajo produce el mensaje contradictorio que Evan leyó
  // el 2026-08-18 — "Ya cierro la de Prueba entrecote" y justo debajo "No pude
  // cerrarla". De las dos frases, la única que sabe lo que de verdad pasó es
  // ésta. Las notas están escritas como mensajes completos, en su voz.
  if (nota) return aplicada ? `${respuesta}\n\n(${nota})` : nota;

  if (accion.tipo === "proponer_pieza") {
    return aplicada
      ? `${respuesta}\n\n${describirPropuesta(accion.pieza, diaCR(new Date()))}`
      : `${respuesta}\n\n(No me quedó anotado, mejor cargalo desde Q·OS.)`;
  }
  if (aplicada) {
    if (accion.tipo === "confirmar" && pendiente?.tipo === "cerrar") {
      return `${respuesta}\n\n(${describirCierreHecho(pendiente.titulo)})`;
    }
    const hecho = describirLoHecho(accion, items);
    return hecho ? `${respuesta}\n\n(${hecho})` : respuesta;
  }
  if (accion.tipo === "confirmar") {
    return pendiente?.tipo === "cerrar"
      ? `${respuesta}\n\n(Ojo: no pude cerrarla, hacelo vos desde Q·OS.)`
      : `${respuesta}\n\n(Ojo: no pude crearla, cargala vos desde Q·OS.)`;
  }
  if (accion.tipo === "descartar") return respuesta;
  if (accion.tipo === "ninguna") return respuesta;
  return `${respuesta}\n\n(Ojo: no pude tocar el tablero, hacelo vos desde Q·OS.)`;
}
