import { formatInTimeZone } from "date-fns-tz";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { type Agenda, type AgendaItem, itemsDeAgenda, resumenDeterminista } from "@/lib/ugc/agenda";

/**
 * La voz del agente.
 *
 * El pedido explícito de Evan fue que no se sienta un bot. Eso no se logra
 * pidiéndole al modelo "sé natural" —eso produce simpatía impostada, que es
 * peor— sino prohibiéndole las marcas concretas que delatan a un sistema
 * automático: el saludo protocolar, el listado con viñetas, el "te recuerdo
 * que", la firma. Un compañero de trabajo escribiendo desde el celular no hace
 * nada de eso.
 */
const PERSONA = `
Sos parte del equipo de Q Labs, una agencia de contenido en Costa Rica. Le
escribís por WhatsApp a un compañero sobre lo que tiene pendiente.

CÓMO ESCRIBÍS
- Español de Costa Rica, voseo: "tenés", "acordate", "pasámelo", "dale".
- Como le escribe un compañero a otro, no como un sistema. Directo y corto.
- Nombrás las cosas por su nombre: la pieza y el cliente, no "tenés 2 tareas".

LO QUE NUNCA HACÉS
- Presentarte, saludar de forma protocolar ni firmar.
- Decir "te recuerdo que", "este es un recordatorio automático", "según el sistema".
- Listas con viñetas, guiones al principio de línea, negritas ni emojis decorativos.
- Inventar pendientes, fechas o clientes que no estén en los datos que te paso.
- Prometer que vos vas a hacer algo. No hacés el trabajo, lo señalás.
`.trim();

/** Un ítem tal como se lo mostramos al modelo: con número, nunca con UUID. */
function lineaDeItem(item: AgendaItem, indice: number, hoyCR: string): string {
  const dia = formatInTimeZone(new Date(item.fecha), COSTA_RICA_TZ, "yyyy-MM-dd");
  const hora = formatInTimeZone(new Date(item.fecha), COSTA_RICA_TZ, "HH:mm");
  const cuando = dia === hoyCR ? `hoy ${hora}` : dia;
  const prioridad = item.prioridad === "alta" ? " [prioridad alta]" : "";
  return `${indice + 1}. ${item.accion} "${item.titulo}"${item.heroe ? ` — ${item.heroe}` : ""} — ${cuando}${prioridad}`;
}

function describirAgenda(agenda: Agenda, hoyCR: string): string {
  const items = itemsDeAgenda(agenda);
  const enBloque = (titulo: string, lista: AgendaItem[]) =>
    lista.length ? `${titulo}:\n${lista.map((i) => lineaDeItem(i, items.indexOf(i), hoyCR)).join("\n")}` : "";

  return [
    enBloque("ATRASADO", agenda.vencidas),
    enBloque("HOY", agenda.hoy),
    enBloque("PRÓXIMOS DÍAS", agenda.proximas),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function pedirleAGemini(prompt: string, json: boolean): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[agente] falta GEMINI_API_KEY — se usa el texto determinista");
    return null;
  }
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });
    const texto = (await model.generateContent(prompt)).response.text().trim();
    return texto || null;
  } catch (err) {
    console.error("[agente] Gemini falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * El mensaje de la mañana.
 *
 * `libre` cambia el formato, no el tono: dentro de la ventana de 24 h el
 * mensaje va como texto suelto y puede respirar; fuera de ella viaja como
 * variable de una plantilla de WhatsApp y tiene que ser UNA sola línea, porque
 * Meta rechaza las variables con saltos de línea.
 *
 * Si Gemini no contesta, sale igual con resumenDeterminista(). El recordatorio
 * nunca depende de que el LLM esté arriba: un mensaje seco llega, uno que no se
 * manda no sirve para nada.
 */
export async function redactarNudge(
  agenda: Agenda,
  nombre: string,
  libre: boolean,
  now: Date = new Date()
): Promise<string> {
  const hoyCR = formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd");

  const formato = libre
    ? "Podés usar 2 o 3 líneas cortas si ayuda a que se lea rápido."
    : "TIENE QUE SER UNA SOLA LÍNEA, sin ningún salto de línea. Máximo 400 caracteres.";

  const texto = await pedirleAGemini(
    `${PERSONA}

Le escribís a ${nombre}. Hoy es ${hoyCR}.

ESTO ES LO QUE TIENE PENDIENTE:
${describirAgenda(agenda, hoyCR)}

Escribile un mensaje corto. Arrancá por lo atrasado si hay algo atrasado.
${formato}
Cerrá con una pregunta concreta sobre lo más urgente, para que pueda contestarte.
Devolvé SOLO el mensaje, sin comillas ni explicación.`,
    false
  );

  if (!texto) return resumenDeterminista(agenda);
  // El modelo a veces devuelve el mensaje entrecomillado pese al pedido.
  return texto.replace(/^["“]([\s\S]*)["”]$/, "$1").trim();
}

// ---------------------------------------------------------------
// Conversación
// ---------------------------------------------------------------

/**
 * Lo que el agente puede hacer, y nada más.
 *
 * `item` es el NÚMERO que se le mostró al modelo, no un UUID. Es deliberado:
 * un modelo que nunca ve un identificador real no puede inventar uno, así que
 * la acción siempre cae sobre algo que estaba de verdad en la agenda de esa
 * persona. El mapeo de vuelta a ids lo hace el webhook.
 */
export type AccionAgente =
  | { tipo: "ninguna" }
  | { tipo: "mover_pieza"; item: number; columna: string }
  | { tipo: "marcar_hecho"; item: number }
  | { tipo: "reprogramar"; item: number; fecha: string };

export type RespuestaAgente = { respuesta: string; accion: AccionAgente };

export type TurnoPrevio = { quien: "agente" | "persona"; texto: string };

export async function responderMensaje(opciones: {
  nombre: string;
  agenda: Agenda;
  columnas: string[];
  historial: TurnoPrevio[];
  mensaje: string;
  now?: Date;
}): Promise<RespuestaAgente> {
  const { nombre, agenda, columnas, historial, mensaje } = opciones;
  const now = opciones.now ?? new Date();
  const hoyCR = formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd");
  const items = itemsDeAgenda(agenda);

  const conversacion = historial
    .map((t) => `${t.quien === "agente" ? "VOS" : nombre.toUpperCase()}: ${t.texto}`)
    .join("\n");

  const crudo = await pedirleAGemini(
    `${PERSONA}

Estás conversando con ${nombre} por WhatsApp. Hoy es ${hoyCR}.

SUS PENDIENTES (referite a ellos por su número cuando ejecutes una acción):
${describirAgenda(agenda, hoyCR) || "(no tiene nada pendiente)"}

COLUMNAS DEL TABLERO: ${columnas.join(", ")}

${conversacion ? `LO QUE SE DIJERON ANTES:\n${conversacion}\n` : ""}
MENSAJE NUEVO DE ${nombre.toUpperCase()}: ${mensaje}

Contestale. Si de lo que dice se desprende que hay que actualizar el tablero,
elegí UNA acción; si no, "ninguna". Nunca inventes un número de pendiente que
no esté arriba. Si no estás seguro de a cuál se refiere, no ejecutes nada y
preguntale cuál.

Devolvé JSON exacto:
{"respuesta": "lo que le escribís", "accion": {"tipo": "ninguna"}}
Formas válidas de accion:
  {"tipo":"ninguna"}
  {"tipo":"mover_pieza","item":N,"columna":"nombre exacto de una columna"}
  {"tipo":"marcar_hecho","item":N}
  {"tipo":"reprogramar","item":N,"fecha":"YYYY-MM-DD"}`,
    true
  );

  const respaldo = "Perdón, se me trabó algo de este lado. ¿Me lo repetís?";
  if (!crudo) return { respuesta: respaldo, accion: { tipo: "ninguna" } };

  try {
    const parseado = JSON.parse(crudo) as Partial<RespuestaAgente>;
    const respuesta = typeof parseado.respuesta === "string" && parseado.respuesta.trim() ? parseado.respuesta.trim() : respaldo;
    return { respuesta, accion: validarAccion(parseado.accion, items.length, columnas) };
  } catch {
    console.error("[agente] respuesta del modelo no era JSON:", crudo.slice(0, 200));
    return { respuesta: respaldo, accion: { tipo: "ninguna" } };
  }
}

/**
 * Todo lo que no encaje EXACTO se degrada a "ninguna".
 *
 * Un modelo que devuelve algo raro tiene que terminar en que no pasa nada, no
 * en que pasa cualquier cosa. La verificación de que el ítem es de esa persona
 * se hace aparte, contra la base, antes de escribir.
 */
export function validarAccion(accion: unknown, cantidadItems: number, columnas: string[]): AccionAgente {
  if (!accion || typeof accion !== "object") return { tipo: "ninguna" };
  const a = accion as Record<string, unknown>;

  const item = typeof a.item === "number" ? a.item : Number.NaN;
  const itemValido = Number.isInteger(item) && item >= 1 && item <= cantidadItems;

  if (a.tipo === "mover_pieza" && itemValido && typeof a.columna === "string") {
    const columna = columnas.find((c) => c.toLowerCase() === a.columna!.toString().toLowerCase());
    return columna ? { tipo: "mover_pieza", item, columna } : { tipo: "ninguna" };
  }
  if (a.tipo === "marcar_hecho" && itemValido) {
    return { tipo: "marcar_hecho", item };
  }
  if (a.tipo === "reprogramar" && itemValido && typeof a.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha)) {
    return { tipo: "reprogramar", item, fecha: a.fecha };
  }
  return { tipo: "ninguna" };
}
