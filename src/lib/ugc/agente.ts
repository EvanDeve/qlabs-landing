import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { COSTA_RICA_TZ, diaCR, sumarDias } from "@/lib/ugc/calendar";
import type { ColumnaDelTablero } from "@/lib/ugc/tablero";
import type { ItemDelTablero } from "@/lib/ugc/busqueda";
import {
  type Agenda,
  type AgendaItem,
  type VentanaAgenda,
  itemsDeAgenda,
  resumenDeterminista,
  VENTANA_POR_DEFECTO,
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
  /** Cuánto ve la agenda. Editable desde el panel; ver 20260811120000. */
  ventana: VentanaAgenda;
};

export const AJUSTES_POR_DEFECTO: AjustesAgente = {
  nombre: "McLovin",
  persona: "",
  instrucciones: "",
  responderDesconocidos: false,
  sobreQlabs: "",
  guionPublico: "",
  linkAgenda: "",
  ventana: VENTANA_POR_DEFECTO,
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
    // `*` a propósito, y no la lista de columnas: si el deploy llega antes que
    // la migración 20260811120000, pedir `dias_proximas` por nombre hace fallar
    // la consulta entera y el agente se queda sin persona, sin sobre_qlabs y sin
    // link — o sea, vuelve a fábrica sin que nadie se entere. Con `*` las
    // columnas que todavía no existen simplemente no vienen y caen en su default.
    .select("*")
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
    // `??` y no `||`: la base tiene checks que impiden un 0, pero si la
    // migración 20260811120000 todavía no se aplicó estos vienen undefined y
    // hay que caer en el default, no en un cero que dejaría la agenda vacía.
    ventana: {
      diasProximas: data.dias_proximas ?? VENTANA_POR_DEFECTO.diasProximas,
      diasVencidas: data.dias_vencidas ?? VENTANA_POR_DEFECTO.diasVencidas,
      maxSinFecha: data.max_sin_fecha ?? VENTANA_POR_DEFECTO.maxSinFecha,
    },
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

/**
 * Las tarjetas que se encontraron en el tablero, numeradas DESPUÉS de la agenda.
 *
 * La numeración es una sola lista y por eso arranca en `desde`: el modelo actúa
 * sobre números, y si el 3 significara una cosa en un bloque y otra en el otro,
 * la primera acción caería sobre la tarjeta equivocada.
 *
 * Se dice de quién es cada una porque son de cualquiera —eso es lo nuevo de este
 * bloque— y sin eso el modelo no puede contestar "esa la tiene Daniel".
 */
function describirEncontradas(items: ItemDelTablero[], desde: number, hoyCR: string): string {
  if (!items.length) return "";

  const lineas = items.map((item, i) => {
    const base = lineaDeItem(item, desde + i, hoyCR);
    const donde = item.fecha && item.columna ? ` — en ${item.columna}` : "";
    const quien = item.responsable ? ` — la tiene ${item.responsable}` : " — sin responsable";
    return `${base}${donde}${quien}`;
  });

  return `OTRAS TARJETAS DEL TABLERO QUE CALZAN CON LO QUE PREGUNTÓ (no son de su agenda):
${lineas.join("\n")}`;
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

/**
 * Cuánto se espera a Gemini antes de dar por perdida la respuesta.
 *
 * Sin techo, una llamada colgada se lleva puesta la función entera: el
 * recordatorio de la mañana nunca sale y la conversación se queda muda, en los
 * dos casos sin ningún error visible. Con techo, un cuelgue cae donde ya
 * sabemos caer —el resumen determinista, o el "se me trabó algo de este lado"—
 * que es feo pero llega.
 */
const TIMEOUT_GEMINI_MS = 12_000;

export async function pedirleAGemini(prompt: string, json: boolean): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[agente] falta GEMINI_API_KEY — se usa el texto determinista");
    return null;
  }
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel(
      {
        model: "gemini-2.5-flash",
        ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      },
      { timeout: TIMEOUT_GEMINI_MS }
    );
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

/**
 * Lo que se tocó, dicho con el dato del sistema y no con la prosa del modelo.
 *
 * El 2026-08-03 Daniel leyó "Pura vida." después de que le cerraran la tarjeta
 * equivocada, y el error recién salió a la luz cuando aparecieron dos tarjetas.
 * El modelo puede escribir cualquier cosa —o nada—; esto sale de la acción que
 * de verdad se ejecutó, así que un error se ve en el mismo mensaje.
 *
 * Va SIN paréntesis y escrito como lo escribiría un compañero, porque es el
 * mensaje y no una nota al pie: el paréntesis era la marca de sistema más
 * visible que quedaba. Y el prompt le prohíbe al modelo repetir lo que hizo,
 * así que esta línea no compite con la suya — antes salían las dos, "ya cierro
 * la de X" y abajo "(Listo: di por terminada X)".
 *
 * Devuelve null para las acciones que no tocan el tablero: no hay nada que
 * contar, y una línea de más en cada respuesta es ruido que se deja de leer.
 */
export function describirLoHecho(accion: AccionAgente, items: AgendaItem[]): string | null {
  if (accion.tipo !== "mover_pieza" && accion.tipo !== "marcar_hecho" && accion.tipo !== "reprogramar") {
    return null;
  }
  const item = items[accion.item - 1];
  if (!item) return null;
  const titulo = item.titulo;
  const heroe = item.heroe ? ` — ${item.heroe}` : "";

  if (accion.tipo === "mover_pieza") return `Listo, moví ${titulo} a ${accion.columna}.`;
  // Cerrar se nombra con el Hero: es la única de las tres que saca la tarjeta de
  // la vista, así que este mensaje es la última oportunidad de cazar el error.
  if (accion.tipo === "marcar_hecho") return `Listo, cerré ${titulo}${heroe}.`;
  return `Listo, ${titulo} queda para el ${accion.fecha}.`;
}

/**
 * Un título llevado a su forma comparable: sin acentos, sin mayúsculas y sin
 * espacios de más. Es lo que decide si una pieza que se va a crear ya existe.
 */
export function normalizarTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type TurnoPrevio = { quien: "agente" | "persona"; texto: string };

/**
 * Las columnas agrupadas por carril, para el prompt.
 *
 * El carril no es decoración: el tablero corre tres —guion, video e it— y hay
 * NOMBRES REPETIDOS entre ellos. Hoy existen dos columnas llamadas "Terminado",
 * una de video y otra de it, así que "pasalo a Terminado" sin el carril a la
 * vista es una instrucción que el modelo resuelve al azar.
 *
 * La ambigüedad igual se termina de cerrar al escribir —ver columnaDestino() en
 * tablero.ts—. Esto es para que el modelo no proponga el disparate de entrada.
 */
function describirColumnas(columnas: ColumnaDelTablero[]): string {
  const porCarril = new Map<string, string[]>();
  for (const c of columnas) {
    porCarril.set(c.section, [...(porCarril.get(c.section) ?? []), c.name]);
  }
  return [...porCarril.entries()].map(([carril, nombres]) => `- ${carril}: ${nombres.join(", ")}`).join("\n");
}

/**
 * Lo que la persona todavía puede confirmar con un "dale": crear algo nuevo.
 *
 * Es el único caso que pregunta antes, y no por ser peligroso sino porque un
 * compañero hace lo mismo: cuando le dictás una tarjeta, repite lo que entendió
 * —título, cliente, fecha— antes de anotarla. Todo lo demás cae sobre algo que
 * ya existe y se hace de una.
 *
 * Cerrar preguntaba, y se le sacó el 2026-08-18 a pedido de Evan: pedirle
 * permiso a alguien que acaba de decirte que ya terminó el video es lo más
 * parecido a un bot que quedaba. Lo que protege ahora es la línea de "qué
 * toqué", que nombra la tarjeta y su Hero en el mismo mensaje.
 */
export type Pendiente = { tipo: "crear"; pieza: PropuestaPieza };

/** Cuánto vive una propuesta sin contestar. Ver esValidaParaConfirmar(). */
export const PROPUESTA_VIGENCIA_MS = 30 * 60 * 1000;

export async function responderMensaje(opciones: {
  nombre: string;
  agenda: Agenda;
  /** Todas las columnas del tablero, con su carril. Ver ColumnaDelTablero. */
  columnas: ColumnaDelTablero[];
  /** Nombres de agency_clients. Sin esto el agente no puede proponer piezas. */
  clientes: string[];
  /**
   * Tarjetas del tablero que calzan con lo que preguntó y NO están en su agenda.
   * Ver busqueda.ts: es lo que le deja hablar de las 141 y no de un puñado.
   */
  encontradas?: ItemDelTablero[];
  historial: TurnoPrevio[];
  mensaje: string;
  /** Lo que quedó esperando un "dale" de esta persona, si hay algo. */
  pendiente: Pendiente | null;
  /**
   * El estado de la agencia, ya redactado. Solo para directores: es el único
   * rol que puede ver el trabajo de los demás. Null para todo el resto, y esa
   * ausencia es el permiso — si el bloque no está en el prompt, no hay dato que
   * el modelo pueda soltar por más que se lo pidan.
   */
  reporte?: string | null;
  ajustes?: AjustesAgente;
  now?: Date;
}): Promise<RespuestaAgente> {
  const { nombre, agenda, columnas, clientes, historial, mensaje, pendiente } = opciones;
  const encontradas = opciones.encontradas ?? [];
  const reporte = opciones.reporte ?? null;
  const ajustes = opciones.ajustes ?? AJUSTES_POR_DEFECTO;
  const now = opciones.now ?? new Date();
  const hoyCR = formatInTimeZone(now, COSTA_RICA_TZ, "yyyy-MM-dd");
  // Una sola lista numerada: primero la agenda, después lo encontrado. El orden
  // tiene que ser EXACTAMENTE el mismo con el que se valida la acción, o el
  // número 12 sería una tarjeta en el prompt y otra al escribir.
  const items = [...itemsDeAgenda(agenda), ...encontradas];

  const conversacion = historial
    .map((t) => `${t.quien === "agente" ? "VOS" : nombre.toUpperCase()}: ${t.texto}`)
    .join("\n");

  const comoSeContesta = `Si en su mensaje acepta, usá {"tipo":"confirmar"}. Si dice que no o cambia de
tema, {"tipo":"descartar"}. Si solo pregunta algo, contestá con
{"tipo":"ninguna"} y sigue en pie.`;

  const bloquePendiente = !pendiente
    ? ""
    : `LE PROPUSISTE ESTO Y ESTÁS ESPERANDO QUE TE DIGA SÍ O NO:
${describirPropuesta(pendiente.pieza, hoyCR)} (fecha exacta: ${pendiente.pieza.fecha})
${comoSeContesta} Si pide cambiarle algo, proponé de nuevo con los datos corregidos.`;

  const crudo = await pedirleAGemini(
    `${armarPersona(ajustes)}

Estás conversando con ${nombre} por WhatsApp. Hoy es ${hoyCR}.

SUS PENDIENTES (referite a ellos por su número cuando ejecutes una acción):
${describirAgenda(agenda, hoyCR) || "(no tiene nada pendiente)"}

${describirEncontradas(encontradas, itemsDeAgenda(agenda).length, hoyCR)}

${
  reporte
    ? `SOS DIRECTOR, ASÍ QUE TAMBIÉN VES ESTO — EL ESTADO DE TODA LA AGENCIA:
${reporte}

Con esto contestás por el estado general, por un Hero o por una persona. Tres
reglas: contestá SOLO lo que te preguntó —nadie pidió el reporte entero—, usá
los números tal cual están acá sin recalcular nada, y si te pregunta por alguien
del equipo hablá de las piezas, no de la persona: "a Daniel le quedan 4
atrasadas" y nunca "Daniel va atrasado". Si te pide algo que no está en este
bloque, decilo en vez de estimarlo.

`
    : ""
}COLUMNAS DEL TABLERO, por carril:
${describirColumnas(columnas)}

Una tarjeta solo se mueve entre columnas de SU MISMO carril: un video no va a una
columna de guiones por más que el nombre suene parecido. Hay nombres repetidos
entre carriles, así que mirá en cuál está parada la tarjeta antes de elegir a
dónde la mandás. Si te piden moverla a una columna de otro carril, decíselo en
vez de hacerlo.

CLIENTES DE LA AGENCIA: ${clientes.length ? clientes.join(", ") : "(ninguno cargado)"}

${conversacion ? `LO QUE SE DIJERON ANTES:\n${conversacion}\n` : ""}${bloquePendiente ? `${bloquePendiente}\n\n` : ""}MENSAJE NUEVO DE ${nombre.toUpperCase()}: ${mensaje}

Contestale. Si de lo que dice se desprende que hay que tocar el tablero o el
calendario, elegí UNA acción; si no, "ninguna". Nunca inventes un número de
pendiente que no esté arriba. Si no estás seguro de a cuál se refiere, no
ejecutes nada y preguntale.

Lo que te salió mal antes en esta conversación puede andar ahora: el tablero lo
tocan varias personas y su configuración cambia durante el día. NUNCA te niegues
a hacer algo porque más arriba te falló, ni repitas de memoria el motivo de
aquella vez. Intentalo igual: vos no sabés si se puede, lo sabe el sistema al
ejecutar, y si vuelve a fallar el motivo se escribe solo.

Si te PIDE lo que hay —"qué tengo", "qué viene", "qué hay para los próximos
días", "todo lo de Dulce Chilena"— enumerá TODAS las que calzan, una por línea,
cada una con su cliente y su fecha. No resumas, no mandes solo el conteo y no
cierres con "y algunas más": si pregunta qué hay, quiere saber qué hay, y una
que no nombraste es una que nadie va a hacer. Esta es la única excepción a
escribir corto — numerar así no es una lista con viñetas, que sigue prohibida.

SU AGENDA llega ${agenda.ventana.diasVencidas} días para atrás y ${agenda.ventana.diasProximas} para adelante. El bloque de OTRAS
TARJETAS no tiene esa ventana: son las del tablero entero que calzan con lo que
te preguntó, de cualquier fecha y de cualquiera del equipo. Úsalas para contestar
—en qué columna está algo, qué le queda a un Hero, quién lo tiene—.

Ese bloque se arma con lo que menciona su mensaje, así que puede no traer todo lo
que existe: si te pide una lista completa de algo que no calza con lo que ves,
contestá lo que sí tenés y decile que mire el tablero. Nunca des por completa una
lista que no pudiste mirar entera, y nunca inventes una tarjeta que no esté
arriba.

Los ítems marcados SIN FECHA son trabajo suyo que nadie fechó. No están
atrasados: no los trates como tales. Si te dice cuándo va uno, ponele la fecha
con "reprogramar". Si la lista dice que hay más sin fecha de las que ves, decí
el total, no inventes los nombres que faltan.

Con "tipo":"publicar" anotás un video en el tablero; con "tipo":"grabar" anotás
una jornada de grabación en el calendario. Las grabaciones se planean una vez al
mes para varios videos a la vez, así que no son una tarjeta del tablero.

Si te dice que ya terminó algo, cerralo de una con "marcar_hecho". No le pidas
que te lo confirme: acaba de decírtelo. Pero tiene que quedar clarísimo CUÁL
cerraste, y de eso se encarga el sistema.

NUNCA cuentes en tu texto lo que acabás de hacer —"ya la moví", "la cierro",
"queda para el viernes"—. Esa línea la escribe el sistema debajo de la tuya, con
lo que de verdad pasó, y si la decís vos salen las dos diciendo lo mismo. Vos
contestá lo que te preguntó, o no digas nada si no hay nada que contestar: un
"dale" tuyo alcanza.

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
        // Solo los nombres: acá se valida que la columna EXISTA en algún lado.
        // Cuál de las repetidas es —y si es del carril correcto— lo decide
        // columnaDestino() al escribir, que es la única que sabe dónde está
        // parada la tarjeta.
        columnas: columnas.map((c) => c.name),
        clientes,
        hoyCR,
        hayPendiente: pendiente !== null,
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
  hayPendiente: boolean;
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
  if ((a.tipo === "confirmar" || a.tipo === "descartar") && ctx.hayPendiente) {
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
