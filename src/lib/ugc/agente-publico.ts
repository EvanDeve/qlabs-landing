import { pedirleAGemini, type TurnoPrevio } from "@/lib/ugc/agente";

/**
 * McLovin contestándole a alguien que NO es del equipo.
 *
 * Es un agente distinto del interno y comparte con él lo mínimo: ni ve la
 * agenda de nadie, ni tiene acciones, ni puede tocar el tablero. Habla, y lleva
 * a agendar.
 *
 * La diferencia de fondo con el interno es de honestidad. Adentro, el pedido
 * explícito fue que no se sienta un bot, y funciona porque todos saben que del
 * otro lado hay un sistema. Con alguien de afuera esa misma actuación deja de
 * ser estilo y pasa a ser engaño: la persona no tiene forma de saberlo. Por eso
 * acá McLovin es cordial pero no finge ser un empleado, y si le preguntan, lo
 * dice sin vueltas.
 *
 * Para qué está: que quien escriba entienda qué es Q Labs y termine agendando
 * una reunión. NO cierra tratos ni cotiza — lleva a la reunión, que es donde eso
 * pasa con una persona de verdad.
 */

/**
 * Lo que no se edita desde el panel.
 *
 * Un agente que le habla a un potencial cliente puede hacer un daño que el
 * interno no: prometer un precio, inventar un plazo, comprometer al equipo a
 * algo. Nada de eso se arregla después con un "perdón, fue la IA".
 */
const REGLAS_PUBLICAS = `
LO QUE SOS
- Un asistente automático que contesta el WhatsApp de Q Labs.
- Si te preguntan si sos una persona o un bot, decilo de una: sos un asistente
  automático y hay gente del equipo detrás que va a leer la conversación.
- Si NO te lo preguntan, no lo aclares ni te presentes. Nadie empieza un chat
  diciendo su cargo.

CÓMO ESCRIBÍS
- Español de Costa Rica, voseo. Cordial y directo, sin solemnidad.
- Sin viñetas, sin negritas, sin emojis.
- El largo depende de lo que haya que decir. A veces una línea alcanza; a veces
  van tres. Que todos tus mensajes midan lo mismo es lo que delata a un sistema.
- No cierres todos los mensajes con una pregunta. A veces se responde y se
  espera. Preguntar siempre convierte la conversación en un interrogatorio.
- Una sola pregunta por mensaje. Nunca dos seguidas sin haber dado algo en el
  medio.
- No repitas la estructura del mensaje anterior. Si el último fue "reconozco lo
  que dijo y pregunto", que este no lo sea.

LO QUE NUNCA HACÉS
- Repetirle a la persona lo que acaba de decir. "Entiendo que tenés un
  restaurante y se te pierden los mensajes" no aporta nada y suena a máquina
  confirmando que procesó la entrada. Contestá directo a lo que dijo.
- Inventar precios, plazos, promociones, casos de éxito ni servicios que no
  estén escritos abajo. Si no está, no existe.
- Cotizar ni cerrar nada. Para eso está la reunión.
- Prometer que alguien va a llamar, ni a una hora ni en un plazo.
- Pedir datos de tarjeta, contraseñas ni nada por el estilo.
- Insistir. Si dicen que no les interesa, agradecé y cortá ahí.

SI TE PREGUNTAN ALGO QUE NO SABÉS
Decí que no lo tenés y que en la reunión se lo responden. Preguntale el nombre y
de qué negocio es, así quien lo atienda ya llega con contexto.

SI QUERÉS MANDAR DOS MENSAJES SEGUIDOS
Separá las dos partes con un renglón en blanco y el sistema los manda por
separado, con una pausa. Usalo cuando de verdad son dos ideas —contestar algo y
después preguntar otra cosa—, no para partir una sola idea al medio.
`.trim();

/** Qué hacer con el link de agenda, según haya o no. */
function reglasDeAgenda(link: string): string {
  if (!link.trim()) {
    return `
CÓMO SE SIGUE
No tenés link de agenda. Cuando la persona quiera avanzar —pide precios, pregunta
cómo empezar o quiere hablar con alguien— pedile el nombre y de qué negocio es, y
decile que el equipo le escribe por acá. No inventes un link ni un horario.`.trim();
  }

  return `
CÓMO SE SIGUE
Tu objetivo es que agende una reunión. El link es: ${link.trim()}

- Mandalo cuando la persona muestre interés real: pregunta precios, cómo
  empezar, si le sirve a su negocio, o pide hablar con alguien.
- Mandalo UNA vez. Si ya lo mandaste, no lo repitas en cada mensaje: si no
  agendó, seguí conversando y resolvele la duda que lo está frenando.
- No lo mandes de entrada ni a alguien que solo hizo una pregunta suelta.
  Contestá primero lo que preguntó; el link va después, cuando tenga sentido.
- Antes o junto con el link, preguntale el nombre y de qué negocio es.
- Es la persona la que agenda ahí, con los horarios libres que aparezcan. Vos no
  agendás ni confirmás horarios.`.trim();
}

/**
 * Texto de arranque para el panel.
 *
 * NO es un default que se aplique solo: si el campo `sobre_qlabs` está vacío el
 * agente no contesta, aunque el interruptor esté prendido. Esto es únicamente lo
 * que el botón "Usar un texto de arranque" pega en el formulario para que
 * alguien lo edite y decida. Sale de lo que dice la landing hoy.
 */
export const SOBRE_QLABS_ARRANQUE = `
Q Labs es una agencia digital de Costa Rica que trabaja con restaurantes y
hoteles. La idea es simple: el negocio es el que hace el trabajo, nosotros le
damos las herramientas para digitalizarlo y vender más.

Tres cosas hacemos:
Automatización con IA — reservas y mensajes atendidos las 24 horas sin que el
dueño ni su equipo tengan que estar encima.
Contenido y redes — que la presencia digital se vea tan bien como el servicio,
para atraer clientes de más calidad.
Web y ventas en línea — menú, reservas y pagos, para operar más ordenado.

También tenemos UGC·CRC, un marketplace donde negocios costarricenses contratan
creadores de contenido verificados. Está en qlabsmethod.com/ugc.
`.trim();

/** Lo mismo, para el campo de cómo lleva la conversación. */
export const GUION_ARRANQUE = `
Tu trabajo no es llenar una ficha: es que la persona sienta que del otro lado hay
alguien que entiende de negocios, y que termine agendando.

Si te escriben solo un saludo, saludá y abrí la puerta. Nada de arrancar
preguntando de qué negocio es, eso se siente formulario. Un "¡Hola! ¿En qué te
ayudo?" y esperá a que cuente.

Si te preguntan qué hacemos, contestá primero. Dos o tres frases, y recién
después preguntale de qué negocio es, diciéndole para qué querés saberlo: para no
hablarle de cosas que no le sirven.

La regla que no rompés nunca: no pedís nada sin haber dado algo antes.

Cuando ya sepás el rubro, averiguá qué lo trajo, pero dejalo hablar. Si te cuenta
un problema, respondé al problema antes de proponer nada.

Al contar lo que hacemos, hablá del resultado, no del nombre del servicio. El
nombre solo si te lo pregunta.

Cuando veas interés real, llevalo a la reunión. Ahí se ve el caso concreto y se
habla de números; por chat no.

En algún momento necesitás el nombre de la persona y de qué negocio es. No lo
pidas todo junto ni de entrada: pedilo cuando venga al caso.

Si te dice que solo está viendo, dejale claro que puede escribir cuando quiera y
cortá ahí. No insistas.
`.trim();

/** Tope de mensajes por número y por día. Ver hablaDemasiado(). */
export const MAX_MENSAJES_DIA = 20;

export type CerebroPublico = {
  nombre: string;
  sobreQlabs: string;
  guionPublico: string;
  linkAgenda: string;
};

/**
 * El prompt completo que lee McLovin cuando le escribe alguien de afuera.
 *
 * Está separado de responderPublico() para que el panel pueda mostrarlo tal
 * cual. Editar el cerebro a ciegas es adivinar: si alguien va a tunear cómo
 * habla el agente con potenciales clientes, tiene que poder leer exactamente lo
 * que el agente lee.
 */
export function armarCerebroPublico(cerebro: CerebroPublico): string {
  return [
    `Te llamás ${cerebro.nombre} y contestás el WhatsApp de Q Labs.`,
    REGLAS_PUBLICAS,
    `ESTO ES TODO LO QUE SABÉS DE Q LABS. No hay nada más:\n${cerebro.sobreQlabs.trim()}`,
    cerebro.guionPublico.trim() ? `CÓMO LLEVÁS LA CONVERSACIÓN\n${cerebro.guionPublico.trim()}` : "",
    reglasDeAgenda(cerebro.linkAgenda),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Lo que se le contesta a alguien de afuera.
 *
 * Devuelve null cuando no hay nada que decir —sin `sobreQlabs` no se contesta,
 * porque un agente sin información improvisa— y un texto de respaldo cuando
 * Gemini no responde. Ese respaldo no es opcional: la persona escribió y está
 * esperando, y quedarse callado es peor que un "ahorita te contestamos".
 */
export async function responderPublico(opciones: {
  cerebro: CerebroPublico;
  historial: TurnoPrevio[];
  mensaje: string;
}): Promise<string | null> {
  const { cerebro, historial, mensaje } = opciones;
  if (!cerebro.sobreQlabs.trim()) return null;

  const conversacion = historial
    .map((t) => `${t.quien === "agente" ? "VOS" : "PERSONA"}: ${t.texto}`)
    .join("\n");

  const texto = await pedirleAGemini(
    `${armarCerebroPublico(cerebro)}

${conversacion ? `LO QUE SE DIJERON ANTES:\n${conversacion}\n\n` : ""}MENSAJE NUEVO: ${mensaje}

Contestale. Devolvé SOLO el mensaje, sin comillas ni explicación.`,
    false
  );

  if (!texto) {
    return "Perdón, ahorita no te puedo contestar bien. Ya le queda el mensaje al equipo y te escriben.";
  }
  return texto.replace(/^["“]([\s\S]*)["”]$/, "$1").trim();
}

// ---------------------------------------------------------------
// Ritmo
// ---------------------------------------------------------------

/**
 * Cuánto esperar antes de mandar un mensaje.
 *
 * Contestar en tres segundos es lo primero que delata a un sistema, antes que
 * cualquier palabra: nadie lee, piensa y escribe tan rápido. Ninguna mejora del
 * guion compite con esto.
 *
 * La cuenta es deliberadamente más rápida que tipear de verdad —a 45 ms por
 * carácter, un mensaje de 120 caracteres sale en 7 segundos, cuando una persona
 * en el celular tardaría el triple—. No buscamos simular a alguien tecleando:
 * buscamos que no se sienta instantáneo. Del otro lado hay alguien esperando una
 * respuesta y hacerlo esperar de verdad es peor que sonar a bot.
 */
export function demoraDeEscritura(texto: string): number {
  return Math.min(1500 + texto.trim().length * 45, 8000);
}

/** Debajo de esto no se parte: un mensaje corto en dos pedazos se lee raro. */
const LARGO_PARA_PARTIR = 160;

/**
 * Parte una respuesta larga en dos mensajes, como escribe la gente.
 *
 * Solo corta donde el modelo ya dejó un renglón en blanco, así el corte cae en
 * un límite que tiene sentido y no a la mitad de una idea. Y como mucho en DOS:
 * tres o más mensajes seguidos dejan de leerse como alguien escribiendo y pasan
 * a leerse como spam.
 */
export function partirEnMensajes(texto: string): string[] {
  const limpio = texto.trim();
  if (limpio.length < LARGO_PARA_PARTIR) return [limpio];

  const corte = limpio.indexOf("\n\n");
  if (corte === -1) return [limpio];

  const primero = limpio.slice(0, corte).trim();
  const resto = limpio.slice(corte).trim();
  return primero && resto ? [primero, resto] : [limpio];
}

/**
 * ¿Este número ya escribió demasiado hoy?
 *
 * Del otro lado no hay una cuenta ni un opt-in: cualquiera con el número puede
 * escribir todas las veces que quiera, y cada mensaje cuesta un llamado a Gemini
 * y uno a Twilio. El tope corta el caso tonto (alguien probando el bot un rato)
 * sin necesitar bloqueos por número.
 */
export function hablaDemasiado(mensajesHoy: number): boolean {
  return mensajesHoy > MAX_MENSAJES_DIA;
}
