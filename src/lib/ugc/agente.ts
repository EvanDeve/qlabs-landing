import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { COSTA_RICA_TZ, diaCR, sumarDias } from "@/lib/ugc/calendar";
import {
  type Agenda,
  type AgendaItem,
  itemsDeAgenda,
  resumenDeterminista,
  DIAS_PROXIMAS,
  DIAS_VENCIDAS,
} from "@/lib/ugc/agenda";

/**
 * La voz del agente.
 *
 * El pedido explícito de Evan fue que no se sienta un bot. Eso no se logra
 * pidiéndole al modelo "sé natural" —eso produce simpatía impostada, que es
 * peor— sino prohibiéndole las marcas concretas que delatan a un sistema
 * automático: el saludo protocolar, el listado con viñetas, el "te recuerdo
 * que", la firma. Un compañero de trabajo escribiendo desde el celular no hace
 * nada de eso.
 *
 * Este texto es el DEFAULT, no la última palabra: se puede reescribir desde
 * /ugc/admin/mclovin sin tocar código. Lo que no se puede reescribir desde ahí
 * son las REGLAS_FIJAS de abajo.
 */
export const PERSONA_SEED = `
Sos parte del equipo de Q Labs, una agencia de contenido en Costa Rica. Le
escribís por WhatsApp a un compañero sobre lo que tiene pendiente.

CÓMO ESCRIBÍS
- Español de Costa Rica, voseo: "tenés", "acordate", "pasámelo", "dale".
- Como le escribe un compañero a otro, no como un sistema. Directo y corto.
- Nombrás las cosas por su nombre: la pieza y el cliente, no "tenés 2 tareas".

LO QUE NUNCA HACÉS
- Presentarte sin que te pregunten, saludar de forma protocolar ni firmar.
- Decir "te recuerdo que", "este es un recordatorio automático", "según el sistema".
- Listas con viñetas, guiones al principio de línea, negritas ni emojis decorativos.
`.trim();

/**
 * Lo que NO se edita desde el panel.
 *
 * La separación importa: la personalidad es preferencia y cambia con el humor
 * del equipo; esto de acá es lo que hace que el agente no mienta. Si viviera en
 * la columna editable, un admin podría borrarlo sin darse cuenta de que junto
 * con el tono se llevó puesta la prohibición de inventar clientes.
 *
 * Ojo: esto es la última línea blanda, no la garantía. La garantía real es que
 * validarAccion() y la revalidación contra la base son código — el prompt puede
 * fallar y aun así el agente no puede escribir algo que no corresponda.
 */
const REGLAS_FIJAS = `
REGLAS QUE NO SE NEGOCIAN
- Nunca inventes pendientes, fechas, clientes ni personas que no estén en los datos que te paso.
- Nunca prometas que vos vas a hacer el trabajo. Lo señalás, no lo hacés.
- Si no entendés a qué se refiere, preguntá. Nunca adivines para salir del paso.
`.trim();

export type AjustesAgente = {
  nombre: string;
  /** Vacío = usar PERSONA_SEED. Ver la migración 20260802000000. */
  persona: string;
  instrucciones: string;
  /** Si contestarle a quien escriba sin ser del equipo. Apagado por default. */
  responderDesconocidos: boolean;
  /** Vacío = no contestar afuera aunque el switch esté prendido. */
  sobreQlabs: string;
  /** Cómo lleva la conversación con alguien de afuera. */
  guionPublico: string;
  /** Dónde agenda la persona (Calendly). Vacío = no ofrece agenda. */
  linkAgenda: string;
};

export const AJUSTES_POR_DEFECTO: AjustesAgente = {
  nombre: "McLovin",
  persona: "",
  instrucciones: "",
  responderDesconocidos: false,
  sobreQlabs: "",
  guionPublico: "",
  linkAgenda: "",
};

/**
 * Los ajustes con los que habla el agente.
 *
 * Si la lectura falla, sale con los defaults en vez de tirar: que el panel esté
 * caído no puede ser motivo de que a nadie le llegue su recordatorio.
 */
export async function getAjustesAgente(supabase: SupabaseClient<Database>): Promise<AjustesAgente> {
  const { data, error } = await supabase
    .from("agent_settings")
    .select("nombre, persona, instrucciones, responder_desconocidos, sobre_qlabs, guion_publico, link_agenda")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[agente] no se pudieron leer los ajustes:", error.message);
    return AJUSTES_POR_DEFECTO;
  }
  return {
    nombre: data.nombre,
    persona: data.persona,
    instrucciones: data.instrucciones,
    // Si la lectura falla se cae en AJUSTES_POR_DEFECTO, donde esto es false:
    // que un error de base termine en el agente hablándole a desconocidos sería
    // exactamente el fallo que no queremos.
    responderDesconocidos: data.responder_desconocidos,
    sobreQlabs: data.sobre_qlabs,
    guionPublico: data.guion_publico,
    linkAgenda: data.link_agenda,
  };
}

/**
 * Núcleo fijo + capa editable, en ese orden.
 *
 * Se exporta para que el panel pueda mostrar el prompt tal cual: editar el
 * cerebro a ciegas es adivinar.
 */
export function armarPersona(ajustes: AjustesAgente): string {
  const persona = ajustes.persona.trim() || PERSONA_SEED;
  const extra = ajustes.instrucciones.trim();

  return [
    `Te llamás ${ajustes.nombre}.`,
    persona,
    extra ? `INSTRUCCIONES DEL EQUIPO\n${extra}` : "",
    REGLAS_FIJAS,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Un ítem tal como se lo mostramos al modelo: con número, nunca con UUID. */
function lineaDeItem(item: AgendaItem, indice: number, hoyCR: string): string {
  const heroe = item.heroe ? ` — ${item.heroe}` : "";
  const prioridad = item.prioridad === "alta" ? " [prioridad alta]" : "";

  // Sin fecha no hay verbo ni día: es una tarjeta parada en una columna. Se
  // dice así, porque decir "Publicar X — sin fecha" le sugiere al modelo un
  // compromiso que nadie tomó.
  if (!item.fecha) {
    const donde = item.columna ? ` — en ${item.columna}` : "";
    return `${indice + 1}. "${item.titulo}"${heroe}${donde} — SIN FECHA${prioridad}`;
  }

  const dia = diaCR(item.fecha);
  // La hora solo si el ítem la tiene de verdad (un evento). Una pieza se
  // publica "el 1 de agosto" y no a una hora: si le pasáramos una inventada,
  // el modelo la repetiría en el mensaje como si alguien la hubiera puesto.
  const hora = item.conHora ? ` ${formatInTimeZone(new Date(item.fecha), COSTA_RICA_TZ, "HH:mm")}` : "";
  const cuando = dia === hoyCR ? `hoy${hora}` : `${dia}${hora}`;

  // La marca de riesgo dice el ESTADO, no la fecha: el bloque (ATRASADO / HOY /
  // PRÓXIMOS DÍAS) ya dice cuándo. Sin ella, "Publicar X — 5 ago" se lee igual
  // esté el video listo o sin editar, que es justo lo que había que separar.
  const riesgo = item.enRiesgo
    ? ` ⚠ SIN TERMINAR — sigue en "${item.columna ?? "el tablero"}"`
    : "";

  return `${indice + 1}. ${item.accion} "${item.titulo}"${heroe} — ${cuando}${prioridad}${riesgo}`;
}

function describirAgenda(agenda: Agenda, hoyCR: string): string {
  const items = itemsDeAgenda(agenda);
  const enBloque = (titulo: string, lista: AgendaItem[]) =>
    lista.length ? `${titulo}:\n${lista.map((i) => lineaDeItem(i, items.indexOf(i), hoyCR)).join("\n")}` : "";

  // El aviso del recorte va pegado al bloque: si se omite, el modelo lee cinco
  // ítems y contesta "tenés cinco cosas", que es falso.
  const sinFecha = enBloque("SIN FECHA (trabajo asignado que nadie fechó)", agenda.sinFecha);
  const conOmitidas =
    sinFecha && agenda.sinFechaOmitidas > 0
      ? `${sinFecha}\n(y ${agenda.sinFechaOmitidas} más sin fecha que no se listan acá)`
      : sinFecha;

  return [
    enBloque("ATRASADO", agenda.vencidas),
    enBloque("HOY", agenda.hoy),
    enBloque("PRÓXIMOS DÍAS", agenda.proximas),
    conOmitidas,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function pedirleAGemini(prompt: string, json: boolean): Promise<string | null> {
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
  now: Date = new Date(),
  ajustes: AjustesAgente = AJUSTES_POR_DEFECTO
): Promise<string> {
  const hoyCR = formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd");

  const formato = libre
    ? "Podés usar 2 o 3 líneas cortas si ayuda a que se lea rápido."
    : "TIENE QUE SER UNA SOLA LÍNEA, sin ningún salto de línea. Máximo 400 caracteres.";

  const texto = await pedirleAGemini(
    `${armarPersona(ajustes)}

Le escribís a ${nombre}. Hoy es ${hoyCR}.

ESTO ES LO QUE TIENE PENDIENTE:
${describirAgenda(agenda, hoyCR)}

Escribile un mensaje corto. Arrancá por lo atrasado si hay algo atrasado.
Los ítems marcados con ⚠ SIN TERMINAR son los más importantes después de lo
atrasado: la fecha de publicación está encima y el video todavía está en esa
columna. Nombralos diciendo en qué columna siguen, para que se entienda qué
falta. Si no hay ninguno, no menciones el tema — no inventes urgencia.
Lo de SIN FECHA va al final y en bloque ("tenés N sin fecha"), nunca uno por
uno: no está atrasado, solo falta decidir cuándo. Si es lo ÚNICO que tiene,
preguntale para cuándo lo deja.
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

/** Los datos de una pieza a crear, tal como se los mostramos a la persona. */
export type PropuestaPieza = {
  titulo: string;
  /** Nombre EXACTO de un agency_clients. El id lo resuelve el webhook. */
  cliente: string;
  /** YYYY-MM-DD. */
  fecha: string;
  tipo: "grabar" | "publicar";
};

/**
 * Lo que el agente puede hacer, y nada más.
 *
 * `item` es el NÚMERO que se le mostró al modelo, no un UUID. Es deliberado:
 * un modelo que nunca ve un identificador real no puede inventar uno, así que
 * la acción siempre cae sobre algo que estaba de verdad en la agenda de esa
 * persona. El mapeo de vuelta a ids lo hace el webhook.
 *
 * Crear es el caso distinto y por eso son TRES acciones y no una. Las otras
 * cuatro caen sobre algo que ya existía; crear inventa una fila nueva a partir
 * de texto que el modelo entendió de oído. El agente solo puede PROPONER; la
 * escritura la desbloquea un `confirmar` en un turno posterior, y usa los datos
 * guardados en wa_agent_actions, no los que el modelo repita.
 */
export type AccionAgente =
  | { tipo: "ninguna" }
  | { tipo: "mover_pieza"; item: number; columna: string }
  | { tipo: "marcar_hecho"; item: number }
  | { tipo: "reprogramar"; item: number; fecha: string }
  | { tipo: "proponer_pieza"; pieza: PropuestaPieza }
  | { tipo: "confirmar" }
  | { tipo: "descartar" };

export type RespuestaAgente = { respuesta: string; accion: AccionAgente };

export type TurnoPrevio = { quien: "agente" | "persona"; texto: string };

/** Cuánto vive una propuesta sin contestar. Ver esValidaParaConfirmar(). */
export const PROPUESTA_VIGENCIA_MS = 30 * 60 * 1000;

export async function responderMensaje(opciones: {
  nombre: string;
  agenda: Agenda;
  columnas: string[];
  /** Nombres de agency_clients. Sin esto el agente no puede proponer piezas. */
  clientes: string[];
  historial: TurnoPrevio[];
  mensaje: string;
  /** La propuesta viva de esta persona, si hay alguna. */
  propuesta: PropuestaPieza | null;
  ajustes?: AjustesAgente;
  now?: Date;
}): Promise<RespuestaAgente> {
  const { nombre, agenda, columnas, clientes, historial, mensaje, propuesta } = opciones;
  const ajustes = opciones.ajustes ?? AJUSTES_POR_DEFECTO;
  const now = opciones.now ?? new Date();
  const hoyCR = formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd");
  const items = itemsDeAgenda(agenda);

  const conversacion = historial
    .map((t) => `${t.quien === "agente" ? "VOS" : nombre.toUpperCase()}: ${t.texto}`)
    .join("\n");

  const bloquePropuesta = propuesta
    ? `LE PROPUSISTE ESTO Y ESTÁS ESPERANDO QUE TE DIGA SÍ O NO:
${describirPropuesta(propuesta, hoyCR)} (fecha exacta: ${propuesta.fecha})
Si en su mensaje acepta, usá {"tipo":"confirmar"}. Si dice que no o cambia de
tema, {"tipo":"descartar"}. Si pide cambiarle algo, proponé de nuevo con los
datos corregidos. Si solo pregunta algo, contestá con {"tipo":"ninguna"} y la
propuesta sigue en pie.`
    : "";

  const crudo = await pedirleAGemini(
    `${armarPersona(ajustes)}

Estás conversando con ${nombre} por WhatsApp. Hoy es ${hoyCR}.

SUS PENDIENTES (referite a ellos por su número cuando ejecutes una acción):
${describirAgenda(agenda, hoyCR) || "(no tiene nada pendiente)"}

COLUMNAS DEL TABLERO: ${columnas.join(", ")}

CLIENTES DE LA AGENCIA: ${clientes.length ? clientes.join(", ") : "(ninguno cargado)"}

${conversacion ? `LO QUE SE DIJERON ANTES:\n${conversacion}\n` : ""}${bloquePropuesta ? `${bloquePropuesta}\n\n` : ""}MENSAJE NUEVO DE ${nombre.toUpperCase()}: ${mensaje}

Contestale. Si de lo que dice se desprende que hay que tocar el tablero o el
calendario, elegí UNA acción; si no, "ninguna". Nunca inventes un número de
pendiente que no esté arriba. Si no estás seguro de a cuál se refiere, no
ejecutes nada y preguntale.

Si te PIDE lo que hay —"qué tengo", "qué viene", "qué hay para los próximos
días", "todo lo de Dulce Chilena"— enumerá TODAS las que calzan, una por línea,
cada una con su cliente y su fecha. No resumas, no mandes solo el conteo y no
cierres con "y algunas más": si pregunta qué hay, quiere saber qué hay, y una
que no nombraste es una que nadie va a hacer. Esta es la única excepción a
escribir corto — numerar así no es una lista con viñetas, que sigue prohibida.

Solo ves ${DIAS_VENCIDAS} días para atrás y ${DIAS_PROXIMAS} para adelante. Si te
pregunta por algo fuera de esa ventana, contestá lo que sí ves y decile hasta
dónde llegás. Nunca des por completa una lista que no pudiste mirar entera.

Los ítems marcados SIN FECHA son trabajo suyo que nadie fechó. No están
atrasados: no los trates como tales. Si te dice cuándo va uno, ponele la fecha
con "reprogramar". Si la lista dice que hay más sin fecha de las que ves, decí
el total, no inventes los nombres que faltan.

Con "tipo":"publicar" anotás un video en el tablero; con "tipo":"grabar" anotás
una jornada de grabación en el calendario. Las grabaciones se planean una vez al
mes para varios videos a la vez, así que no son una tarjeta del tablero.

Si te pide anotar algo nuevo, NO lo creás en el acto: proponelo con
"proponer_pieza" y escribile una línea corta preguntándole si va así. NO repitas
el título, el cliente ni la fecha en tu texto: esos los agrega el sistema debajo
de tu mensaje, tal cual van a quedar guardados. El cliente tiene que ser uno de
la lista de arriba, escrito igual; si no te dijo cuál, preguntale en vez de
elegir vos.

Devolvé JSON exacto:
{"respuesta": "lo que le escribís", "accion": {"tipo": "ninguna"}}
Formas válidas de accion:
  {"tipo":"ninguna"}
  {"tipo":"mover_pieza","item":N,"columna":"nombre exacto de una columna"}
  {"tipo":"marcar_hecho","item":N}
  {"tipo":"reprogramar","item":N,"fecha":"YYYY-MM-DD"}
  {"tipo":"proponer_pieza","pieza":{"titulo":"...","cliente":"nombre exacto","fecha":"YYYY-MM-DD","tipo":"grabar"|"publicar"}}
  {"tipo":"confirmar"}
  {"tipo":"descartar"}`,
    true
  );

  const respaldo = "Perdón, se me trabó algo de este lado. ¿Me lo repetís?";
  if (!crudo) return { respuesta: respaldo, accion: { tipo: "ninguna" } };

  try {
    const parseado = JSON.parse(crudo) as Partial<RespuestaAgente>;
    const respuesta =
      typeof parseado.respuesta === "string" && parseado.respuesta.trim() ? parseado.respuesta.trim() : respaldo;
    return {
      respuesta,
      accion: validarAccion(parseado.accion, {
        cantidadItems: items.length,
        columnas,
        clientes,
        hoyCR,
        hayPropuesta: propuesta !== null,
      }),
    };
  } catch {
    console.error("[agente] respuesta del modelo no era JSON:", crudo.slice(0, 200));
    return { respuesta: respaldo, accion: { tipo: "ninguna" } };
  }
}

/**
 * Cómo se le muestra una propuesta a la persona antes de que la confirme.
 *
 * Esta línea la agrega el webhook al mensaje del agente en vez de dejar que el
 * modelo repita los datos en su prosa, y no es un capricho de formato: es lo
 * único que garantiza que lo que la persona lee sea lo que se va a guardar. Si
 * el modelo escribiera "el jueves" de su lado mientras el JSON dice otra fecha,
 * la confirmación no confirmaría nada.
 */
export function describirPropuesta(pieza: PropuestaPieza, hoyCR?: string): string {
  const [anio, mes, dia] = pieza.fecha.split("-").map(Number);
  // Se formatea en UTC sobre una fecha armada a mano: acá ya no queda zona
  // horaria que resolver, es un día literal. Mismo criterio que diaCorto().
  const cuando = new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    // El año solo cuando no es el corriente: en el 99% de los casos sobra, y
    // cuando alguien agenda para enero del año que viene importa muchísimo.
    ...(hoyCR && hoyCR.slice(0, 4) !== String(anio) ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });

  return `${pieza.tipo === "grabar" ? "Grabar" : "Publicar"} “${pieza.titulo}” · ${pieza.cliente} · ${cuando}`;
}

export type ContextoValidacion = {
  cantidadItems: number;
  columnas: string[];
  clientes: string[];
  /** Hoy en Costa Rica, 'yyyy-MM-dd'. Ancla el rango de fechas aceptables. */
  hoyCR: string;
  hayPropuesta: boolean;
};

/** Hasta cuánto en el futuro se puede agendar algo nuevo. */
const DIAS_FUTURO_MAX = 365;
/** Y cuánto para atrás: anotar algo de la semana pasada pasa, de 2024 no. */
const DIAS_PASADO_MAX = 7;

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Todo lo que no encaje EXACTO se degrada a "ninguna".
 *
 * Un modelo que devuelve algo raro tiene que terminar en que no pasa nada, no
 * en que pasa cualquier cosa. La verificación de que el ítem es de esa persona
 * se hace aparte, contra la base, antes de escribir.
 */
export function validarAccion(accion: unknown, ctx: ContextoValidacion): AccionAgente {
  if (!accion || typeof accion !== "object") return { tipo: "ninguna" };
  const a = accion as Record<string, unknown>;

  const item = typeof a.item === "number" ? a.item : Number.NaN;
  const itemValido = Number.isInteger(item) && item >= 1 && item <= ctx.cantidadItems;

  if (a.tipo === "mover_pieza" && itemValido && typeof a.columna === "string") {
    const columna = ctx.columnas.find((c) => c.toLowerCase() === (a.columna as string).toLowerCase());
    return columna ? { tipo: "mover_pieza", item, columna } : { tipo: "ninguna" };
  }
  if (a.tipo === "marcar_hecho" && itemValido) {
    return { tipo: "marcar_hecho", item };
  }
  if (a.tipo === "reprogramar" && itemValido && typeof a.fecha === "string" && FORMATO_DIA.test(a.fecha)) {
    return { tipo: "reprogramar", item, fecha: a.fecha };
  }

  // Confirmar y descartar solo existen si hay algo que confirmar o descartar.
  // Sin este candado, un "dale" suelto un rato después de que la propuesta se
  // venció le haría creer al modelo que creó algo — y la respuesta saldría
  // diciéndolo.
  if ((a.tipo === "confirmar" || a.tipo === "descartar") && ctx.hayPropuesta) {
    return { tipo: a.tipo };
  }

  if (a.tipo === "proponer_pieza") {
    const pieza = validarPropuesta(a.pieza, ctx);
    return pieza ? { tipo: "proponer_pieza", pieza } : { tipo: "ninguna" };
  }

  return { tipo: "ninguna" };
}

/**
 * Los datos de una pieza nueva, que es lo único que el modelo escribe de cero.
 *
 * El cliente se resuelve contra la lista real y se devuelve con la grafía de la
 * base: el modelo escribe "kosta asiatika" y lo que se guarda es el nombre tal
 * cual está cargado. Si no matchea nada, no hay propuesta — es preferible que
 * pregunte a que la pieza le caiga al cliente equivocado.
 */
function validarPropuesta(valor: unknown, ctx: ContextoValidacion): PropuestaPieza | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Record<string, unknown>;

  const titulo = typeof p.titulo === "string" ? p.titulo.trim() : "";
  if (titulo.length < 3 || titulo.length > 120) return null;

  if (typeof p.cliente !== "string") return null;
  const cliente = resolverCliente(p.cliente, ctx.clientes);
  if (!cliente) return null;

  if (typeof p.fecha !== "string" || !FORMATO_DIA.test(p.fecha)) return null;
  if (!fechaEnRango(p.fecha, ctx.hoyCR)) return null;

  if (p.tipo !== "grabar" && p.tipo !== "publicar") return null;

  return { titulo, cliente, fecha: p.fecha, tipo: p.tipo };
}

/** Sin tildes, sin mayúsculas, sin espacios de más. Para comparar, nunca para guardar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * De cómo alguien nombra un cliente al nombre con el que está cargado.
 *
 * El match exacto no alcanza contra los datos reales: en la base están "Zonna
 * Gastrobar", "La Árboleda" y "Entrecote", y nadie escribe eso por WhatsApp —
 * escribe "Zonna", "la arboleda", "entrecot". Con match exacto el agente
 * preguntaría cuál cliente es en casi todos los mensajes útiles.
 *
 * Por eso hay un segundo intento por coincidencia parcial, pero SOLO si deja un
 * único candidato. Con "la" hay tres (Árboleda, Bontá, Maremmana) y devuelve
 * null: preferimos que pregunte a que elija. La ambigüedad tiene que terminar en
 * una pregunta, nunca en una pieza cargada al cliente equivocado.
 */
export function resolverCliente(entrada: string, clientes: string[]): string | null {
  const buscado = normalizar(entrada);
  if (!buscado) return null;

  const exacto = clientes.find((c) => normalizar(c) === buscado);
  if (exacto) return exacto;

  const candidatos = clientes.filter((c) => {
    const nombre = normalizar(c);
    return nombre.includes(buscado) || buscado.includes(nombre);
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Rango razonable para algo que se agenda.
 *
 * Compara días de Costa Rica como texto —en 'yyyy-MM-dd' el orden alfabético es
 * el cronológico— para no volver a pisar la trampa de convertir un día suelto
 * en un instante. Ver la migración 20260801000000.
 */
export function fechaEnRango(fecha: string, hoyCR: string): boolean {
  // El mediodía UTC como ancla, no la medianoche: desde ahí sumar y restar días
  // nunca cruza un borde de zona horaria por accidente.
  const anclaje = new Date(`${hoyCR}T12:00:00Z`);
  return (
    fecha >= diaCR(sumarDias(anclaje, -DIAS_PASADO_MAX)) && fecha <= diaCR(sumarDias(anclaje, DIAS_FUTURO_MAX))
  );
}

/** ¿La propuesta sigue viva? Una de hace tres horas ya no la contesta un "dale". */
export function esValidaParaConfirmar(creadaEn: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(creadaEn).getTime() < PROPUESTA_VIGENCIA_MS;
}
