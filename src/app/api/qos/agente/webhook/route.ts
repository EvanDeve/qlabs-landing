import { NextResponse, after } from "next/server";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { firmaValida } from "@/lib/whatsapp/firma";
import { sendWhatsAppFreeform, normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { getStaffAgenda, itemsDeAgenda } from "@/lib/ugc/agenda";
import {
  responderMensaje,
  getAjustesAgente,
  describirPropuesta,
  describirLoHecho,
  normalizarTitulo,
  esValidaParaConfirmar,
  describirEvento,
  HORA_POR_DEFECTO,
  type AccionAgente,
  type PropuestaPieza,
  type PropuestaEvento,
  type CambiosDePieza,
  type TurnoPrevio,
} from "@/lib/ugc/agente";
import {
  responderPublico,
  hablaDemasiado,
  partirEnMensajes,
  demoraDeEscritura,
} from "@/lib/ugc/agente-publico";
import { leerBusqueda, buscarEnElTablero, vale, type ItemDelTablero } from "@/lib/ugc/busqueda";
import { ventanaAbierta } from "@/lib/ugc/recordatorios";
import { PIEZA_TOCADA } from "@/lib/ugc/admin-alerts";
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

/**
 * Lo que se le contesta a Twilio cuando el mensaje se recibió bien.
 *
 * Twilio espera TwiML (`text/xml`) en la respuesta del webhook, y cuando le
 * llega otra cosa lo anota como error `12300 — Invalid Content-Type`. La
 * conversación nunca dependió de esto —la respuesta al equipo sale aparte por
 * la API, dentro del after()— así que devolver JSON no rompía nada. Lo que sí
 * hacía era pintar de rojo en la consola de Twilio TODOS los mensajes
 * entrantes, que es exactamente donde aparecería un `11200` de verdad: la única
 * señal que tenemos de que el webhook dejó de responder. Un log donde todo está
 * en rojo no avisa de nada.
 *
 * Va vacío a propósito: `<Response/>` es TwiML válido y significa "recibido, no
 * contestes nada por tu cuenta".
 */
function recibido(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

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
  if (!telefono || !texto) return recibido();

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

  return recibido();
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

  const [{ data: perfil }, { data: columnas }, { data: clientes }, { data: previos }, ajustes, { data: equipo }] =
    await Promise.all([
    admin.from("profiles").select("display_name").eq("id", miembro.profile_id).maybeSingle(),
    // `section` es lo que separa los tres carriles del tablero. Sin él, mover
    // una tarjeta a "Terminado" es ambiguo —hay dos columnas con ese nombre— y
    // dar algo por hecho puede mandarlo al carril equivocado.
    admin.from("content_columns").select("id, name, is_done, section").order("position"),
    // Sin los archivados: esta lista es la de Heroes que McLovin puede nombrar
    // al crear una pieza, y no se le carga trabajo nuevo a un cliente que se
    // fue. Si alguien igual dicta ese nombre, el agente no lo va a encontrar y
    // va a preguntar — que es la salida correcta.
    admin.from("agency_clients").select("id, name, archived").order("name"),
    admin
      .from("wa_messages")
      .select("direction, body")
      .eq("profile_id", miembro.profile_id)
      .order("created_at", { ascending: false })
      .limit(11),
    getAjustesAgente(admin),
    // El equipo, para poder ponerle responsable a un evento. Sale de
    // staff_members y no de la vista staff_directory: esa filtra por sesión de
    // admin y acá el cliente es service-role, así que devolvería cero filas.
    admin.from("staff_members").select("profile_id").eq("active", true),
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

  const itemsAgenda = itemsDeAgenda(agenda);

  // El tablero entero, buscado con lo que menciona el mensaje. Va después de la
  // agenda porque necesita saber qué ya se le está mostrando: la misma tarjeta
  // con dos números es cómo el modelo mueve una y dice que movió la otra.
  const encontradas = await buscarDelMensaje(admin, {
    mensaje: texto,
    heroes: clientes ?? [],
    columnas: columnas ?? [],
    yaEnAgenda: new Set(itemsAgenda.map((i) => i.key)),
    profileId: miembro.profile_id,
  });

  const items = [...itemsAgenda, ...encontradas];

  // Los nombres del equipo: son los que el modelo puede escribir como
  // responsable de un evento. Se resuelven contra `profiles` porque
  // staff_members solo guarda el id.
  const { data: perfilesEquipo } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", (equipo ?? []).map((m) => m.profile_id));
  const nombresDelEquipo = (perfilesEquipo ?? [])
    .filter((p): p is { id: string; display_name: string } => Boolean(p.display_name))
    .map((p) => ({ id: p.id, nombre: p.display_name }));

  // El más nuevo es el que acabamos de guardar; va aparte como `mensaje`.
  const historial: TurnoPrevio[] = (previos ?? [])
    .slice(1)
    .reverse()
    .map((m) => ({ quien: m.direction === "in" ? "persona" : "agente", texto: m.body }));

  const { respuesta, acciones } = await responderMensaje({
    nombre: perfil?.display_name ?? "colega",
    agenda,
    columnas: columnas ?? [],
    // Para PROPONER una pieza nueva solo se ofrecen los Heroes activos: no se le
    // carga trabajo a un cliente que se fue. Buscar sí los incluye a todos —
    // preguntar por lo que quedó de un Hero archivado es legítimo.
    clientes: (clientes ?? []).filter((c) => !c.archived).map((c) => c.name),
    equipo: nombresDelEquipo.map((p) => p.nombre),
    encontradas,
    historial,
    mensaje: texto,
    pendiente: !propuesta
      ? null
      : propuesta.tipo === "crear"
        ? { tipo: "crear", pieza: propuesta.pieza }
        : { tipo: "crear_evento", evento: propuesta.evento },
    reporte,
    ajustes,
  });

  // En serie y en el orden que las dijo: dos escrituras sobre la misma tarjeta
  // en paralelo se pisarían, y el orden es el que la persona tiene en la cabeza
  // cuando lee lo que se hizo.
  const hechas: { accion: AccionAgente; resultado: ResultadoAccion }[] = [];
  for (const accion of acciones) {
    const resultado = await aplicarAccion(admin, {
      profileId: miembro.profile_id,
      nombre: perfil?.display_name ?? "alguien del equipo",
      accion,
      items,
      heroesArchivados: new Set((clientes ?? []).filter((c) => c.archived).map((c) => c.id)),
      columnas: columnas ?? [],
      clientes: (clientes ?? []).filter((c) => !c.archived),
      equipo: nombresDelEquipo,
      propuesta,
    });
    hechas.push({ accion, resultado });
  }

  // Estamos dentro de la ventana de 24 h por definición —acaban de escribir—
  // así que acá el agente habla libre, sin plantilla.
  await responder(admin, miembro.profile_id, telefono, redactarSalida(respuesta, hechas, items));
}

/**
 * Las tarjetas del tablero que menciona el mensaje, con los nombres ya resueltos.
 *
 * Vive acá y no en busqueda.ts porque es la parte que sabe de dónde salen los
 * nombres —Heroes, columnas y equipo— y ese es trabajo del webhook. En
 * busqueda.ts queda la lógica, que es la que se puede probar sin base.
 *
 * Si algo falla se devuelve vacío: quedarse sin el bloque de búsqueda es que
 * McLovin conteste solo sobre la agenda, como venía haciendo hasta hoy. Que se
 * caiga el mensaje entero por una consulta de más sería mucho peor.
 */
async function buscarDelMensaje(
  admin: Admin,
  opciones: {
    mensaje: string;
    heroes: { id: string; name: string }[];
    columnas: Columna[];
    yaEnAgenda: Set<string>;
    profileId: string;
  }
): Promise<ItemDelTablero[]> {
  try {
    const busqueda = leerBusqueda(opciones.mensaje, opciones.heroes, opciones.columnas);
    if (!vale(busqueda)) return [];

    const encontradas = await buscarEnElTablero(admin, busqueda, {
      yaEnAgenda: opciones.yaEnAgenda,
      heroePorId: new Map(opciones.heroes.map((h) => [h.id, h.name])),
      columnaPorId: new Map(opciones.columnas.map((c) => [c.id, c.name])),
      columnasFinales: new Set(opciones.columnas.filter((c) => c.is_done).map((c) => c.id)),
      profileId: opciones.profileId,
    });

    // Los nombres del equipo se resuelven acá, sobre los dueños que de verdad
    // aparecieron: pedir la tabla de perfiles antes de saber si la búsqueda
    // trajo algo es una consulta que casi siempre sobra.
    const owners = [...new Set(encontradas.filter((i) => i.ajena).map((i) => i.ownerId).filter((v): v is string => Boolean(v)))];
    if (!owners.length) return encontradas;

    const { data: perfiles } = await admin.from("profiles").select("id, display_name").in("id", owners);
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

    return encontradas.map((i) => ({
      ...i,
      responsable: i.ownerId ? nombrePorId.get(i.ownerId) ?? null : null,
    }));
  } catch (err) {
    console.error("[agente/webhook] no se pudo buscar en el tablero:", err);
    return [];
  }
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
 * Solo puede ser una pieza a crear. Cerrar también esperaba confirmación hasta
 * el 2026-08-18; ahora se hace de una — ver el comentario de `Pendiente`.
 */
type PropuestaViva =
  | { id: string; tipo: "crear"; pieza: PropuestaPieza }
  | { id: string; tipo: "crear_evento"; evento: PropuestaEvento };

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
    // Solo las de crear. Pueden quedar filas viejas de 'marcar_hecho' abiertas
    // de cuando cerrar preguntaba, y su payload tiene otra forma: sin este
    // filtro, un "dale" las leería como si fueran una pieza a crear.
    .in("kind", ["crear_pieza", "crear_evento"])
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

  // El kind dice qué forma tiene el payload. Una fila vieja de cuando las
  // grabaciones eran piezas con `tipo: "grabar"` no trae los campos de evento,
  // así que se descarta en vez de crear algo a medias con un "dale".
  if (data.kind === "crear_evento") {
    const evento = data.payload as unknown as PropuestaEvento;
    if (!evento?.tipo || !evento?.fecha) return null;
    return { id: data.id, tipo: "crear_evento", evento };
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
  /** Cómo se llama quien pidió la acción. Va en el aviso al dueño de la tarjeta. */
  nombre: string;
  accion: AccionAgente;
  /**
   * La agenda de quien escribe MÁS lo que se encontró en el tablero. Las
   * segundas traen `responsable`, que es de quién es la tarjeta — la agenda no
   * lo lleva porque todo lo suyo es suyo.
   */
  items: (AgendaItem & { responsable?: string | null; ajena?: boolean })[];
  columnas: Columna[];
  clientes: Cliente[];
  /** El equipo activo, para poder asignarle un evento a alguien por su nombre. */
  equipo: { id: string; nombre: string }[];
  /** Los Heroes archivados: de un cliente que se fue no se toca nada. */
  heroesArchivados: Set<string>;
  propuesta: PropuestaViva | null;
};

/**
 * Le avisa al dueño de la tarjeta que alguien más se la tocó.
 *
 * Es la contracara de haber abierto los permisos. Con el candado de propiedad,
 * el tablero de cada uno solo lo cambiaba esa persona; ahora lo cambia
 * cualquiera desde un chat que el dueño no ve, y enterarse por casualidad de
 * que tu video "ya estaba publicado" es cómo se pierde la confianza en el
 * tablero. La bitácora ya guardaba quién lo pidió, pero había que ir a buscarla.
 *
 * Dos capas, igual que el aviso de cronograma: la notificación in-app se crea
 * SIEMPRE —es la que garantiza que el aviso no se pierda— y el WhatsApp se
 * intenta encima, solo para quien tenga la ventana de 24 h abierta. Fuera de esa
 * ventana Meta exige plantilla y no hay ninguna para esto.
 *
 * Todo best-effort: que falle el aviso no puede deshacer lo que ya se escribió.
 */
async function avisarAlDueno(
  admin: Admin,
  ctx: Contexto,
  pieza: { id: string; owner_id: string | null; title: string },
  queHizo: string
): Promise<void> {
  // Nadie se avisa a sí mismo, y una tarjeta sin dueño no tiene a quién avisar.
  if (!pieza.owner_id || pieza.owner_id === ctx.profileId) return;

  try {
    await admin.from("notifications").insert({
      profile_id: pieza.owner_id,
      type: PIEZA_TOCADA,
      payload: { piece_id: pieza.id, title: pieza.title, quien: ctx.nombre, que: queHizo },
    });

    if (!(await ventanaAbierta(admin, pieza.owner_id))) return;

    const { data: dueno } = await admin
      .from("staff_members")
      .select("phone_e164, wa_opt_in")
      .eq("profile_id", pieza.owner_id)
      .maybeSingle();
    if (!dueno?.phone_e164 || !dueno.wa_opt_in) return;

    await responder(
      admin,
      pieza.owner_id,
      dueno.phone_e164,
      `Ojo, ${ctx.nombre} ${queHizo}: ${pieza.title}.`
    );
  } catch (err) {
    console.error("[agente/webhook] no se pudo avisar al dueño:", err);
  }
}

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
    if (accion.tipo === "proponer_evento") return await abrirPropuestaDeEvento(admin, ctx, accion.evento);
    if (accion.tipo === "cancelar_evento") return await cancelarEvento(admin, ctx, accion.item);
    if (accion.tipo === "editar_pieza") return await cambiarCampos(admin, ctx, accion.item, accion.cambios);
    if (accion.tipo === "descartar") return { aplicada: await cerrarPropuesta(admin, ctx, "descartada") };
    if (accion.tipo === "confirmar") return { aplicada: await ejecutarConfirmado(admin, ctx) };
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
  // Cancelar un evento se registra como 'reprogramar': es la bandera más cercana
  // de las que existen y no vale una migración del enum por una etiqueta.
  if (accion.tipo === "cancelar_evento") return "reprogramar";
  if (accion.tipo === "proponer_evento") return "crear_evento";
  // El resto de los casos que caen acá (confirmar, descartar, ninguna) se
  // registran solo cuando fallan y no tienen destino propio.
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
  const cliente = ctx.clientes.find((c) => c.name === pieza.cliente);
  const repetida = cliente ? await piezaYaExistente(admin, cliente.id, pieza.titulo) : null;
  if (repetida) {
    return {
      aplicada: false,
      nota: `Ojo: "${repetida}" ya está en el tablero de ${pieza.cliente}, así que no la anoté de nuevo. Si igual querés otra, cargala desde Q·OS.`,
    };
  }

  if (ctx.propuesta) await cerrarPropuesta(admin, ctx, "reemplazada");
  // El kind se decide acá, en la propuesta, y no al ejecutarla: así la bitácora
  // dice desde el primer registro qué se iba a crear, aunque nunca contesten.
  const id = await registrar(
    admin,
    ctx.profileId,
    "crear_pieza",
    pieza as unknown as Record<string, unknown>,
    "propuesta"
  );
  return { aplicada: id !== null };
}

/**
 * Guarda el evento que se va a crear, sin crear nada todavía.
 *
 * No hay chequeo de repetido como en las piezas: dos reuniones con el mismo
 * título el mismo día son raras pero legítimas —una a la mañana y otra a la
 * tarde—, y bloquear la segunda sería negarse a algo que existe de verdad. El
 * duplicado de una pieza sí se bloquea porque ahí lo que se repite es trabajo.
 */
async function abrirPropuestaDeEvento(
  admin: Admin,
  ctx: Contexto,
  evento: PropuestaEvento
): Promise<ResultadoAccion> {
  if (ctx.propuesta) await cerrarPropuesta(admin, ctx, "reemplazada");
  const id = await registrar(
    admin,
    ctx.profileId,
    "crear_evento",
    evento as unknown as Record<string, unknown>,
    "propuesta"
  );
  return { aplicada: id !== null };
}

/**
 * Suspende un evento del calendario.
 *
 * Pasa a `pausado` y no se borra: un evento cancelado sigue siendo información
 * —se sabe que estaba y que se cayó—, y borrarlo desde un chat sería la única
 * acción del agente sin vuelta atrás. Sale de la agenda igual, porque esta solo
 * mira los que están en `programado`.
 */
async function cancelarEvento(admin: Admin, ctx: Contexto, indice: number): Promise<ResultadoAccion> {
  const item = ctx.items[indice - 1];
  if (!item) return { aplicada: false };

  if (item.ref.kind !== "event") {
    return {
      aplicada: false,
      nota: "Eso es una tarjeta del tablero, no un evento: no se cancela. Decime si la movés de columna o la damos por terminada.",
    };
  }

  const { error } = await admin
    .from("calendar_events")
    .update({ status: "pausado" })
    .eq("id", item.ref.eventId);

  await registrar(
    admin,
    ctx.profileId,
    "reprogramar",
    { accion: { tipo: "cancelar_evento" }, titulo: item.titulo },
    error ? "fallida" : "ejecutada",
    error ? { error: error.message } : { targetTable: "calendar_events", targetId: item.ref.eventId }
  );

  return error ? { aplicada: false } : { aplicada: true, nota: `Listo, cancelé ${item.titulo}.` };
}

async function cerrarPropuesta(admin: Admin, ctx: Contexto, status: "descartada" | "reemplazada"): Promise<boolean> {
  if (!ctx.propuesta) return false;
  const { error } = await admin
    .from("wa_agent_actions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", ctx.propuesta.id);
  return !error;
}

/** Un "dale" ejecuta lo que haya quedado esperando: una tarjeta o un evento. */
async function ejecutarConfirmado(admin: Admin, ctx: Contexto): Promise<boolean> {
  if (!ctx.propuesta) return false;
  return ctx.propuesta.tipo === "crear_evento"
    ? await crearEventoConfirmado(admin, ctx, ctx.propuesta.id, ctx.propuesta.evento)
    : await crearPiezaConfirmada(admin, ctx);
}

/**
 * Crea la pieza a partir de lo GUARDADO, nunca de lo que el modelo reescriba.
 *
 * Es el punto entero del diseño de dos turnos. Si acá se usaran los datos que el
 * modelo devuelve junto con el "confirmar", la persona estaría confirmando un
 * texto y el sistema guardando otro, sin que nada fallara de forma visible.
 */

/**
 * Crea la pieza a partir de lo GUARDADO, nunca de lo que el modelo reescriba.
 *
 * Es el punto entero del diseño de dos turnos: si acá se usaran los datos que el
 * modelo devuelve junto con el "confirmar", la persona estaría confirmando un
 * texto y el sistema guardando otro, sin que nada fallara de forma visible.
 */
async function crearPiezaConfirmada(admin: Admin, ctx: Contexto): Promise<boolean> {
  const propuesta = ctx.propuesta;
  if (!propuesta || propuesta.tipo !== "crear") return false;

  const cliente = ctx.clientes.find((c) => c.name === propuesta.pieza.cliente);
  if (!cliente) return false;

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
 * Crea el evento guardado, con lo que se dictó y no con lo que el modelo repita.
 *
 * Reemplaza a la vieja crearGrabacionConfirmada(), que solo sabía hacer una cosa:
 * una grabación, a las 9 de la mañana, a nombre de quien la pedía y colgada de un
 * Hero obligatorio. Ahora los cuatro son datos del evento.
 */
async function crearEventoConfirmado(admin: Admin, ctx: Contexto, propuestaId: string, evento: PropuestaEvento) {
  // fromZonedTime interpreta el día+hora EN Costa Rica y devuelve el instante.
  // Un `new Date("2026-08-05T09:00:00")` lo leería en la zona del servidor, que
  // en Vercel es UTC, y la reunión de las 3 de la tarde quedaría a las 9 de la
  // mañana del día siguiente.
  const hora = evento.hora ?? HORA_POR_DEFECTO;
  const startsAt = fromZonedTime(`${evento.fecha} ${hora}:00`, COSTA_RICA_TZ).toISOString();

  const brandId = evento.cliente ? ctx.clientes.find((c) => c.name === evento.cliente)?.id ?? null : null;
  // Un nombre que no resuelve NO cae en quien lo pidió: la validación ya lo
  // habría descartado, y si igual llegara acá, asignárselo a otro sería peor
  // que no crearlo. `?? ctx.profileId` cubre el caso legítimo de no haber
  // dictado responsable.
  const responsableId = evento.responsable
    ? ctx.equipo.find((m) => m.nombre === evento.responsable)?.id ?? ctx.profileId
    : ctx.profileId;

  const { data: creado, error } = await admin
    .from("calendar_events")
    .insert({
      type: evento.tipo,
      brand_id: brandId,
      title: evento.titulo,
      starts_at: startsAt,
      responsible_id: responsableId,
      status: "programado",
      created_by_agent: true,
      // Sin pieza asociada a propósito: la FK es `on delete cascade`, así que
      // apuntar a una pieza haría que borrarla se llevara puesto el evento.
      content_piece_id: null,
    })
    .select("id")
    .single();

  if (error || !creado) return await marcarPropuestaFallida(admin, propuestaId, error?.message);

  await admin
    .from("wa_agent_actions")
    .update({
      status: "ejecutada",
      target_table: "calendar_events",
      target_id: creado.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", propuestaId);

  // Si el evento quedó a nombre de otro, esa persona tiene que enterarse: es
  // trabajo que le acaba de aparecer en la agenda sin que ella lo pidiera.
  if (responsableId !== ctx.profileId) {
    await avisarAlDueno(
      admin,
      ctx,
      { id: creado.id, owner_id: responsableId, title: evento.titulo },
      "te dejó un evento en el calendario"
    );
  }

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

/**
 * Cambia los campos de una tarjeta: prioridad, plataforma, hora, dueño, título,
 * aprobación y apuntes.
 *
 * Los apuntes se AGREGAN a lo que había. Es el único campo que se comporta así y
 * la razón es que se dicta de a poco —"anotale que el chef pidió grabar en la
 * cocina nueva"— sin saber qué hay escrito del otro lado. Pisarlos sería borrar
 * lo que alguien anotó ayer sin que ninguno de los dos se entere.
 */
async function cambiarCampos(
  admin: Admin,
  ctx: Contexto,
  indice: number,
  cambios: CambiosDePieza
): Promise<ResultadoAccion> {
  const item = ctx.items[indice - 1];
  if (!item) return { aplicada: false };

  if (item.ref.kind !== "piece") {
    return {
      aplicada: false,
      nota: "Eso es un evento del calendario y no tiene esos campos. Se edita desde el calendario de Q·OS.",
    };
  }

  const { data: pieza } = await admin
    .from("content_pieces")
    .select("id, owner_id, brand_id, title, notes")
    .eq("id", item.ref.pieceId)
    .maybeSingle();
  if (!pieza) return { aplicada: false };

  if (pieza.brand_id && ctx.heroesArchivados.has(pieza.brand_id)) {
    return { aplicada: false, nota: "Esa es de un Hero archivado, así que no le toco nada." };
  }

  const responsableId = cambios.responsable
    ? ctx.equipo.find((m) => m.nombre === cambios.responsable)?.id
    : undefined;

  const { error } = await admin
    .from("content_pieces")
    .update({
      ...(cambios.titulo ? { title: cambios.titulo } : {}),
      ...(cambios.prioridad ? { priority: cambios.prioridad } : {}),
      ...(cambios.plataforma ? { platform: cambios.plataforma } : {}),
      ...(cambios.aprobacion ? { approval: cambios.aprobacion } : {}),
      ...(cambios.hora ? { publish_time: `${cambios.hora}:00` } : {}),
      ...(responsableId ? { owner_id: responsableId } : {}),
      ...(cambios.notas
        ? { notes: pieza.notes?.trim() ? `${pieza.notes.trim()}\n${cambios.notas}` : cambios.notas }
        : {}),
    })
    .eq("id", pieza.id);

  await registrar(
    admin,
    ctx.profileId,
    "editar_pieza",
    { cambios, titulo: pieza.title, ...(item.responsable ? { dueno: item.responsable } : {}) },
    error ? "fallida" : "ejecutada",
    error ? { error: error.message } : { targetTable: "content_pieces", targetId: pieza.id }
  );

  if (error) return { aplicada: false };

  // Reasignar es lo único de acá que le cambia el trabajo a otra persona: la
  // tarjeta le aparece en SU agenda. Los demás campos le avisan al dueño de
  // siempre, que es quien la tiene que producir.
  const destinatario = responsableId ?? pieza.owner_id;
  await avisarAlDueno(
    admin,
    ctx,
    { id: pieza.id, owner_id: destinatario, title: pieza.title },
    responsableId ? "te pasó una tarjeta" : "le cambió algo a una tarjeta tuya"
  );

  return { aplicada: true };
}

/** Las tres acciones que caen sobre algo que ya existía en la agenda. */
async function editarItem(
  admin: Admin,
  ctx: Contexto,
  accion: Exclude<
    Extract<AccionAgente, { item: number }>,
    { tipo: "cancelar_evento" } | { tipo: "editar_pieza" }
  >
): Promise<ResultadoAccion> {
  const item = ctx.items[accion.item - 1];
  if (!item) return { aplicada: false };

  const { ok, nota } = await escribirEdicion(admin, ctx, accion, item);
  await registrar(
    admin,
    ctx.profileId,
    kindDe(accion),
    // El dueño va a la bitácora cuando la tarjeta era de otro: desde que
    // cualquiera puede tocar cualquier cosa, "quién lo pidió" ya no cuenta la
    // historia entera — hay que poder ver sobre el trabajo de quién cayó.
    { accion, titulo: item.titulo, ...(item.responsable ? { dueno: item.responsable } : {}) },
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

/**
 * Escribe sobre una tarjeta o un evento, con los candados que reemplazaron al
 * de propiedad.
 *
 * Hasta el 2026-08-18 acá había un `.eq("owner_id", profileId)`: solo podías
 * tocar lo tuyo. Se cayó por decisión de Evan —cualquiera del equipo mueve
 * cualquier cosa, que es lo que hace que el tablero se pueda manejar sin
 * abrirlo—. Pero ese filtro no era solo un permiso: también era la red que
 * atajaba al modelo cuando confundía una tarjeta con otra, porque lo ajeno
 * simplemente no se movía.
 *
 * Lo que ocupa su lugar son tres cosas distintas y ninguna es opcional:
 *   1. La tarjeta existe de verdad (el modelo nunca ve un id, pero igual se
 *      revalida contra la base antes de escribir: el cliente es service-role y
 *      se saltea RLS).
 *   2. Su Hero no está archivado — de un cliente que se fue no se toca nada.
 *   3. La columna destino es del carril de la tarjeta (ver tablero.ts).
 * Y encima, el dueño se entera: ver avisarAlDueno().
 */
async function escribirEdicion(
  admin: Admin,
  ctx: Contexto,
  // Sin cancelar_evento ni editar_pieza: los dos tienen su propia función.
  accion: Exclude<
    Extract<AccionAgente, { item: number }>,
    { tipo: "cancelar_evento" } | { tipo: "editar_pieza" }
  >,
  item: AgendaItem
): Promise<ResultadoEdicion> {
  if (item.ref.kind === "piece") {
    const { data: pieza } = await admin
      .from("content_pieces")
      .select("id, column_id, owner_id, brand_id, title")
      .eq("id", item.ref.pieceId)
      .maybeSingle();
    if (!pieza) return { ok: false };

    // De un Hero archivado no se toca nada: dejó de ser cliente y su tablero
    // queda como quedó. Es el mismo criterio que usa la agenda para no
    // recordarlo todos los días.
    if (pieza.brand_id && ctx.heroesArchivados.has(pieza.brand_id)) {
      return { ok: false, nota: "Esa es de un Hero archivado, así que no le toco nada." };
    }

    if (accion.tipo === "mover_pieza") {
      const destino = columnaDestino(ctx.columnas, pieza.column_id, accion.columna);
      if (!destino.ok) return destino;
      const { error } = await admin.from("content_pieces").update({ column_id: destino.columna.id }).eq("id", pieza.id);
      if (error) return { ok: false };
      await avisarAlDueno(admin, ctx, pieza, `la movió a ${destino.columna.name}`);
      return { ok: true };
    }
    if (accion.tipo === "marcar_hecho") {
      // "Hecho" es la columna is_done DEL CARRIL de la tarjeta, no un estado
      // aparte ni la primera que aparezca en el tablero. El porqué, con el caso
      // que lo rompía, está en columnaFinalDe().
      const final = columnaFinalDe(ctx.columnas, pieza.column_id);
      if (!final.ok) return final;
      const { error } = await admin.from("content_pieces").update({ column_id: final.columna.id }).eq("id", pieza.id);
      if (error) return { ok: false };
      await avisarAlDueno(admin, ctx, pieza, "la dio por terminada");
      return { ok: true };
    }
    // Reprogramar toca la fecha que originó el aviso, no las dos: el campo
    // viene del ítem, no de lo que el modelo haya querido elegir.
    // Va el día pelado: las columnas son `date`, sin hora que inventar.
    const { error } = await admin
      .from("content_pieces")
      .update(item.ref.campo === "publish_date" ? { publish_date: accion.fecha } : { record_date: accion.fecha })
      .eq("id", pieza.id);
    if (error) return { ok: false };
    await avisarAlDueno(admin, ctx, pieza, `la pasó para el ${accion.fecha}`);
    return { ok: true };
  }

  const { data: evento } = await admin
    .from("calendar_events")
    .select("id, starts_at")
    .eq("id", item.ref.eventId)
    .maybeSingle();
  if (!evento) return { ok: false };

  if (accion.tipo === "marcar_hecho") {
    const { error } = await admin.from("calendar_events").update({ status: "hecho" }).eq("id", evento.id);
    return { ok: !error };
  }
  if (accion.tipo === "reprogramar") {
    // La hora que tenía se conserva. Antes se escribía un `T15:00:00Z` fijo —las
    // 9 de la mañana de Costa Rica— así que pasar una reunión de las 3 de la
    // tarde para el día siguiente la mandaba a las 9, sin que nadie lo pidiera y
    // sin que el mensaje lo dijera.
    //
    // Se lee en hora de CR y se vuelve a armar en CR: la columna es un instante,
    // y hacer la cuenta en UTC corre el evento seis horas cada vez que se toca.
    const hora = formatInTimeZone(new Date(evento.starts_at), COSTA_RICA_TZ, "HH:mm:ss");
    const { error } = await admin
      .from("calendar_events")
      .update({ starts_at: fromZonedTime(`${accion.fecha} ${hora}`, COSTA_RICA_TZ).toISOString() })
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
  hechas: { accion: AccionAgente; resultado: ResultadoAccion }[],
  items: (AgendaItem & { responsable?: string | null; ajena?: boolean })[]
): string {
  const lineas = hechas.map(({ accion, resultado }) => lineaDeAccion(accion, resultado, items)).filter(Boolean);
  return [respuesta, ...lineas].join("\n\n");
}

/**
 * La línea de UNA acción: qué se hizo, o por qué no se pudo.
 *
 * Cada acción trae la suya, así que un mensaje con tres pedidos donde falló el
 * segundo se lee como tres renglones y uno dice qué pasó. Un "listo" general
 * cuando algo falló es la peor salida posible: la persona se va creyendo que su
 * tablero quedó como pidió.
 */
function lineaDeAccion(
  accion: AccionAgente,
  resultado: ResultadoAccion,
  items: (AgendaItem & { responsable?: string | null; ajena?: boolean })[]
): string {
  const { aplicada, nota } = resultado;

  // Cuando algo NO se pudo hacer, la explicación va sola: la prosa del modelo se
  // escribió antes de ejecutar, dando por hecho que iba a salir bien. Pegarle la
  // explicación abajo produce el mensaje que se contradice — "ya cierro la de X"
  // y justo debajo "no pude cerrarla".
  if (nota) return nota;

  if (accion.tipo === "proponer_pieza") {
    return aplicada
      ? describirPropuesta(accion.pieza, diaCR(new Date()))
      : "No me quedó anotado, mejor cargalo desde Q·OS.";
  }
  if (accion.tipo === "proponer_evento") {
    // La línea del evento la arma el sistema por lo mismo que la de la pieza: es
    // lo único que garantiza que la hora que la persona lee sea la que se guarda.
    return aplicada
      ? describirEvento(accion.evento, diaCR(new Date()))
      : "No me quedó anotado, mejor cargalo desde el calendario.";
  }
  if (aplicada) return describirLoHecho(accion, items) ?? "";
  if (accion.tipo === "confirmar") return "Ojo, no pude crearla — cargala vos desde Q·OS.";
  if (accion.tipo === "descartar" || accion.tipo === "ninguna") return "";
  return "Ojo, no pude tocar el tablero — hacelo vos desde Q·OS.";
}
